-- Additive, non-destructive SIM history correction for every employee.
-- Corrects ONLY an existing sim_assignments row. Audit insert and optional active-card
-- metadata sync run in one transaction; no status, employee, SIM custody or rows created/deleted.
CREATE OR REPLACE FUNCTION public.allied_correct_sim_assignment_history(
  p_tenant_id text,
  p_assignment_id text,
  p_editor_id text,
  p_editor_name text,
  p_reason text,
  p_assigned_date date,
  p_assigned_by text DEFAULT NULL,
  p_return_date date DEFAULT NULL,
  p_returned_by text DEFAULT NULL,
  p_return_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sim_assignments%ROWTYPE;
  v_saved public.sim_assignments%ROWTYPE;
  v_card public.sim_cards%ROWTYPE;
  v_original jsonb;
  v_assigned_by text;
  v_returned_by text;
  v_return_date date;
  v_return_reason text;
  v_notes text;
  v_assigned_at timestamptz;
  v_returned_at timestamptz;
  v_audit_id text := 'aud_sim_edit_' || replace(gen_random_uuid()::text, '-', '');
  v_now timestamptz := clock_timestamp();
BEGIN
  IF nullif(btrim(p_tenant_id), '') IS NULL OR nullif(btrim(p_assignment_id), '') IS NULL
     OR nullif(btrim(p_editor_id), '') IS NULL OR nullif(btrim(p_editor_name), '') IS NULL
     OR nullif(btrim(p_reason), '') IS NULL OR p_assigned_date IS NULL THEN
    RAISE EXCEPTION 'Tenant, existing assignment, signed-in editor, correction reason and assignment date are required';
  END IF;
  IF length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Correction reason is too long';
  END IF;
  IF p_assigned_date > (now() AT TIME ZONE 'Asia/Dubai')::date THEN
    RAISE EXCEPTION 'Assignment date cannot be in the future';
  END IF;
  IF p_assigned_date < date '2000-01-01' THEN
    RAISE EXCEPTION 'Assignment date is outside the valid range';
  END IF;

  -- Verify the supplied operator identity against a tenant-scoped profile.
  -- Service role may call this function; anon/authenticated cannot.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE tenant_id = p_tenant_id
      AND (id::text = p_editor_id OR auth_user_id::text = p_editor_id)
      AND btrim(full_name) = btrim(p_editor_name)
  ) THEN
    RAISE EXCEPTION 'Signed-in editor could not be verified for this tenant';
  END IF;

  SELECT * INTO v_row
  FROM public.sim_assignments
  WHERE tenant_id = p_tenant_id AND id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SIM assignment record not found for this tenant';
  END IF;
  IF upper(coalesce(v_row.status, '')) NOT IN ('ACTIVE','ASSIGNED','RETURNED') THEN
    RAISE EXCEPTION 'History corrections for status % require dedicated review', v_row.status;
  END IF;

  -- The historical assigned_by may be a real staff UUID (legacy). Resolve it
  -- from profiles, but never assume the editor was the original assigner.
  v_assigned_by := v_row.assigned_by;
  IF nullif(btrim(coalesce(p_assigned_by, '')), '') IS NOT NULL THEN
    SELECT full_name INTO v_assigned_by
    FROM public.profiles
    WHERE tenant_id = p_tenant_id AND
      (id::text = btrim(p_assigned_by)
       OR lower(btrim(full_name)) = lower(btrim(p_assigned_by)))
    ORDER BY (id::text = btrim(p_assigned_by)) DESC
    LIMIT 1;
    IF v_assigned_by IS NULL THEN
      IF btrim(p_assigned_by) = btrim(v_row.assigned_by) THEN
        v_assigned_by := v_row.assigned_by; -- Preserve an unverified legacy label.
      ELSE
        RAISE EXCEPTION 'Assigned By must match a verified staff profile; choose the actual assigner';
      END IF;
    END IF;
  END IF;

  v_returned_by := v_row.returned_by;
  v_return_date := coalesce(v_row.return_date, (v_row.returned_at AT TIME ZONE 'Asia/Dubai')::date);
  v_return_reason := v_row.return_reason;
  v_notes := v_row.notes;

  IF upper(v_row.status) IN ('ACTIVE','ASSIGNED') THEN
    IF p_return_date IS NOT NULL OR nullif(btrim(coalesce(p_returned_by, '')), '') IS NOT NULL
       OR p_return_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Active assignment cannot be returned through history edit. Use Return SIM';
    END IF;
  ELSE
    IF p_return_date IS NOT NULL THEN v_return_date := p_return_date; END IF;
    IF nullif(btrim(coalesce(p_returned_by, '')), '') IS NOT NULL THEN
      SELECT full_name INTO v_returned_by
      FROM public.profiles
      WHERE tenant_id = p_tenant_id AND
        (id::text = btrim(p_returned_by)
         OR lower(btrim(full_name)) = lower(btrim(p_returned_by)))
      ORDER BY (id::text = btrim(p_returned_by)) DESC
      LIMIT 1;
      IF v_returned_by IS NULL THEN
        IF btrim(p_returned_by) = btrim(coalesce(v_row.returned_by, '')) THEN
          v_returned_by := v_row.returned_by;
        ELSE
          RAISE EXCEPTION 'Returned By must match a verified staff profile';
        END IF;
      END IF;
    END IF;
    IF p_return_reason IS NOT NULL THEN
      v_return_reason := nullif(btrim(p_return_reason), '');
    END IF;
  END IF;

  IF v_return_date IS NOT NULL AND v_return_date < p_assigned_date THEN
    RAISE EXCEPTION 'Return date cannot precede assignment date';
  END IF;
  IF v_return_date IS NOT NULL AND v_return_date > (now() AT TIME ZONE 'Asia/Dubai')::date THEN
    RAISE EXCEPTION 'Return date cannot be in the future';
  END IF;
  IF p_notes IS NOT NULL THEN v_notes := nullif(btrim(p_notes), ''); END IF;

  -- Keep actual event timestamps consistent with corrected dates, retaining
  -- the existing Dubai-local time-of-day when the date changes.
  v_assigned_at := v_row.assigned_at;
  IF p_assigned_date IS DISTINCT FROM coalesce(v_row.assigned_date,
      (v_row.assigned_at AT TIME ZONE 'Asia/Dubai')::date) THEN
    v_assigned_at := (p_assigned_date
      + (v_row.assigned_at AT TIME ZONE 'Asia/Dubai')::time)
      AT TIME ZONE 'Asia/Dubai';
  END IF;
  v_returned_at := v_row.returned_at;
  IF upper(v_row.status) = 'RETURNED' AND v_return_date IS NOT NULL
     AND v_return_date IS DISTINCT FROM coalesce(v_row.return_date,
       (v_row.returned_at AT TIME ZONE 'Asia/Dubai')::date) THEN
    v_returned_at := (v_return_date
      + coalesce((v_row.returned_at AT TIME ZONE 'Asia/Dubai')::time, time '18:00'))
      AT TIME ZONE 'Asia/Dubai';
  END IF;

  -- Updating an active history date also updates only the matching current card's
  -- descriptive fields, never its owner, status or availability.
  IF upper(v_row.status) IN ('ACTIVE','ASSIGNED') THEN
    SELECT * INTO v_card FROM public.sim_cards
      WHERE tenant_id = p_tenant_id AND id = v_row.sim_card_id FOR UPDATE;
    IF NOT FOUND OR v_card.current_employee_id IS DISTINCT FROM v_row.employee_id THEN
      RAISE EXCEPTION 'SIM custody conflict: history not changed; verify the active card holder first';
    END IF;
  END IF;

  v_original := jsonb_build_object(
    'assigned_date', v_row.assigned_date, 'assigned_at', v_row.assigned_at,
    'return_date', v_row.return_date, 'returned_at', v_row.returned_at,
    'assigned_by', v_row.assigned_by, 'returned_by', v_row.returned_by,
    'return_reason', v_row.return_reason, 'notes', v_row.notes,
    'status', v_row.status, 'employee_id', v_row.employee_id,
    'sim_card_id', v_row.sim_card_id
  );

  UPDATE public.sim_assignments
  SET assigned_date = p_assigned_date, assigned_at = v_assigned_at,
      assigned_by = v_assigned_by,
      return_date = CASE WHEN upper(v_row.status) = 'RETURNED'
                    THEN v_return_date ELSE v_row.return_date END,
      returned_at = CASE WHEN upper(v_row.status) = 'RETURNED'
                    THEN v_returned_at ELSE v_row.returned_at END,
      returned_by = CASE WHEN upper(v_row.status) = 'RETURNED'
                    THEN v_returned_by ELSE v_row.returned_by END,
      return_reason = CASE WHEN upper(v_row.status) = 'RETURNED'
                    THEN v_return_reason ELSE v_row.return_reason END,
      notes = v_notes
  WHERE tenant_id = p_tenant_id AND id = p_assignment_id
  RETURNING * INTO v_saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'History update failed; transaction rolled back'; END IF;

  IF upper(v_row.status) IN ('ACTIVE','ASSIGNED') THEN
    UPDATE public.sim_cards
    SET assigned_date = p_assigned_date, assigned_by = v_assigned_by,
        updated_at = v_now, updated_by = p_editor_name
    WHERE tenant_id = p_tenant_id AND id = v_row.sim_card_id
      AND current_employee_id = v_row.employee_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active card metadata sync failed; history rolled back'; END IF;
  END IF;

  INSERT INTO public.audit_logs
    (id, tenant_id, user_id, actor_name, actor_role, action, action_type,
     module, entity_type, entity_id, old_values, new_values, details, status, created_at)
  VALUES
    (v_audit_id, p_tenant_id, p_editor_id, p_editor_name, 'ERP_USER',
     'CORRECT_SIM_ASSIGNMENT_HISTORY', 'UPDATE', 'SIM_MANAGEMENT',
     'SIM_ASSIGNMENT', p_assignment_id, v_original,
     jsonb_build_object(
       'assigned_date', v_saved.assigned_date, 'assigned_at', v_saved.assigned_at,
       'return_date', v_saved.return_date, 'returned_at', v_saved.returned_at,
       'assigned_by', v_saved.assigned_by, 'returned_by', v_saved.returned_by,
       'return_reason', v_saved.return_reason, 'notes', v_saved.notes,
       'status', v_saved.status, 'employee_id', v_saved.employee_id,
       'sim_card_id', v_saved.sim_card_id
     ), btrim(p_reason), 'SUCCESS', v_now);

  RETURN jsonb_build_object(
    'success', true,
    'assignment', to_jsonb(v_saved),
    'auditLogId', v_audit_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.allied_correct_sim_assignment_history(
  text,text,text,text,text,date,text,date,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allied_correct_sim_assignment_history(
  text,text,text,text,text,date,text,date,text,text,text
) TO service_role;
