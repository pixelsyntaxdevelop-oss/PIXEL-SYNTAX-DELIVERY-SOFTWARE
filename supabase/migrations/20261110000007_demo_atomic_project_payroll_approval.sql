
-- Approve and publish both employee payroll and its project rows in one DB transaction.
CREATE OR REPLACE FUNCTION public.demo_transition_project_payroll(
 p_tenant_id text,p_period_month text,p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE from_status text; to_status text; touched int; line_count int;
BEGIN
 IF p_tenant_id<>'company_pixel_syntax' THEN RAISE EXCEPTION 'Demo tenant only'; END IF;
 IF p_period_month IS NULL OR p_period_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
  RAISE EXCEPTION 'Invalid payroll period';
 END IF;
 IF p_action='approve' THEN from_status:='DRAFT';to_status:='APPROVED';
 ELSIF p_action='publish' THEN from_status:='APPROVED';to_status:='PUBLISHED';
 ELSE RAISE EXCEPTION 'Unsupported payroll state transition'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id),hashtext(p_period_month));
 IF EXISTS (
  SELECT 1 FROM public.payroll_records
  WHERE tenant_id=p_tenant_id AND period_month=p_period_month AND status<>from_status
 ) THEN RAISE EXCEPTION 'Period has mixed or incompatible salary status; review before transition'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.project_payroll_lines
  WHERE tenant_id=p_tenant_id AND period_month=p_period_month AND status<>from_status
 ) THEN RAISE EXCEPTION 'Project salary status mismatch'; END IF;
 UPDATE public.payroll_records SET status=to_status,updated_at=now()
 WHERE tenant_id=p_tenant_id AND period_month=p_period_month AND status=from_status;
 GET DIAGNOSTICS touched = ROW_COUNT;
 IF touched=0 THEN RAISE EXCEPTION 'No payroll records eligible for state transition'; END IF;
 UPDATE public.project_payroll_lines SET status=to_status
 WHERE tenant_id=p_tenant_id AND period_month=p_period_month AND status=from_status;
 GET DIAGNOSTICS line_count = ROW_COUNT;
 RETURN jsonb_build_object('success',true,'period_month',p_period_month,
  'status',to_status,'employees',touched,'project_lines',line_count,'is_demo',true,'payment_processed',false);
END $$;
REVOKE ALL ON FUNCTION public.demo_transition_project_payroll(text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_transition_project_payroll(text,text,text)
 TO service_role;
