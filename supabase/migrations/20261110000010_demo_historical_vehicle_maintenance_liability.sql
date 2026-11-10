
-- Historical custody is authoritative for bike repair/maintenance as for traffic fines.
CREATE OR REPLACE FUNCTION public.demo_register_vehicle_maintenance_charge(
 p_tenant text,p_vehicle_id text,p_incident_at timestamptz,p_amount numeric,
 p_reference text,p_due_month text,p_actor text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE holder record; n integer; d public.demo_payroll_deductions%ROWTYPE;
BEGIN
 IF p_tenant<>'company_pixel_syntax' OR p_amount<=0 OR p_amount>20000
 THEN RAISE EXCEPTION 'Invalid demo company or maintenance charge'; END IF;
 IF nullif(trim(coalesce(p_reference,'')),'') IS NULL OR
    nullif(trim(coalesce(p_reason,'')),'') IS NULL OR p_incident_at IS NULL OR
    p_due_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
 THEN RAISE EXCEPTION 'Source reference, incident date, reason, salary period are required'; END IF;
 SELECT count(*) INTO n FROM public.vehicle_assignments a
 WHERE a.tenant_id=p_tenant AND a.vehicle_id=p_vehicle_id
 AND (a.assignment_date+a.assignment_time)<=(p_incident_at AT TIME ZONE 'Asia/Dubai')
 AND (a.return_date IS NULL OR (a.return_date+coalesce(a.return_time,time '23:59:59'))>=(p_incident_at AT TIME ZONE 'Asia/Dubai'));
 IF n<>1 THEN RAISE EXCEPTION 'Maintenance charge has % historical bike owners; manual review required',n; END IF;
 SELECT a.id as assignment_id,a.employee_id INTO holder FROM public.vehicle_assignments a
 WHERE a.tenant_id=p_tenant AND a.vehicle_id=p_vehicle_id
 AND (a.assignment_date+a.assignment_time)<=(p_incident_at AT TIME ZONE 'Asia/Dubai')
 AND (a.return_date IS NULL OR (a.return_date+coalesce(a.return_time,time '23:59:59'))>=(p_incident_at AT TIME ZONE 'Asia/Dubai'))
 LIMIT 1;
 INSERT INTO public.demo_payroll_deductions
 (tenant_id,employee_id,source_type,source_id,vehicle_id,custody_assignment_id,
 incident_at,original_due_month,due_month,amount_aed,status,reason,created_by)
 VALUES(p_tenant,holder.employee_id,'BIKE_MAINTENANCE',p_reference,p_vehicle_id,holder.assignment_id,
 p_incident_at,p_due_month,p_due_month,p_amount,'REVIEW_REQUIRED',p_reason,p_actor)
 ON CONFLICT(tenant_id,source_type,source_id) DO NOTHING
 RETURNING * INTO d;
 IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance reference already exists'; END IF;
 RETURN jsonb_build_object('success',true,'deduction_id',d.id,
  'employee_id',holder.employee_id,'custody_assignment_id',holder.assignment_id,
  'status','REVIEW_REQUIRED','payment_deducted',false);
END $$;
REVOKE ALL ON FUNCTION public.demo_register_vehicle_maintenance_charge(text,text,timestamptz,numeric,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_register_vehicle_maintenance_charge(text,text,timestamptz,numeric,text,text,text,text)
 TO service_role;
