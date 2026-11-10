
-- Isolated Pixel Syntax DEMO payroll deductions and approval workflow.
CREATE TABLE IF NOT EXISTS public.demo_payroll_deductions (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id),
 employee_id varchar not null references public.employees(id),
 source_type text not null check(source_type in ('TRAFFIC_FINE','BIKE_MAINTENANCE','LOAN','MANUAL_ADJUSTMENT')),
 source_id text not null,
 vehicle_id varchar,
 custody_assignment_id varchar,
 incident_at timestamptz,
 original_due_month varchar not null check(original_due_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 due_month varchar not null check(due_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 amount_aed numeric(12,2) not null check(amount_aed>0),
 status text not null default 'REVIEW_REQUIRED' check(status in ('REVIEW_REQUIRED','APPROVED','POSTPONED','CANCELLED')),
 reason text not null,
 legal_basis text not null default 'PENDING_REVIEW',
 evidence_reference text,
 consent_reference text,
 created_by text not null,
 reviewed_by text,
 reviewed_at timestamptz,
 postponement_reason text,
 postponed_by text,
 postponed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,source_type,source_id)
);
CREATE INDEX IF NOT EXISTS idx_demo_deduction_month ON public.demo_payroll_deductions(tenant_id,due_month,status,employee_id);
CREATE INDEX IF NOT EXISTS idx_demo_deduction_employee ON public.demo_payroll_deductions(tenant_id,employee_id,created_at DESC);
ALTER TABLE public.demo_payroll_deductions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_payroll_deductions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.demo_payroll_deductions TO service_role;

CREATE TABLE IF NOT EXISTS public.demo_payroll_deduction_applications (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id),
 deduction_id text not null references public.demo_payroll_deductions(id),
 employee_id varchar not null references public.employees(id),
 period_month varchar not null,
 amount_aed numeric(12,2) not null check(amount_aed>0),
 created_at timestamptz not null default now(),
 unique(tenant_id,deduction_id),
 unique(tenant_id,period_month,deduction_id)
);
CREATE INDEX IF NOT EXISTS idx_demo_applied_deductions_period ON public.demo_payroll_deduction_applications(tenant_id,period_month,employee_id);
ALTER TABLE public.demo_payroll_deduction_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_payroll_deduction_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.demo_payroll_deduction_applications TO service_role;

CREATE TABLE IF NOT EXISTS public.demo_payroll_review_cycles (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id),
 period_month varchar not null check(period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 stage text not null default 'DRAFT' check(stage in (
 'DRAFT','PENDING_APPROVAL','APPROVED','VERIFIED','READY_TO_PROCESS')),
 calculated_by text,
 calculated_at timestamptz,
 submitted_by text,
 submitted_at timestamptz,
 approved_by text,
 approved_at timestamptz,
 verified_by text,
 verified_at timestamptz,
 ready_by text,
 ready_at timestamptz,
 gross_aed numeric(14,2) not null default 0,
 deductions_aed numeric(14,2) not null default 0,
 net_aed numeric(14,2) not null default 0,
 payment_processed boolean not null default false,
 payment_reference text,
 notes text,
 updated_at timestamptz not null default now(),
 unique(tenant_id,period_month)
);
ALTER TABLE public.demo_payroll_review_cycles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_payroll_review_cycles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.demo_payroll_review_cycles TO service_role;

CREATE TABLE IF NOT EXISTS public.demo_payroll_audit_events (
 id text primary key default gen_random_uuid()::text,
 tenant_id varchar not null references public.tenants(id),
 period_month varchar,
 deduction_id text,
 event_type text not null,
 actor_id text not null,
 previous_stage text,
 next_stage text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_demo_payroll_audit_period ON public.demo_payroll_audit_events(tenant_id,period_month,created_at DESC);
ALTER TABLE public.demo_payroll_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_payroll_audit_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.demo_payroll_audit_events TO service_role;

-- Link traffic fine to holder when violation actually occurred; NOT the current bike owner.
CREATE OR REPLACE FUNCTION public.demo_register_historical_vehicle_fine(
 p_tenant text,p_fine_id text,p_due_month text,p_actor text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE fine public.traffic_fines%ROWTYPE; holder record; matches integer;
BEGIN
 IF p_tenant<>'company_pixel_syntax' THEN RAISE EXCEPTION 'Demo tenant only'; END IF;
 IF p_due_month IS NULL OR p_due_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Invalid deduction month'; END IF;
 SELECT * INTO fine FROM public.traffic_fines
 WHERE tenant_id=p_tenant AND id=p_fine_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Traffic fine not found in demo'; END IF;
 IF fine.amount<=0 THEN RAISE EXCEPTION 'Fine amount must be positive'; END IF;
 SELECT count(*) INTO matches
 FROM public.vehicle_assignments a JOIN public.vehicles v
  ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
 WHERE a.tenant_id=p_tenant AND v.plate_number=fine.plate_number
 AND (a.assignment_date+a.assignment_time) <= (fine.violation_date AT TIME ZONE 'Asia/Dubai')
 AND (a.return_date IS NULL OR
     (a.return_date+coalesce(a.return_time,time '23:59:59')) >= (fine.violation_date AT TIME ZONE 'Asia/Dubai'));
 IF matches<>1 THEN RAISE EXCEPTION 'Fine cannot be allocated: % historical bike holders match; manual custody review required',matches; END IF;
 SELECT a.id as assignment_id,a.employee_id,a.vehicle_id INTO holder
 FROM public.vehicle_assignments a JOIN public.vehicles v
  ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
 WHERE a.tenant_id=p_tenant AND v.plate_number=fine.plate_number
 AND (a.assignment_date+a.assignment_time) <= (fine.violation_date AT TIME ZONE 'Asia/Dubai')
 AND (a.return_date IS NULL OR
     (a.return_date+coalesce(a.return_time,time '23:59:59')) >= (fine.violation_date AT TIME ZONE 'Asia/Dubai'))
 LIMIT 1;
 INSERT INTO public.demo_payroll_deductions
 (tenant_id,employee_id,source_type,source_id,vehicle_id,custody_assignment_id,
  incident_at,original_due_month,due_month,amount_aed,status,reason,created_by)
 VALUES (p_tenant,holder.employee_id,'TRAFFIC_FINE',fine.id,
  holder.vehicle_id,holder.assignment_id,fine.violation_date,p_due_month,p_due_month,
  fine.amount,'REVIEW_REQUIRED','Traffic fine candidate; requires liability evidence and deduction approval',p_actor)
 ON CONFLICT(tenant_id,source_type,source_id) DO NOTHING;
 UPDATE public.traffic_fines SET driver_id=holder.employee_id,
  allocation_status='ASSIGNED_TO_DRIVER',updated_at=now()
 WHERE tenant_id=p_tenant AND id=fine.id AND allocation_status IN ('UNALLOCATED','ASSIGNED_TO_DRIVER');
 RETURN jsonb_build_object('success',true,'employee_id',holder.employee_id,
  'vehicle_id',holder.vehicle_id,'historical_assignment_id',holder.assignment_id,
  'pending_human_review',true,'payment_deducted',false);
END $$;
REVOKE ALL ON FUNCTION public.demo_register_historical_vehicle_fine(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_register_historical_vehicle_fine(text,text,text,text) TO service_role;

-- A real reviewer must establish authorization before salary deduction.
CREATE OR REPLACE FUNCTION public.demo_review_or_postpone_deduction(
 p_tenant text,p_deduction_id text,p_action text,p_actor text,
 p_evidence text DEFAULT NULL,p_consent text DEFAULT NULL,p_reason text DEFAULT NULL,p_next_month text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.demo_payroll_deductions%ROWTYPE; review_stage text; target_month text;
BEGIN
 IF p_tenant<>'company_pixel_syntax' OR nullif(btrim(coalesce(p_actor,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO d FROM public.demo_payroll_deductions WHERE tenant_id=p_tenant AND id=p_deduction_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Deduction not found'; END IF;
 SELECT stage INTO review_stage FROM public.demo_payroll_review_cycles
  WHERE tenant_id=p_tenant AND period_month=d.due_month;
 IF review_stage IS NOT NULL AND review_stage<>'DRAFT' THEN RAISE EXCEPTION 'Payroll already submitted; reopen with audit first'; END IF;
 IF EXISTS(SELECT 1 FROM public.demo_payroll_deduction_applications app
  JOIN public.demo_payroll_review_cycles c ON c.tenant_id=app.tenant_id AND c.period_month=app.period_month
  WHERE app.tenant_id=p_tenant AND app.deduction_id=d.id AND c.stage<>'DRAFT')
 THEN RAISE EXCEPTION 'Previously reviewed salary deduction cannot be changed'; END IF;
 IF p_action='APPROVE' THEN
  IF d.status NOT IN ('REVIEW_REQUIRED','POSTPONED') THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF length(trim(coalesce(p_evidence,'')))<6 OR length(trim(coalesce(p_consent,'')))<6
  THEN RAISE EXCEPTION 'Evidence and legal/consent reference required before deduction'; END IF;
  UPDATE public.demo_payroll_deductions SET status='APPROVED',
    reviewed_by=p_actor,reviewed_at=now(),evidence_reference=p_evidence,consent_reference=p_consent,
    legal_basis='HUMAN_REVIEW_REQUIRED_FOR_LEGAL_COMPLIANCE',updated_at=now() WHERE id=d.id;
 ELSIF p_action='POSTPONE' THEN
  IF d.status NOT IN ('REVIEW_REQUIRED','APPROVED','POSTPONED') THEN RAISE EXCEPTION 'Deduction cannot be postponed'; END IF;
  target_month:=p_next_month;
  IF target_month IS NULL OR target_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     OR target_month<=d.due_month THEN RAISE EXCEPTION 'Choose a later due month'; END IF;
  UPDATE public.demo_payroll_deductions SET due_month=target_month,status='POSTPONED',
   postponement_reason=coalesce(nullif(p_reason,''),'Requested for later payroll'),
   postponed_by=p_actor,postponed_at=now(),updated_at=now() WHERE id=d.id;
  DELETE FROM public.demo_payroll_deduction_applications WHERE tenant_id=p_tenant
   AND deduction_id=d.id;
 ELSIF p_action='CANCEL' THEN
  IF length(trim(coalesce(p_reason,'')))<6 THEN RAISE EXCEPTION 'Cancellation reason required'; END IF;
  UPDATE public.demo_payroll_deductions SET status='CANCELLED',postponement_reason=p_reason,
    updated_at=now() WHERE id=d.id;
  DELETE FROM public.demo_payroll_deduction_applications WHERE tenant_id=p_tenant
   AND deduction_id=d.id;
 ELSE RAISE EXCEPTION 'Unknown deduction action'; END IF;
 INSERT INTO public.demo_payroll_audit_events(tenant_id,period_month,deduction_id,event_type,actor_id,details)
 VALUES(p_tenant,d.due_month,d.id,p_action,p_actor,
  jsonb_build_object('next_month',p_next_month,'reason',coalesce(p_reason,''),'evidence_reference',coalesce(p_evidence,'')));
 RETURN jsonb_build_object('success',true,'action',p_action,'deduction_id',d.id,'previous_month',d.due_month,
  'next_month',coalesce(target_month,d.due_month),'payment_processed',false);
END $$;
REVOKE ALL ON FUNCTION public.demo_review_or_postpone_deduction(text,text,text,text,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_review_or_postpone_deduction(text,text,text,text,text,text,text,text)
 TO service_role;
