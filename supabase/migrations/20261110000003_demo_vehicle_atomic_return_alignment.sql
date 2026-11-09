-- Pixel Syntax Delivery DEMO ONLY: Fix atomic vehicle-return log and missing custody field.
-- The return RPC runs a single transaction and verifies the authenticated operator.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS current_employee_name VARCHAR(255);
UPDATE public.vehicles v SET current_employee_name=e.full_name
FROM public.employees e WHERE v.tenant_id='company_pixel_syntax' AND e.tenant_id=v.tenant_id
AND e.id=v.current_employee_id AND v.current_employee_name IS DISTINCT FROM e.full_name;

CREATE OR REPLACE FUNCTION public.allied_return_vehicle_to_depot(p_tenant_id text, p_vehicle_id text, p_employee_id text, p_return_date date, p_return_time time without time zone, p_return_odometer numeric, p_return_reason text, p_return_notes text, p_editor_id text, p_editor_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_assignment public.vehicle_assignments%ROWTYPE;
  v_employee public.employees%ROWTYPE;
  v_vehicle_id text := nullif(btrim(coalesce(p_vehicle_id,'')),'');
  v_employee_id text := nullif(btrim(coalesce(p_employee_id,'')),'');
  v_date date := coalesce(p_return_date,(now() AT TIME ZONE 'Asia/Dubai')::date);
  v_time time := coalesce(p_return_time,(now() AT TIME ZONE 'Asia/Dubai')::time);
  v_now timestamptz := clock_timestamp();
  v_count int;
  v_audit_id text := 'aud_vreturn_' || replace(gen_random_uuid()::text, '-', '');
  v_actor text;
BEGIN
  IF nullif(btrim(p_tenant_id),'') IS NULL OR
     nullif(btrim(coalesce(p_return_reason,'')),'') IS NULL OR
     nullif(btrim(coalesce(p_editor_name,'')),'') IS NULL OR
     nullif(btrim(coalesce(p_editor_id,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Tenant, return reason and authenticated staff are required';
  END IF;
  SELECT full_name INTO v_actor FROM public.profiles
    WHERE tenant_id=p_tenant_id
      AND (id::text=p_editor_id OR auth_user_id::text=p_editor_id)
      AND btrim(full_name)=btrim(p_editor_name)
    LIMIT 1;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Could not verify the signed-in return operator for this tenant';
  END IF;
  IF v_date > (now() AT TIME ZONE 'Asia/Dubai')::date OR
     v_date < date '2000-01-01' THEN
    RAISE EXCEPTION 'Return date is outside the valid range';
  END IF;
  IF p_return_odometer IS NOT NULL AND p_return_odometer < 0 THEN
    RAISE EXCEPTION 'Return odometer cannot be negative';
  END IF;

  -- If the employee profile initiated the return, find the uniquely active bike.
  IF v_vehicle_id IS NULL AND v_employee_id IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.vehicle_assignments a
      JOIN public.employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
      WHERE a.tenant_id=p_tenant_id AND upper(a.assignment_status)='ACTIVE'
        AND (e.id=v_employee_id OR e.employee_code=v_employee_id);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Employee must have exactly one active bike handover; found %. No data changed.',v_count;
    END IF;
    SELECT a.vehicle_id INTO v_vehicle_id
      FROM public.vehicle_assignments a
      JOIN public.employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
      WHERE a.tenant_id=p_tenant_id AND upper(a.assignment_status)='ACTIVE'
        AND (e.id=v_employee_id OR e.employee_code=v_employee_id)
      LIMIT 1;
  END IF;
  IF v_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Choose the existing assigned bike to return';
  END IF;

  -- Do not confuse two bikes with the same plate number.
  SELECT count(*) INTO v_count FROM public.vehicles
    WHERE tenant_id=p_tenant_id AND (id=v_vehicle_id OR plate_number=v_vehicle_id);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one matching bike required; found %. Use the vehicle ID.',v_count;
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles
    WHERE tenant_id=p_tenant_id AND (id=v_vehicle_id OR plate_number=v_vehicle_id)
    FOR UPDATE;
  IF v_vehicle.vendor_returned OR upper(coalesce(v_vehicle.status,'')) IN ('RETURNED_TO_VENDOR','RETURNED TO VENDOR') THEN
    RAISE EXCEPTION 'Bike was returned to vendor and cannot be returned to depot';
  END IF;

  SELECT count(*) INTO v_count FROM public.vehicle_assignments
    WHERE tenant_id=p_tenant_id AND vehicle_id=v_vehicle.id AND upper(assignment_status)='ACTIVE';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected one ACTIVE handover for this bike; found %. Check returned history before retrying.',v_count;
  END IF;
  SELECT * INTO v_assignment FROM public.vehicle_assignments
    WHERE tenant_id=p_tenant_id AND vehicle_id=v_vehicle.id AND upper(assignment_status)='ACTIVE'
    FOR UPDATE;
  IF v_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id=v_assignment.employee_id AND tenant_id=p_tenant_id
      AND (id=v_employee_id OR employee_code=v_employee_id)
  ) THEN
    RAISE EXCEPTION 'The selected bike is held by another employee; no changes made';
  END IF;
  IF v_vehicle.current_employee_id IS NOT NULL
     AND v_vehicle.current_employee_id IS DISTINCT FROM v_assignment.employee_id THEN
    RAISE EXCEPTION 'Bike and active history have conflicting holders; review before returning';
  END IF;
  IF v_date < v_assignment.assignment_date THEN
    RAISE EXCEPTION 'Return date cannot precede the original assignment date';
  END IF;
  SELECT * INTO v_employee FROM public.employees
    WHERE tenant_id=p_tenant_id AND id=v_assignment.employee_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original rider was not found in this tenant; no changes made';
  END IF;
  IF v_employee.current_bike_id IS NOT NULL
     AND v_employee.current_bike_id IS DISTINCT FROM v_vehicle.id
     AND v_employee.current_bike_plate IS DISTINCT FROM v_vehicle.plate_number THEN
    RAISE EXCEPTION 'Employee currently holds a different bike; verify custody before returning';
  END IF;

  UPDATE public.vehicle_assignments SET
    assignment_status='RETURNED',return_date=v_date,return_time=v_time,
    return_odometer=coalesce(p_return_odometer,return_odometer),
    return_notes=concat_ws(' | ',p_return_reason,nullif(btrim(coalesce(p_return_notes,'')),'')),
    returned_to=v_actor
  WHERE id=v_assignment.id AND tenant_id=p_tenant_id AND upper(assignment_status)='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not close vehicle history; return rolled back'; END IF;

  UPDATE public.vehicles SET
    status='AVAILABLE',current_status='Available',current_employee_id=NULL,
    current_employee_name=NULL,updated_by=v_actor,updated_at=v_now,
    current_odometer=coalesce(p_return_odometer,current_odometer)
  WHERE id=v_vehicle.id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not update bike inventory; return rolled back'; END IF;

  UPDATE public.employees SET
    current_bike_id=NULL,current_bike_plate=NULL,
    updated_by=v_actor,updated_at=v_now
  WHERE id=v_employee.id AND tenant_id=p_tenant_id
    AND (current_bike_id=v_vehicle.id OR current_bike_plate=v_vehicle.plate_number);
  -- A previously empty employee pointer is safe: it must never be filled by a return.

  INSERT INTO public.audit_logs(
    id,tenant_id,user_id,actor_name,actor_role,action,action_type,module,
    entity_type,entity_id,old_values,new_values,details,status,created_at)
  VALUES(
    v_audit_id,p_tenant_id,p_editor_id::uuid,v_actor,'ERP_USER',
    'RETURN_VEHICLE_TO_DEPOT','RETURN','FLEET_MANAGEMENT',
    'VEHICLE_ASSIGNMENT',v_assignment.id,
    jsonb_build_object('status',v_assignment.assignment_status,
      'vehicle_id',v_vehicle.id,'employee_id',v_assignment.employee_id,
      'vehicle_status',v_vehicle.status,'current_employee_id',v_vehicle.current_employee_id),
    jsonb_build_object('status','RETURNED','vehicle_id',v_vehicle.id,
      'employee_id',v_assignment.employee_id,'vehicle_status','AVAILABLE',
      'return_date',v_date,'returned_by',v_actor),
    btrim(p_return_reason),'SUCCESS',v_now
  );

  RETURN jsonb_build_object(
    'success',true,'assignment_id',v_assignment.id,
    'vehicle_id',v_vehicle.id,'plate_number',v_vehicle.plate_number,
    'employee_id',v_employee.id,'return_date',v_date,
    'status','AVAILABLE','returned_by',v_actor,'auditLogId',v_audit_id
  );
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.allied_return_vehicle_to_depot(text,text,text,date,time without time zone,numeric,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allied_return_vehicle_to_depot(text,text,text,date,time without time zone,numeric,text,text,text,text) TO service_role;
