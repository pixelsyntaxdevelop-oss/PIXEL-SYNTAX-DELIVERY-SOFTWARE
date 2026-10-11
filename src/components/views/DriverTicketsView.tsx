import React, { useState } from 'react';
import {
  AlertTriangle,
  Search,
  Plus,
  Download,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
  FileText,
  Clock,
  Filter,
} from 'lucide-react';
import { DriverTicket } from '../../types/erp';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

const INITIAL_TICKETS: DriverTicket[] = [
  { id: 'tkt_1', ticketNumber: 'TKT-2026-8812', riderId: 'r_1', riderName: 'Ahmed Farooq', vehiclePlate: 'DXB-M-8841', violationDate: '2026-08-01', violationType: 'SPEEDING', location: 'Sheikh Zayed Road (Radar #12)', fineAmountAED: 600, status: 'ASSIGNED_TO_DRIVER', deductedFromPayroll: true },
  { id: 'tkt_2', ticketNumber: 'TKT-2026-8813', riderId: 'r_2', riderName: 'Johnathan Wick', vehiclePlate: 'AUH-C-9912', violationDate: '2026-08-02', violationType: 'PARKING', location: 'Corniche Area No-Parking Zone', fineAmountAED: 200, status: 'PENDING_REVIEW', deductedFromPayroll: false },
  { id: 'tkt_3', ticketNumber: 'TKT-2026-8814', riderId: 'r_3', riderName: 'Hamza Al-Maktoum', vehiclePlate: 'SHJ-K-4410', violationDate: '2026-07-28', violationType: 'LANE_VIOLATION', location: 'E11 Highway Sharjah Exit', fineAmountAED: 400, status: 'PAID', deductedFromPayroll: true },
  { id: 'tkt_4', ticketNumber: 'TKT-2026-8815', riderId: 'r_4', riderName: 'Sufyan Ali', vehiclePlate: 'DXB-M-1024', violationDate: '2026-08-03', violationType: 'NO_HELMET', location: 'Jumeirah Road Camera', fineAmountAED: 500, status: 'DISPUTED', deductedFromPayroll: false },
];

export const DriverTicketsView: React.FC<{ lang: 'EN' | 'AR' }> = ({ lang }) => {
  const [tickets, setTickets] = useState<DriverTicket[]>(INITIAL_TICKETS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [ticketNum, setTicketNum] = useState('');
  const [riderName, setRiderName] = useState('');
  const [plate, setPlate] = useState('DXB-M-');
  const [violationType, setViolationType] = useState<'SPEEDING' | 'PARKING' | 'LANE_VIOLATION' | 'RED_LIGHT' | 'NO_HELMET'>('SPEEDING');
  const [amount, setAmount] = useState(500);
  const [location, setLocation] = useState('Dubai Main Arterial');

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderName) return;

    const newTicket: DriverTicket = {
      id: `tkt_${Date.now()}`,
      ticketNumber: ticketNum || `TKT-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
      riderId: `r_${Date.now()}`,
      riderName,
      vehiclePlate: plate,
      violationDate: new Date().toISOString().split('T')[0],
      violationType,
      location,
      fineAmountAED: Number(amount),
      status: 'ASSIGNED_TO_DRIVER',
      deductedFromPayroll: true,
    };

    setTickets([newTicket, ...tickets]);
    setIsAddModalOpen(false);
    setRiderName('');
    setTicketNum('');
  };

  const totalFinesAED = tickets.reduce((acc, curr) => acc + curr.fineAmountAED, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            {lang === 'EN' ? 'Driver Tickets & Traffic Fines Management' : 'مخالفات وتذاكر السائقين والخصومات'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'RTA & Police traffic violation tracking, ticket assignments, disputes, and automatic payroll deduction synchronization.'
              : 'متابعة المخالفات المرورية المسجلة على المركبات والخصم التلقائي من راتب السائق.'}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Log Traffic Fine / Ticket
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Fines Logged</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">AED {totalFinesAED.toLocaleString()}</p>
          <span className="text-[10px] text-slate-500">{tickets.length} Active Tickets</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Pending Review</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {tickets.filter((t) => t.status === 'PENDING_REVIEW').length}
          </p>
          <span className="text-[10px] text-slate-500">Awaiting Assignment</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Deducted from Payroll</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {tickets.filter((t) => t.deductedFromPayroll).length}
          </p>
          <span className="text-[10px] text-slate-500">Auto Synced with HR</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Under Dispute</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {tickets.filter((t) => t.status === 'DISPUTED').length}
          </p>
          <span className="text-[10px] text-slate-500">Objection filed</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ticket #, driver, or plate..."
            className="w-full bg-slate-100 dark:bg-slate-800 pl-9 pr-4 py-1.5 rounded-md text-xs border border-transparent focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'PENDING_REVIEW', 'ASSIGNED_TO_DRIVER', 'PAID', 'DISPUTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3 pl-4">Ticket Number</th>
                <th className="p-3">Rider / Driver</th>
                <th className="p-3">Vehicle Plate</th>
                <th className="p-3">Violation Type</th>
                <th className="p-3">Violation Date</th>
                <th className="p-3">Fine Amount</th>
                <th className="p-3">Payroll Sync</th>
                <th className="p-3 text-right pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 pl-4 font-mono font-bold text-slate-900 dark:text-white">{t.ticketNumber}</td>
                  <td className="p-3 font-semibold">{t.riderName}</td>
                  <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.vehiclePlate}</td>
                  <td className="p-3">
                    <Badge variant="danger">{t.violationType}</Badge>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{t.location}</p>
                  </td>
                  <td className="p-3 font-mono">{t.violationDate}</td>
                  <td className="p-3 font-extrabold text-rose-600 dark:text-rose-400">AED {t.fineAmountAED}</td>
                  <td className="p-3">
                    {t.deductedFromPayroll ? (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Synced
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-right pr-4">
                    <Badge
                      variant={
                        t.status === 'PAID'
                          ? 'success'
                          : t.status === 'ASSIGNED_TO_DRIVER'
                          ? 'info'
                          : t.status === 'DISPUTED'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Traffic Ticket / Fine"
        subtitle="Record RTA / Police fine and assign to driver"
      >
        <form onSubmit={handleAddTicket} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Driver Full Name *</label>
            <input
              type="text"
              required
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              placeholder="e.g. Ahmed Farooq"
              className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Ticket Number</label>
              <input
                type="text"
                value={ticketNum}
                onChange={(e) => setTicketNum(e.target.value)}
                placeholder="TKT-2026-9901"
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Vehicle Plate #</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Violation Type</label>
              <select
                value={violationType}
                onChange={(e) => setViolationType(e.target.value as any)}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <option value="SPEEDING">SPEEDING</option>
                <option value="PARKING">PARKING</option>
                <option value="LANE_VIOLATION">LANE_VIOLATION</option>
                <option value="RED_LIGHT">RED_LIGHT</option>
                <option value="NO_HELMET">NO_HELMET</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Fine Amount (AED)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Violation Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Sheikh Zayed Rd Exit 22"
              className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-lg"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg">
              Confirm Ticket Entry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
