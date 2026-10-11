-- Add an independent telecom line state. Existing custody and employee rows remain unchanged.
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS service_status text;
ALTER TABLE public.sim_cards ADD CONSTRAINT sim_cards_service_status_valid
  CHECK (service_status IS NULL OR service_status IN ('Active','Inactive','Suspended','Cancelled','Lost'));

CREATE OR REPLACE FUNCTION public.allied_set_sim_service_status(
  p_tenant_id text, p_sim_id text, p_editor_id text, p_editor_name text,
  p_new_status text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_sim public.sim_cards%ROWTYPE;
  v_old_status text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF nullif(btrim(coalesce(p_tenant_id,'')), '') IS NULL OR nullif(btrim(coalesce(p_sim_id,'')), '') IS NULL
    OR nullif(btrim(coalesce(p_editor_id,'')), '') IS NULL OR nullif(btrim(coalesce(p_editor_name,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Tenant, SIM and verified operator are required';
  END IF;
  IF p_new_status NOT IN ('Active','Inactive','Suspended','Cancelled') THEN
    RAISE EXCEPTION 'Choose Active, Inactive, Suspended or Cancelled';
  END IF;
  IF length(btrim(coalesce(p_reason,''))) < 2 OR length(p_reason) > 1500 THEN
    RAISE EXCEPTION 'A service status reason (2–1500 characters) is required';
  END IF;
  SELECT * INTO v_sim FROM public.sim_cards
    WHERE tenant_id=p_tenant_id AND id=p_sim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIM not found for this tenant'; END IF;
  v_old_status := coalesce(v_sim.service_status,
    CASE WHEN v_sim.status='Inactive' THEN 'Inactive'
         WHEN v_sim.status='Lost' THEN 'Lost' ELSE 'Active' END);
  IF v_old_status=p_new_status THEN
    RETURN jsonb_build_object('success',true,'service_status',v_old_status,'unchanged',true);
  END IF;
  UPDATE public.sim_cards SET service_status=p_new_status,
    status=CASE WHEN v_sim.status='Inactive' AND p_new_status='Active' AND v_sim.current_employee_id IS NULL THEN 'Available' ELSE v_sim.status END,
    updated_by=btrim(p_editor_name),updated_at=v_now
    WHERE tenant_id=p_tenant_id AND id=p_sim_id;
  INSERT INTO public.audit_logs
    (id,tenant_id,user_id,actor_name,actor_role,action,action_type,module,
     entity_type,entity_id,old_values,new_values,details,status,created_at)
  VALUES
    ('aud_sim_service_' || replace(gen_random_uuid()::text,'-',''),p_tenant_id,p_editor_id,
     btrim(p_editor_name),'ERP_USER','CHANGE_SIM_SERVICE_STATUS','UPDATE',
     'SIM_MANAGEMENT','SIM_CARD',p_sim_id,
     jsonb_build_object('service_status',v_old_status),
     jsonb_build_object('service_status',p_new_status),
     'Service status changed: ' || btrim(p_reason),'SUCCESS',v_now);
  RETURN jsonb_build_object('success',true,'service_status',p_new_status,'previous_status',v_old_status);
END;
$$;
REVOKE ALL ON FUNCTION public.allied_set_sim_service_status(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allied_set_sim_service_status(text,text,text,text,text,text) TO service_role;

-- Assignment checks both physical inventory and telecom service inside the locked transaction.
CREATE OR REPLACE FUNCTION public.allied_assign_sim_with_history(p_tenant_id text, p_employee_id text, p_sim_id text, p_assigned_by text, p_assigned_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_monthly_package_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF upper(coalesce(v_sim.status,'')) <> 'AVAILABLE' OR upper(coalesce(v_sim.service_status, CASE WHEN upper(coalesce(v_sim.status,'')) = 'INACTIVE' THEN 'Inactive' ELSE 'Active' END)) <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Only an Available SIM with Active service can be assigned';
  END IF;
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
$function$
;

-- A verified loss also marks the service line Lost; existing loss records use the read fallback.
CREATE OR REPLACE FUNCTION public.allied_mark_sim_lost_atomic(p_tenant_id text, p_sim_id text, p_editor_id text, p_editor_name text, p_loss_date date, p_reason text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sim public.sim_cards%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_asgn public.sim_assignments%ROWTYPE;
  v_holder_id text;
  v_pointer_count int;
  v_active_count int;
  v_now timestamptz := clock_timestamp();
  v_day date := (clock_timestamp() AT TIME ZONE 'Asia/Dubai')::date;
  v_audit_id text := 'aud_sim_lost_' || replace(gen_random_uuid()::text, '-', '');
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_notes text := nullif(btrim(coalesce(p_notes,'')), '');
  v_was_legacy_pointer boolean := false;
BEGIN
  IF nullif(btrim(coalesce(p_tenant_id,'')), '') IS NULL
    OR nullif(btrim(coalesce(p_sim_id,'')), '') IS NULL
    OR nullif(btrim(coalesce(p_editor_id,'')), '') IS NULL
    OR nullif(btrim(coalesce(p_editor_name,'')), '') IS NULL
    OR v_reason IS NULL THEN
    RAISE EXCEPTION 'Tenant, existing SIM, verified staff and loss reason are required';
  END IF;
  IF length(v_reason) > 1500 THEN RAISE EXCEPTION 'Loss reason is too long'; END IF;
  IF p_loss_date IS NULL OR p_loss_date > v_day OR p_loss_date < date '2000-01-01' THEN
    RAISE EXCEPTION 'Choose a valid actual loss date (not in the future)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE tenant_id=p_tenant_id
      AND (id::text=p_editor_id OR auth_user_id::text=p_editor_id)
      AND btrim(full_name)=btrim(p_editor_name)
  ) THEN
    RAISE EXCEPTION 'Signed-in staff profile could not be verified';
  END IF;

  -- Exact existing card only: never infer a target from a free-typed number.
  SELECT * INTO v_sim FROM public.sim_cards
  WHERE tenant_id=p_tenant_id AND id=p_sim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIM card not found for this tenant'; END IF;
  IF upper(coalesce(v_sim.status,''))='LOST' THEN
    RAISE EXCEPTION 'This SIM is already marked as Lost; refresh the list';
  END IF;
  IF upper(coalesce(v_sim.status,'')) IN ('CANCELLED','RETURNED TO PROVIDER','ARCHIVED') THEN
    RAISE EXCEPTION 'SIM is already out of inventory; review status before marking lost';
  END IF;

  -- An older employee import may have a live SIM pointer even when the card is
  -- Available and no sim_assignments row was ever created. Resolve this precisely.
  SELECT count(*) INTO v_pointer_count FROM public.employees e
  WHERE e.tenant_id=p_tenant_id AND (
    e.current_sim_id=v_sim.id OR
    regexp_replace(coalesce(e.current_sim_number,''),'[^0-9]','','g')=
      regexp_replace(v_sim.mobile_number,'[^0-9]','','g')
  );
  IF v_pointer_count > 1 THEN
    RAISE EXCEPTION 'Multiple employees hold this SIM pointer; reconcile before reporting lost';
  END IF;
  IF v_pointer_count=1 THEN
    SELECT * INTO v_emp FROM public.employees e
    WHERE e.tenant_id=p_tenant_id AND (
      e.current_sim_id=v_sim.id OR
      regexp_replace(coalesce(e.current_sim_number,''),'[^0-9]','','g')=
        regexp_replace(v_sim.mobile_number,'[^0-9]','','g')
    ) FOR UPDATE;
    v_holder_id := v_emp.id;
  END IF;

  IF v_sim.current_employee_id IS NOT NULL THEN
    IF v_holder_id IS NOT NULL AND v_sim.current_employee_id <> v_holder_id THEN
      RAISE EXCEPTION 'SIM card and employee pointers conflict; loss was not recorded';
    END IF;
    IF v_holder_id IS NULL THEN
      SELECT * INTO v_emp FROM public.employees
      WHERE id=v_sim.current_employee_id AND tenant_id=p_tenant_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SIM card holds an unknown employee; verify custody first';
      END IF;
      v_holder_id := v_emp.id;
    END IF;
  END IF;

  SELECT count(*) INTO v_active_count FROM public.sim_assignments
  WHERE tenant_id=p_tenant_id AND sim_card_id=v_sim.id
    AND upper(status) IN ('ACTIVE','ASSIGNED');
  IF v_active_count > 1 THEN
    RAISE EXCEPTION 'Multiple active SIM handovers; no history or status was changed';
  END IF;
  IF v_active_count=1 THEN
    SELECT * INTO v_asgn FROM public.sim_assignments
    WHERE tenant_id=p_tenant_id AND sim_card_id=v_sim.id
      AND upper(status) IN ('ACTIVE','ASSIGNED')
    FOR UPDATE;
    IF v_holder_id IS NOT NULL AND v_holder_id <> v_asgn.employee_id THEN
      RAISE EXCEPTION 'Active SIM assignment belongs to another rider; no changes made';
    END IF;
    IF v_holder_id IS NULL THEN
      SELECT * INTO v_emp FROM public.employees
      WHERE tenant_id=p_tenant_id AND id=v_asgn.employee_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Active SIM assignment refers to a missing employee; no changes made';
      END IF;
      v_holder_id := v_emp.id;
    END IF;
    IF p_loss_date < coalesce(v_asgn.assigned_date,
        (v_asgn.assigned_at AT TIME ZONE 'Asia/Dubai')::date) THEN
      RAISE EXCEPTION 'Loss date cannot precede verified SIM assignment date';
    END IF;
    UPDATE public.sim_assignments SET
      status='LOST',returned_at=v_now,return_date=p_loss_date,
      returned_by=btrim(p_editor_name),returned_to=btrim(p_editor_name),
      return_reason='LOST: '||v_reason,
      notes=concat_ws(E'\n',nullif(notes,''),v_notes)
    WHERE tenant_id=p_tenant_id AND id=v_asgn.id
      AND upper(status) IN ('ACTIVE','ASSIGNED');
    IF NOT FOUND THEN RAISE EXCEPTION 'SIM handover changed; transaction cancelled'; END IF;
  ELSE
    v_was_legacy_pointer := v_pointer_count=1;
    -- No history row exists: do NOT fabricate an assignment for this SIM.
  END IF;

  IF v_holder_id IS NOT NULL THEN
    UPDATE public.employees SET
      current_sim_id=NULL,current_sim_number=NULL,
      updated_at=v_now,updated_by=btrim(p_editor_name)
    WHERE tenant_id=p_tenant_id AND id=v_holder_id
      AND (
        current_sim_id=v_sim.id OR
        regexp_replace(coalesce(current_sim_number,''),'[^0-9]','','g')=
          regexp_replace(v_sim.mobile_number,'[^0-9]','','g')
      );
    -- Duty/employment status never changes automatically on SIM loss.
  END IF;

  UPDATE public.sim_cards SET
    status='Lost',service_status='Lost',current_employee_id=NULL,current_employee_name=NULL,
    current_employee_code=NULL,assigned_date=NULL,assigned_by=NULL,
    notes=concat_ws(E'\n',nullif(notes,''),
      'Reported LOST ('||p_loss_date||'): '||v_reason,
      CASE WHEN v_was_legacy_pointer THEN
        'Legacy employee pointer existed without a saved assignment record; no history invented.'
      END,v_notes),
    updated_at=v_now,updated_by=btrim(p_editor_name)
  WHERE tenant_id=p_tenant_id AND id=v_sim.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not mark SIM Lost; transaction rolled back'; END IF;

  INSERT INTO public.audit_logs(
    id,tenant_id,user_id,actor_name,actor_role,action,action_type,module,
    entity_type,entity_id,old_values,new_values,details,status,created_at
  ) VALUES (
    v_audit_id,p_tenant_id,p_editor_id,btrim(p_editor_name),'ERP_USER',
    'MARK_SIM_LOST','UPDATE','SIM_MANAGEMENT','SIM_CARD',v_sim.id,
    jsonb_build_object('card_status',v_sim.status,'card_holder',v_sim.current_employee_id,
      'verified_employee_id',v_holder_id,'active_assignments',v_active_count),
    jsonb_build_object('card_status','Lost','card_holder',NULL,
      'employee_pointer_cleared',v_holder_id,'closed_assignment_id',
      CASE WHEN v_active_count=1 THEN v_asgn.id ELSE NULL END,
      'loss_date',p_loss_date,'reason',v_reason,
      'legacy_pointer_without_history',v_was_legacy_pointer),
    'Reported lost. Reason: '||v_reason||CASE WHEN v_notes IS NOT NULL THEN ' | Notes: '||v_notes ELSE '' END,
    'SUCCESS',v_now
  );
  RETURN jsonb_build_object(
    'success',true,'sim_id',v_sim.id,'status','Lost',
    'employee_id',v_holder_id,
    'closed_assignment_id',CASE WHEN v_active_count=1 THEN v_asgn.id ELSE NULL END,
    'legacy_pointer_without_history',v_was_legacy_pointer,
    'reported_by',btrim(p_editor_name),'loss_date',p_loss_date,
    'auditLogId',v_audit_id
  );
END;
$function$
;
