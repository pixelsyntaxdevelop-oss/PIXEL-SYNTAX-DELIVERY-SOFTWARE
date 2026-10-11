-- Non-destructive: permit Al Ain in the saved physical location of a bike.
-- Al Ain is a city within Abu Dhabi emirate, not a vehicle plate registration emirate.
-- Only replaces the existing tenant-scoped, authenticated, audited location RPC.
-- Does not modify any vehicle or employee records.
CREATE OR REPLACE FUNCTION public.allied_set_vehicle_location(
  p_tenant_id text,
  p_vehicle_id text,
  p_location_state text,
  p_actor_id text,
  p_actor_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_location text := NULLIF(BTRIM(COALESCE(p_location_state,'')),'');
  v_actor text;
  v_audit_id text := 'aud_vstate_' || replace(gen_random_uuid()::text,'-','');
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_tenant_id,'')),'') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_vehicle_id,'')),'') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_actor_id,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Tenant, bike and authenticated editor are required';
  END IF;
  IF v_location IS NOT NULL AND v_location NOT IN
     ('Dubai','Abu Dhabi','Al Ain','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain') THEN
    RAISE EXCEPTION 'Select a valid UAE state or city for the bike location';
  END IF;
  SELECT full_name INTO v_actor FROM public.profiles
    WHERE tenant_id=p_tenant_id
      AND (id::text=p_actor_id OR auth_user_id::text=p_actor_id)
      AND BTRIM(full_name)=BTRIM(p_actor_name)
    LIMIT 1;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Could not verify signed-in fleet operator';
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles
    WHERE tenant_id=p_tenant_id AND id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bike not found in your company'; END IF;
  IF v_vehicle.location_state IS NOT DISTINCT FROM v_location THEN
    RETURN jsonb_build_object('success',true,'vehicle_id',v_vehicle.id,
      'location_state',v_location,'unchanged',true);
  END IF;
  UPDATE public.vehicles SET location_state=v_location,
    updated_by=v_actor,updated_at=clock_timestamp()
    WHERE id=v_vehicle.id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bike location update failed'; END IF;
  INSERT INTO public.audit_logs
    (id,tenant_id,user_id,actor_name,actor_role,action,action_type,module,
      entity_type,entity_id,old_values,new_values,details,status,created_at)
  VALUES (v_audit_id,p_tenant_id,p_actor_id,v_actor,'ERP_USER',
     'UPDATE_VEHICLE_LOCATION','UPDATE','FLEET_MANAGEMENT',
     'FLEET_VEHICLE',v_vehicle.id,
     jsonb_build_object('location_state',v_vehicle.location_state),
     jsonb_build_object('location_state',v_location),
     'Physical vehicle location corrected; plate registration untouched',
     'SUCCESS',clock_timestamp());
  RETURN jsonb_build_object('success',true,'vehicle_id',v_vehicle.id,
    'location_state',v_location,'auditLogId',v_audit_id);
END;
$$;
REVOKE ALL ON FUNCTION public.allied_set_vehicle_location(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allied_set_vehicle_location(text,text,text,text,text)
  TO service_role;
