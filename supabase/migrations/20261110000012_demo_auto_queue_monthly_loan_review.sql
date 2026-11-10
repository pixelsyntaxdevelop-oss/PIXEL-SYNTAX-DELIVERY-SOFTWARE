CREATE OR REPLACE FUNCTION public.demo_prepare_payroll_with_deductions(p_tenant text, p_month text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 stage_now text;
 baseline jsonb;
 count_deduct int;
 gross_total numeric(14,2);
 deductions_total numeric(14,2);
 net_total numeric(14,2);
 calc_total numeric(14,2);
BEGIN
 IF p_tenant<>'company_pixel_syntax' OR nullif(btrim(coalesce(p_actor,'')),'') IS NULL THEN
  RAISE EXCEPTION 'Demo tenant and authenticated operator required';
 END IF;
 IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
  RAISE EXCEPTION 'Invalid payroll month';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant),hashtext(p_month));
 SELECT stage INTO stage_now FROM public.demo_payroll_review_cycles
  WHERE tenant_id=p_tenant AND period_month=p_month FOR UPDATE;
 IF stage_now IS NOT NULL AND stage_now<>'DRAFT' THEN
  RAISE EXCEPTION 'Payroll is %: cannot regenerate a locked period',stage_now;
 END IF;
 -- Prepopulate monthly loan installments from the authoritative loan ledger
 -- as REVIEW_REQUIRED. Never withhold without independent legal approval.
 INSERT INTO public.demo_payroll_deductions
 (tenant_id,employee_id,source_type,source_id,original_due_month,due_month,
  amount_aed,status,reason,created_by)
 SELECT l.tenant_id,l.employee_id,'LOAN',l.id||':'||p_month,p_month,p_month,
  least(l.monthly_installment,l.remaining_balance),'REVIEW_REQUIRED',
  'Auto-queued loan installment: review worker consent and legal limit before salary withholding',
  p_actor
 FROM public.employee_loans l
 WHERE l.tenant_id=p_tenant AND l.status='ACTIVE'
   AND l.start_month<=p_month AND l.remaining_balance>0 AND l.monthly_installment>0
   AND EXISTS (SELECT 1 FROM public.project_daily_earnings e
    WHERE e.tenant_id=l.tenant_id AND e.employee_id=l.employee_id
    AND to_char(e.work_date,'YYYY-MM')=p_month)
   AND NOT EXISTS (SELECT 1 FROM public.demo_payroll_deductions d
    WHERE d.tenant_id=l.tenant_id AND d.source_type='LOAN'
     AND d.due_month=p_month AND d.status='POSTPONED'
     AND d.source_id LIKE l.id||':%')
 ON CONFLICT(tenant_id,source_type,source_id) DO NOTHING;

 -- Do not lose a fine or loan because its employee is not on payroll.
 IF EXISTS(SELECT 1 FROM public.demo_payroll_deductions d
 WHERE d.tenant_id=p_tenant AND d.due_month=p_month
 AND d.status='APPROVED'
 AND NOT EXISTS (SELECT 1 FROM public.project_daily_earnings e
 WHERE e.tenant_id=d.tenant_id AND e.employee_id=d.employee_id
 AND to_char(e.work_date,'YYYY-MM')=p_month)) THEN
   RAISE EXCEPTION 'Approved deduction has no employee earnings this month. Review and postpone manually.';
 END IF;

 baseline:=public.demo_generate_project_payroll(p_tenant,p_month);

 DELETE FROM public.demo_payroll_deduction_applications
 WHERE tenant_id=p_tenant AND period_month=p_month;

 INSERT INTO public.demo_payroll_deduction_applications
 (tenant_id,deduction_id,employee_id,period_month,amount_aed)
 SELECT d.tenant_id,d.id,d.employee_id,p_month,d.amount_aed
 FROM public.demo_payroll_deductions d
 WHERE d.tenant_id=p_tenant AND d.due_month=p_month AND d.status='APPROVED'
 AND length(coalesce(d.consent_reference,''))>=6
 AND length(coalesce(d.evidence_reference,''))>=6
 AND NOT EXISTS (SELECT 1 FROM public.demo_payroll_deduction_applications applied
  WHERE applied.tenant_id=d.tenant_id AND applied.deduction_id=d.id);

 -- Each employee's project lines remain intact; deduct liability once from
 -- combined salary, never from every platform's 15-day share.
 UPDATE public.payroll_records p
 SET penalties = totals.project_deductions + totals.extra_deductions,
     net_payable = totals.project_net - totals.extra_deductions,
     updated_at=now()
 FROM (
  SELECT l.employee_id,
   round(sum(l.deductions_aed),2) project_deductions,
   round(sum(l.net_payable_aed),2) project_net,
   coalesce((SELECT round(sum(a.amount_aed),2)
    FROM public.demo_payroll_deduction_applications a
    WHERE a.tenant_id=p_tenant AND a.period_month=p_month
     AND a.employee_id=l.employee_id),0) extra_deductions
  FROM public.project_payroll_lines l
  WHERE l.tenant_id=p_tenant AND l.period_month=p_month GROUP BY l.employee_id
 ) totals
 WHERE p.tenant_id=p_tenant AND p.period_month=p_month
 AND p.employee_id=totals.employee_id AND p.status='DRAFT'
 AND p.payroll_source='PROJECT_SPLIT_DEMO';

 IF EXISTS(SELECT 1 FROM public.payroll_records
 WHERE tenant_id=p_tenant AND period_month=p_month AND net_payable<0) THEN
  RAISE EXCEPTION 'Deductions exceed earnings for an employee. Manual review required.';
 END IF;
 -- Conservative stop for excessive deductions; verify actual per-category law separately.
 IF EXISTS(
 SELECT 1 FROM public.payroll_records p
 JOIN (SELECT employee_id,sum(amount_aed) amount FROM public.demo_payroll_deduction_applications
 WHERE tenant_id=p_tenant AND period_month=p_month GROUP BY employee_id) d ON d.employee_id=p.employee_id
 WHERE p.tenant_id=p_tenant AND p.period_month=p_month
 AND d.amount>0.5*(p.net_payable+d.amount)
 ) THEN RAISE EXCEPTION 'Deduction exceeds safety review threshold; compliance approval required'; END IF;

 SELECT count(*) INTO count_deduct
 FROM public.demo_payroll_deduction_applications
 WHERE tenant_id=p_tenant AND period_month=p_month;
 SELECT coalesce(round(sum(p.base_salary+coalesce(p.incentives,0)+coalesce(p.overtime_pay,0)),2),0),
        coalesce(round(sum(coalesce(p.penalties,0)+coalesce(p.tax_deductions,0)),2),0),
        coalesce(round(sum(p.net_payable),2),0)
 INTO gross_total,deductions_total,net_total
 FROM public.payroll_records p
 WHERE p.tenant_id=p_tenant AND p.period_month=p_month;
 SELECT coalesce(sum(l.net_payable_aed),0)-
   coalesce((SELECT sum(a.amount_aed) FROM public.demo_payroll_deduction_applications a
    WHERE a.tenant_id=p_tenant AND a.period_month=p_month),0)
 INTO calc_total FROM public.project_payroll_lines l
 WHERE l.tenant_id=p_tenant AND l.period_month=p_month;
 IF round(calc_total,2) IS DISTINCT FROM net_total THEN
   RAISE EXCEPTION 'Project totals and deduction ledger do not reconcile';
 END IF;

 INSERT INTO public.demo_payroll_review_cycles(tenant_id,period_month,stage,calculated_by,calculated_at,
  gross_aed,deductions_aed,net_aed,payment_processed)
 VALUES(p_tenant,p_month,'DRAFT',p_actor,now(),gross_total,deductions_total,net_total,false)
 ON CONFLICT(tenant_id,period_month) DO UPDATE SET
  stage='DRAFT',calculated_by=EXCLUDED.calculated_by,calculated_at=now(),
  gross_aed=EXCLUDED.gross_aed,deductions_aed=EXCLUDED.deductions_aed,
  net_aed=EXCLUDED.net_aed,updated_at=now();
 INSERT INTO public.demo_payroll_audit_events(tenant_id,period_month,event_type,actor_id,details)
 VALUES(p_tenant,p_month,'RECALCULATED_DRAFT',p_actor,
 jsonb_build_object('baseline',baseline,'applied_deductions',count_deduct,
 'gross',gross_total,'net',net_total));
 RETURN jsonb_build_object('success',true,'stage','DRAFT',
  'period_month',p_month,'applied_deductions',count_deduct,'gross_aed',gross_total,
  'deductions_aed',deductions_total,'net_aed',net_total,
  'payment_processed',false);
END $function$
;
