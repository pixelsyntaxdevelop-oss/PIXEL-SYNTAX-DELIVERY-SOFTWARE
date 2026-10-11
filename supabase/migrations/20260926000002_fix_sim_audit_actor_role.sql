-- Follow-up to 20260926000001: the production audit_logs.actor_role column is NOT NULL.
-- The failed handover RPC rolled back completely; this only replaces the two function bodies.
-- ERP_USER denotes an authenticated ERP operator class; actor_name retains the actual signed-in staff name.
-- No existing employee, SIM, assignment or audit records are changed by this migration.
CREATE OR REPLACE FUNCTION public.allied_assign_sim_with_history(
  p_tenant_id text,
  p_employee_id text,
  p_sim_id text,
  p_assigned_by text,
  p_assigned_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_monthly_package_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_sim public.sim_cards%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_assigned_date date := COALESCE(p_assigned_date, (now() AT TIME ZONE 'Asia/Dubai')::date);
  v_assigned_at timestamptz;
  v_assignment_id text := 's_asgn_' || replace(gen_random_uuid()::text, '-', '');
  v_existing int;
BEGIN
  IF NULLIF(trim(p_tenant_id),'') IS NULL OR NULLIF(trim(p_employee_id),'') IS NULL
    OR NULLIF(trim(p_sim_id),'') IS NULL OR NULLIF(trim(p_assigned_by),'') IS NULL THEN
    RAISE EXCEPTION 'Tenant, employee, SIM and authenticated actor are required';
  END IF;
  IF p_monthly_package_amount IS NOT NULL AND p_monthly_package_amount < 0 THEN
    RAISE EXCEPTION 'SIM monthly package amount cannot be negative';
  END IF;
  IF v_assigned_date > (now() AT TIME ZONE 'Asia/Dubai')::date THEN
    RAISE EXCEPTION 'SIM assignment date cannot be in the future';
  END IF;
  -- Lock employee then card (the same order is used by the return function).
  SELECT * INTO v_emp FROM public.employees
    WHERE tenant_id = p_tenant_id AND (id = p_employee_id OR employee_code = p_employee_id)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in this tenant'; END IF;
  SELECT * INTO v_sim FROM public.sim_cards
    WHERE tenant_id = p_tenant_id AND (id = p_sim_id OR mobile_number = p_sim_id)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIM not found in this tenant'; END IF;
  IF v_emp.current_sim_id IS NOT NULL OR NULLIF(trim(coalesce(v_emp.current_sim_number,'')),'') IS NOT NULL THEN
    RAISE EXCEPTION 'Employee already has a SIM: return or resolve the existing custody first';
  END IF;
  IF v_sim.current_employee_id IS NOT NULL OR upper(coalesce(v_sim.status,'')) = 'ASSIGNED' THEN
    RAISE EXCEPTION 'SIM is already assigned: return or resolve its existing custody first';
  END IF;
  SELECT count(*) INTO v_existing FROM public.sim_assignments
    WHERE tenant_id = p_tenant_id AND status = 'ACTIVE'
      AND (employee_id = v_emp.id OR sim_card_id = v_sim.id);
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'An active SIM history record already exists: resolve it before assigning again';
  END IF;
  SELECT count(*) INTO v_existing FROM public.sim_cards
    WHERE tenant_id = p_tenant_id AND current_employee_id = v_emp.id;
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'Employee has another card assigned: return it first';
  END IF;
  v_assigned_at := (v_assigned_date::timestamp + interval '12 hours') AT TIME ZONE 'Asia/Dubai';

  INSERT INTO public.sim_assignments
    (id, tenant_id, sim_card_id, mobile_number, provider, employee_id, employee_name,
     assigned_at, assigned_date, status, assigned_by, notes, created_at)
  VALUES
    (v_assignment_id, p_tenant_id, v_sim.id, v_sim.mobile_number, v_sim.provider,
     v_emp.id, v_emp.full_name, v_assigned_at, v_assigned_date,
     'ACTIVE', trim(p_assigned_by), nullif(trim(coalesce(p_notes,'')),''), v_now);

  UPDATE public.sim_cards
    SET current_employee_id = v_emp.id, current_employee_name = v_emp.full_name,
        current_employee_code = v_emp.employee_code, assigned_date = v_assigned_date,
        assigned_by = trim(p_assigned_by), status = 'Assigned',
        monthly_package_amount = COALESCE(p_monthly_package_amount, v_sim.monthly_package_amount),
        updated_by = trim(p_assigned_by), updated_at = v_now
    WHERE id = v_sim.id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIM update failed; assignment rolled back'; END IF;

  UPDATE public.employees
    SET current_sim_id = v_sim.id, current_sim_number = v_sim.mobile_number,
        updated_by = trim(p_assigned_by), updated_at = v_now
    WHERE id = v_emp.id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee update failed; assignment rolled back'; END IF;

  INSERT INTO public.audit_logs
    (id, tenant_id, actor_name, actor_role, action, action_type, module,
     entity_type, entity_id, details, status, created_at, new_values)
  VALUES
    ('aud_sim_' || replace(gen_random_uuid()::text,'-',''), p_tenant_id, trim(p_assigned_by), 'ERP_USER',
     'ASSIGN_SIM', 'ASSIGN', 'SIM_MANAGEMENT', 'SIM_ASSIGNMENT', v_assignment_id,
     'SIM assigned to employee through authenticated ERP transaction', 'SUCCESS', v_now,
     jsonb_build_object('employee_id',v_emp.id,'sim_card_id',v_sim.id,
       'assigned_date',v_assigned_date,'assigned_by',trim(p_assigned_by)));

  RETURN jsonb_build_object('success',true,'assignment_id',v_assignment_id,
    'employee_id',v_emp.id,'sim_card_id',v_sim.id,'mobile_number',v_sim.mobile_number,
    'assigned_date',v_assigned_date,'assigned_by',trim(p_assigned_by));
END;
$$;

CREATE OR REPLACE FUNCTION public.allied_return_sim_with_history(
  p_tenant_id text,
  p_sim_id text,
  p_returned_by text,
  p_return_reason text,
  p_return_date date DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_sim public.sim_cards%ROWTYPE;
  v_assignment public.sim_assignments%ROWTYPE;
  v_card_id text;
  v_employee_id text;
  v_now timestamptz := clock_timestamp();
  v_return_date date := COALESCE(p_return_date, (now() AT TIME ZONE 'Asia/Dubai')::date);
  v_count int;
BEGIN
  IF NULLIF(trim(p_tenant_id),'') IS NULL OR NULLIF(trim(p_sim_id),'') IS NULL
     OR NULLIF(trim(p_returned_by),'') IS NULL OR NULLIF(trim(p_return_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Tenant, SIM, authenticated actor and return reason are required';
  END IF;
  IF v_return_date > (now() AT TIME ZONE 'Asia/Dubai')::date THEN
    RAISE EXCEPTION 'SIM return date cannot be in the future';
  END IF;
  -- Read custody identity first; take locks in employee->SIM order.
  SELECT id, current_employee_id INTO v_card_id, v_employee_id FROM public.sim_cards
    WHERE tenant_id = p_tenant_id AND (id = p_sim_id OR mobile_number = p_sim_id);
  IF v_card_id IS NULL OR v_employee_id IS NULL THEN
    RAISE EXCEPTION 'SIM has no verified current holder; cannot invent a return history record';
  END IF;
  SELECT * INTO v_emp FROM public.employees
    WHERE tenant_id = p_tenant_id AND id = v_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current SIM holder not found in this tenant'; END IF;
  SELECT * INTO v_sim FROM public.sim_cards
    WHERE tenant_id = p_tenant_id AND id = v_card_id FOR UPDATE;
  IF NOT FOUND OR v_sim.current_employee_id IS DISTINCT FROM v_emp.id THEN
    RAISE EXCEPTION 'SIM custody changed; reload and try again';
  END IF;
  IF p_employee_id IS NOT NULL AND p_employee_id <> v_emp.id AND p_employee_id <> v_emp.employee_code THEN
    RAISE EXCEPTION 'SIM is not assigned to the requested employee';
  END IF;
  IF v_emp.current_sim_id IS DISTINCT FROM v_sim.id THEN
    RAISE EXCEPTION 'Employee and SIM custody disagree; resolve mismatch before returning';
  END IF;

  SELECT count(*) INTO v_count FROM public.sim_assignments
    WHERE tenant_id = p_tenant_id AND sim_card_id = v_sim.id AND status = 'ACTIVE';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected one active SIM history record; found %, no records changed', v_count;
  END IF;
  SELECT * INTO v_assignment FROM public.sim_assignments
    WHERE tenant_id = p_tenant_id AND sim_card_id = v_sim.id AND status = 'ACTIVE'
    AND employee_id = v_emp.id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active SIM history belongs to a different employee; no records changed';
  END IF;
  IF v_return_date < COALESCE(v_assignment.assigned_date, (v_assignment.assigned_at AT TIME ZONE 'Asia/Dubai')::date) THEN
    RAISE EXCEPTION 'Return date cannot be earlier than assignment date';
  END IF;

  UPDATE public.sim_assignments
    SET status = 'RETURNED', returned_at = v_now, return_date = v_return_date,
        returned_by = trim(p_returned_by), returned_to = trim(p_returned_by),
        return_reason = trim(p_return_reason),
        notes = concat_ws(E'\n', nullif(notes,''), nullif(trim(coalesce(p_notes,'')),''))
    WHERE id = v_assignment.id AND tenant_id = p_tenant_id AND status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not close SIM history record; return rolled back'; END IF;

  UPDATE public.sim_cards
    SET status = 'Available', current_employee_id = NULL,
        current_employee_name = NULL, current_employee_code = NULL,
        assigned_date = NULL, updated_by = trim(p_returned_by), updated_at = v_now
    WHERE id = v_sim.id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not release SIM to inventory; return rolled back'; END IF;

  UPDATE public.employees
    SET current_sim_id = NULL, current_sim_number = NULL,
        updated_by = trim(p_returned_by), updated_at = v_now
    WHERE id = v_emp.id AND tenant_id = p_tenant_id AND current_sim_id = v_sim.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not release employee SIM pointer; return rolled back'; END IF;

  INSERT INTO public.audit_logs
    (id, tenant_id, actor_name, actor_role, action, action_type, module,
     entity_type, entity_id, details, status, created_at, old_values, new_values)
  VALUES
    ('aud_sim_' || replace(gen_random_uuid()::text,'-',''), p_tenant_id, trim(p_returned_by), 'ERP_USER',
     'RETURN_SIM', 'RETURN', 'SIM_MANAGEMENT', 'SIM_ASSIGNMENT', v_assignment.id,
     trim(p_return_reason), 'SUCCESS', v_now,
     jsonb_build_object('employee_id',v_emp.id,'sim_card_id',v_sim.id,'status','ACTIVE'),
     jsonb_build_object('employee_id',v_emp.id,'sim_card_id',v_sim.id,
       'status','RETURNED','return_date',v_return_date,'returned_by',trim(p_returned_by)));

  RETURN jsonb_build_object('success',true,'assignment_id',v_assignment.id,
    'employee_id',v_emp.id,'sim_card_id',v_sim.id,'mobile_number',v_sim.mobile_number,
    'status','RETURNED','return_date',v_return_date,
    'returned_by',trim(p_returned_by));
END;
$$;

REVOKE ALL ON FUNCTION public.allied_assign_sim_with_history(text,text,text,text,date,text,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allied_assign_sim_with_history(text,text,text,text,date,text,numeric)
  TO service_role;
REVOKE ALL ON FUNCTION public.allied_return_sim_with_history(text,text,text,text,date,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allied_return_sim_with_history(text,text,text,text,date,text,text)
  TO service_role;
