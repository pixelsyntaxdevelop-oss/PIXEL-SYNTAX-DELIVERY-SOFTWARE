-- Demo-only integrity migration. Apply to Pixel Syntax Delivery Demo database.
-- Independently applied and verified on project fevwkppueiwfokslwqji.
-- Do not run on Allied production without a separate compatibility review.

CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_employee_code_tenant
 ON public.employees(tenant_id, employee_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_vehicle_active_vehicle
 ON public.vehicle_assignments(tenant_id, vehicle_id)
 WHERE assignment_status = 'ACTIVE' AND return_date IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_vehicle_active_employee
 ON public.vehicle_assignments(tenant_id, employee_id)
 WHERE assignment_status = 'ACTIVE' AND return_date IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_payroll_employee_month
 ON public.payroll_records(tenant_id,employee_id,period_month);
CREATE INDEX IF NOT EXISTS idx_demo_payroll_tenant_period
 ON public.payroll_records(tenant_id,period_month,status);
CREATE INDEX IF NOT EXISTS idx_demo_status_history_employee
 ON public.employee_status_history(tenant_id,employee_id,effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_demo_employee_timeline
 ON public.employee_timeline_events(tenant_id,employee_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.demo_record_employee_status_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_time timestamptz := clock_timestamp();
BEGIN
 IF TG_OP = 'INSERT' THEN
   INSERT INTO public.employee_status_history
     (id,tenant_id,employee_id,status,reason,effective_from,notes,changed_by)
   VALUES
     (gen_random_uuid()::text,NEW.tenant_id,NEW.id,NEW.current_status,
      NEW.status_reason,v_time,'Initial employee status',
      COALESCE(NEW.created_by,'System'));
   INSERT INTO public.employee_timeline_events
     (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by)
   VALUES
     (gen_random_uuid()::text,NEW.tenant_id,NEW.id,'CREATED','EMPLOYEE',
      'Employee profile created',NEW.full_name,COALESCE(NEW.created_by,'System'));
 ELSIF NEW.current_status IS DISTINCT FROM OLD.current_status THEN
   UPDATE public.employee_status_history SET effective_to=v_time
    WHERE tenant_id=NEW.tenant_id AND employee_id=NEW.id AND effective_to IS NULL;
   INSERT INTO public.employee_status_history
     (id,tenant_id,employee_id,status,reason,effective_from,notes,changed_by)
   VALUES
     (gen_random_uuid()::text,NEW.tenant_id,NEW.id,NEW.current_status,
      NEW.status_reason,v_time,'Changed from ' || COALESCE(OLD.current_status,'(none)'),
      COALESCE(NEW.updated_by,'System'));
   INSERT INTO public.employee_timeline_events
     (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by)
   VALUES
     (gen_random_uuid()::text,NEW.tenant_id,NEW.id,'STATUS_CHANGE','EMPLOYEE',
      'Employee status changed',
      COALESCE(OLD.current_status,'(none)')||' → '||NEW.current_status,
      COALESCE(NEW.updated_by,'System'));
 END IF;
 RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.demo_record_employee_status_history()
 FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_demo_employee_status_history ON public.employees;
CREATE TRIGGER trg_demo_employee_status_history
 AFTER INSERT OR UPDATE OF current_status ON public.employees
 FOR EACH ROW EXECUTE FUNCTION public.demo_record_employee_status_history();
