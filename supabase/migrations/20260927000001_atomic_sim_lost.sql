-- All-employee SIM loss workflow. Adds a service-role-only function; NO existing records
-- are changed merely by applying this migration. Runtime transactions verify ownership,
-- close only a real active handover, preserve old audit evidence and never invent history.
CREATE OR REPLACE FUNCTION public.allied_mark_sim_lost_atomic(
  p_tenant_id text, p_sim_id text, p_editor_id text, p_editor_name text,
  p_loss_date date, p_reason text, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
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
    status='Lost',current_employee_id=NULL,current_employee_name=NULL,
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
$$;

REVOKE ALL ON FUNCTION public.allied_mark_sim_lost_atomic(
  text,text,text,text,date,text,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allied_mark_sim_lost_atomic(
  text,text,text,text,date,text,text
) TO service_role;
