
-- Pixel Syntax DEMO ONLY multi-project ERP, isolated from Allied production.
CREATE TABLE IF NOT EXISTS public.project_salary_settings (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id) on delete cascade,
 project_id varchar not null references public.projects(id) on delete cascade,
 pay_model varchar not null check(pay_model in ('FIXED_MONTHLY','PER_ORDER','DAILY_RATE')),
 rate_aed numeric(12,2) not null check(rate_aed>=0),
 currency varchar not null default 'AED' check(currency='AED'),
 is_demo boolean not null default true,
 rate_source text not null default 'SAMPLE_DEMO_NOT_OFFICIAL',
 effective_from date not null default '2026-01-01',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,project_id,effective_from)
);
CREATE INDEX IF NOT EXISTS idx_demo_pay_settings_project ON public.project_salary_settings(tenant_id,project_id,effective_from DESC);
ALTER TABLE public.project_salary_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_salary_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_salary_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.project_daily_earnings (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id) on delete cascade,
 employee_id varchar not null references public.employees(id) on delete cascade,
 project_id varchar not null references public.projects(id) on delete cascade,
 assignment_id varchar not null references public.employee_project_assignments(id) on delete cascade,
 work_date date not null,
 orders_count integer not null default 0 check(orders_count>=0 and orders_count<=1000),
 tips_aed numeric(12,2) not null default 0,
 incentives_aed numeric(12,2) not null default 0,
 deductions_aed numeric(12,2) not null default 0 check(deductions_aed>=0),
 source_type varchar not null default 'MANUAL_REVIEW'
  check(source_type in ('DEMO_SYNTHETIC','PROVIDER_IMPORT','MANUAL_REVIEW')),
 source_reference text,
 is_demo boolean not null default true,
 created_at timestamptz not null default now(),
 unique(tenant_id,employee_id,work_date),
 unique(tenant_id,assignment_id,work_date)
);
CREATE INDEX IF NOT EXISTS idx_project_daily_project_date ON public.project_daily_earnings(tenant_id,project_id,work_date);
ALTER TABLE public.project_daily_earnings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_daily_earnings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_daily_earnings TO service_role;

CREATE TABLE IF NOT EXISTS public.project_payroll_lines (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id) on delete cascade,
 period_month varchar not null check(period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 employee_id varchar not null references public.employees(id) on delete cascade,
 project_id varchar not null references public.projects(id) on delete cascade,
 assignment_id varchar not null references public.employee_project_assignments(id) on delete cascade,
 external_rider_id text,
 period_start date not null,
 period_end date not null,
 worked_days integer not null check(worked_days>=0 and worked_days<=31),
 orders_count integer not null default 0 check(orders_count>=0),
 pay_model varchar not null check(pay_model in ('FIXED_MONTHLY','PER_ORDER','DAILY_RATE')),
 rate_aed numeric(12,2) not null check(rate_aed>=0),
 base_salary_aed numeric(12,2) not null default 0,
 commission_aed numeric(12,2) not null default 0,
 tips_aed numeric(12,2) not null default 0,
 incentives_aed numeric(12,2) not null default 0,
 deductions_aed numeric(12,2) not null default 0,
 net_payable_aed numeric(12,2) not null default 0,
 calculation_source varchar not null default 'DEMO_SYNTHETIC',
 status varchar not null default 'DRAFT',
 calculated_at timestamptz not null default now(),
 unique(tenant_id,period_month,employee_id,assignment_id),
 check(period_start<=period_end)
);
CREATE INDEX IF NOT EXISTS idx_project_payroll_project_period ON public.project_payroll_lines(tenant_id,period_month,project_id,employee_id);
CREATE INDEX IF NOT EXISTS idx_project_payroll_emp_period ON public.project_payroll_lines(tenant_id,employee_id,period_month);
ALTER TABLE public.project_payroll_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_payroll_lines FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_payroll_lines TO service_role;

ALTER TABLE public.payroll_records
 ADD COLUMN IF NOT EXISTS payroll_source varchar not null default 'LEGACY';
CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_eid_tenant
 ON public.employees(tenant_id,emirates_id_number)
 WHERE emirates_id_number IS NOT NULL AND btrim(emirates_id_number)<>'';
CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_active_external_rider_code
 ON public.employee_project_assignments(tenant_id,project_id,lower(btrim(external_rider_id)))
 WHERE status='ACTIVE' AND external_rider_id IS NOT NULL AND btrim(external_rider_id)<>'';
CREATE INDEX IF NOT EXISTS idx_demo_assignment_dates
 ON public.employee_project_assignments(tenant_id,employee_id,assignment_start_date,assignment_end_date);

-- Block overlapping custody periods, and accidental overlapping project salary days.
CREATE OR REPLACE FUNCTION public.demo_validate_project_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE conflict_id text;
BEGIN
 IF NEW.assignment_end_date IS NOT NULL AND NEW.assignment_end_date<NEW.assignment_start_date THEN
  RAISE EXCEPTION 'Project unassignment date is before assignment date';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id),hashtext(NEW.employee_id));
 SELECT id INTO conflict_id FROM public.employee_project_assignments
 WHERE tenant_id=NEW.tenant_id AND employee_id=NEW.employee_id
  AND id<>NEW.id
  AND daterange(assignment_start_date,coalesce(assignment_end_date,'infinity'::date),'[]')
   && daterange(NEW.assignment_start_date,coalesce(NEW.assignment_end_date,'infinity'::date),'[]')
 LIMIT 1;
 IF conflict_id IS NOT NULL THEN
  RAISE EXCEPTION 'Employee already assigned to an overlapping project period (%)',conflict_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.demo_validate_project_assignment() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_demo_no_project_overlap ON public.employee_project_assignments;
CREATE TRIGGER trg_demo_no_project_overlap BEFORE INSERT OR UPDATE OF employee_id,tenant_id,assignment_start_date,assignment_end_date
 ON public.employee_project_assignments FOR EACH ROW
 EXECUTE FUNCTION public.demo_validate_project_assignment();

CREATE OR REPLACE FUNCTION public.demo_validate_daily_earnings()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.employee_project_assignments%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.employee_project_assignments
 WHERE id=NEW.assignment_id AND tenant_id=NEW.tenant_id;
 IF NOT FOUND OR a.employee_id<>NEW.employee_id OR a.project_id<>NEW.project_id OR
  NEW.work_date<a.assignment_start_date OR
  (a.assignment_end_date IS NOT NULL AND NEW.work_date>a.assignment_end_date) THEN
  RAISE EXCEPTION 'Daily earning does not belong to employee project assignment dates';
 END IF;
 IF EXISTS(SELECT 1 FROM public.project_payroll_lines l
  WHERE l.tenant_id=NEW.tenant_id AND l.employee_id=NEW.employee_id
  AND l.period_month=to_char(NEW.work_date,'YYYY-MM') AND l.status<>'DRAFT') THEN
  RAISE EXCEPTION 'Approved payroll period is locked; reopen with audit first';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.demo_validate_daily_earnings() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_demo_earnings_in_assignment ON public.project_daily_earnings;
CREATE TRIGGER trg_demo_earnings_in_assignment BEFORE INSERT OR UPDATE
 ON public.project_daily_earnings FOR EACH ROW
 EXECUTE FUNCTION public.demo_validate_daily_earnings();
