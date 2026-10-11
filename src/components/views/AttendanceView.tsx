import React, { useState } from 'react';
import {
  Clock,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Download,
  Filter,
  UserCheck,
  Building,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { AttendanceRecord } from '../../types/erp';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  { id: 'att_1', employeeId: 'emp_101', employeeName: 'Tariq Mansoor', employeeCode: 'EMP-101', date: '2026-08-04', checkIn: '08:00 AM', checkOut: '05:00 PM', status: 'PRESENT', location: 'Dubai HQ', shiftName: 'Morning Shift A', overtimeHours: 1.5 },
  { id: 'att_2', employeeId: 'emp_102', employeeName: 'Rashid Khan', employeeCode: 'EMP-102', date: '2026-08-04', checkIn: '08:45 AM', checkOut: '05:00 PM', status: 'LATE', location: 'Abu Dhabi Branch', shiftName: 'Morning Shift A', overtimeHours: 0 },
  { id: 'att_3', employeeId: 'emp_103', employeeName: 'Amina Al-Nuaimi', employeeCode: 'EMP-103', date: '2026-08-04', checkIn: '-', checkOut: '-', status: 'ON_LEAVE', location: '-', shiftName: 'Standard', overtimeHours: 0 },
  { id: 'att_4', employeeId: 'emp_104', employeeName: 'Bilal Farooq', employeeCode: 'EMP-104', date: '2026-08-04', checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'PRESENT', location: 'Dubai HQ', shiftName: 'Morning Shift B', overtimeHours: 2.0 },
  { id: 'att_5', employeeId: 'emp_105', employeeName: 'Sami Hassan', employeeCode: 'EMP-105', date: '2026-08-04', checkIn: '08:10 AM', checkOut: '04:30 PM', status: 'OFFICIAL_VISIT', location: 'RTA Headquarters', shiftName: 'Field Visit', overtimeHours: 0 },
];

export const AttendanceView: React.FC<{ lang: 'EN' | 'AR' }> = ({ lang }) => {
  const isDemo = typeof window !== 'undefined' && 
    (localStorage.getItem('apex_active_tenant_id') === 'company_demo' || 
     localStorage.getItem('active_tenant_id') === 'company_demo');
  const [records, setRecords] = useState<AttendanceRecord[]>(isDemo ? INITIAL_ATTENDANCE : []);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'holidays' | 'visits'>('daily');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [empName, setEmpName] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [checkIn, setCheckIn] = useState('08:00 AM');
  const [checkOut, setCheckOut] = useState('05:00 PM');
  const [location, setLocation] = useState('Dubai HQ');
  const [status, setStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'OFFICIAL_VISIT'>('PRESENT');

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName) return;

    const newRec: AttendanceRecord = {
      id: `att_${Date.now()}`,
      employeeId: `emp_${Date.now()}`,
      employeeName: empName,
      employeeCode: empCode || `EMP-${records.length + 100}`,
      date: new Date().toISOString().split('T')[0],
      checkIn: checkIn || '08:00 AM',
      checkOut: checkOut || '05:00 PM',
      status,
      location,
      shiftName: 'Standard Shift',
      overtimeHours: 0,
    };

    setRecords([newRec, ...records]);
    setIsAddModalOpen(false);
    setEmpName('');
    setEmpCode('');
  };

  const handleExportCSV = () => {
    const headers = 'ID,Employee Name,Employee Code,Date,Check In,Check Out,Status,Location,Overtime\n';
    const rows = filtered
      .map(
        (r) =>
          `"${r.id}","${r.employeeName}","${r.employeeCode}","${r.date}","${r.checkIn}","${r.checkOut}","${r.status}","${r.location}",${r.overtimeHours}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            {lang === 'EN' ? 'Attendance & Duty Rosters Management' : 'إدارة الحضور والانصراف والدوام'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Track daily check-ins, monthly employee summaries, holiday schedules, geofenced visits, and overtime calculations.'
              : 'متابعة سجلات الحضور اليومي والشهرية والزيارات الميدانية والإجازات الرسمية.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Log Attendance
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4 text-xs font-bold">
        {[
          { id: 'daily', label: 'Daily Employee Attendance' },
          { id: 'monthly', label: 'Monthly Summary' },
          { id: 'holidays', label: 'Holiday Management' },
          { id: 'visits', label: 'Visit Management' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2 transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Present Today</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">1,420</p>
          <span className="text-[10px] text-emerald-600 font-bold">96.2% On Time</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Late Check-ins</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">28</p>
          <span className="text-[10px] text-slate-500">Grace period active</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">On Approved Leave</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">14</p>
          <span className="text-[10px] text-slate-500">Annual &amp; Sick</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Overtime Hours</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">184.5 hrs</p>
          <span className="text-[10px] text-slate-500">This Month</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee or code..."
            className="w-full bg-slate-100 dark:bg-slate-800 pl-9 pr-4 py-1.5 rounded-md text-xs border border-transparent focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'OFFICIAL_VISIT'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
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
                <th className="p-3 pl-4">Employee</th>
                <th className="p-3">Date</th>
                <th className="p-3">Check In</th>
                <th className="p-3">Check Out</th>
                <th className="p-3">Location / Shift</th>
                <th className="p-3">Overtime</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 pl-4">
                    <p className="font-bold text-slate-900 dark:text-white">{r.employeeName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{r.employeeCode}</p>
                  </td>
                  <td className="p-3 font-mono">{r.date}</td>
                  <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">{r.checkIn}</td>
                  <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">{r.checkOut}</td>
                  <td className="p-3">
                    <p className="font-medium">{r.location}</p>
                    <p className="text-[10px] text-slate-400">{r.shiftName}</p>
                  </td>
                  <td className="p-3 font-mono text-purple-600 font-bold">{r.overtimeHours} hrs</td>
                  <td className="p-3">
                    <Badge
                      variant={
                        r.status === 'PRESENT'
                          ? 'success'
                          : r.status === 'LATE'
                          ? 'warning'
                          : r.status === 'ABSENT'
                          ? 'danger'
                          : 'info'
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right pr-4">
                    <button className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded font-bold text-[11px]">
                      Edit
                    </button>
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
        title="Manual Attendance Entry"
        subtitle="Record employee punch in/out"
      >
        <form onSubmit={handleAddRecord} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Employee Name *</label>
            <input
              type="text"
              required
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              placeholder="e.g. Omar Al-Sayed"
              className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Employee Code</label>
              <input
                type="text"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="EMP-902"
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="OFFICIAL_VISIT">OFFICIAL_VISIT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Check In Time</label>
              <input
                type="text"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Check Out Time</label>
              <input
                type="text"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-lg"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">
              Save Entry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
