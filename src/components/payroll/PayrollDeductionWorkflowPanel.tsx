import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3, ShieldCheck } from 'lucide-react';

type DeductionRow = {
  id: string; employee_name: string; employee_code: string;
  source_type: string; source_id: string; amount_aed: number;
  due_month: string; original_due_month: string; status: string;
  reason: string; postponement_reason?: string; vehicle_id?: string;
  incident_at?: string; evidence_reference?: string;
};
interface Props {
  period: string;
  stage?: string;
  calculatedAt?: string | null;
  onUpdated: () => void | Promise<void>;
}

const api = async (path: string, method = 'GET', payload?: unknown) => {
  const response = await fetch(path, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(String(data?.error || 'Unable to save the demo payroll record.'));
  }
  return data;
};
const nextPeriod = (period: string) => {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]), month = Number(match[2]);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
};

export const PayrollDeductionWorkflowPanel: React.FC<Props> = ({ period, stage = 'DRAFT', calculatedAt, onUpdated }) => {
  const [items, setItems] = useState<DeductionRow[]>([]);
  const [fineOptions, setFineOptions] = useState<any[]>([]);
  const [loanOptions, setLoanOptions] = useState<any[]>([]);
  const [bikeOptions, setBikeOptions] = useState<any[]>([]);
  const [fineId, setFineId] = useState('');
  const [loanId, setLoanId] = useState('');
  const [bikeId, setBikeId] = useState('');
  const [repairAmount, setRepairAmount] = useState('');
  const [repairAt, setRepairAt] = useState('');
  const [repairRef, setRepairRef] = useState('');
  const [repairReason, setRepairReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [consent, setConsent] = useState('');
  const [reason, setReason] = useState('');
  const [deferTo, setDeferTo] = useState(() => nextPeriod(period));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recalculateNeeded, setRecalculateNeeded] = useState(false);
  const isDraft = stage === 'DRAFT';
  // An actual recomputation refreshes this server-owned timestamp.
  useEffect(() => { if (calculatedAt) setRecalculateNeeded(false); }, [calculatedAt]);
  const pendingCount = items.filter(d => d.due_month === period && d.status === 'REVIEW_REQUIRED').length;
  const dueItems = items.filter(d => d.due_month === period);
  const deductionTotal = dueItems.filter(d => d.status === 'APPROVED')
    .reduce((n, d) => n + Number(d.amount_aed || 0), 0);

  const load = async () => {
    try {
      const [deductions, fines, loans, bikes] = await Promise.all([
        api('/api/v1/payroll/deductions?period=' + encodeURIComponent(period)),
        api('/api/v1/payroll/fine-candidates'),
        api('/api/v1/payroll/loan-candidates'),
        api('/api/v1/payroll/bike-candidates'),
      ]);
      setItems(Array.isArray(deductions.deductions) ? deductions.deductions : []);
      setFineOptions(Array.isArray(fines.fines) ? fines.fines : []);
      setLoanOptions(Array.isArray(loans.loans) ? loans.loans : []);
      setBikeOptions(Array.isArray(bikes.vehicles) ? bikes.vehicles : []);
    } catch (err: any) {
      setError(String(err?.message || 'Deduction register unavailable'));
    }
  };
  useEffect(() => {
    setDeferTo(nextPeriod(period));
    setRecalculateNeeded(false);
    load();
  }, [period]);

  const perform = async (path: string, payload: unknown, label: string, markRecalculate = true) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api(path, 'POST', payload);
      setMessage(label);
      if (markRecalculate) setRecalculateNeeded(true);
      await load();
      await onUpdated();
    } catch (err: any) {
      setError(String(err?.message || 'Operation failed'));
    } finally {
      setBusy(false);
    }
  };
  const stageAction = async (action: 'submit' | 'approve' | 'verify' | 'ready') => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/api/v1/payroll/periods/' + encodeURIComponent(period) + '/' + action, 'POST', {
        reason: reason || 'Demo payroll verified with supporting ledger',
      });
      setMessage('Workflow updated: ' + action.toUpperCase() + '. No bank transfer was made.');
      setRecalculateNeeded(false);
      await onUpdated(); await load();
    } catch (err: any) {
      setError(String(err?.message || 'Approval action failed'));
    } finally {
      setBusy(false);
    }
  };
  const field = 'rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm min-w-0 w-full';
  const button = 'px-3 py-2 rounded-xl font-bold text-xs bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <section aria-label="Salary deductions and approval" className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Salary Review, Fines & Loans
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Draft → Approval → Independent Verification → Ready to Process
          </p>
        </div>
        <div className="text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-2">
          {period} / {stage.replace(/_/g, ' ')}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-[11px] text-amber-800 dark:text-amber-300">Pending liability review</p>
          <p className="text-lg font-black text-amber-800 dark:text-amber-300">{pendingCount}</p>
        </div>
        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
          <p className="text-[11px] text-slate-500">Approved deduction candidates</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">AED {deductionTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
          <p className="text-[11px] text-slate-500">Payable status</p>
          <p className="text-sm font-black text-slate-900 dark:text-white">NOT TRANSFERRED</p>
        </div>
      </div>

      {error && <div role="alert" className="text-xs p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">{error}</div>}
      {message && <div role="status" className="text-xs p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">{message}</div>}
      {recalculateNeeded && <div role="status" className="text-xs p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
        Deduction changed. Use <strong>Recalculate</strong> in Payroll Register before submitting the month.
      </div>}

      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Link existing records to this payroll period</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold">Traffic fine — use violation-time bike holder</label>
            <select value={fineId} onChange={e => setFineId(e.target.value)} className={field} disabled={!isDraft || busy}>
              <option value="">Choose recorded fine...</option>
              {fineOptions.map((f: any) =>
                <option key={f.id} value={f.id} disabled={f.already_linked}>
                  {f.fine_number} • {f.plate_number} • AED {f.amount} {f.already_linked ? '(linked)' : ''}
                </option>)}
            </select>
            <button type="button" disabled={!isDraft || busy || !fineId} className={button}
              onClick={() => perform('/api/v1/payroll/deductions/from-fine',
                { fine_id: fineId, due_month: period },
                'Fine linked to incident-date bike holder. Approval still required.')}>
              Link Fine for Review
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold">Employee advance / loan installment</label>
            <select value={loanId} onChange={e => setLoanId(e.target.value)} className={field} disabled={!isDraft || busy}>
              <option value="">Choose active loan...</option>
              {loanOptions.map((loan:any) =>
                <option key={loan.id} value={loan.id}>
                  {loan.employee_name} • AED {loan.monthly_installment}/month • Remaining AED {loan.remaining_balance}
                </option>)}
            </select>
            <button type="button" disabled={!isDraft || busy || !loanId} className={button}
              onClick={() => perform('/api/v1/payroll/deductions/loan-installment',
                { loan_id: loanId, due_month: period },
                'Loan installment queued for review.')}>
              Queue Loan Installment
            </button>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
          <p className="text-xs font-bold">Bike maintenance deduction candidate</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className={field} value={bikeId} onChange={e => setBikeId(e.target.value)} disabled={!isDraft || busy}>
              <option value="">Choose bike</option>
              {bikeOptions.map((bike:any) => <option key={bike.id} value={bike.id}>{bike.plate_number}</option>)}
            </select>
            <input className={field} type="datetime-local" value={repairAt} onChange={e => setRepairAt(e.target.value)}
              aria-label="Maintenance incident date and time" disabled={!isDraft || busy}/>
            <input className={field} type="number" min="0.01" step="0.01" value={repairAmount}
              onChange={e => setRepairAmount(e.target.value)} placeholder="Maintenance charge AED" disabled={!isDraft || busy}/>
            <input className={field} value={repairRef} onChange={e => setRepairRef(e.target.value)}
              placeholder="Invoice/reference number" disabled={!isDraft || busy}/>
            <input className={field} value={repairReason} onChange={e => setRepairReason(e.target.value)}
              placeholder="Reason and supporting evidence" disabled={!isDraft || busy}/>
            <button type="button" className={button}
              disabled={!isDraft || busy || !bikeId || !repairAt || !(Number(repairAmount)>0) || !repairRef.trim() || !repairReason.trim()}
              onClick={() => perform('/api/v1/payroll/deductions/from-maintenance',
                { vehicle_id: bikeId, incident_at: new Date(repairAt).toISOString(),
                  amount_aed: Number(repairAmount), reference: repairRef.trim(),
                  reason: repairReason.trim(), due_month: period },
                'Maintenance linked to historical bike holder; awaiting review.')}>
              Add Maintenance for Review
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-black text-slate-900 dark:text-white">Deduction decision register</h4>
        <p className="text-xs text-slate-500">A traffic fine, repair cost or loan must have supporting evidence and approval before salary withholding. Demo references are not real consent.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className={field} value={evidence} onChange={e => setEvidence(e.target.value)}
            placeholder="Evidence / receipt reference"/>
          <input className={field} value={consent} onChange={e => setConsent(e.target.value)}
            placeholder="Written consent / lawful basis reference"/>
          <input className={field} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Decision / postponement reason"/>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Postpone until:</span>
          <input aria-label="Postpone to salary month" type="month" min={nextPeriod(period)}
            className={field + ' max-w-48'} value={deferTo} onChange={e => setDeferTo(e.target.value)}/>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-2">Employee</th><th className="p-2">Source</th><th className="p-2">Month</th>
                <th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2"><strong>{d.employee_name}</strong><span className="block text-slate-500">{d.employee_code}</span></td>
                  <td className="p-2">{d.source_type.replace(/_/g,' ')}
                    <span className="block text-slate-500" title={d.reason}>{d.source_id}</span>
                  </td>
                  <td className="p-2">{d.due_month}
                    {d.due_month !== d.original_due_month && <span className="block text-amber-600">From {d.original_due_month}</span>}
                  </td>
                  <td className="p-2 font-bold">AED {Number(d.amount_aed).toFixed(2)}</td>
                  <td className="p-2">{d.status}</td>
                  <td className="p-2">
                    {isDraft && d.due_month === period && ['REVIEW_REQUIRED','APPROVED','POSTPONED'].includes(d.status) && (
                      <div className="flex flex-wrap gap-1">
                        {d.status !== 'APPROVED' && <button type="button" disabled={busy || evidence.trim().length<6 || consent.trim().length<6}
                          className="px-2 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40"
                          onClick={() => perform('/api/v1/payroll/deductions/' + encodeURIComponent(d.id) + '/action',
                            { action:'APPROVE', evidence_reference:evidence, consent_reference:consent,
                              reason:reason },'Liability approved for demo. Recalculate salary before submission.')}>Approve</button>}
                        <button type="button" disabled={busy || !deferTo || deferTo<=d.due_month || reason.trim().length<6}
                          className="px-2 py-1.5 rounded-lg bg-amber-100 text-amber-900 disabled:opacity-40"
                          onClick={() => perform('/api/v1/payroll/deductions/' + encodeURIComponent(d.id) + '/action',
                            {action:'POSTPONE', next_month:deferTo, reason},'Deduction deferred. History preserved.')}>
                          Postpone</button>
                        <button type="button" disabled={busy || reason.trim().length<6}
                          className="px-2 py-1.5 rounded-lg bg-slate-100 text-rose-700 disabled:opacity-40"
                          onClick={() => perform('/api/v1/payroll/deductions/' + encodeURIComponent(d.id) + '/action',
                            {action:'CANCEL',reason},'Deduction cancelled with audit reason.')}>Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length===0 && <tr><td className="p-4 text-slate-500" colSpan={6}>
                No deductions for this selected month. An empty deduction register is not a payment confirmation.
              </td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex gap-2 items-center">
          <CircleDollarSign className="w-4 h-4"/> Payroll authorization sequence
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={button} type="button" disabled={busy || stage!=='DRAFT' || recalculateNeeded || pendingCount>0}
            onClick={() => stageAction('submit')}>1. Submit for Approval</button>
          <button className={button} type="button" disabled={busy || stage!=='PENDING_APPROVAL'}
            onClick={() => stageAction('approve')}>2. Approve Salary</button>
          <button className={button} type="button" disabled={busy || stage!=='APPROVED'}
            onClick={() => stageAction('verify')}>3. Verify (Different User)</button>
          <button className={button} type="button" disabled={busy || stage!=='VERIFIED'}
            onClick={() => stageAction('ready')}>4. Ready to Process</button>
        </div>
        {pendingCount>0 && <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4"/> Resolve {pendingCount} pending deduction(s) or postpone before approval.
        </p>}
        <p className="text-[11px] text-slate-500 flex gap-1 items-start">
          <Clock3 className="w-3.5 h-3.5 shrink-0"/>
          Ready to Process is not PAID. Bank/WPS integration and bank reconciliation remain disabled in this demo.
        </p>
      </div>
    </section>
  );
};
