import type { SupabaseClient } from '@supabase/supabase-js';

/** Isolated demo-tenant payroll API. All routes run AFTER worker session verification. */
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });

const validPeriod = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const round = (value: number) => Math.round(value * 100) / 100;

async function pageRecords(db: SupabaseClient, table: string, tenantId: string, extra?: { period?: string; archived?: boolean }) {
  const records: any[] = [];
  const batchSize = 500;
  for (let index = 0; index < 20; index++) {
    let q = db.from(table).select('*').eq('tenant_id', tenantId).order('id', { ascending: true }).range(index * batchSize, index * batchSize + batchSize - 1);
    if (extra?.period) q = q.eq('period_month', extra.period);
    if (extra?.archived !== undefined) q = q.eq('is_archived', extra.archived);
    const { data, error } = await q;
    if (error) throw new Error('Unable to load ' + table + ': ' + error.message);
    records.push(...(data || []));
    if ((data || []).length < batchSize) break;
  }
  return records;
}

async function monthData(db: SupabaseClient, tenantId: string, periodKey: string) {
  const rows = await pageRecords(db, 'payroll_records', tenantId, { period: periodKey });
  const [employees, projectLines, projects, deductionApps, deductionLedger, reviewCycles] = await Promise.all([
    pageRecords(db, 'employees', tenantId, { archived: false }),
    pageRecords(db, 'project_payroll_lines', tenantId, { period: periodKey }),
    pageRecords(db, 'projects', tenantId),
    pageRecords(db, 'demo_payroll_deduction_applications', tenantId, { period: periodKey }),
    pageRecords(db, 'demo_payroll_deductions', tenantId),
    pageRecords(db, 'demo_payroll_review_cycles', tenantId, { period: periodKey }),
  ]);
  const employeeMap = new Map<string, any>(employees.map((emp: any) => [emp.id, emp]));
  const projectMap = new Map<string, any>(projects.map((project: any) => [project.id, project]));
  const deductionById = new Map<string, any>(deductionLedger.map((d: any) => [d.id, d]));
  const applicationsByEmployee = new Map<string, any[]>();
  for (const app of deductionApps) {
    const source = deductionById.get(app.deduction_id);
    const item = {
      id: app.deduction_id, source_type: source?.source_type || 'OTHER',
      amount_aed: Number(app.amount_aed || 0), reason: source?.reason || '',
      source_id: source?.source_id || '', evidence_reference: source?.evidence_reference || '',
    };
    applicationsByEmployee.set(app.employee_id, [...(applicationsByEmployee.get(app.employee_id) || []), item]);
  }

  const linesByEmployee = new Map<string, any[]>();
  for (const line of projectLines) {
    const project = projectMap.get(line.project_id);
    const shaped = {
      id: line.id,
      project_id: line.project_id,
      project_name: project?.name || line.project_id,
      project_code: project?.code || '',
      external_rider_id: line.external_rider_id || '',
      assignment_id: line.assignment_id,
      period_start: line.period_start,
      period_end: line.period_end,
      days_worked: Number(line.worked_days || 0),
      deliveries_count: Number(line.orders_count || 0),
      calculation_method: line.pay_model,
      rate: Number(line.rate_aed || 0),
      base_salary_aed: Number(line.base_salary_aed || 0),
      commission_aed: Number(line.commission_aed || 0),
      tips_aed: Number(line.tips_aed || 0),
      incentives_aed: Number(line.incentives_aed || 0),
      deductions_aed: Number(line.deductions_aed || 0),
      net_payable_aed: Number(line.net_payable_aed || 0),
      gross_earning: round(Number(line.base_salary_aed || 0) + Number(line.commission_aed || 0) +
        Number(line.tips_aed || 0) + Number(line.incentives_aed || 0)),
      calculation_source: line.calculation_source,
    };
    linesByEmployee.set(line.employee_id, [...(linesByEmployee.get(line.employee_id) || []), shaped]);
  }
  const records = rows.map((r: any) => {
    const e = employeeMap.get(r.employee_id) || {};
    const projectSalaryLines = (linesByEmployee.get(r.employee_id) || []).sort((a: any, b: any) =>
      a.period_start.localeCompare(b.period_start));
    const hasProjectLines = projectSalaryLines.length > 0;
    const applied = applicationsByEmployee.get(r.employee_id) || [];
    const sumDeduction = (sourceType: string) => round(applied.filter((d: any) => d.source_type === sourceType)
      .reduce((total: number, d: any) => total + d.amount_aed, 0));
    const fineTotal = sumDeduction('TRAFFIC_FINE');
    const maintenanceTotal = sumDeduction('BIKE_MAINTENANCE');
    const loanTotal = sumDeduction('LOAN');
    const manualTotal = sumDeduction('MANUAL_ADJUSTMENT');
    const externalDeductions = round(fineTotal + maintenanceTotal + loanTotal + manualTotal);

    const sumLines = (key: string) => round(projectSalaryLines.reduce((v: number, l: any) => v + Number(l[key] || 0), 0));
    const earnedDays = hasProjectLines ? sumLines('days_worked') :
      new Date(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)), 0).getDate();
    return {
      ...r,
      employee_code: e.employee_code || r.employee_id,
      project_name: hasProjectLines
        ? projectSalaryLines.map((l: any) => l.project_name).join(' / ')
        : (e.project_name || 'Unassigned'),
      salary_structure_type: hasProjectLines ? 'PROJECT_SPLIT' : (e.salary_type || 'MONTHLY'),
      project_salary_lines: projectSalaryLines,
      payroll_deduction_items: applied,
      employee_deductions_total: externalDeductions,
      loan_deduction: loanTotal,
      advance_deduction: loanTotal,
      bike_maintenance_deduction: maintenanceTotal,
      traffic_fines_deduction: fineTotal,
      manual_adjustment_deduction: manualTotal,
      project_source_deduction: hasProjectLines ? sumLines('deductions_aed') : 0,
      project_ids: projectSalaryLines.map((l: any) => l.project_id),
      calculated_base_salary: hasProjectLines ? sumLines('base_salary_aed') : Number(r.base_salary || 0),
      calculated_deliveries_commission: hasProjectLines ? sumLines('commission_aed') : Number(r.incentives || 0),
      overtime_pay: Number(r.overtime_pay || 0),
      allowances_total: hasProjectLines ?
        round(sumLines('tips_aed') + sumLines('incentives_aed')) : 0,
      penalties_total: Number(r.penalties || 0),
      salik_deduction: 0,
      net_salary: Number(r.net_payable || 0),
      days_worked: earnedDays,
      deliveries_count: hasProjectLines ? sumLines('deliveries_count') : 0,
      status: r.status || 'DRAFT',
    };
  });
  const total = round(records.reduce((sum: number, r: any) => sum + r.net_salary, 0));
  const allApproved = records.length && records.every((r: any) => r.status === 'APPROVED');
  const allPublished = records.length && records.every((r: any) => r.status === 'PUBLISHED');
  const period = {
    id: periodKey, period_month: periodKey,
    status: allPublished ? 'PUBLISHED' : allApproved ? 'APPROVED' : 'DRAFT',
    total_net_payable: total, total_net_salary: total, employees_count: records.length,
    is_demo: true,
    stage: reviewCycles[0]?.stage || 'DRAFT',
    payment_processed: false,
    gross_aed: Number(reviewCycles[0]?.gross_aed || 0),
    deductions_aed: Number(reviewCycles[0]?.deductions_aed || 0),
    total_external_deductions_aed: round(deductionApps.reduce((t: number, a: any) => t + Number(a.amount_aed || 0), 0)),
  };
  return { success: true, period, records, exceptions: [], pending_deductions: deductionLedger
    .filter((d: any) => d.due_month === periodKey && d.status === 'REVIEW_REQUIRED').length };
}

export async function handleDemoPayrollWorkerRoutes(
  request: Request, db: SupabaseClient, tenantId: string,
  actor: { userId: string; role: string }
): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (!path.startsWith('/api/v1/payroll/') &&
      !path.startsWith('/api/erp/payroll/employee-payroll-360/')) return null;
  if (tenantId !== 'company_pixel_syntax') return json({ error: 'Forbidden tenant' }, 403);
  const method = request.method;
  const privileged = ['COMPANY_ADMIN','SUPER_ADMIN','PAYROLL_MANAGER','FINANCE_MANAGER'].includes(actor.role);
  const writable = privileged || ['ERP_USER','HR_MANAGER'].includes(actor.role);

  try {
    const employeePayrollMatch = path.match(/^\/api\/erp\/payroll\/employee-payroll-360\/([^/]+)$/);
    if (method === 'GET' && employeePayrollMatch) {
      const employeeId = decodeURIComponent(employeePayrollMatch[1]);
      const { data: employee, error: empError } = await db.from('employees')
        .select('id,employee_code,full_name')
        .eq('tenant_id', tenantId).eq('id', employeeId).maybeSingle();
      if (empError) return json({ error: empError.message }, 500);
      if (!employee) return json({ error: 'Employee not found in demo tenant' }, 404);
      const [payrollRes, linesRes, projects] = await Promise.all([
        db.from('payroll_records').select('*').eq('tenant_id', tenantId)
          .eq('employee_id', employee.id).order('period_month', { ascending: false }).limit(120),
        db.from('project_payroll_lines').select('*').eq('tenant_id', tenantId)
          .eq('employee_id', employee.id).order('period_month', { ascending: false }).limit(500),
        pageRecords(db, 'projects', tenantId),
      ]);
      if (payrollRes.error || linesRes.error)
        return json({ error: payrollRes.error?.message || linesRes.error?.message }, 500);
      const projectNames = new Map<string,string>(projects.map((project: any) => [project.id, project.name]));
      const allLines: any[] = linesRes.data || [];
      const months = (payrollRes.data || []).map((payroll: any) => {
        const lines = allLines.filter((line: any) => line.period_month === payroll.period_month)
          .sort((a: any, b: any) => String(a.period_start).localeCompare(String(b.period_start)));
        const project_lines = lines.map((line: any) => ({
          id: line.id,
          project_id: line.project_id,
          project_name: projectNames.get(line.project_id) || line.project_id,
          external_rider_id: line.external_rider_id,
          external_id_type: 'Platform Rider ID',
          assignment_id: line.assignment_id,
          assignment_start_date: line.period_start,
          assignment_end_date: line.period_end,
          worked_days: Number(line.worked_days || 0),
          units_completed: Number(line.orders_count || 0),
          calculation_method: line.pay_model,
          rate: Number(line.rate_aed || 0),
          gross_earnings: round(Number(line.base_salary_aed || 0) +
            Number(line.commission_aed || 0) + Number(line.tips_aed || 0) +
            Number(line.incentives_aed || 0)),
          deductions: Number(line.deductions_aed || 0),
          incentives: Number(line.incentives_aed || 0),
          net_project_amount: Number(line.net_payable_aed || 0),
          calculation_source: line.calculation_source,
        }));
        const gross = project_lines.length
          ? round(project_lines.reduce((amount: number, line: any) => amount + line.gross_earnings, 0))
          : round(Number(payroll.base_salary || 0) + Number(payroll.incentives || 0) +
            Number(payroll.overtime_pay || 0));
        const deductions = project_lines.length
          ? round(project_lines.reduce((amount: number, line: any) => amount + line.deductions, 0))
          : round(Number(payroll.penalties || 0) + Number(payroll.tax_deductions || 0));
        return {
          month: payroll.period_month,
          period_month: payroll.period_month,
          status: payroll.status || 'DRAFT',
          gross_earnings: gross,
          deductions,
          net_payable: Number(payroll.net_payable || 0),
          project_lines,
          is_demo: true,
          payment_processed: false,
        };
      });
      return json({ success: true, employee, months, is_demo: true });
    }

    const periodMatch = path.match(/^\/api\/v1\/payroll\/periods\/(\d{4}-\d{2})$/);
    if (method === 'GET' && periodMatch) {
      if (!validPeriod(periodMatch[1])) return json({ error: 'Invalid payroll month' }, 400);
      return json(await monthData(db, tenantId, periodMatch[1]));
    }

    if (method === 'POST' && path === '/api/v1/payroll/generate') {
      const body: any = await request.json().catch(() => ({}));
      const year = Number(body.year), month = Number(body.month);
      const periodKey = String(year) + '-' + String(month).padStart(2, '0');
      if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) ||
          month < 1 || month > 12 || !validPeriod(periodKey)) {
        return json({ error: 'Invalid month or year' }, 400);
      }
      const { count, error: workError } = await db.from('project_daily_earnings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('work_date', periodKey + '-01')
        .lte('work_date', new Date(year, month, 0).toISOString().slice(0, 10));
      if (workError) return json({ error: workError.message }, 500);
      if (!count) {
        return json({
          error: 'No verified attendance/order source exists for this month. Salary was not generated.',
          is_demo: true,
        }, 409);
      }
      if (!writable) return json({ error: 'Payroll access denied for this role' }, 403);
      const { data, error } = await db.rpc('demo_prepare_payroll_with_deductions', {
        p_tenant: tenantId, p_month: periodKey, p_actor: actor.userId,
      });
      if (error || !data?.success) return json({ error: error?.message || 'Project payroll reconciliation failed' }, 409);
      return json(await monthData(db, tenantId, periodKey));
    }

    const action = path.match(/^\/api\/v1\/payroll\/periods\/(\d{4}-\d{2})\/(submit|approve|verify|ready|publish|pay|reverse-payment|sif)$/);
    if (action) {
      const periodKey = action[1], verb = action[2];
      if (!validPeriod(periodKey)) return json({ error: 'Invalid period' }, 400);
      if (verb === 'sif') return json({ error: 'WPS SIF export requires real bank and legal validation; disabled in demo.' }, 501);
      if (['pay','reverse-payment','publish'].includes(verb)) {
        return json({ error: 'Demo cannot transfer funds, reverse payment or publish paid wages. Use Ready to Process after verification.' }, 409);
      }
      if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!writable || (verb === 'approve' || verb === 'ready') && !privileged)
        return json({ error: 'This approval stage requires authorized payroll management role.' }, 403);
      const body: any = await request.json().catch(() => ({}));
      const { data, error } = await db.rpc('demo_advance_payroll_review', {
        p_tenant: tenantId,
        p_month: periodKey,
        p_action: verb.toUpperCase(),
        p_actor: actor.userId,
        p_comment: String(body.reason || '').slice(0,500),
      });
      if (error || !data?.success) return json({ error: error?.message || 'Approval stage failed' }, 409);
      return json(await monthData(db, tenantId, periodKey));
    }

    if (method === 'GET' && path === '/api/v1/payroll/fine-candidates') {
      const [fines, deductions] = await Promise.all([
        pageRecords(db, 'traffic_fines', tenantId),
        pageRecords(db, 'demo_payroll_deductions', tenantId),
      ]);
      const linked = new Set(deductions.filter((d:any) => d.source_type === 'TRAFFIC_FINE')
        .map((d:any) => d.source_id));
      return json({ success:true, fines: fines.map((fine:any)=>({
        id:fine.id, fine_number:fine.fine_number, plate_number:fine.plate_number,
        violation_date:fine.violation_date, amount:Number(fine.amount||0),
        driver_id:fine.driver_id, already_linked:linked.has(fine.id),
      })) });
    }
    if (method === 'GET' && path === '/api/v1/payroll/bike-candidates') {
      const vehicles = await pageRecords(db, 'vehicles', tenantId);
      return json({ success:true, vehicles: vehicles.filter((v:any)=>!v.vendor_returned)
        .map((v:any)=>({id:v.id, plate_number:v.plate_number, assigned_employee_id:v.current_employee_id})) });
    }
    if (method === 'GET' && path === '/api/v1/payroll/loan-candidates') {
      const [loans, employees] = await Promise.all([
        pageRecords(db, 'employee_loans', tenantId),
        pageRecords(db, 'employees', tenantId),
      ]);
      const names = new Map<string,string>(employees.map((e:any)=>[e.id,e.full_name]));
      return json({ success:true, loans:loans.filter((l:any)=>l.status==='ACTIVE')
        .map((l:any)=>({
          id:l.id,employee_id:l.employee_id,employee_name:names.get(l.employee_id)||l.employee_id,
          monthly_installment:Number(l.monthly_installment||0),
          remaining_balance:Number(l.remaining_balance||0),start_month:l.start_month,
        })) });
    }

    if (path === '/api/v1/payroll/deductions' && method === 'GET') {
      const period = new URL(request.url).searchParams.get('period') || '';
      if (!validPeriod(period)) return json({ error: 'Valid period required' }, 400);
      const [items, employees] = await Promise.all([
        pageRecords(db, 'demo_payroll_deductions', tenantId),
        pageRecords(db, 'employees', tenantId),
      ]);
      const employeeMap = new Map<string,any>(employees.map((e:any)=>[e.id,e]));
      return json({ success: true, period_month: period, deductions: items.filter((d:any)=>
        d.due_month === period || d.original_due_month === period).map((d:any)=>({
          ...d, employee_name: employeeMap.get(d.employee_id)?.full_name || d.employee_id,
          employee_code: employeeMap.get(d.employee_id)?.employee_code || '',
        }))});
    }

    if (path === '/api/v1/payroll/deductions/from-fine' && method === 'POST') {
      if (!writable) return json({ error: 'Insufficient permissions' }, 403);
      const body:any = await request.json().catch(()=>({}));
      if (!validPeriod(String(body.due_month || '')) || !body.fine_id)
        return json({ error: 'Fine ID and salary month required' }, 400);
      const { data,error } = await db.rpc('demo_register_historical_vehicle_fine',{
        p_tenant: tenantId,p_fine_id:String(body.fine_id),p_due_month:body.due_month,p_actor:actor.userId,
      });
      return error ? json({ error:error.message },409) : json(data,201);
    }

    if (path === '/api/v1/payroll/deductions/from-maintenance' && method === 'POST') {
      if (!writable) return json({ error: 'Insufficient permissions' },403);
      const body:any = await request.json().catch(()=>({}));
      const amount=Number(body.amount_aed);
      if (!body.vehicle_id || !body.incident_at || !body.reference || !validPeriod(String(body.due_month||'')) ||
          !Number.isFinite(amount) || amount<=0 || !String(body.reason||'').trim())
        return json({ error:'Bike, incident date, reference, positive amount and reason are required' },400);
      const { data,error }=await db.rpc('demo_register_vehicle_maintenance_charge',{
        p_tenant:tenantId,p_vehicle_id:String(body.vehicle_id),p_incident_at:body.incident_at,
        p_amount:amount,p_reference:String(body.reference),p_due_month:body.due_month,
        p_actor:actor.userId,p_reason:String(body.reason),
      });
      return error ? json({error:error.message},409):json(data,201);
    }

    if (path === '/api/v1/payroll/deductions/loan-installment' && method === 'POST') {
      if (!writable) return json({error:'Insufficient permissions'},403);
      const body:any=await request.json().catch(()=>({}));
      const period=String(body.due_month||'');
      if (!body.loan_id || !validPeriod(period)) return json({error:'Loan and due month required'},400);
      const {data:loan,error:loanError}=await db.from('employee_loans').select('*')
        .eq('tenant_id',tenantId).eq('id',String(body.loan_id)).maybeSingle();
      if (loanError || !loan || loan.status!=='ACTIVE') return json({error:'Active loan not found'},404);
      if (period<loan.start_month) return json({error:'Installment before loan starting month'},400);
      const amount=Math.round(Math.min(Number(loan.monthly_installment),Number(loan.remaining_balance))*100)/100;
      if (!Number.isFinite(amount) || amount<=0) return json({error:'Loan has no remaining installment'},409);
      const {data,error}=await db.from('demo_payroll_deductions').insert({
        tenant_id:tenantId,employee_id:loan.employee_id,source_type:'LOAN',
        source_id:loan.id+':'+period,original_due_month:period,due_month:period,
        amount_aed:amount,status:'REVIEW_REQUIRED',reason:'Loan installment pending required consent / review',
        created_by:actor.userId,
      }).select('*').single();
      return error?json({error:error.message},409):json({success:true,deduction:data},201);
    }

    const actionDeduction = path.match(/^\/api\/v1\/payroll\/deductions\/([^/]+)\/action$/);
    if (actionDeduction && method === 'POST') {
      if (!writable) return json({error:'Insufficient permissions'},403);
      const body:any=await request.json().catch(()=>({}));
      const verb=String(body.action||'').toUpperCase();
      if (!['APPROVE','POSTPONE','CANCEL'].includes(verb))
        return json({error:'Unsupported deduction review action'},400);
      if (verb==='APPROVE' && !privileged)
        return json({error:'Deduction approval requires payroll manager'},403);
      const {data,error}=await db.rpc('demo_review_or_postpone_deduction',{
        p_tenant:tenantId,p_deduction_id:decodeURIComponent(actionDeduction[1]),
        p_action:verb,p_actor:actor.userId,
        p_evidence:body.evidence_reference||null,p_consent:body.consent_reference||null,
        p_reason:body.reason||null,p_next_month:body.next_month||null,
      });
      return error?json({error:error.message},409):json(data);
    }

    if (method === 'GET' && path === '/api/v1/payroll/projects') {
      const period = new URL(request.url).searchParams.get('period') || '';
      if (!validPeriod(period)) return json({ error: 'Select payroll period as YYYY-MM' }, 400);
      const lines = await pageRecords(db, 'project_payroll_lines', tenantId, { period });
      const projects = await pageRecords(db, 'projects', tenantId);
      const results = projects.map((p: any) => {
        const matched = lines.filter((l: any) => l.project_id === p.id);
        return {
          project_id: p.id, project_name: p.name, project_code: p.code,
          employee_count: new Set(matched.map((l: any) => l.employee_id)).size,
          project_lines: matched.length,
          worked_days: matched.reduce((a: number, l: any) => a + Number(l.worked_days || 0), 0),
          orders_count: matched.reduce((a: number, l: any) => a + Number(l.orders_count || 0), 0),
          net_payable_aed: round(matched.reduce((a: number, l: any) => a + Number(l.net_payable_aed || 0), 0)),
          is_demo: true,
        };
      });
      return json({ success: true, period_month: period, projects: results, total_project_lines: lines.length,
        total_net_payable_aed: round(lines.reduce((sum: number, line: any) => sum + Number(line.net_payable_aed || 0), 0)) });
    }

    if (method === 'GET' && path === '/api/v1/payroll/employees') {
      const employees = await pageRecords(db, 'employees', tenantId, { archived: false });
      return json({
        success: true,
        employees: employees.map((e: any) => ({
          id: e.id, employee_code: e.employee_code, full_name: e.full_name,
          status: e.current_status,
        })),
      });
    }

    if (method === 'GET' && path === '/api/v1/payroll/advances') {
      const loans = await pageRecords(db, 'employee_loans', tenantId);
      const employees = await pageRecords(db, 'employees', tenantId);
      const byId = new Map<string, any>(employees.map((e: any) => [e.id, e]));
      const advances = loans.map((l: any) => ({
        ...l,
        employeeId: l.employee_id,
        employee_name: byId.get(l.employee_id)?.full_name || 'Unknown employee',
        employee_code: byId.get(l.employee_id)?.employee_code || l.employee_id,
        reason: l.notes || '',
        amount: Number(l.principal_amount),
        monthly_deduction: Number(l.monthly_installment),
        remaining_amount: Number(l.remaining_balance),
        installments: Math.max(1, Math.round(Number(l.principal_amount) / Math.max(1, Number(l.monthly_installment)))),
        registered_date: l.created_at?.slice(0, 10) || '',
      }));
      return json({ success: true, advances });
    }

    if (method === 'POST' && path === '/api/v1/payroll/advances') {
      const body: any = await request.json().catch(() => ({}));
      const employeeId = String(body.employeeId || body.employee_id || '');
      const amount = Number(body.amount), installments = Number(body.installments);
      if (!employeeId || !Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
        !Number.isInteger(installments) || installments < 1 || installments > 24) {
        return json({ error: 'Valid employee, amount and 1–24 installments are required' }, 400);
      }
      const { data: employee } = await db.from('employees').select('id,full_name')
        .eq('id', employeeId).eq('tenant_id', tenantId).maybeSingle();
      if (!employee) return json({ error: 'Employee does not exist in demo company' }, 404);
      const month = new Date().toISOString().slice(0, 7);
      const { data, error } = await db.from('employee_loans').insert({
        id: crypto.randomUUID(), tenant_id: tenantId, employee_id: employeeId,
        loan_type: 'ADVANCE', principal_amount: round(amount),
        monthly_installment: round(amount / installments), remaining_balance: round(amount),
        start_month: month, status: 'ACTIVE', notes: String(body.reason || 'Demo advance'),
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, advance: data });
    }

    const advanceIdMatch = path.match(/^\/api\/v1\/payroll\/advances\/([^/]+)$/);
    if (advanceIdMatch && (method === 'PATCH' || method === 'DELETE')) {
      const id = decodeURIComponent(advanceIdMatch[1]);
      const { data: existing, error: lookupError } = await db.from('employee_loans').select('*')
        .eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      if (lookupError) return json({ error: lookupError.message }, 500);
      if (!existing) return json({ error: 'Advance not found in this company.' }, 404);
      if (existing.status !== 'ACTIVE') return json({ error: 'Only active advances can be changed.' }, 409);
      let updates: Record<string, unknown>;
      if (method === 'DELETE') {
        updates = { status: 'CANCELLED', notes: String(existing.notes || '') + ' | Cancelled by authorized demo staff' };
      } else {
        if (Number(existing.remaining_balance) !== Number(existing.principal_amount)) {
          return json({ error: 'Advance with repayments cannot be edited. Reconcile the balance first.' }, 409);
        }
        const input: any = await request.json().catch(() => ({}));
        const amount = Number(input.amount);
        const installments = Number(input.installments);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
          !Number.isInteger(installments) || installments < 1 || installments > 24) {
          return json({ error: 'Invalid amount or installment count.' }, 400);
        }
        updates = { principal_amount: round(amount), remaining_balance: round(amount),
          monthly_installment: round(amount / installments), notes: String(input.reason || '').slice(0, 500) };
      }
      const { data, error } = await db.from('employee_loans')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('id', id).eq('status', 'ACTIVE')
        .select('*').maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: 'Advance changed by another user. Refresh and try again.' }, 409);
      return json({ success: true, advance: data });
    }

    if (method === 'GET' && path === '/api/v1/payroll/structures') {
      const { data, error } = await db.from('employees')
        .select('id,full_name,employee_code,basic_salary,salary_type')
        .eq('tenant_id', tenantId).eq('is_archived', false).limit(500);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, structures: (data || []).map((e: any) => ({
        id: e.id, name: e.full_name, employee_code: e.employee_code,
        base_salary: Number(e.basic_salary || 0),
        salary_type: e.salary_type || 'MONTHLY', commission_rate: 0,
      })) });
    }

    if (method === 'GET' && (path === '/api/v1/payroll/import/batches' ||
      path === '/api/v1/payroll/partner-workbook/batches')) {
      return json({ success: true, batches: [] });
    }

    return json({ error: 'Payroll feature not implemented in isolated demo: ' + path }, 501);
  } catch (err: any) {
    return json({ error: 'Payroll request failed: ' + String(err?.message || 'Unknown error') }, 500);
  }
}
