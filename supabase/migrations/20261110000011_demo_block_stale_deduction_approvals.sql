CREATE OR REPLACE FUNCTION public.demo_advance_payroll_review(p_tenant text, p_month text, p_action text, p_actor text, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE cycle public.demo_payroll_review_cycles%ROWTYPE;
 next_stage text;
 actual_net numeric;
 actual_project_net numeric;
 actual_deductions numeric;
 open_issues integer;
BEGIN
 IF p_tenant<>'company_pixel_syntax' OR nullif(btrim(coalesce(p_actor,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Unauthorized payroll review'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant),hashtext(p_month));
 SELECT * INTO cycle FROM public.demo_payroll_review_cycles
  WHERE tenant_id=p_tenant AND period_month=p_month FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Run payroll calculation before approval'; END IF;
 IF p_action='SUBMIT' AND cycle.stage='DRAFT' THEN next_stage:='PENDING_APPROVAL';
 ELSIF p_action='APPROVE' AND cycle.stage='PENDING_APPROVAL' THEN next_stage:='APPROVED';
 ELSIF p_action='VERIFY' AND cycle.stage='APPROVED' THEN
  IF cycle.approved_by=p_actor THEN RAISE EXCEPTION 'Verifier must differ from approver'; END IF;
  next_stage:='VERIFIED';
 ELSIF p_action='READY' AND cycle.stage='VERIFIED' THEN next_stage:='READY_TO_PROCESS';
 ELSE RAISE EXCEPTION 'Invalid transition % from stage %',p_action,cycle.stage; END IF;

 -- Approving a liability after the last draft calculation must not silently
 -- leave it out of salary. Recalculate after any deduction decision.
 IF EXISTS(
  SELECT 1 FROM public.demo_payroll_deductions d
  WHERE d.tenant_id=p_tenant AND d.due_month=p_month AND d.status='APPROVED'
   AND NOT EXISTS(SELECT 1 FROM public.demo_payroll_deduction_applications a
    WHERE a.tenant_id=d.tenant_id AND a.deduction_id=d.id AND a.period_month=p_month)
 ) THEN
  RAISE EXCEPTION 'An approved deduction has not been included in this draft; recalculate payroll';
 END IF;
 SELECT count(*) INTO open_issues FROM public.demo_payroll_deductions
 WHERE tenant_id=p_tenant AND due_month=p_month AND status='REVIEW_REQUIRED';
 IF open_issues>0 THEN RAISE EXCEPTION '% pending fine/loan deductions need decision before submission',open_issues; END IF;
 SELECT coalesce(sum(net_payable),0) INTO actual_net FROM public.payroll_records
  WHERE tenant_id=p_tenant AND period_month=p_month;
 SELECT coalesce(sum(net_payable_aed),0) INTO actual_project_net FROM public.project_payroll_lines
  WHERE tenant_id=p_tenant AND period_month=p_month;
 SELECT coalesce(sum(amount_aed),0) INTO actual_deductions FROM public.demo_payroll_deduction_applications
  WHERE tenant_id=p_tenant AND period_month=p_month;
 IF round(actual_project_net-actual_deductions,2)<>round(actual_net,2)
 OR round(actual_net,2)<>round(cycle.net_aed,2) THEN
  RAISE EXCEPTION 'Payroll changed since calculation; recalculate before approval';
 END IF;
 UPDATE public.demo_payroll_review_cycles SET stage=next_stage,updated_at=now(),
  submitted_by=CASE WHEN p_action='SUBMIT' THEN p_actor ELSE submitted_by END,
  submitted_at=CASE WHEN p_action='SUBMIT' THEN now() ELSE submitted_at END,
  approved_by=CASE WHEN p_action='APPROVE' THEN p_actor ELSE approved_by END,
  approved_at=CASE WHEN p_action='APPROVE' THEN now() ELSE approved_at END,
  verified_by=CASE WHEN p_action='VERIFY' THEN p_actor ELSE verified_by END,
  verified_at=CASE WHEN p_action='VERIFY' THEN now() ELSE verified_at END,
  ready_by=CASE WHEN p_action='READY' THEN p_actor ELSE ready_by END,
  ready_at=CASE WHEN p_action='READY' THEN now() ELSE ready_at END
 WHERE id=cycle.id;
 IF p_action IN ('APPROVE','VERIFY','READY') THEN
  UPDATE public.payroll_records SET status=next_stage,updated_at=now()
  WHERE tenant_id=p_tenant AND period_month=p_month;
  UPDATE public.project_payroll_lines SET status=next_stage
  WHERE tenant_id=p_tenant AND period_month=p_month;
 END IF;
 INSERT INTO public.demo_payroll_audit_events(tenant_id,period_month,event_type,actor_id,
  previous_stage,next_stage,details)
 VALUES(p_tenant,p_month,p_action,p_actor,cycle.stage,next_stage,
 jsonb_build_object('comment',coalesce(p_comment,''),'net_aed',cycle.net_aed));
 RETURN jsonb_build_object('success',true,'stage',next_stage,'net_aed',cycle.net_aed,
 'payment_processed',false);
END $function$
;
