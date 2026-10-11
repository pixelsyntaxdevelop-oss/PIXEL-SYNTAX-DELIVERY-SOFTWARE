-- Provider cancellation is a single transaction; rider history is preserved.
ALTER TABLE public.sim_cards
  ADD COLUMN IF NOT EXISTS provider_return_date date,
  ADD COLUMN IF NOT EXISTS provider_return_reason text,
  ADD COLUMN IF NOT EXISTS provider_return_reference text,
  ADD COLUMN IF NOT EXISTS provider_returned_by text,
  ADD COLUMN IF NOT EXISTS provider_return_notes text;

CREATE OR REPLACE FUNCTION public.allied_return_sim_to_provider(
  p_tenant_id text, p_sim_id text, p_returned_by text, p_reason text,
  p_return_date date DEFAULT NULL, p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_auto_close boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp AS $$
DECLARE
  v_sim public.sim_cards%ROWTYPE;
  v_card_id text;
  v_holder text;
  v_locked_employee text;
  v_date date := coalesce(p_return_date, (now() AT TIME ZONE 'Asia/Dubai')::date);
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF nullif(trim(p_tenant_id),'') IS NULL OR nullif(trim(p_sim_id),'') IS NULL
    OR nullif(trim(p_returned_by),'') IS NULL OR length(trim(coalesce(p_reason,''))) < 2 THEN
    RAISE EXCEPTION 'Tenant, SIM, verified operator and cancellation reason are required';
  END IF;
  IF v_date > (now() AT TIME ZONE 'Asia/Dubai')::date THEN
    RAISE EXCEPTION 'Provider return date cannot be in the future';
  END IF;
  SELECT id,current_employee_id INTO v_card_id,v_holder FROM public.sim_cards
    WHERE tenant_id=p_tenant_id AND (id=p_sim_id OR mobile_number=p_sim_id);
  IF v_card_id IS NULL THEN RAISE EXCEPTION 'SIM card not found in this tenant'; END IF;
  -- Match assignment/return lock order so parallel custody operations cannot race.
  IF v_holder IS NOT NULL THEN
    SELECT id INTO v_locked_employee FROM public.employees
      WHERE tenant_id=p_tenant_id AND id=v_holder FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current SIM holder not found'; END IF;
  END IF;
  SELECT * INTO v_sim FROM public.sim_cards
    WHERE tenant_id=p_tenant_id AND id=v_card_id FOR UPDATE;
  IF NOT FOUND OR v_sim.current_employee_id IS DISTINCT FROM v_holder THEN
    RAISE EXCEPTION 'SIM custody changed; reload and try again';
  END IF;
  IF lower(coalesce(v_sim.status,'')) IN ('returned to provider','returned_to_provider') THEN
    RETURN jsonb_build_object('success',true,'sim',to_jsonb(v_sim),
      'message','SIM is already returned to provider.');
  END IF;
  IF v_holder IS NOT NULL THEN
    IF NOT coalesce(p_auto_close,false) THEN
      RAISE EXCEPTION 'Return this SIM from its employee first or enable auto-close';
    END IF;
    v_result := public.allied_return_sim_with_history(
      p_tenant_id, v_sim.id, trim(p_returned_by),
      'RETURN_TO_PROVIDER: ' || trim(p_reason), v_date, v_holder, p_notes);
    IF NOT coalesce((v_result->>'success')::boolean,false) THEN
      RAISE EXCEPTION 'Rider custody could not be closed; cancellation rolled back';
    END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM public.sim_assignments WHERE tenant_id=p_tenant_id
      AND sim_card_id=v_sim.id AND upper(status)='ACTIVE')
      OR EXISTS(SELECT 1 FROM public.employees WHERE tenant_id=p_tenant_id
        AND (current_sim_id=v_sim.id OR current_sim_number=v_sim.mobile_number)) THEN
      RAISE EXCEPTION 'SIM custody records disagree; resolve existing custody before provider return';
    END IF;
  END IF;
  UPDATE public.sim_cards SET
    status='Returned to Provider', service_status='Cancelled',
    current_employee_id=NULL, current_employee_name=NULL, current_employee_code=NULL,
    assigned_date=NULL, provider_return_date=v_date, provider_return_reason=trim(p_reason),
    provider_return_reference=nullif(trim(coalesce(p_reference,'')),''),
    provider_returned_by=trim(p_returned_by), provider_return_notes=nullif(trim(coalesce(p_notes,'')),''),
    updated_by=trim(p_returned_by), updated_at=v_now
    WHERE tenant_id=p_tenant_id AND id=v_sim.id RETURNING * INTO v_sim;
  IF NOT FOUND THEN RAISE EXCEPTION 'SIM cancellation was not saved'; END IF;
  INSERT INTO public.audit_logs
    (id,tenant_id,actor_name,actor_role,action,action_type,module,entity_type,entity_id,
     details,status,created_at,new_values)
  VALUES ('aud_sim_' || replace(gen_random_uuid()::text,'-',''),p_tenant_id,
    trim(p_returned_by),'ERP_USER','RETURN_SIM_TO_PROVIDER','RETURN','SIM_MANAGEMENT',
    'SIM_CARD',v_sim.id,trim(p_reason),'SUCCESS',v_now,
    jsonb_build_object('status','Returned to Provider','service_status','Cancelled',
      'return_date',v_date,'reference',p_reference,'returned_by',trim(p_returned_by)));
  RETURN jsonb_build_object('success',true,'sim',to_jsonb(v_sim),
    'message','SIM returned to provider. Cancellation saved and rider history preserved.');
END;
$$;
REVOKE ALL ON FUNCTION public.allied_return_sim_to_provider(text,text,text,text,date,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allied_return_sim_to_provider(text,text,text,text,date,text,text,boolean) TO service_role;
