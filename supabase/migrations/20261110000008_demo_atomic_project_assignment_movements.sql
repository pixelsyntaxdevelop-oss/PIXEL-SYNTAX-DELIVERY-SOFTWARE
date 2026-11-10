
-- Demo-only atomic project movement & end of duty; end dates are INCLUSIVE.
CREATE OR REPLACE FUNCTION public.demo_transfer_project_atomic(
 p_tenant_id text,p_employee_id text,p_new_project_id text,
 p_start_date date,p_external_rider_id text,p_reason text,p_operator text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE e public.employees%ROWTYPE; pr public.projects%ROWTYPE;
 old_assignment public.employee_project_assignments%ROWTYPE;
 next_assignment public.employee_project_assignments%ROWTYPE;
 v_start date:=coalesce(p_start_date,(now() AT TIME ZONE 'Asia/Dubai')::date);
 v_now timestamptz:=clock_timestamp();
 v_old_id text;
BEGIN
 IF p_tenant_id<>'company_pixel_syntax' THEN RAISE EXCEPTION 'Demo tenant only'; END IF;
 IF v_start<(date '2000-01-01') OR v_start>(now() AT TIME ZONE 'Asia/Dubai')::date THEN
  RAISE EXCEPTION 'Invalid project start date; current assignment cannot start in future';
 END IF;
 IF nullif(btrim(coalesce(p_operator,'')),'') IS NULL THEN RAISE EXCEPTION 'Verified operator required'; END IF;
 SELECT * INTO e FROM public.employees
  WHERE tenant_id=p_tenant_id AND (id=p_employee_id OR employee_code=p_employee_id)
  FOR UPDATE;
 IF NOT FOUND OR e.is_archived OR NOT e.is_active THEN
  RAISE EXCEPTION 'Active employee not found';
 END IF;
 SELECT * INTO pr FROM public.projects
  WHERE tenant_id=p_tenant_id AND id=p_new_project_id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Active project not found in this tenant'; END IF;
 SELECT * INTO old_assignment FROM public.employee_project_assignments
  WHERE tenant_id=p_tenant_id AND employee_id=e.id AND status='ACTIVE'
  ORDER BY assignment_start_date DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  v_old_id:=old_assignment.id;
  IF old_assignment.project_id=pr.id THEN RAISE EXCEPTION 'Employee already assigned to this project'; END IF;
  IF v_start<=old_assignment.assignment_start_date THEN
   RAISE EXCEPTION 'Transfer must begin after current assignment start';
  END IF;
  IF EXISTS (
   SELECT 1 FROM public.project_payroll_lines
   WHERE tenant_id=p_tenant_id AND assignment_id=old_assignment.id
    AND period_end>=v_start AND status<>'DRAFT'
  ) THEN RAISE EXCEPTION 'Approved project payroll would be changed by this transfer'; END IF;
  UPDATE public.employee_project_assignments
   SET status='ENDED',assignment_end_date=v_start-1,
    end_reason=coalesce(nullif(btrim(p_reason),''),'Transferred to '||pr.name),
    ended_at=v_now,is_primary=false,updated_at=v_now
   WHERE id=old_assignment.id AND tenant_id=p_tenant_id;
 END IF;
 INSERT INTO public.employee_project_assignments
 (id,tenant_id,employee_id,project_id,branch_id,
  assignment_start_date,status,is_primary,employee_name,employee_code,
  project_name,project_code,external_rider_id,external_id_type,
  notes,assigned_by,created_by)
 VALUES(gen_random_uuid()::text,p_tenant_id,e.id,pr.id,e.branch_id,
  v_start,'ACTIVE',true,e.full_name,e.employee_code,pr.name,pr.code,
  nullif(btrim(coalesce(p_external_rider_id,'')),''),
  coalesce(pr.external_id_label,'Platform Rider ID'),
  coalesce(nullif(btrim(p_reason),''),'Project assigned via demo'),
  btrim(p_operator),btrim(p_operator))
 RETURNING * INTO next_assignment;
 UPDATE public.employees SET project_id=pr.id,project_name=pr.name,project_code=pr.code,
  current_status=CASE WHEN lower(coalesce(current_status,'')) ~ 'terminat|exit|archiv'
    THEN current_status ELSE 'Assigned / Active' END,
  updated_by=p_operator,updated_at=v_now
 WHERE tenant_id=p_tenant_id AND id=e.id;
 INSERT INTO public.employee_timeline_events
 (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by,related_entity_type,related_entity_id)
 VALUES(gen_random_uuid()::text,p_tenant_id,e.id,'PROJECT_TRANSFER','PROJECT',
  'Project assignment changed',
  coalesce(old_assignment.project_name,'Unassigned')||' -> '||pr.name||
  ', effective '||v_start::text,p_operator,'PROJECT_ASSIGNMENT',next_assignment.id);
 RETURN jsonb_build_object('success',true,'assignment',to_jsonb(next_assignment),
  'previous_assignment_id',v_old_id,'previous_assignment_end_date',
  CASE WHEN v_old_id IS NULL THEN NULL ELSE (v_start-1)::text END,
  'project_name',pr.name,'employee_id',e.id);
END $$;
REVOKE ALL ON FUNCTION public.demo_transfer_project_atomic(text,text,text,date,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_transfer_project_atomic(text,text,text,date,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_end_project_atomic(
 p_tenant_id text,p_assignment_id text,p_end_date date,p_reason text,p_operator text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE e public.employees%ROWTYPE;
 a public.employee_project_assignments%ROWTYPE;
 v_end date:=coalesce(p_end_date,(now() AT TIME ZONE 'Asia/Dubai')::date);
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_tenant_id<>'company_pixel_syntax' THEN RAISE EXCEPTION 'Demo tenant only'; END IF;
 IF nullif(btrim(coalesce(p_operator,'')),'') IS NULL THEN RAISE EXCEPTION 'Operator required'; END IF;
 SELECT * INTO a FROM public.employee_project_assignments
 WHERE tenant_id=p_tenant_id AND id=p_assignment_id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Active assignment does not exist'; END IF;
 SELECT * INTO e FROM public.employees WHERE tenant_id=p_tenant_id AND id=a.employee_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
 SELECT * INTO a FROM public.employee_project_assignments
 WHERE tenant_id=p_tenant_id AND id=p_assignment_id AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND OR v_end<a.assignment_start_date OR v_end>(now() AT TIME ZONE 'Asia/Dubai')::date THEN
  RAISE EXCEPTION 'Invalid end date or assignment already ended';
 END IF;
 IF EXISTS(SELECT 1 FROM public.project_payroll_lines
  WHERE tenant_id=p_tenant_id AND assignment_id=a.id AND period_end>v_end
   AND status<>'DRAFT') THEN
  RAISE EXCEPTION 'Cannot change date of approved payroll';
 END IF;
 UPDATE public.employee_project_assignments
 SET status='ENDED',assignment_end_date=v_end,
  end_reason=coalesce(nullif(btrim(p_reason),''),'End assignment'),
  ended_at=v_now,is_primary=false,updated_at=v_now
 WHERE tenant_id=p_tenant_id AND id=a.id;
 UPDATE public.employees SET project_id=NULL,project_name=NULL,project_code=NULL,
  current_status=CASE WHEN lower(coalesce(current_status,'')) ~ 'terminat|exit|archiv'
   THEN current_status ELSE 'Available / Unassigned' END,
  updated_by=p_operator,updated_at=v_now
 WHERE tenant_id=p_tenant_id AND id=e.id;
 INSERT INTO public.employee_timeline_events
 (id,tenant_id,employee_id,event_type,event_category,title,description,performed_by,related_entity_type,related_entity_id)
 VALUES(gen_random_uuid()::text,p_tenant_id,e.id,'PROJECT_END','PROJECT',
  'Project assignment ended',a.project_name||' through '||v_end::text,
  p_operator,'PROJECT_ASSIGNMENT',a.id);
 RETURN jsonb_build_object('success',true,'employee_id',e.id,
  'assignment_id',a.id,'assignment_end_date',v_end,'current_project',null);
END $$;
REVOKE ALL ON FUNCTION public.demo_end_project_atomic(text,text,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_end_project_atomic(text,text,date,text,text) TO service_role;
