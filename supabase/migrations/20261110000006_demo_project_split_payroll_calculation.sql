
-- Single transaction, tenant-scoped sample project payroll calculation.
-- A rider has ONE monthly payroll record but one line for EACH project interval.
CREATE OR REPLACE FUNCTION public.demo_generate_project_payroll(
 p_tenant_id text,
 p_period_month text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_start date;
 v_end date;
 v_count int;
 v_reconciled bool;
 v_total numeric(14,2);
BEGIN
 IF p_tenant_id<>'company_pixel_syntax' THEN
  RAISE EXCEPTION 'This payroll engine is restricted to the Pixel Syntax demo tenant';
 END IF;
 IF p_period_month IS NULL OR p_period_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
  RAISE EXCEPTION 'Payroll period must be YYYY-MM';
 END IF;
 v_start:=to_date(p_period_month||'-01','YYYY-MM-DD');
 IF to_char(v_start,'YYYY-MM')<>p_period_month THEN RAISE EXCEPTION 'Invalid payroll month'; END IF;
 v_end:=(v_start+INTERVAL '1 month' - interval '1 day')::date;
 IF v_start>date_trunc('month',(now() AT TIME ZONE 'Asia/Dubai'))::date THEN
  RAISE EXCEPTION 'Cannot generate payroll for a future month';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id),hashtext(p_period_month));

 IF EXISTS(
  SELECT 1 FROM public.project_payroll_lines
  WHERE tenant_id=p_tenant_id AND period_month=p_period_month AND status<>'DRAFT'
 ) THEN RAISE EXCEPTION 'Approved project payroll is locked; reopen with audit before recalculating'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.payroll_records
  WHERE tenant_id=p_tenant_id AND period_month=p_period_month
    AND (status<>'DRAFT' OR payroll_source<>'PROJECT_SPLIT_DEMO')
    AND employee_id IN (
      SELECT employee_id FROM public.project_daily_earnings
      WHERE tenant_id=p_tenant_id AND work_date BETWEEN v_start AND v_end
    )
 ) THEN RAISE EXCEPTION 'Existing payroll data must be reconciled before project calculation'; END IF;

 DELETE FROM public.project_payroll_lines
 WHERE tenant_id=p_tenant_id AND period_month=p_period_month AND status='DRAFT';

 WITH observed AS (
  SELECT d.employee_id,d.project_id,d.assignment_id,
   min(d.work_date) first_work_date,max(d.work_date) last_work_date,
   count(DISTINCT d.work_date)::integer worked_days,
   sum(d.orders_count)::integer orders,
   round(sum(d.tips_aed),2) tips,
   round(sum(d.incentives_aed),2) bonuses,
   round(sum(d.deductions_aed),2) fines,
   bool_and(d.source_type='DEMO_SYNTHETIC') all_demo
  FROM public.project_daily_earnings d
  JOIN public.employee_project_assignments a
   ON a.tenant_id=d.tenant_id AND a.id=d.assignment_id
   AND a.employee_id=d.employee_id AND a.project_id=d.project_id
   AND d.work_date>=a.assignment_start_date
   AND (a.assignment_end_date IS NULL OR d.work_date<=a.assignment_end_date)
  WHERE d.tenant_id=p_tenant_id AND d.work_date BETWEEN v_start AND v_end
  GROUP BY d.employee_id,d.project_id,d.assignment_id
 ),
 valued AS (
 SELECT o.*,e.full_name,e.basic_salary,a.external_rider_id,
  r.pay_model,r.rate_aed,
  CASE WHEN r.pay_model='FIXED_MONTHLY' THEN
    round(coalesce(nullif(e.basic_salary,0),r.rate_aed)*o.worked_days /
      extract(day from v_end),2)
   WHEN r.pay_model='DAILY_RATE' THEN round(r.rate_aed*o.worked_days,2)
   ELSE 0::numeric END base_part,
  CASE WHEN r.pay_model='PER_ORDER' THEN round(r.rate_aed*o.orders,2)
   ELSE 0::numeric END commission_part
 FROM observed o
 JOIN public.employees e ON e.id=o.employee_id AND e.tenant_id=p_tenant_id
 JOIN public.employee_project_assignments a ON a.id=o.assignment_id AND a.tenant_id=p_tenant_id
 JOIN LATERAL (
  SELECT s.pay_model,s.rate_aed,s.effective_from
  FROM public.project_salary_settings s
  WHERE s.tenant_id=p_tenant_id AND s.project_id=o.project_id
    AND s.effective_from<=o.first_work_date
  ORDER BY s.effective_from DESC LIMIT 1
 ) r ON TRUE
 )
 INSERT INTO public.project_payroll_lines
 (id,tenant_id,period_month,employee_id,project_id,assignment_id,external_rider_id,
  period_start,period_end,worked_days,orders_count,pay_model,rate_aed,
  base_salary_aed,commission_aed,tips_aed,incentives_aed,deductions_aed,
  net_payable_aed,calculation_source,status)
 SELECT gen_random_uuid()::text,p_tenant_id,p_period_month,
   employee_id,project_id,assignment_id,external_rider_id,
   first_work_date,last_work_date,worked_days,orders,pay_model,rate_aed,
   base_part,commission_part,tips,bonuses,fines,
   round(base_part+commission_part+tips+bonuses-fines,2),
   CASE WHEN all_demo THEN 'DEMO_SYNTHETIC' ELSE 'REVIEW_REQUIRED' END,
   'DRAFT'
 FROM valued;

 -- If daily rows exist for a platform without a configured rate, reject
 -- the entire transaction instead of silently dropping its earnings.
 IF EXISTS (
 SELECT 1 FROM (
   SELECT DISTINCT d.assignment_id FROM public.project_daily_earnings d
   WHERE d.tenant_id=p_tenant_id AND d.work_date BETWEEN v_start AND v_end
 ) daily
 LEFT JOIN public.project_payroll_lines l
  ON l.tenant_id=p_tenant_id AND l.period_month=p_period_month
  AND l.assignment_id=daily.assignment_id
 WHERE l.id IS NULL
 ) THEN RAISE EXCEPTION 'Daily earnings without project salary rates cannot be calculated'; END IF;

 INSERT INTO public.payroll_records
  (id,tenant_id,period_month,employee_id,employee_name,role,
   base_salary,incentives,overtime_hours,overtime_pay,penalties,tax_deductions,
   net_payable,status,payroll_source,created_at,updated_at)
 SELECT gen_random_uuid()::text,p_tenant_id,p_period_month,
  l.employee_id,max(e.full_name),max(coalesce(e.designation,'Delivery Rider')),
  round(sum(l.base_salary_aed),2),
  round(sum(l.commission_aed+l.tips_aed+l.incentives_aed),2),0,0,
  round(sum(l.deductions_aed),2),0,round(sum(l.net_payable_aed),2),
  'DRAFT','PROJECT_SPLIT_DEMO',now(),now()
 FROM public.project_payroll_lines l
 JOIN public.employees e ON e.id=l.employee_id AND e.tenant_id=p_tenant_id
 WHERE l.tenant_id=p_tenant_id AND l.period_month=p_period_month
 GROUP BY l.employee_id
 ON CONFLICT (tenant_id,employee_id,period_month)
 DO UPDATE SET
   employee_name=EXCLUDED.employee_name,role=EXCLUDED.role,
   base_salary=EXCLUDED.base_salary,incentives=EXCLUDED.incentives,
   penalties=EXCLUDED.penalties,net_payable=EXCLUDED.net_payable,
   payroll_source='PROJECT_SPLIT_DEMO',updated_at=now()
 WHERE payroll_records.status='DRAFT'
  AND payroll_records.payroll_source='PROJECT_SPLIT_DEMO';

 SELECT count(*),coalesce(sum(net_payable_aed),0)
 INTO v_count,v_total FROM public.project_payroll_lines
 WHERE tenant_id=p_tenant_id AND period_month=p_period_month;

 SELECT NOT EXISTS(
  SELECT 1 FROM (
    SELECT l.employee_id,round(sum(l.net_payable_aed),2) line_total,
     max(p.net_payable) payroll_total
    FROM public.project_payroll_lines l
    JOIN public.payroll_records p ON p.tenant_id=l.tenant_id
     AND p.period_month=l.period_month AND p.employee_id=l.employee_id
    WHERE l.tenant_id=p_tenant_id AND l.period_month=p_period_month
    GROUP BY l.employee_id
   ) x WHERE x.line_total IS DISTINCT FROM x.payroll_total
 ) INTO v_reconciled;
 IF NOT v_reconciled THEN
  RAISE EXCEPTION 'Project ledger does not reconcile to employee payroll';
 END IF;
 RETURN jsonb_build_object(
  'success',true,'period_month',p_period_month,'project_lines',v_count,
  'total_net_payable_aed',v_total,'reconciled',v_reconciled,
  'is_demo',true,'payment_processed',false
 );
END $$;

REVOKE ALL ON FUNCTION public.demo_generate_project_payroll(text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_generate_project_payroll(text,text)
 TO service_role;
