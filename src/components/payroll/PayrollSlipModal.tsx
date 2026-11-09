import React from 'react';
import {
  Printer,
  XCircle,
  Building2,
  Calendar,
  CreditCard,
  ShieldAlert,
  Car,
  DollarSign,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface PayrollSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
  periodMonth?: string;
  periodKey?: string;
}

export const PayrollSlipModal: React.FC<PayrollSlipModalProps> = ({
  isOpen,
  onClose,
  record,
  periodMonth,
  periodKey,
}) => {
  if (!record) return null;

  const activePeriod = periodKey || periodMonth;

  const handlePrint = () => {
    window.print();
  };

  const projectLines = record.project_salary_lines || [];
  const fineTickets = record.traffic_fine_ticket_ids || [];
  const salikIds = record.salik_transaction_ids || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pixel Syntax Demo Salary Slip"
    >
      <div className="space-y-5 text-slate-900 dark:text-white max-w-2xl">
        {/* Printable Payslip Card */}
        <div id="printable-payslip" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Pixel Syntax Delivery Software — DEMO
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Monthly Compensation & Salary Slip
              </h3>
              <p className="text-[11px] text-slate-400">
                Sample payroll preview • Not a tax invoice or proof of payment
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-black rounded-xl inline-block">
                {activePeriod || record.period_month || new Date().toISOString().slice(0, 7)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Ref: {record.id || `PAY-${record.employee_code}`}
              </span>
            </div>
          </div>

          {/* Employee Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Employee Name</span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {record.employee_name}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Employee Code</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {record.employee_code}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Emirates ID</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {record.emirates_id || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Bank & IBAN</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 truncate block">
                {record.iban || 'Not provided'}
              </span>
            </div>
          </div>

          {/* Project Salary Earnings Lines (Multi-Project) */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Gross Earnings Breakdown</span>
              <span className="text-[10px] font-normal text-emerald-600">Calculated in Fils (AED)</span>
            </h4>
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Component / Project</th>
                    <th className="p-2.5 text-center">Plan</th>
                    <th className="p-2.5 text-right">Units/Hours</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">Subtotal (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Base Salary */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                      Standard Monthly Base Salary
                    </td>
                    <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">FIXED</td>
                    <td className="p-2.5 text-right font-mono">{record.days_worked || 30} days</td>
                    <td className="p-2.5 text-right font-mono">-</td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      AED {record.calculated_base_salary?.toLocaleString()}
                    </td>
                  </tr>

                  {/* Multi-Project Lines */}
                  {projectLines.map((pl: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold text-emerald-700 dark:text-emerald-400">
                        <div>{pl.project_name}</div>
                        {pl.supporting_details?.payout_mapping && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            Structure: {pl.supporting_details.payout_mapping}
                            {pl.supporting_details.additional_earnings > 0 ? ` • Tips/Bonus: +AED ${pl.supporting_details.additional_earnings}` : ''}
                            {pl.supporting_details.source_deductions > 0 ? ` • Sheet Ded: -AED ${pl.supporting_details.source_deductions}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">
                        {pl.calculation_method}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {pl.deliveries_count !== undefined && pl.deliveries_count !== null
                          ? `${pl.deliveries_count} orders`
                          : `${pl.working_hours || 0} hrs`}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {typeof pl.rate === 'number' && pl.rate > 0 ? `AED ${pl.rate}` : 'Partner Structure'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                        AED {pl.gross_earning?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Deliveries Commission if present and no project lines */}
                  {projectLines.length === 0 && record.calculated_deliveries_commission > 0 && (
                    <tr>
                      <td className="p-2.5 font-bold text-emerald-700 dark:text-emerald-400">
                        {record.project_name || 'Fleet Delivery'} Orders Commission
                      </td>
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">
                        PER_DROP
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {record.deliveries_count || 0} drops
                      </td>
                      <td className="p-2.5 text-right font-mono">-</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                        + AED {record.calculated_deliveries_commission?.toLocaleString()}
                      </td>
                    </tr>
                  )}

                  {/* Overtime */}
                  {record.overtime_pay > 0 && (
                    <tr>
                      <td className="p-2.5 font-bold text-blue-600">Overtime Compensation</td>
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">
                        HOURLY
                      </td>
                      <td className="p-2.5 text-right font-mono">{record.overtime_hours || 0} hrs</td>
                      <td className="p-2.5 text-right font-mono">-</td>
                      <td className="p-2.5 text-right font-mono font-bold text-blue-600">
                        + AED {record.overtime_pay?.toLocaleString()}
                      </td>
                    </tr>
                  )}

                  {/* Allowances */}
                  {record.allowances_total > 0 && (
                    <tr>
                      <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">
                        Allowances (Fuel, Mobile, Housing)
                      </td>
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-400">ALLOW</td>
                      <td className="p-2.5 text-right font-mono">Monthly</td>
                      <td className="p-2.5 text-right font-mono">-</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        + AED {record.allowances_total?.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deductions Breakdown (Separate Salik, Traffic Fines, Advances) */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Deductions & Recoveries
            </h4>
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Reference / Linked Tickets</th>
                    <th className="p-2.5 text-right">Amount (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Traffic Fines */}
                  <tr>
                    <td className="p-2.5 font-bold text-rose-600 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> Traffic Fines & Penalties
                    </td>
                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                      {fineTickets.length > 0
                        ? `${fineTickets.length} Violations (${fineTickets.slice(0, 2).join(', ')})`
                        : 'No pending police fines'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                      - AED {(record.traffic_fines_deduction || record.penalties_total || 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Salik Toll Transactions */}
                  <tr>
                    <td className="p-2.5 font-bold text-amber-600 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5" /> Salik Toll Crossings
                    </td>
                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                      {salikIds.length > 0
                        ? `${salikIds.length} Gate Crossings Recorded`
                        : 'Auto-synced Salik module'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-600">
                      - AED {(record.salik_deduction || 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Loan / Advance Deduction */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Employee Advance / Loan
                    </td>
                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                      Scheduled monthly installment
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                      - AED {(record.advance_deduction || record.loan_deduction || 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Manual / Other Deductions */}
                  {record.manual_deductions > 0 && (
                    <tr>
                      <td className="p-2.5 font-bold text-slate-600">Other Verified Deductions</td>
                      <td className="p-2.5 text-slate-500 font-mono text-[11px]">Approved adjustment</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                        - AED {record.manual_deductions.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Final Net Payable Banner */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 block uppercase tracking-wider">
                Net Salary — DEMO PREVIEW
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                No bank transfer or WPS file has been processed • {record.status}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                AED {record.net_salary?.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
