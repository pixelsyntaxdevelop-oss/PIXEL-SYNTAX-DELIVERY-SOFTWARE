import React, { useState, useEffect } from 'react';
import {
  Home,
  User,
  Briefcase,
  Bike,
  Smartphone,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Landmark,
  FileCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Send,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import { masterEmployeeService, Employee360Profile } from '../../services/masterEmployeeService';
import { DbEmployeeMaster } from '../../types/database';
import { apiClient } from '../../services/apiClient';

interface RiderSelfServicePortalViewProps {
  currentEmployeeId?: string;
  lang?: 'EN' | 'AR';
}

export const RiderSelfServicePortalView: React.FC<RiderSelfServicePortalViewProps> = ({
  currentEmployeeId,
  lang = 'EN',
}) => {
  const [employees, setEmployees] = useState<DbEmployeeMaster[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [profile, setProfile] = useState<Employee360Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | 'home'
    | 'profile'
    | 'project'
    | 'bike'
    | 'sim'
    | 'documents'
    | 'attendance'
    | 'salary'
    | 'fines'
    | 'loans'
    | 'forms'
  >('home');

  // Modals
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionNote, setCorrectionNote] = useState('');
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [selectedFineForDispute, setSelectedFineForDispute] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load initial employee list
  useEffect(() => {
    masterEmployeeService.getMasterEmployees().then((data) => {
      setEmployees(data);
      if (data && data.length > 0) {
        const initial = currentEmployeeId && data.find((e) => e.id === currentEmployeeId)
          ? currentEmployeeId
          : data[0].id;
        setSelectedEmpId(initial);
      }
    });
  }, [currentEmployeeId]);

  // Load profile when selected employee changes
  useEffect(() => {
    if (!selectedEmpId) return;
    setLoading(true);
    masterEmployeeService
      .getEmployee360Profile(selectedEmpId)
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => console.error('Error loading rider portal profile:', err))
      .finally(() => setLoading(false));
  }, [selectedEmpId]);

  if (loading || !profile) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold">Loading Rider Self-Service Portal...</p>
      </div>
    );
  }

  const { employee, currentProject, currentVehicle, currentSim, statusHistory, projectHistory } = profile;

  // Mocked salary split data derived for this employee
  const salaryData = {
    month: 'August 2026',
    status: 'PUBLISHED', // 'DRAFT' | 'APPROVED' | 'PUBLISHED'
    splitProjects: [
      { projectName: 'Keeta Delivery Hub', days: 15, baseAmount: 1650, incentives: 280 },
      { projectName: 'Talabat Dubai Hub', days: 16, baseAmount: 1850, incentives: 340 },
    ],
    allowances: { fuel: 350, mobile: 100, housing: 400 },
    deductions: { fines: 150, loans: 250, gosi: 0 },
    totalEarnings: 4670,
    totalDeductions: 400,
    netSalary: 4270,
  };

  // Mocked Attendance Data for current month
  const attendanceSummary = {
    month: 'August 2026',
    present: 27,
    absent: 1,
    leave: 0,
    weeklyOff: 3,
    totalWorkingDays: 31,
    overtimeHours: 14.5,
  };

  // Mocked Fines
  const finesList = [
    {
      id: 'fine_1',
      date: '2026-08-14',
      plate: currentVehicle?.plate_number || 'DXB-72154',
      authority: 'Dubai Police',
      reason: 'Bus Lane / Restricted Lane Violation (Al-Wasl Rd)',
      fineAmount: 400,
      adminFee: 20,
      total: 420,
      status: 'PAYROLL_DEDUCTED',
    },
    {
      id: 'fine_2',
      date: '2026-08-22',
      plate: currentVehicle?.plate_number || 'DXB-72154',
      authority: 'RTA Dubai',
      reason: 'Improper Parking at Delivery Zone',
      fineAmount: 200,
      adminFee: 20,
      total: 220,
      status: 'OUTSTANDING',
    },
  ];

  // Mocked Loans
  const loansList = [
    {
      id: 'loan_1',
      type: 'Advance Salary / Emergency Relocation',
      originalAmount: 1500,
      monthlyDeduction: 250,
      totalPaid: 750,
      remainingBalance: 750,
      status: 'ACTIVE',
      startDate: '2026-06-01',
    },
  ];

  // Mocked Forms / Letters
  const issuedForms = [
    { id: 'f_1', title: 'Salary Certificate (Bank Proof)', issueDate: '2026-08-01', type: 'Official Certificate' },
    { id: 'f_2', title: 'Vehicle Handover & Undertaking Form', issueDate: '2026-07-15', type: 'Fleet Agreement' },
    { id: 'f_3', title: 'NOC for SIM Card Registration', issueDate: '2026-07-15', type: 'Telecom NOC' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Rider Profile Selector (Simulate Rider Login) */}
      <div className="p-4 bg-linear-to-r from-indigo-900 via-blue-900 to-slate-900 text-white rounded-2xl border border-indigo-800/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center ring-2 ring-indigo-400 shrink-0">
            {employee.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Rider Self-Service Portal
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500 text-slate-950 uppercase">
                {employee.status}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white mt-0.5">
              Hello, {employee.full_name}
            </h1>
            <p className="text-xs text-indigo-200 font-mono">
              ID: {employee.employee_code} | EID: {employee.emirates_id || 'Pending EID'}
            </p>
          </div>
        </div>

        {/* Impersonation / View As Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] text-indigo-300 font-bold uppercase shrink-0">Switch Rider:</span>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="w-full sm:w-48 px-2.5 py-1.5 bg-slate-900/80 border border-indigo-700/60 rounded-xl text-xs text-white font-medium focus:outline-hidden"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.employee_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile-Friendly Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 shadow-xs overflow-x-auto flex items-center gap-1 text-xs font-bold scrollbar-none">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'project', label: 'My Project', icon: Briefcase },
          { id: 'bike', label: 'My Bike', icon: Bike },
          { id: 'sim', label: 'My SIM', icon: Smartphone },
          { id: 'documents', label: 'My Documents', icon: FileText },
          { id: 'attendance', label: 'My Attendance', icon: Calendar },
          { id: 'salary', label: 'My Salary', icon: DollarSign },
          { id: 'fines', label: 'My Fines', icon: AlertTriangle },
          { id: 'loans', label: 'My Loans', icon: Landmark },
          { id: 'forms', label: 'My Letters', icon: FileCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. HOME TAB */}
      {/* ======================================================== */}
      {activeTab === 'home' && (
        <div className="space-y-4">
          {/* Active Assignment Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Current Project</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {employee.current_project_name || 'Unassigned'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Hub ID: {employee.employee_code}</div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Assigned Bike</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {employee.current_bike_plate || 'No Bike Assigned'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">Mulkiya Active</div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-sky-50 dark:bg-sky-950/60 text-sky-600 rounded-xl">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Company SIM</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {employee.current_sim_number || 'No SIM Assigned'}
                </div>
                <div className="text-[10px] text-sky-600 font-semibold">DU Telecom Corporate</div>
              </div>
            </div>
          </div>

          {/* Current Month Quick Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attendance & Salary status */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>August 2026 Monthly Summary</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {salaryData.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-3">
                <div>
                  <span className="text-[10px] text-slate-400 block">Present</span>
                  <span className="text-base font-black text-emerald-600">{attendanceSummary.present} Days</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Overtime</span>
                  <span className="text-base font-black text-blue-600">{attendanceSummary.overtimeHours} hrs</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Net Salary</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">AED {salaryData.netSalary}</span>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('salary')}
                className="w-full py-2 bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View Full Payslip Breakdown</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Important Alerts & Passport / Fine Notice */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Rider Reminders & Compliance</span>
              </h3>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-blue-900 dark:text-blue-200">Physical Passport in Company Custody</span>
                  <p className="text-blue-700 dark:text-blue-300 text-[11px] mt-0.5">
                    Safe custody serial: {employee.passport_number || 'PP-RECORDED'}. Available for release upon approved leave request.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200">1 Traffic Fine Pending Review</span>
                  <p className="text-amber-700 dark:text-amber-300 text-[11px] mt-0.5">
                    RTA parking violation (AED 220). You can review details or submit a dispute in My Fines.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MY PROFILE TAB */}
      {/* ======================================================== */}
      {activeTab === 'profile' && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Official HR Record & Profile
              </h2>
              <p className="text-xs text-slate-500">Read-only verified company master data</p>
            </div>
            <button
              onClick={() => setIsCorrectionModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-blue-600" />
              <span>Request Info Correction</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Legal Name</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{employee.full_name}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Employee ID / System Code</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">{employee.employee_code}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Emirates ID</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{employee.emirates_id || '784-XXXX-XXXXXXX-X'}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Passport Number</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{employee.passport_number || 'PP-XXXXXXX'}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Mobile</span>
              <span className="font-bold text-slate-900 dark:text-white">{employee.contact_number || '+971 50 000 0000'}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Operating Branch</span>
              <span className="font-bold text-slate-900 dark:text-white">{employee.branch_name || 'Dubai Central Branch'}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Joining Date</span>
              <span className="font-bold text-slate-900 dark:text-white">{employee.joining_date || '2024-01-15'}</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Employment Status</span>
              <span className="font-bold text-emerald-600">{employee.status}</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MY PROJECT TAB */}
      {/* ======================================================== */}
      {activeTab === 'project' && (
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Active Client Project Assignment
            </h2>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-base font-black text-indigo-950 dark:text-indigo-200">
                  {employee.current_project_name || 'Talabat Dubai Hub'}
                </div>
                <div className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Assigned Project Rider ID: <span className="font-mono font-bold">{employee.employee_code_on_project || 'TB-99201'}</span>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-extrabold rounded-full text-[10px] uppercase">
                Active Assignment
              </span>
            </div>
          </div>

          {/* Project History Timeline */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Project History & Mid-Month Transfers
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Talabat Dubai Hub</div>
                  <div className="text-[11px] text-slate-500">16 Aug 2026 – Present (Current Active)</div>
                </div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded font-bold text-[10px]">
                  16 Days this month
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Keeta Delivery Hub</div>
                  <div className="text-[11px] text-slate-500">01 Aug 2026 – 15 Aug 2026 (Completed Transfer)</div>
                </div>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded font-bold text-[10px]">
                  15 Days this month
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MY BIKE TAB */}
      {/* ======================================================== */}
      {activeTab === 'bike' && (
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Current Assigned Vehicle Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Plate Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                  {employee.current_bike_plate || 'DXB-72154'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Make & Model</span>
                <span className="font-bold text-slate-900 dark:text-white">Yamaha FZ-FI 150cc (2024)</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Registration / Mulkiya</span>
                <span className="font-bold text-emerald-600">Valid till 30-Nov-2026</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Insurance Status</span>
                <span className="font-bold text-emerald-600">Comprehensive Commercial Fleet</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MY SIM TAB */}
      {/* ======================================================== */}
      {activeTab === 'sim' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Assigned Corporate Telecom SIM
          </h2>
          <div className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sky-900 dark:text-sky-200 font-bold text-sm font-mono">
                {employee.current_sim_number || '050-1234567'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-slate-950 uppercase">
                Active
              </span>
            </div>
            <div className="text-[11px] text-sky-700 dark:text-sky-300">
              Provider: <strong>DU Corporate Postpaid</strong> | Monthly Data Plan: <strong>10 GB + Unlimited Delivery Apps</strong>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MY DOCUMENTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'documents' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Required Documents & Expiration Status
          </h2>
          <div className="space-y-2 text-xs">
            {[
              { name: 'Emirates ID', docNumber: employee.emirates_id || '', expiry: '2027-04-12', status: 'VALID' },
              { name: 'Passport', docNumber: employee.passport_number || 'A2481920', expiry: '2028-10-20', status: 'VALID' },
              { name: 'UAE Driving License', docNumber: 'DXB-DL-98214', expiry: '2026-11-30', status: 'EXPIRING_SOON' },
              { name: 'Labour Card & Residence Visa', docNumber: 'RES-882194', expiry: '2027-02-15', status: 'VALID' },
            ].map((doc) => (
              <div key={doc.name} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{doc.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">No: {doc.docNumber} | Exp: {doc.expiry}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    doc.status === 'VALID'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {doc.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. MY ATTENDANCE TAB */}
      {/* ======================================================== */}
      {activeTab === 'attendance' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Monthly Attendance Sheet ({attendanceSummary.month})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold block">Present Days</span>
              <span className="text-lg font-black text-emerald-600">{attendanceSummary.present}</span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
              <span className="text-[10px] text-rose-800 dark:text-rose-300 font-bold block">Absent Days</span>
              <span className="text-lg font-black text-rose-600">{attendanceSummary.absent}</span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <span className="text-[10px] text-blue-800 dark:text-blue-300 font-bold block">Weekly Off</span>
              <span className="text-lg font-black text-blue-600">{attendanceSummary.weeklyOff}</span>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold block">Overtime Hours</span>
              <span className="text-lg font-black text-amber-600">{attendanceSummary.overtimeHours} hrs</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. MY SALARY TAB (MID-MONTH PROJECT SPLIT) */}
      {/* ======================================================== */}
      {activeTab === 'salary' && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                Official Payslip
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                August 2026 Salary Statement
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                {salaryData.status}
              </span>
              <button
                onClick={() => showToast('📥 Payslip PDF downloaded successfully!')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Payslip</span>
              </button>
            </div>
          </div>

          {/* Project-Wise Earnings Split Breakdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              1. Project-Wise Salary Split (Mid-Month Transfer)
            </h3>
            <div className="space-y-2 text-xs">
              {salaryData.splitProjects.map((p) => (
                <div
                  key={p.projectName}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{p.projectName}</div>
                    <div className="text-[11px] text-slate-500">
                      Duration: {p.days} Days | Base: AED {p.baseAmount} + Incentives: AED {p.incentives}
                    </div>
                  </div>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                    AED {p.baseAmount + p.incentives}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Allowances & Deductions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Allowances */}
            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-1.5">
              <div className="font-bold text-emerald-900 dark:text-emerald-200 mb-1 uppercase text-[10px]">
                Allowances
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Fuel Allowance</span>
                <span className="font-mono font-bold">+AED {salaryData.allowances.fuel}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Mobile Telecom Allowance</span>
                <span className="font-mono font-bold">+AED {salaryData.allowances.mobile}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Housing / Transport Allowance</span>
                <span className="font-mono font-bold">+AED {salaryData.allowances.housing}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1.5">
              <div className="font-bold text-rose-900 dark:text-rose-200 mb-1 uppercase text-[10px]">
                Deductions
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Traffic Fine Installment</span>
                <span className="font-mono font-bold text-rose-600">-AED {salaryData.deductions.fines}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Loan / Advance Installment</span>
                <span className="font-mono font-bold text-rose-600">-AED {salaryData.deductions.loans}</span>
              </div>
            </div>
          </div>

          {/* Total Net Salary Banner */}
          <div className="p-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-between font-black text-sm">
            <span>TOTAL NET SALARY DISBURSED</span>
            <span className="text-xl text-emerald-400 dark:text-emerald-600 font-mono">
              AED {salaryData.netSalary.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. MY FINES TAB */}
      {/* ======================================================== */}
      {activeTab === 'fines' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Responsible Traffic Fines & Violations
          </h2>
          <div className="space-y-2 text-xs">
            {finesList.map((f) => (
              <div
                key={f.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{f.reason}</span>
                    <span className="text-[10px] font-mono text-slate-400">({f.plate})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Date: {f.date} | Authority: {f.authority} | Base: AED {f.fineAmount} + Admin: AED {f.adminFee}
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <span className="font-mono font-bold text-rose-600">AED {f.total}</span>
                  <button
                    onClick={() => {
                      setSelectedFineForDispute(f);
                      setIsDisputeModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-[10px] font-bold hover:bg-amber-100"
                  >
                    Request Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. MY LOANS TAB */}
      {/* ======================================================== */}
      {activeTab === 'loans' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Company Loans & Salary Advances
          </h2>
          {loansList.map((l) => (
            <div key={l.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>{l.type}</span>
                <span className="text-blue-600">AED {l.remainingBalance} Remaining</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                <div>Original: <strong className="text-slate-700 dark:text-slate-300">AED {l.originalAmount}</strong></div>
                <div>Monthly: <strong className="text-slate-700 dark:text-slate-300">AED {l.monthlyDeduction}</strong></div>
                <div>Paid: <strong className="text-emerald-600">AED {l.totalPaid}</strong></div>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full"
                  style={{ width: `${(l.totalPaid / l.originalAmount) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* 11. MY FORMS & LETTERS TAB */}
      {/* ======================================================== */}
      {activeTab === 'forms' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Company Issued Forms & Certificates
          </h2>
          <div className="space-y-2 text-xs">
            {issuedForms.map((form) => (
              <div key={form.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{form.title}</div>
                  <div className="text-[11px] text-slate-500">Type: {form.type} | Issued: {form.issueDate}</div>
                </div>
                <button
                  onClick={() => showToast(`📄 Viewing/Downloading ${form.title}...`)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Request Correction */}
      {/* ======================================================== */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                Request HR Information Correction
              </h3>
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Submit correction request for your contact details, Emirates ID, or spelling to Operations HR.
            </p>
            <textarea
              rows={4}
              placeholder="Describe the detail you would like to update..."
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsCorrectionModalOpen(false);
                  setCorrectionNote('');
                  showToast('✅ Correction request submitted to HR Operations!');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Submit Fine Dispute */}
      {/* ======================================================== */}
      {isDisputeModalOpen && selectedFineForDispute && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                Submit Traffic Fine Review / Dispute
              </h3>
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200">{selectedFineForDispute.reason}</div>
              <div className="text-amber-700 dark:text-amber-300">
                Plate: {selectedFineForDispute.plate} | Total: AED {selectedFineForDispute.total}
              </div>
            </div>
            <textarea
              rows={4}
              placeholder="State reason for dispute (e.g. was on scheduled leave, different rider using bike, radar error)..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsDisputeModalOpen(false);
                  setDisputeReason('');
                  showToast('✅ Fine review request sent to Fleet Compliance team!');
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
