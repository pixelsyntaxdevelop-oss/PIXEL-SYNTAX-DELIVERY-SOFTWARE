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
    let q = db.from(table).select('*').eq('tenant_id', tenantId).range(index * batchSize, index * batchSize + batchSize - 1);
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
  const employees = await pageRecords(db, 'employees', tenantId, { archived: false });
  const employeeMap = new Map<string, any>(employees.map((emp: any) => [emp.id, emp]));
  const records = rows.map((r: any) => {
    const e = employeeMap.get(r.employee_id) || {};
    return {
      ...r,
      employee_code: e.employee_code || r.employee_id,
      project_name: e.project_name || 'Unassigned',
      salary_structure_type: e.salary_type || 'MONTHLY',
      calculated_base_salary: Number(r.base_salary || 0),
      calculated_deliveries_commission: Number(r.incentives || 0),
      overtime_pay: Number(r.overtime_pay || 0),
      allowances_total: 0,
      traffic_fines_deduction: Number(r.penalties || 0),
      penalties_total: Number(r.penalties || 0),
      salik_deduction: 0,
      advance_deduction: 0,
      net_salary: Number(r.net_payable || 0),
      days_worked: new Date(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)), 0).getDate(),
      deliveries_count: 0,
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
  };
  return { success: true, period, records, exceptions: [] };
}

export async function handleDemoPayrollWorkerRoutes(
  request: Request, db: SupabaseClient, tenantId: string
): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (!path.startsWith('/api/v1/payroll/')) return null;
  if (tenantId !== 'company_pixel_syntax') return json({ error: 'Forbidden tenant' }, 403);
  const method = request.method;

  try {
    const periodMatch = path.match(/^\/api\/v1\/payroll\/periods\/(\d{4}-\d{2})$/);
    if (method === 'GET' && periodMatch) {
      if (!validPeriod(periodMatch[1])) return json({ error: 'Invalid payroll month' }, 400);
      return json(await monthData(db, tenantId, periodMatch[1]));
    }

    if (method === 'POST' && path === '/api/v1/payroll/generate') {
      const body: any = await request.json().catch(() => ({}));
      const year = Number(body.year), month = Number(body.month);
      const periodKey = String(year) + '-' + String(month).padStart(2, '0');
      if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12 || !validPeriod(periodKey)) {
        return json({ error: 'Invalid month or year' }, 400);
      }
      const employees = await pageRecords(db, 'employees', tenantId, { archived: false });
      const existing = await pageRecords(db, 'payroll_records', tenantId, { period: periodKey });
      const existingIds = new Set(existing.map((r: any) => r.employee_id));
      const rows: any[] = [];
      for (const e of employees) {
        if (existingIds.has(e.id)) continue; // never rewrite approved/imported salary data
        const start = new Date(e.joining_date || (periodKey + '-01'));
        const periodEnd = new Date(year, month, 0);
        if (start > periodEnd) continue;
        const base = Number(e.basic_salary ?? e.salary_base ?? 0);
        if (!Number.isFinite(base) || base < 0) continue;
        const daysInMonth = periodEnd.getDate();
        const daysWorked = start.getFullYear() === year && start.getMonth() === month - 1
          ? Math.max(0, daysInMonth - start.getDate() + 1) : daysInMonth;
        const prorated = round(base * daysWorked / daysInMonth);
        rows.push({
          id: crypto.randomUUID(), tenant_id: tenantId, period_month: periodKey,
          employee_id: e.id, employee_name: e.full_name, role: e.designation || 'Employee',
          base_salary: prorated, incentives: 0, overtime_hours: 0, overtime_pay: 0,
          penalties: 0, tax_deductions: 0, net_payable: prorated, status: 'DRAFT',
        });
      }
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from('payroll_records')
          .upsert(rows.slice(i, i + 200), {
            onConflict: 'tenant_id,employee_id,period_month', ignoreDuplicates: true,
          });
        if (error) return json({ error: 'Payroll save failed: ' + error.message }, 500);
      }
      return json(await monthData(db, tenantId, periodKey));
    }

    const action = path.match(/^\/api\/v1\/payroll\/periods\/(\d{4}-\d{2})\/(approve|publish|pay|reverse-payment|sif)$/);
    if (action) {
      const periodKey = action[1], verb = action[2];
      if (!validPeriod(periodKey)) return json({ error: 'Invalid period' }, 400);
      if (verb === 'sif') return json({ error: 'WPS SIF export not yet verified for UAE bank processing.' }, 501);
      if (verb === 'pay' || verb === 'reverse-payment') {
        return json({ error: 'This is a demo. No bank/WPS integration is connected. Real transfers or reversals are disabled.' }, 409);
      }
      if (method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const from = verb === 'approve' ? 'DRAFT' : 'APPROVED';
      const to = verb === 'approve' ? 'APPROVED' : 'PUBLISHED';
      const { data, error } = await db.from('payroll_records').update({ status: to, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('period_month', periodKey).eq('status', from)
        .select('id');
      if (error) return json({ error: error.message }, 500);
      if (!data?.length) return json({ error: 'No eligible salary drafts to ' + verb }, 409);
      return json(await monthData(db, tenantId, periodKey));
    }

    if (method === 'GET' && path === '/api/v1/payroll/advances') {
      const { data, error } = await db.from('employee_loans').select('*')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500);
      if (error) return json({ error: error.message }, 500);
      const advances = (data || []).map((l: any) => ({
        ...l, employeeId: l.employee_id, amount: Number(l.principal_amount),
        installments: Math.max(1, Math.round(Number(l.principal_amount) / Math.max(1, Number(l.monthly_installment)))),
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
