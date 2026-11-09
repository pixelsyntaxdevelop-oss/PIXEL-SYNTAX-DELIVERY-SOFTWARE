-- Pixel Syntax Delivery DEMO ONLY: atomic and tenant-bound employee vehicle handovers.
-- Requires 20261110000003_demo_vehicle_atomic_return_alignment.sql.
-- All vehicle assignments, swaps and audit events commit together or roll back.
CREATE OR REPLACE FUNCTION public.demo_assign_vehicle_atomic(p_tenant_id text, p_vehicle_id text, p_employee_id text, p_assignment_date date, p_assignment_time time without time zone, p_starting_odometer numeric, p_condition text, p_handover_notes text, p_assigned_by text, p_force_reassign boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_employee public.employees%ROWTYPE;
 v_vehicle public.vehicles%ROWTYPE;
 v_prior public.vehicle_assignments%ROWTYPE;
 v_old_employee public.employees%ROWTYPE;
 v_assignment public.vehicle_assignments%ROWTYPE;
 v_date date:=coalesce(p_assignment_date,(now() AT TIME ZONE 'Asia/Dubai')::date);
 v_time time:=coalesce(p_assignment_time,(now() AT TIME ZONE 'Asia/Dubai')::time);
 v_now timestamptz:=clock_timestamp();
 v_odo numeric;
 v_count int;
BEGIN
 IF nullif(btrim(coalesce(p_tenant_id,'')),'') IS NULL OR
    nullif(btrim(coalesce(p_vehicle_id,'')),'') IS NULL OR
    nullif(btrim(coalesce(p_employee_id,'')),'') IS NULL OR
    nullif(btrim(coalesce(p_assigned_by,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Tenant, bike, employee, and operator required'; END IF;
 IF v_date> (now() AT TIME ZONE 'Asia/Dubai')::date OR v_date < date '2000-01-01'
 THEN RAISE EXCEPTION 'Assignment date is outside allowed range'; END IF;

 SELECT * INTO v_employee FROM public.employees
 WHERE tenant_id=p_tenant_id AND (id=p_employee_id OR employee_code=p_employee_id)
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in this company'; END IF;
 IF v_employee.is_archived OR NOT v_employee.is_active OR
 lower(coalesce(v_employee.current_status,'')) ~ 'terminated|exited|archived'
 THEN RAISE EXCEPTION 'Cannot assign bike to archived or exited employee'; END IF;

 SELECT * INTO v_vehicle FROM public.vehicles
 WHERE tenant_id=p_tenant_id AND (id=p_vehicle_id OR plate_number=p_vehicle_id)
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bike not found in this company'; END IF;
 IF v_vehicle.vendor_returned OR NOT v_vehicle.is_active OR
 upper(coalesce(v_vehicle.status,'')) IN ('RETURNED_TO_VENDOR','LOST','SCRAPPED')
 THEN RAISE EXCEPTION 'Bike not eligible for assignment'; END IF;

 v_odo:=coalesce(p_starting_odometer,v_vehicle.current_odometer,v_vehicle.odometer_km,0);
 IF v_odo<0 OR v_odo < coalesce(v_vehicle.current_odometer,0)
 THEN RAISE EXCEPTION 'Starting odometer cannot be below current odometer'; END IF;

 SELECT count(*) INTO v_count FROM public.vehicle_assignments
 WHERE tenant_id=p_tenant_id AND employee_id=v_employee.id
 AND assignment_status='ACTIVE' AND return_date IS NULL;
 IF v_count<>0 THEN RAISE EXCEPTION 'Employee already has an active bike; return it first'; END IF;
 IF v_employee.current_bike_id IS NOT NULL OR nullif(btrim(coalesce(v_employee.current_bike_plate,'')),'') IS NOT NULL
 THEN RAISE EXCEPTION 'Employee bike pointer already exists; return or repair custody first'; END IF;

 SELECT count(*) INTO v_count FROM public.vehicle_assignments
 WHERE tenant_id=p_tenant_id AND vehicle_id=v_vehicle.id
 AND assignment_status='ACTIVE' AND return_date IS NULL;
 IF v_count>1 THEN RAISE EXCEPTION 'Multiple active bike histories require correction'; END IF;

 IF v_count=1 THEN
   SELECT * INTO v_prior FROM public.vehicle_assignments
    WHERE tenant_id=p_tenant_id AND vehicle_id=v_vehicle.id AND assignment_status='ACTIVE'
    AND return_date IS NULL FOR UPDATE;
   IF NOT coalesce(p_force_reassign,false)
   THEN RAISE EXCEPTION 'Bike already assigned; explicit confirmation required to reassign'; END IF;
   IF v_prior.employee_id=v_employee.id
   THEN RAISE EXCEPTION 'Bike already assigned to selected employee'; END IF;

   SELECT * INTO v_old_employee FROM public.employees
    WHERE tenant_id=p_tenant_id AND id=v_prior.employee_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Prior bike holder is missing'; END IF;
   IF v_vehicle.current_employee_id IS DISTINCT FROM v_old_employee.id OR
      v_old_employee.current_bike_id IS DISTINCT FROM v_vehicle.id
   THEN RAISE EXCEPTION 'Bike custody pointer mismatch; correct before reassigning'; END IF;
   UPDATE public.vehicle_assignments
    SET assignment_status='REASSIGNED',return_date=v_date,return_time=v_time,
        return_odometer=v_odo,return_notes='Reassigned to '||v_employee.full_name
    WHERE id=v_prior.id AND tenant_id=p_tenant_id;
   UPDATE public.employees
    SET current_bike_id=NULL,current_bike_plate=NULL,updated_by=p_assigned_by,updated_at=v_now
    WHERE tenant_id=p_tenant_id AND id=v_old_employee.id;
   INSERT INTO public.employee_timeline_events
    (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by,related_entity_type,related_entity_id)
    VALUES(gen_random_uuid()::text,p_tenant_id,v_old_employee.id,'RETURN','FLEET',
     'Bike reassigned',v_vehicle.plate_number||' transferred to '||v_employee.full_name,
     p_assigned_by,'VEHICLE',v_vehicle.id);
 ELSIF v_vehicle.current_employee_id IS NOT NULL OR upper(coalesce(v_vehicle.status,''))='ASSIGNED' THEN
   RAISE EXCEPTION 'Bike says assigned without active custody history; repair before proceeding';
 END IF;

 INSERT INTO public.vehicle_assignments
  (id,tenant_id,vehicle_id,employee_id,assignment_date,assignment_time,
   assignment_status,starting_odometer,condition_on_assignment,handover_notes,
   assigned_by,created_at)
 VALUES(gen_random_uuid()::text,p_tenant_id,v_vehicle.id,v_employee.id,v_date,v_time,
   'ACTIVE',v_odo,coalesce(nullif(btrim(p_condition),''),'Good Condition'),
   coalesce(nullif(btrim(p_handover_notes),''),'Verified demo handover'),
   btrim(p_assigned_by),v_now)
 RETURNING * INTO v_assignment;

 UPDATE public.vehicles SET status='ASSIGNED',current_status='Assigned',
  current_employee_id=v_employee.id,current_employee_name=v_employee.full_name,
  current_odometer=v_odo,updated_by=p_assigned_by,updated_at=v_now
 WHERE tenant_id=p_tenant_id AND id=v_vehicle.id;
 UPDATE public.employees SET current_bike_id=v_vehicle.id,
  current_bike_plate=v_vehicle.plate_number,updated_by=p_assigned_by,updated_at=v_now
 WHERE tenant_id=p_tenant_id AND id=v_employee.id;

 INSERT INTO public.employee_timeline_events
  (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by,related_entity_type,related_entity_id)
 VALUES(gen_random_uuid()::text,p_tenant_id,v_employee.id,'ASSIGNED','FLEET',
  'Bike assigned',v_vehicle.plate_number||' assigned to '||v_employee.full_name,
  p_assigned_by,'VEHICLE',v_vehicle.id);
 INSERT INTO public.audit_logs(id,tenant_id,actor_name,actor_role,action,
   action_type,module,entity_type,entity_id,details,status,created_at,new_values)
 VALUES(gen_random_uuid()::text,p_tenant_id,btrim(p_assigned_by),'ERP_USER',
   'ASSIGN_VEHICLE','ASSIGN','FLEET_MANAGEMENT','VEHICLE_ASSIGNMENT',
   v_assignment.id,'Atomic bike assignment','SUCCESS',v_now,
   jsonb_build_object('employee_id',v_employee.id,'vehicle_id',v_vehicle.id,
    'assignment_date',v_date));
 RETURN jsonb_build_object('success',true,'assignment',to_jsonb(v_assignment),
   'employee_id',v_employee.id,'vehicle_id',v_vehicle.id,'vehicle_plate',v_vehicle.plate_number);
END $function$
;

CREATE OR REPLACE FUNCTION public.rpc_swap_vehicle(p_tenant_id character varying, p_employee_id character varying, p_old_vehicle_id character varying, p_new_vehicle_id character varying, p_return_odometer numeric, p_condition_on_return text, p_return_notes text, p_new_starting_odometer numeric, p_new_condition text, p_replacement_reason text, p_assigned_by character varying, p_user_id character varying DEFAULT NULL::character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_employee public.employees%ROWTYPE;
 v_old public.vehicles%ROWTYPE;
 v_old_assignment public.vehicle_assignments%ROWTYPE;
 v_response jsonb;
 v_at timestamptz:=clock_timestamp();
 v_day date:=(now() AT TIME ZONE 'Asia/Dubai')::date;
 v_clock time:=(now() AT TIME ZONE 'Asia/Dubai')::time;
 v_confirm_force boolean := p_replacement_reason = 'CONFIRMED_FORCE_REASSIGN';
 v_odo numeric;
BEGIN
 IF nullif(btrim(coalesce(p_tenant_id,'')),'') IS NULL OR
  nullif(btrim(coalesce(p_employee_id,'')),'') IS NULL OR
  nullif(btrim(coalesce(p_new_vehicle_id,'')),'') IS NULL OR
  nullif(btrim(coalesce(p_assigned_by,'')),'') IS NULL THEN
  RAISE EXCEPTION 'Tenant, employee, bike and operator are required';
 END IF;
 IF p_old_vehicle_id IS NOT NULL AND btrim(p_old_vehicle_id)<>'' THEN
  IF p_old_vehicle_id=p_new_vehicle_id THEN
   RAISE EXCEPTION 'Old bike and new bike cannot be the same';
  END IF;
  SELECT * INTO v_employee FROM public.employees
  WHERE id=p_employee_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in tenant'; END IF;
  SELECT * INTO v_old FROM public.vehicles
   WHERE id=p_old_vehicle_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Old bike not found in tenant'; END IF;
  SELECT * INTO v_old_assignment FROM public.vehicle_assignments
   WHERE tenant_id=p_tenant_id AND employee_id=v_employee.id AND vehicle_id=v_old.id
   AND assignment_status='ACTIVE' AND return_date IS NULL FOR UPDATE;
  IF NOT FOUND OR v_employee.current_bike_id IS DISTINCT FROM v_old.id
     OR v_old.current_employee_id IS DISTINCT FROM v_employee.id THEN
   RAISE EXCEPTION 'Old bike custody does not match the employee; no changes made';
  END IF;
  v_odo:=coalesce(p_return_odometer,v_old.current_odometer,v_old.odometer_km);
  IF v_odo<coalesce(v_old.current_odometer,0) THEN
   RAISE EXCEPTION 'Old bike return odometer cannot go backwards';
  END IF;
  UPDATE public.vehicle_assignments SET assignment_status='REPLACED',
   return_date=v_day,return_time=v_clock,return_odometer=v_odo,
   condition_on_return=coalesce(p_condition_on_return,'Good Condition'),
   return_notes=coalesce(p_return_notes,'Replaced by new bike'),
   returned_to=p_assigned_by
  WHERE id=v_old_assignment.id AND tenant_id=p_tenant_id;
  UPDATE public.vehicles SET status='AVAILABLE',current_status='Available',
   current_employee_id=NULL,current_employee_name=NULL,current_odometer=v_odo,
   updated_by=p_assigned_by,updated_at=v_at WHERE id=v_old.id AND tenant_id=p_tenant_id;
  UPDATE public.employees SET current_bike_id=NULL,current_bike_plate=NULL,
   updated_by=p_assigned_by,updated_at=v_at WHERE id=v_employee.id AND tenant_id=p_tenant_id;
  INSERT INTO public.employee_timeline_events
   (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by,related_entity_type,related_entity_id)
  VALUES(gen_random_uuid()::text,p_tenant_id,v_employee.id,'RETURN','FLEET','Old bike replaced',
   'Replaced '||v_old.plate_number||' with '||p_new_vehicle_id,
   p_assigned_by,'VEHICLE',v_old.id);
 END IF;

 v_response:=public.demo_assign_vehicle_atomic(
  p_tenant_id,p_new_vehicle_id,p_employee_id,v_day,v_clock,p_new_starting_odometer,
  p_new_condition,p_return_notes,p_assigned_by,v_confirm_force
 );
 RETURN v_response;
END $function$
;

REVOKE ALL ON FUNCTION public.demo_assign_vehicle_atomic(text,text,text,date,time without time zone,numeric,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_assign_vehicle_atomic(text,text,text,date,time without time zone,numeric,text,text,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.rpc_swap_vehicle(varchar,varchar,varchar,varchar,numeric,text,text,numeric,text,text,varchar,varchar) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_swap_vehicle(varchar,varchar,varchar,varchar,numeric,text,text,numeric,text,text,varchar,varchar) TO service_role;