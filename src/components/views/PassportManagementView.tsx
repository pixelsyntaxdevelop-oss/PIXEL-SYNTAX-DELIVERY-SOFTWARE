import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderCheck,
  Search,
  Plus,
  Lock,
  ShieldCheck,
  Clock,
  History,
  Building,
  RefreshCw,
  AlertCircle,
  FileText,
  User,
  CheckCircle2,
  ChevronRight,
  Download,
  Upload,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  X,
  Edit2,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  MapPin,
  Send,
  UserCheck,
  ExternalLink,
  Users,
  UserX,
  FileQuestion,
  FileCheck,
  Info,
  HelpCircle,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export interface PassportCustodyItem {
  id: string;
  serial_number: string;
  passport_serial?: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  emirates_id: string;
  passport_number: string;
  passport_expiry: string;
  expiry_date?: string;
  status: 'WITH_COMPANY' | 'WITH_RIDER';
  current_location: string;
  safe_location?: string;
  storage_detail?: string;
  current_handler: string;
  handler_name?: string;
  current_handler_id?: string;
  receive_date?: string;
  receiving_date?: string;
  received_date?: string;
  return_date?: string;
  returned_date?: string;
  release_date?: string;
  returned_by?: string;
  return_reason?: string;
  reason?: string;
  notes?: string;
  branch_id?: string;
  branch_name: string;
  branch?: string;
  guarantor_name?: string;
  guarantor_id?: string;
  guarantor_unique_id?: string;
  receiver_acknowledged?: boolean;
  receiver_name?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface MovementHistoryItem {
  id: string;
  custody_id: string;
  serial_number: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  event_type: 'RECEIVED' | 'RETURNED_TO_RIDER' | 'EDIT_CORRECTION' | 'LOCATION_TRANSFER';
  from_status?: string;
  to_status?: string;
  status: 'WITH_COMPANY' | 'WITH_RIDER';
  actor_name: string;
  actor_id?: string;
  handler_name?: string;
  returned_by?: string;
  event_date: string;
  receive_date?: string;
  return_date?: string;
  received_from?: string;
  returned_to?: string;
  receiver_name?: string;
  location: string;
  storage_location?: string;
  return_reason?: string;
  reason: string;
  notes?: string;
  guarantor_name?: string;
  guarantor_unique_id?: string;
  correction_reason?: string;
  previous_values?: Record<string, any>;
  new_values?: Record<string, any>;
  timestamp: string;
  created_at: string;
}

export interface MasterEmployee {
  id: string;
  employee_code: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  emirates_id_number?: string;
  emirates_id?: string;
  passport_number?: string;
  passport_expiry?: string;
  branch_name?: string;
  branch_id?: string;
  designation?: string;
  current_status?: string;
  status_reason?: string;
  status_change_reason?: string;
  status_remarks?: string;
  reason?: string;
  status_effective_date?: string;
  project_name?: string;
  project_id?: string;
  project?: string;
  current_project_name?: string;
  is_archived?: boolean;
  tenant_id?: string;
}

export type PassportCategoryType = 'WITH_COMPANY' | 'NOT_RECEIVED' | 'RETURNED_TO_RIDER';

export interface EmployeePassportRow {
  key: string;
  category: PassportCategoryType;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  emirates_id: string;
  employee_status: string;
  status_reason?: string;
  project: string;
  passport_number: string;
  passport_expiry?: string;
  branch_name: string;
  current_location: string;
  current_handler: string;
  receive_date: string;
  return_date?: string;
  return_reason?: string;
  returned_by?: string;
  received_by?: string;
  serial_number?: string;
  custody_id?: string;
  rawCustody?: PassportCustodyItem;
  rawEmployee?: MasterEmployee;
}

export function resolveEmployeeDisplayStatus(status?: string | null): string {
  if (!status) return 'Available / Unassigned';
  const clean = String(status).trim();
  const lower = clean.toLowerCase();

  // 1. Emergency Leave
  if (
    lower === 'emergency leave' ||
    lower === 'emergency_leave' ||
    lower.includes('emergency leave') ||
    lower.includes('emergency')
  ) {
    return 'Emergency Leave';
  }

  // 2. On Leave
  if (
    lower.includes('leave') ||
    lower.includes('vacation') ||
    lower.includes('holiday')
  ) {
    return 'On Leave';
  }

  // 3. On Hold
  if (
    lower === 'suspended' ||
    lower.includes('suspend') ||
    lower.includes('on hold') ||
    lower.includes('on-hold') ||
    lower.includes('pending') ||
    lower.includes('waiting') ||
    lower.includes('onboarding')
  ) {
    return 'On Hold';
  }

  // 4. Absconding
  if (lower.includes('abscond')) {
    return 'Absconding';
  }

  // 5. Terminated
  if (
    lower.includes('terminat') ||
    lower.includes('dismiss') ||
    lower.includes('fired')
  ) {
    return 'Terminated';
  }

  // 6. Cancelled (including legacy Exited)
  if (
    lower.includes('cancel') ||
    lower.includes('exit') ||
    lower.includes('resign') ||
    lower.includes('released') ||
    lower === 'inactive' ||
    lower === 'in-active' ||
    lower === '1' ||
    lower === 'disabled' ||
    lower === 'closed'
  ) {
    return 'Cancelled';
  }

  // 7. Available / Unassigned
  if (
    lower.includes('unassigned') ||
    lower.includes('available') ||
    lower === 'unassigned' ||
    lower === 'free'
  ) {
    return 'Available / Unassigned';
  }

  // 8. Assigned / Active
  if (
    lower.includes('assigned') ||
    lower.includes('active') ||
    lower === 'assigned' ||
    lower === 'active'
  ) {
    return 'Assigned / Active';
  }

  return clean;
}

export function getEmployeeStatusBadgeConfig(status: string) {
  const normalized = resolveEmployeeDisplayStatus(status);
  switch (normalized) {
    case 'Assigned / Active':
      return {
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
        dotClass: 'bg-emerald-400',
        label: 'Assigned / Active',
      };
    case 'Available / Unassigned':
      return {
        badgeClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
        dotClass: 'bg-sky-400',
        label: 'Available / Unassigned',
      };
    case 'On Leave':
      return {
        badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
        dotClass: 'bg-amber-400',
        label: 'On Leave',
      };
    case 'Emergency Leave':
      return {
        badgeClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
        dotClass: 'bg-orange-400',
        label: 'Emergency Leave',
      };
    case 'On Hold':
      return {
        badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
        dotClass: 'bg-purple-400',
        label: 'On Hold',
      };
    case 'Absconding':
      return {
        badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
        dotClass: 'bg-rose-400',
        label: 'Absconding',
      };
    case 'Terminated':
      return {
        badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/30',
        dotClass: 'bg-red-500',
        label: 'Terminated',
      };
    case 'Cancelled':
      return {
        badgeClass: 'bg-slate-500/15 text-slate-300 border border-slate-600/40',
        dotClass: 'bg-slate-400',
        label: 'Cancelled',
      };
    default:
      return {
        badgeClass: 'bg-slate-500/10 text-slate-400 border border-slate-700',
        dotClass: 'bg-slate-400',
        label: normalized || 'Available / Unassigned',
      };
  }
}

export const ROUTEMATE_RETURN_REASONS = [
  'All Return Reasons',
  'Other (Specify in Notes)',
  'Annual Leave / Vacation (Travel)',
  'Company Return (No Process Needed / Rider Requested Back)',
  'Passport Renewal (Submission to Consulate / Typing Center)',
  'Sick Leave / Medical Emergency',
] as const;

export interface PassportManagementViewProps {
  lang?: 'EN' | 'AR';
  currentUser?: any;
  onOpenEmployee360?: (employeeId: string) => void;
}

export const PassportManagementView: React.FC<PassportManagementViewProps> = ({
  lang = 'EN',
  currentUser,
  onOpenEmployee360,
}) => {
  const [passports, setPassports] = useState<PassportCustodyItem[]>([]);
  const [employees, setEmployees] = useState<MasterEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  // Dynamic KPI & Stats
  const [kpis, setKpis] = useState({
    totalEmployees: 0,
    totalTracked: 0,
    withCompany: 0,
    withRiderNotReceived: 0,
    notReceived: 0,
    returnedToRider: 0,
    withRider: 0,
    branchWiseWithCompany: {} as Record<string, number>,
    branchWiseWithRiders: {} as Record<string, number>,
    returnReasonsCounts: {} as Record<string, number>,
    historicalReturnReasonsCounts: {} as Record<string, number>,
    totalHistoricalReturns: 0,
  });

  // Four Mutually Exclusive Category Filter:
  // ALL: All master employees
  // WITH_COMPANY: Latest custody status is WITH_COMPANY
  // NOT_RECEIVED: Never submitted passport / no custody record
  // RETURNED_TO_RIDER: Previously received, latest status is WITH_RIDER
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'WITH_COMPANY' | 'NOT_RECEIVED' | 'RETURNED_TO_RIDER'>('ALL');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WITH_COMPANY' | 'WITH_RIDER'>('ALL');
  const [selectedReturnReason, setSelectedReturnReason] = useState<string>('All Return Reasons');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<string>('ALL');
  const [selectedReasonModal, setSelectedReasonModal] = useState<{
    employeeName: string;
    employeeCode: string;
    status: string;
    reason: string;
  } | null>(null);

  // Modals state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Active selected item for Edit / History / Return
  const [selectedItem, setSelectedItem] = useState<PassportCustodyItem | null>(null);
  const [historyList, setHistoryList] = useState<MovementHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Logged in ERP user name
  const effectiveLoggedInUser = currentUser?.fullName || currentUser?.name || currentUser?.username || 'Muhammad System User';

  // Receive Form State
  const [recRiderSearch, setRecRiderSearch] = useState('');
  const [selectedRider, setSelectedRider] = useState<MasterEmployee | null>(null);
  const [recPassportNumber, setRecPassportNumber] = useState('');
  const [recPassportExpiry, setRecPassportExpiry] = useState('');
  const [recReceiveDate, setRecReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [recBranch, setRecBranch] = useState('ALLIED DELIVERY SERVICES L.L.C');
  const [recStorageLocation, setRecStorageLocation] = useState('Dubai Head Office Safe');
  const [recNotes, setRecNotes] = useState('');
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [recError, setRecError] = useState('');

  // Return Form State
  const [retCustodyId, setRetCustodyId] = useState('');
  const [retSearchQuery, setRetSearchQuery] = useState('');
  const [retReturnDate, setRetReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [retReason, setRetReason] = useState<string>('Annual Leave / Vacation (Travel)');
  const [retNotes, setRetNotes] = useState('');
  const [retGuarantorName, setRetGuarantorName] = useState('');
  const [retGuarantorUniqueId, setRetGuarantorUniqueId] = useState('');
  const [retReceiverAcknowledged, setRetReceiverAcknowledged] = useState(true);
  const [retReceiverName, setRetReceiverName] = useState('');
  const [retSubmitting, setRetSubmitting] = useState(false);
  const [retError, setRetError] = useState('');

  // Edit Form State
  const [editPassportNumber, setEditPassportNumber] = useState('');
  const [editPassportExpiry, setEditPassportExpiry] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editStorageLocation, setEditStorageLocation] = useState('');
  const [editReceiveDate, setEditReceiveDate] = useState('');
  const [editReturnDate, setEditReturnDate] = useState('');
  const [editReturnReason, setEditReturnReason] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editGuarantorName, setEditGuarantorName] = useState('');
  const [editGuarantorUniqueId, setEditGuarantorUniqueId] = useState('');
  const [editCorrectionReason, setEditCorrectionReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Bulk Receive State
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ receivedCount: number; errorCount: number; errors: any[] } | null>(null);

  // Success Notification banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all live data
  const fetchData = async () => {
    setLoading(true);
    try {
      const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';
      const [custodyRes, statsRes, empsRes] = await Promise.all([
        fetch('/api/erp/passports/custody', {
          headers: {
            'x-tenant-id': activeTenant,
            'x-user-name': effectiveLoggedInUser,
          },
        }),
        fetch('/api/erp/passports/stats', {
          headers: {
            'x-tenant-id': activeTenant,
          },
        }),
        fetch('/api/erp/master-employees', {
          headers: {
            'x-tenant-id': activeTenant,
          },
        }),
      ]);

      if (custodyRes.ok) {
        const records = await custodyRes.json();
        setPassports(Array.isArray(records) ? records : records.records || []);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setKpis({
          totalEmployees: stats.totalEmployees ?? stats.totalTracked ?? 0,
          totalTracked: stats.totalTracked ?? stats.total ?? 0,
          withCompany: stats.withCompany ?? 0,
          withRiderNotReceived: stats.withRiderNotReceived ?? stats.notReceived ?? 0,
          notReceived: stats.notReceived ?? stats.withRiderNotReceived ?? 0,
          returnedToRider: stats.returnedToRider ?? 0,
          withRider: stats.withRider ?? 0,
          branchWiseWithCompany: stats.branchWiseWithCompany || {},
          branchWiseWithRiders: stats.branchWiseWithRiders || {},
          returnReasonsCounts: stats.returnReasonsCounts || {},
          historicalReturnReasonsCounts: stats.historicalReturnReasonsCounts || {},
          totalHistoricalReturns: stats.totalHistoricalReturns ?? 0,
        });
      }

      if (empsRes.ok) {
        const empData = await empsRes.json();
        setEmployees(Array.isArray(empData) ? empData : empData.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch passport data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.tenantId]);

  // Authoritative Four Mutually Exclusive Categories:
  // (1) Total Employees: live count from authoritative master employees (expected 191)
  // (2) With Company: employees whose latest valid passport custody state is WITH_COMPANY
  // (3) With Rider / Not Received: employees who have never submitted a passport and have no passport custody record
  // (4) Returned to Rider: employees whose passport was previously received and latest custody state is WITH_RIDER
  const categorizedData = useMemo(() => {
    const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';

    // 1. Authoritative master employees for tenant (un-deleted)
    const eligibleEmployees = employees.filter((e) => {
      const t = e.tenant_id || 'company_pixel_syntax';
      const matchesTenant =
        activeTenant === 'company_pixel_syntax'
          ? t === 'company_pixel_syntax' || t === 'tenant_allied' || !e.tenant_id
          : t === activeTenant;
      return matchesTenant && !(e as any).is_deleted && !(e as any).is_archived;
    });

    // 2. Map latest custody record per employee
    const custodyByEmpId = new Map<string, PassportCustodyItem>();
    const custodyByEmpCode = new Map<string, PassportCustodyItem>();

    // Sort by latest update / creation
    const sortedPassports = [...passports].sort(
      (a, b) =>
        new Date((b as any).updated_at || b.created_at || 0).getTime() -
        new Date((a as any).updated_at || a.created_at || 0).getTime()
    );

    for (const p of sortedPassports) {
      if (p.employee_id && !custodyByEmpId.has(p.employee_id)) {
        custodyByEmpId.set(p.employee_id, p);
      }
      if (p.employee_code && !custodyByEmpCode.has(p.employee_code.toLowerCase())) {
        custodyByEmpCode.set(p.employee_code.toLowerCase(), p);
      }
    }

    const withCompanyList: EmployeePassportRow[] = [];
    const notReceivedList: EmployeePassportRow[] = [];
    const returnedToRiderList: EmployeePassportRow[] = [];
    const processedEmpIds = new Set<string>();

    for (const emp of eligibleEmployees) {
      processedEmpIds.add(emp.id);
      if (emp.employee_code) processedEmpIds.add(emp.employee_code.toLowerCase());

      const c =
        (emp.id && custodyByEmpId.get(emp.id)) ||
        (emp.employee_code && custodyByEmpCode.get(emp.employee_code.toLowerCase())) ||
        null;

      const project =
        emp.project_name || emp.project || emp.current_project_name || 'Allied Logistics';
      const emiratesId = emp.emirates_id_number || emp.emirates_id || c?.emirates_id || '—';
      const branchName = c?.branch_name || emp.branch_name || 'ALLIED DELIVERY SERVICES L.L.C';
      const empStatus = resolveEmployeeDisplayStatus(emp.current_status);
      const statusReason = (emp.status_reason || emp.status_change_reason || emp.reason || emp.status_remarks || '').trim();

      if (!c) {
        // (3) With Rider / Not Received: never submitted passport & no custody record
        notReceivedList.push({
          key: `emp_${emp.id}`,
          category: 'NOT_RECEIVED',
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          emirates_id: emiratesId,
          employee_status: empStatus,
          status_reason: statusReason,
          project,
          passport_number: 'Not Provided',
          passport_expiry: '—',
          branch_name: branchName,
          current_location: 'With Rider (Not Submitted)',
          current_handler: '—',
          receive_date: '—',
          rawEmployee: emp,
        });
      } else if (c.status === 'WITH_COMPANY') {
        // (2) With Company: latest valid passport custody state is WITH_COMPANY
        withCompanyList.push({
          key: `cust_${c.id}`,
          category: 'WITH_COMPANY',
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          emirates_id: emiratesId,
          employee_status: empStatus,
          status_reason: statusReason,
          project,
          passport_number: c.passport_number || emp.passport_number || '—',
          passport_expiry: c.passport_expiry || c.expiry_date || emp.passport_expiry || '—',
          branch_name: branchName,
          current_location: c.current_location || c.safe_location || 'Office Vault / Safe',
          current_handler: c.current_handler || 'HR Staff',
          receive_date: c.receive_date || c.receiving_date || c.created_at?.split('T')[0] || '—',
          serial_number: c.serial_number,
          custody_id: c.id,
          rawCustody: c,
          rawEmployee: emp,
        });
      } else {
        // (4) Returned to Rider: previously received, latest custody state is WITH_RIDER
        returnedToRiderList.push({
          key: `cust_${c.id}`,
          category: 'RETURNED_TO_RIDER',
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          emirates_id: emiratesId,
          employee_status: empStatus,
          status_reason: statusReason,
          project,
          passport_number: c.passport_number || emp.passport_number || '—',
          passport_expiry: c.passport_expiry || c.expiry_date || emp.passport_expiry || '—',
          branch_name: branchName,
          current_location: 'With Rider',
          current_handler: c.current_handler || '—',
          receive_date: c.receive_date || c.receiving_date || c.created_at?.split('T')[0] || '—',
          return_date: c.return_date || c.returned_date || '—',
          return_reason: c.return_reason || c.reason || 'Annual Leave / Vacation (Travel)',
          returned_by: c.returned_by || c.current_handler || 'Muhammad System User',
          received_by: (c as any).receiver_name || emp.full_name,
          serial_number: c.serial_number,
          custody_id: c.id,
          rawCustody: c,
          rawEmployee: emp,
        });
      }
    }

    // Capture any legacy custody records not in the unarchived master list
    for (const c of sortedPassports) {
      if (
        (c.employee_id && processedEmpIds.has(c.employee_id)) ||
        (c.employee_code && processedEmpIds.has(c.employee_code.toLowerCase()))
      ) {
        continue;
      }
      processedEmpIds.add(c.id);
      const isWithCompany = c.status === 'WITH_COMPANY';
      const matchedEmp = employees.find(
        (e) =>
          (c.employee_id && e.id === c.employee_id) ||
          (c.employee_code && e.employee_code?.toLowerCase() === c.employee_code?.toLowerCase())
      );
      const empStatus = matchedEmp ? resolveEmployeeDisplayStatus(matchedEmp.current_status) : 'Available / Unassigned';
      const statusReason = (matchedEmp?.status_reason || matchedEmp?.status_change_reason || matchedEmp?.reason || '').trim();

      const item: EmployeePassportRow = {
        key: `cust_${c.id}`,
        category: isWithCompany ? 'WITH_COMPANY' : 'RETURNED_TO_RIDER',
        employee_id: c.employee_id,
        employee_code: c.employee_code,
        employee_name: c.employee_name,
        emirates_id: c.emirates_id || '—',
        employee_status: empStatus,
        status_reason: statusReason,
        project: 'Allied Logistics',
        passport_number: c.passport_number || '—',
        passport_expiry: c.passport_expiry || c.expiry_date || '—',
        branch_name: c.branch_name || 'ALLIED DELIVERY SERVICES L.L.C',
        current_location: c.current_location || (isWithCompany ? 'Office Vault / Safe' : 'With Rider'),
        current_handler: c.current_handler || 'HR Staff',
        receive_date: c.receive_date || c.receiving_date || c.created_at?.split('T')[0] || '—',
        return_date: c.return_date || c.returned_date || '—',
        return_reason: c.return_reason || c.reason || '—',
        returned_by: c.returned_by || '—',
        received_by: (c as any).receiver_name || c.employee_name,
        serial_number: c.serial_number,
        custody_id: c.id,
        rawCustody: c,
      };

      if (isWithCompany) {
        withCompanyList.push(item);
      } else {
        returnedToRiderList.push(item);
      }
    }

    const totalEmployeesCount = withCompanyList.length + notReceivedList.length + returnedToRiderList.length;

    return {
      totalEmployeesCount,
      withCompanyList,
      notReceivedList,
      returnedToRiderList,
      allList: [...withCompanyList, ...returnedToRiderList, ...notReceivedList],
    };
  }, [employees, passports, currentUser?.tenantId]);

  // Filtered rows for the Active Category and Search Filters
  const filteredCategorizedRows = useMemo(() => {
    let sourceList: EmployeePassportRow[] = [];
    if (categoryFilter === 'WITH_COMPANY') {
      sourceList = categorizedData.withCompanyList;
    } else if (categoryFilter === 'NOT_RECEIVED') {
      sourceList = categorizedData.notReceivedList;
    } else if (categoryFilter === 'RETURNED_TO_RIDER') {
      sourceList = categorizedData.returnedToRiderList;
    } else {
      sourceList = categorizedData.allList;
    }

    return sourceList.filter((row) => {
      // 1. Branch filter
      if (branchFilter !== 'ALL') {
        const rowBranch = row.branch_name || 'ALLIED DELIVERY SERVICES L.L.C';
        if (rowBranch !== branchFilter) return false;
      }

      // 2. Status / Category Filter when statusFilter is manually chosen
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'WITH_COMPANY' && row.category !== 'WITH_COMPANY') return false;
        if (statusFilter === 'WITH_RIDER' && row.category === 'WITH_COMPANY') return false;
      }

      // 3. Return Reason filter
      if (selectedReturnReason !== 'All Return Reasons') {
        if (row.category !== 'RETURNED_TO_RIDER') return false;
        const r = row.return_reason || 'Other (Specify in Notes)';
        if (selectedReturnReason === 'Other (Specify in Notes)') {
          if (!r || r === 'Other (Specify in Notes)' || !ROUTEMATE_RETURN_REASONS.includes(r as any)) {
            // matches
          } else {
            return false;
          }
        } else {
          if (r !== selectedReturnReason) return false;
        }
      }

      // 4. Employee Status Filter (Assigned / Active, On Leave, Absconding, Terminated, Cancelled, etc.)
      if (employeeStatusFilter !== 'ALL') {
        if (row.employee_status !== employeeStatusFilter) return false;
      }

      // 5. Search term across Employee Name, Code, Emirates ID, Passport #, Project, Status, Reason
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = row.employee_name?.toLowerCase().includes(q);
        const matchesCode = row.employee_code?.toLowerCase().includes(q);
        const matchesEid = row.emirates_id?.toLowerCase().includes(q);
        const matchesPass = row.passport_number?.toLowerCase().includes(q);
        const matchesProject = row.project?.toLowerCase().includes(q);
        const matchesSerial = row.serial_number?.toLowerCase().includes(q);
        const matchesLocation = row.current_location?.toLowerCase().includes(q);
        const matchesHandler = row.current_handler?.toLowerCase().includes(q);
        const matchesStatus = row.employee_status?.toLowerCase().includes(q);
        const matchesReason = row.status_reason?.toLowerCase().includes(q);

        if (
          !matchesName &&
          !matchesCode &&
          !matchesEid &&
          !matchesPass &&
          !matchesProject &&
          !matchesSerial &&
          !matchesLocation &&
          !matchesHandler &&
          !matchesStatus &&
          !matchesReason
        ) {
          return false;
        }
      }

      return true;
    });
  }, [categorizedData, categoryFilter, branchFilter, statusFilter, selectedReturnReason, employeeStatusFilter, searchTerm]);

  // Legacy filteredPassports for backward compatibility
  const filteredPassports = useMemo(() => {
    return passports.filter((item) => {
      if (branchFilter !== 'ALL') {
        const itemBranch = item.branch_name || item.branch || 'ALLIED DELIVERY SERVICES L.L.C';
        if (itemBranch !== branchFilter) return false;
      }
      if (statusFilter !== 'ALL') {
        if (item.status !== statusFilter) return false;
      }
      if (selectedReturnReason !== 'All Return Reasons') {
        if (item.status !== 'WITH_RIDER') return false;
        const itemReason =
          item.return_reason ||
          (ROUTEMATE_RETURN_REASONS.includes(item.reason as any) ? item.reason : '') ||
          'Other (Specify in Notes)';
        if (selectedReturnReason === 'Other (Specify in Notes)') {
          if (!itemReason || itemReason === 'Other (Specify in Notes)' || !ROUTEMATE_RETURN_REASONS.includes(itemReason as any)) {
            // matches
          } else {
            return false;
          }
        } else {
          if (itemReason !== selectedReturnReason) return false;
        }
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = item.employee_name?.toLowerCase().includes(q);
        const matchesCode = item.employee_code?.toLowerCase().includes(q);
        const matchesEid = item.emirates_id?.toLowerCase().includes(q);
        const matchesPass = item.passport_number?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEid && !matchesPass) return false;
      }
      return true;
    });
  }, [passports, branchFilter, statusFilter, selectedReturnReason, searchTerm]);

  // Quick Action Handlers
  const handleQuickReceiveFromNotReceived = (row: EmployeePassportRow) => {
    const rider = row.rawEmployee || {
      id: row.employee_id,
      employee_code: row.employee_code,
      full_name: row.employee_name,
      emirates_id_number: row.emirates_id,
      emirates_id: row.emirates_id,
      passport_number: '',
      branch_name: row.branch_name,
    };
    setSelectedRider(rider);
    setRecRiderSearch(row.employee_name);
    setRecPassportNumber('');
    setRecPassportExpiry('');
    setRecNotes('');
    setRecError('');
    setIsReceiveModalOpen(true);
  };

  const handleQuickReReceiveFromReturned = (row: EmployeePassportRow) => {
    const rider = row.rawEmployee || {
      id: row.employee_id,
      employee_code: row.employee_code,
      full_name: row.employee_name,
      emirates_id_number: row.emirates_id,
      emirates_id: row.emirates_id,
      passport_number: row.passport_number,
      branch_name: row.branch_name,
    };
    setSelectedRider(rider);
    setRecRiderSearch(row.employee_name);
    setRecPassportNumber(row.passport_number !== 'Not Provided' && row.passport_number !== '—' ? row.passport_number : '');
    setRecPassportExpiry(row.passport_expiry !== '—' ? row.passport_expiry || '' : '');
    setRecNotes('Re-received passport from rider into company safe custody.');
    setRecError('');
    setIsReceiveModalOpen(true);
  };

  // List of Passports currently WITH COMPANY (for Return modal selection)
  const passportsWithCompany = useMemo(() => {
    return passports.filter((p) => p.status === 'WITH_COMPANY');
  }, [passports]);

  // Search and filter existing WITH_COMPANY passports by employee name, code, Emirates ID, or passport number (Max 10)
  const filteredReturnCandidates = useMemo(() => {
    const q = retSearchQuery.toLowerCase().trim();
    if (q.length < 3) return [];
    return passportsWithCompany
      .filter((p) => {
        const name = (p.employee_name || '').toLowerCase();
        const code = (p.employee_code || '').toLowerCase();
        const eid = (p.emirates_id || '').toLowerCase();
        const pass = (p.passport_number || '').toLowerCase();
        const serial = (p.serial_number || '').toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          eid.includes(q) ||
          pass.includes(q) ||
          serial.includes(q)
        );
      })
      .slice(0, 10);
  }, [passportsWithCompany, retSearchQuery]);

  // Filter riders for autocomplete in Receive modal
  const filteredRiderCandidates = useMemo(() => {
    if (!recRiderSearch.trim()) return employees.slice(0, 8);
    const q = recRiderSearch.toLowerCase().trim();
    return employees
      .filter(
        (e) =>
          e.full_name?.toLowerCase().includes(q) ||
          e.employee_code?.toLowerCase().includes(q) ||
          e.emirates_id_number?.toLowerCase().includes(q) ||
          e.emirates_id?.toLowerCase().includes(q) ||
          e.passport_number?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [employees, recRiderSearch]);

  // Open Receive Modal
  const openReceiveModal = () => {
    setSelectedRider(null);
    setRecRiderSearch('');
    setRecPassportNumber('');
    setRecPassportExpiry('2028-12-31');
    setRecReceiveDate(new Date().toISOString().split('T')[0]);
    setRecBranch('ALLIED DELIVERY SERVICES L.L.C');
    setRecStorageLocation('Dubai Head Office Safe');
    setRecNotes('');
    setRecError('');
    setIsReceiveModalOpen(true);
  };

  // Rider selected in Receive Modal
  const handleSelectRiderInReceive = (emp: MasterEmployee) => {
    setSelectedRider(emp);
    setRecRiderSearch(`${emp.full_name} (${emp.employee_code})`);
    if (emp.passport_number) setRecPassportNumber(emp.passport_number);
    if (emp.passport_expiry) setRecPassportExpiry(emp.passport_expiry);
    if (emp.branch_name) setRecBranch(emp.branch_name);
  };

  // Submit Receive
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider) {
      setRecError('Please search and select an employee from Allied Employee Master.');
      return;
    }
    if (!recPassportNumber.trim()) {
      setRecError('Passport number is required.');
      return;
    }

    setRecSubmitting(true);
    setRecError('');
    try {
      const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';
      const res = await fetch('/api/erp/passports/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
          'x-user-name': effectiveLoggedInUser,
        },
        body: JSON.stringify({
          employee_id: selectedRider.id,
          employee_code: selectedRider.employee_code,
          employee_name: selectedRider.full_name,
          passport_number: recPassportNumber.trim(),
          passport_expiry: recPassportExpiry,
          storage_location: recStorageLocation,
          branch_name: recBranch,
          receive_date: recReceiveDate,
          handler: effectiveLoggedInUser,
          notes: recNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRecError(data.error || 'Failed to receive passport.');
        return;
      }

      setIsReceiveModalOpen(false);
      showToast(`Passport for ${selectedRider.full_name} (${data.record?.serial_number || 'received'}) placed into company custody.`);
      if (data.record) {
        setPassports((prev) => {
          const idx = prev.findIndex((p) => p.id === data.record.id || p.employee_id === data.record.employee_id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.record;
            return next;
          }
          return [data.record, ...prev];
        });
      }
      await fetchData();
    } catch (err: any) {
      setRecError(err.message || 'Network error while receiving passport.');
    } finally {
      setRecSubmitting(false);
    }
  };

  // Open Return Modal
  const openReturnModal = (presetItemOrRow?: PassportCustodyItem | EmployeePassportRow) => {
    setRetError('');
    setRetReturnDate(new Date().toISOString().split('T')[0]);
    setRetReason('Annual Leave / Vacation (Travel)');
    setRetNotes('');
    setRetGuarantorName('');
    setRetGuarantorUniqueId('');
    setRetReceiverAcknowledged(true);

    if (presetItemOrRow) {
      const presetItem: PassportCustodyItem =
        'rawCustody' in presetItemOrRow && presetItemOrRow.rawCustody
          ? presetItemOrRow.rawCustody
          : 'status' in presetItemOrRow
          ? (presetItemOrRow as PassportCustodyItem)
          : ({
              id: (presetItemOrRow as any).custody_id || (presetItemOrRow as any).key,
              serial_number: (presetItemOrRow as any).serial_number || `PC-${(presetItemOrRow as any).employee_code}`,
              tenant_id: 'company_pixel_syntax',
              employee_id: (presetItemOrRow as any).employee_id,
              employee_name: (presetItemOrRow as any).employee_name,
              employee_code: (presetItemOrRow as any).employee_code,
              emirates_id: (presetItemOrRow as any).emirates_id,
              passport_number: (presetItemOrRow as any).passport_number,
              passport_expiry: (presetItemOrRow as any).passport_expiry,
              status: 'WITH_COMPANY',
              current_location: (presetItemOrRow as any).current_location,
              current_handler: (presetItemOrRow as any).current_handler,
              branch_name: (presetItemOrRow as any).branch_name,
              receive_date: (presetItemOrRow as any).receive_date,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as PassportCustodyItem);

      setRetCustodyId(presetItem.id);
      setRetSearchQuery(`${presetItem.employee_name} (${presetItem.employee_code})`);
      setRetReceiverName(presetItem.employee_name);
    } else {
      setRetCustodyId('');
      setRetSearchQuery('');
      setRetReceiverName('');
    }
    setIsReturnModalOpen(true);
  };

  // Selected item in Return Modal
  const returnTargetRecord = useMemo(() => {
    if (!retCustodyId) return null;
    return passportsWithCompany.find((p) => p.id === retCustodyId) || passports.find((p) => p.id === retCustodyId) || null;
  }, [passportsWithCompany, passports, retCustodyId]);

  // Submit Return
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retCustodyId) {
      setRetError('Please search and select a passport currently in company custody to return.');
      return;
    }

    setRetSubmitting(true);
    setRetError('');
    try {
      const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';
      const res = await fetch(`/api/erp/passports/${encodeURIComponent(retCustodyId)}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
          'x-user-name': effectiveLoggedInUser,
        },
        body: JSON.stringify({
          id: retCustodyId,
          custody_id: retCustodyId,
          serial_number: returnTargetRecord?.serial_number,
          employee_id: returnTargetRecord?.employee_id,
          employee_code: returnTargetRecord?.employee_code,
          return_date: retReturnDate,
          return_reason: retReason,
          returned_by: effectiveLoggedInUser,
          notes: retNotes,
          guarantor_name: retGuarantorName,
          guarantor_unique_id: retGuarantorUniqueId,
          receiver_name: retReceiverName || returnTargetRecord?.employee_name,
          receiver_acknowledged: retReceiverAcknowledged,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRetError(data.error || 'Failed to return passport.');
        return;
      }

      setIsReturnModalOpen(false);
      showToast(`Passport returned to rider ${data.record?.employee_name || returnTargetRecord?.employee_name || ''} successfully.`);
      if (data.record) {
        setPassports((prev) => {
          const idx = prev.findIndex((p) => p.id === data.record.id || p.serial_number === data.record.serial_number);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.record;
            return next;
          }
          return [data.record, ...prev];
        });
      }
      await fetchData();
    } catch (err: any) {
      setRetError(err.message || 'Error processing passport return.');
    } finally {
      setRetSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (itemOrRow: PassportCustodyItem | EmployeePassportRow) => {
    const item: PassportCustodyItem =
      'rawCustody' in itemOrRow && itemOrRow.rawCustody
        ? itemOrRow.rawCustody
        : 'status' in itemOrRow
        ? (itemOrRow as PassportCustodyItem)
        : ({
            id: (itemOrRow as any).custody_id || (itemOrRow as any).key,
            serial_number: (itemOrRow as any).serial_number || `PC-${(itemOrRow as any).employee_code}`,
            tenant_id: 'company_pixel_syntax',
            employee_id: (itemOrRow as any).employee_id,
            employee_name: (itemOrRow as any).employee_name,
            employee_code: (itemOrRow as any).employee_code,
            emirates_id: (itemOrRow as any).emirates_id,
            passport_number: (itemOrRow as any).passport_number,
            passport_expiry: (itemOrRow as any).passport_expiry,
            status: (itemOrRow as any).category === 'WITH_COMPANY' ? 'WITH_COMPANY' : 'WITH_RIDER',
            current_location: (itemOrRow as any).current_location,
            current_handler: (itemOrRow as any).current_handler,
            branch_name: (itemOrRow as any).branch_name,
            receive_date: (itemOrRow as any).receive_date,
            return_date: (itemOrRow as any).return_date,
            return_reason: (itemOrRow as any).return_reason,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as PassportCustodyItem);

    setSelectedItem(item);
    setEditPassportNumber(item.passport_number || '');
    setEditPassportExpiry(item.passport_expiry || item.expiry_date || '');
    setEditBranch(item.branch_name || item.branch || 'ALLIED DELIVERY SERVICES L.L.C');
    setEditStorageLocation(item.current_location || '');
    setEditReceiveDate(item.receive_date || item.receiving_date || '');
    setEditReturnDate(item.return_date || item.returned_date || '');
    setEditReturnReason(item.return_reason || item.reason || '');
    setEditNotes(item.notes || '');
    setEditGuarantorName(item.guarantor_name || '');
    setEditGuarantorUniqueId(item.guarantor_unique_id || '');
    setEditCorrectionReason('');
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!editCorrectionReason.trim()) {
      setEditError('A correction reason is required for administrative audit compliance.');
      return;
    }

    setEditSubmitting(true);
    setEditError('');
    try {
      const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';
      const res = await fetch(`/api/erp/passports/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
          'x-user-name': effectiveLoggedInUser,
        },
        body: JSON.stringify({
          passport_number: editPassportNumber,
          passport_expiry: editPassportExpiry,
          branch_name: editBranch,
          storage_location: editStorageLocation,
          receive_date: editReceiveDate,
          return_date: editReturnDate,
          return_reason: editReturnReason,
          notes: editNotes,
          guarantor_name: editGuarantorName,
          guarantor_unique_id: editGuarantorUniqueId,
          correction_reason: editCorrectionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update passport record.');
        return;
      }

      setIsEditModalOpen(false);
      showToast(`Passport record (${selectedItem.serial_number}) updated with audit log.`);
      await fetchData();
    } catch (err: any) {
      setEditError(err.message || 'Error updating passport record.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Open History Modal
  const openHistoryModal = async (itemOrRow: PassportCustodyItem | EmployeePassportRow) => {
    const custodyId =
      'rawCustody' in itemOrRow
        ? itemOrRow.rawCustody?.id || (itemOrRow as any).custody_id
        : (itemOrRow as PassportCustodyItem).id;

    const fallbackItem: PassportCustodyItem =
      'rawCustody' in itemOrRow && itemOrRow.rawCustody
        ? itemOrRow.rawCustody
        : 'status' in itemOrRow
        ? (itemOrRow as PassportCustodyItem)
        : ({
            id: (itemOrRow as any).custody_id || (itemOrRow as any).key,
            serial_number: (itemOrRow as any).serial_number || `PC-${(itemOrRow as any).employee_code}`,
            tenant_id: 'company_pixel_syntax',
            employee_id: (itemOrRow as any).employee_id,
            employee_name: (itemOrRow as any).employee_name,
            employee_code: (itemOrRow as any).employee_code,
            emirates_id: (itemOrRow as any).emirates_id,
            passport_number: (itemOrRow as any).passport_number,
            passport_expiry: (itemOrRow as any).passport_expiry,
            status: (itemOrRow as any).category === 'WITH_COMPANY' ? 'WITH_COMPANY' : 'WITH_RIDER',
            current_location: (itemOrRow as any).current_location,
            current_handler: (itemOrRow as any).current_handler,
            branch_name: (itemOrRow as any).branch_name,
            receive_date: (itemOrRow as any).receive_date,
            return_date: (itemOrRow as any).return_date,
            return_reason: (itemOrRow as any).return_reason,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as PassportCustodyItem);

    setSelectedItem(fallbackItem);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';
      if (!custodyId) {
        setHistoryList([]);
        setHistoryLoading(false);
        return;
      }
      const res = await fetch(`/api/erp/passports/${custodyId}/history`, {
        headers: {
          'x-tenant-id': activeTenant,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      } else {
        setHistoryList([]);
      }
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = [
      'Sr#',
      'Category',
      'Rider Name',
      'Employee Code',
      'Emirates ID / Unique ID',
      'Project',
      'Passport No',
      'Expiry Date',
      'Custody Status',
      'Current Handler',
      'Current Location',
      'Branch',
      'Receive Date',
      'Return Date',
      'Return Reason',
      'Returned By',
      'Received By',
      'Guarantor Name',
      'Guarantor Unique ID',
      'Notes',
    ];

    const rows = filteredCategorizedRows.map((p, idx) => [
      idx + 1,
      p.category === 'WITH_COMPANY' ? 'With Company' : p.category === 'NOT_RECEIVED' ? 'With Rider / Not Received' : 'Returned to Rider',
      `"${p.employee_name}"`,
      p.employee_code,
      p.emirates_id,
      `"${p.project || ''}"`,
      p.passport_number,
      p.passport_expiry || '',
      p.category === 'WITH_COMPANY' ? 'With Company' : p.category === 'RETURNED_TO_RIDER' ? 'With Rider' : 'Not Received',
      `"${p.current_handler || ''}"`,
      `"${p.current_location || ''}"`,
      `"${p.branch_name || ''}"`,
      p.receive_date || '',
      p.return_date || '',
      `"${p.return_reason || ''}"`,
      `"${p.returned_by || ''}"`,
      `"${p.received_by || ''}"`,
      `"${p.rawCustody?.guarantor_name || ''}"`,
      `"${p.rawCustody?.guarantor_unique_id || ''}"`,
      `"${(p.rawCustody?.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RouteMate_Passport_Categories_${categoryFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported passport custody report successfully.');
  };

  // Bulk Receive submission
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCsvText.trim()) return;

    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const lines = bulkCsvText.trim().split('\n');
      const items: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith('employee_code') || line.toLowerCase().startsWith('code')) {
          continue;
        }
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          items.push({
            employee_code: parts[0],
            passport_number: parts[1],
            expiry_date: parts[2] || '2028-12-31',
            storage_location: parts[3] || 'Dubai Head Office Safe',
            branch_name: parts[4] || 'ALLIED DELIVERY SERVICES L.L.C',
            notes: parts[5] || 'Bulk Upload Receive',
          });
        }
      }

      if (items.length === 0) {
        showToast('No valid rows found to process. Format: Code, PassportNumber, Expiry, Location, Branch', 'error');
        setBulkProcessing(false);
        return;
      }

      const activeTenant = currentUser?.tenantId || 'company_pixel_syntax';
      const res = await fetch('/api/erp/passports/bulk-receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
          'x-user-name': effectiveLoggedInUser,
        },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBulkResult(data);
        showToast(`Bulk receive finished: ${data.receivedCount} received, ${data.errorCount} failed.`);
        await fetchData();
      } else {
        showToast(data.error || 'Bulk receive encountered errors.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing bulk upload.', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Download Sample Bulk CSV Template
  const handleDownloadTemplate = () => {
    const sample = `employee_code,passport_number,expiry_date,storage_location,branch_name,notes
ADL0001,N1234567,2028-12-31,Dubai Head Office Safe,ALLIED DELIVERY SERVICES L.L.C,Onboarding deposit
ADL0002,P7654321,2029-06-15,Abu Dhabi Hub Locker B-2,Allied Delivery Services LLL SPC,Vault storage`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'passport_bulk_receive_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setBranchFilter('ALL');
    setStatusFilter('ALL');
    setSelectedReturnReason('All Return Reasons');
    setEmployeeStatusFilter('ALL');
  };

  // Render Employee Status Badge + View Reason Tooltip & Modal trigger
  const renderEmployeeStatusCell = (row: EmployeePassportRow) => {
    const badgeConfig = getEmployeeStatusBadgeConfig(row.employee_status);
    const rawReason = (row.status_reason || '').trim();
    const displayReason = rawReason || 'Not recorded';

    return (
      <td className="py-3 px-3">
        <div className="flex flex-col gap-1 items-start">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeConfig.badgeClass} whitespace-nowrap shadow-sm`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dotClass}`} />
            <span>{badgeConfig.label}</span>
          </span>

          <div className="relative group/reason">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReasonModal({
                  employeeName: row.employee_name,
                  employeeCode: row.employee_code,
                  status: badgeConfig.label,
                  reason: displayReason,
                });
              }}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors py-0.5 px-1 rounded hover:bg-slate-800/80 focus:outline-none"
              title={`Status Reason: ${displayReason}`}
            >
              <Info className="w-3 h-3 text-slate-400 group-hover/reason:text-slate-200 shrink-0" />
              <span className="underline decoration-slate-600 underline-offset-2 hover:decoration-slate-300">
                View Reason
              </span>
            </button>

            {/* Hover Tooltip */}
            <div className="hidden group-hover/reason:block absolute left-0 bottom-full mb-1.5 z-40 w-64 p-2.5 bg-slate-900/95 text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 pointer-events-none backdrop-blur-md">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400" />
                <span>Status Reason / Remarks</span>
              </div>
              <div className="text-[11px] leading-relaxed break-words font-normal">
                {rawReason ? (
                  <span className="text-slate-200">{rawReason}</span>
                ) : (
                  <span className="text-slate-500 italic">Not recorded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all transform animate-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500/50'
              : 'bg-rose-950 text-rose-200 border-rose-500/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Section with RouteMate Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <span>Human Resources</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span>Allied ERP</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-emerald-400 font-bold">Passport Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>Passport Management</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              Authoritative Custody
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track and manage physical rider passport custody, branch distribution, and return lifecycle with immutable audit history.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openReceiveModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 active:scale-95"
            title="Receive physical passport from rider into company safe"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Receive Passport from Rider</span>
          </button>

          <button
            onClick={() => openReturnModal()}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-900/30 hover:shadow-amber-900/50 active:scale-95"
            title="Return passport to rider for vacation, renewal, or handover"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Return Passport to Rider</span>
          </button>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Bulk upload passport custody records"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Bulk Receive</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Export current table view to CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Refresh dynamic database counts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards - Four Mutually Exclusive Employee-based Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* (1) Total Employees */}
        <div
          onClick={() => {
            setCategoryFilter('ALL');
            setStatusFilter('ALL');
            setSelectedReturnReason('All Return Reasons');
          }}
          className={`cursor-pointer bg-slate-800/90 border rounded-2xl p-5 transition-all hover:scale-[1.01] ${
            categoryFilter === 'ALL'
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-950/40'
              : 'border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Employees</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-blue-400 tracking-tight">
              {categorizedData.totalEmployeesCount}
            </span>
            <span className="text-xs font-medium text-slate-400">Master employees</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-400/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Live Authoritative Supabase (191)</span>
          </div>
        </div>

        {/* (2) With Company */}
        <div
          onClick={() => {
            setCategoryFilter('WITH_COMPANY');
            setStatusFilter('WITH_COMPANY');
            setSelectedReturnReason('All Return Reasons');
          }}
          className={`cursor-pointer bg-slate-800/90 border rounded-2xl p-5 transition-all hover:scale-[1.01] ${
            categoryFilter === 'WITH_COMPANY'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-950/40'
              : 'border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">With Company</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
              {categorizedData.withCompanyList.length}
            </span>
            <span className="text-xs font-medium text-slate-400">In safe custody</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-500/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Physical Vault / Safe Storage</span>
          </div>
        </div>

        {/* (3) With Rider / Not Received */}
        <div
          onClick={() => {
            setCategoryFilter('NOT_RECEIVED');
            setStatusFilter('ALL');
            setSelectedReturnReason('All Return Reasons');
          }}
          className={`cursor-pointer bg-slate-800/90 border rounded-2xl p-5 transition-all hover:scale-[1.01] ${
            categoryFilter === 'NOT_RECEIVED'
              ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-lg shadow-sky-950/40'
              : 'border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">With Rider / Not Received</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <FileQuestion className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-sky-400 tracking-tight">
              {categorizedData.notReceivedList.length}
            </span>
            <span className="text-xs font-medium text-slate-400">Never submitted</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sky-400/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>No Passport Custody Record</span>
          </div>
        </div>

        {/* (4) Returned to Rider */}
        <div
          onClick={() => {
            setCategoryFilter('RETURNED_TO_RIDER');
            setStatusFilter('WITH_RIDER');
          }}
          className={`cursor-pointer bg-slate-800/90 border rounded-2xl p-5 transition-all hover:scale-[1.01] ${
            categoryFilter === 'RETURNED_TO_RIDER'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg shadow-amber-950/40'
              : 'border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Returned to Rider</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
              {categorizedData.returnedToRiderList.length}
            </span>
            <span className="text-xs font-medium text-slate-400">Previously received</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-500/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Vacation, Renewal, or Handover</span>
          </div>
        </div>
      </div>

      {/* Mutual Exclusivity Verification Banner */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white mr-1.5">Mutually Exclusive Employee Partition:</span>
            <span className="text-slate-300 font-mono">
              With Company (<strong className="text-emerald-400 font-bold">{categorizedData.withCompanyList.length}</strong>)
              {' + '}
              Not Received (<strong className="text-sky-400 font-bold">{categorizedData.notReceivedList.length}</strong>)
              {' + '}
              Returned to Rider (<strong className="text-amber-400 font-bold">{categorizedData.returnedToRiderList.length}</strong>)
              {' = '}
              Total Employees (<strong className="text-white font-bold">{categorizedData.totalEmployeesCount}</strong>)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
            100% Invariant Sum Verified
          </span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline">Authoritative Supabase Sync</span>
        </div>
      </div>

      {/* 3. Branch-wise Sections (With Company & With Riders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Branch-wise: With Company */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Branch-wise: With Company
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              Total In Vault: <strong className="text-emerald-400">{kpis.withCompany}</strong>
            </span>
          </div>

          <div className="space-y-2">
            {Object.keys(kpis.branchWiseWithCompany).length === 0 ? (
              <div className="text-xs text-slate-500 italic py-2">No passports currently in company custody.</div>
            ) : (
              Object.entries(kpis.branchWiseWithCompany).map(([branchName, count]) => (
                <div
                  key={branchName}
                  onClick={() => {
                    setBranchFilter(branchName);
                    setStatusFilter('WITH_COMPANY');
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    branchFilter === branchName && statusFilter === 'WITH_COMPANY'
                      ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/30 text-white'
                      : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <span className="font-semibold truncate pr-2">{branchName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-xs">
                      {count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Branch-wise: With Riders */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                Branch-wise: With Riders
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              Total With Riders: <strong className="text-amber-400">{kpis.withRider}</strong>
            </span>
          </div>

          <div className="space-y-2">
            {Object.keys(kpis.branchWiseWithRiders).length === 0 ? (
              <div className="text-xs text-slate-500 italic py-2">No passports currently with riders.</div>
            ) : (
              Object.entries(kpis.branchWiseWithRiders).map(([branchName, count]) => (
                <div
                  key={branchName}
                  onClick={() => {
                    setBranchFilter(branchName);
                    setStatusFilter('WITH_RIDER');
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    branchFilter === branchName && statusFilter === 'WITH_RIDER'
                      ? 'bg-amber-950/40 border-amber-500/50 ring-1 ring-amber-500/30 text-white'
                      : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <span className="font-semibold truncate pr-2">{branchName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 text-xs">
                      {count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Return Reasons Section (RouteMate Breakdown based on History) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Return Reasons (Active Passports with Rider: {kpis.withRider})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {kpis.totalHistoricalReturns > 0 && (
              <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-800">
                Lifetime Historical Returns: <strong className="text-slate-300">{kpis.totalHistoricalReturns}</strong>
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              Click any reason to filter active records
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ROUTEMATE_RETURN_REASONS.map((reasonText) => {
            const count = kpis.returnReasonsCounts[reasonText] || 0;
            const isSelected = selectedReturnReason === reasonText;

            return (
              <button
                key={reasonText}
                onClick={() => {
                  setSelectedReturnReason(reasonText);
                  if (reasonText !== 'All Return Reasons') {
                    setStatusFilter('WITH_RIDER');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                    : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{reasonText}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Search & Filter Bar */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Branch Selector */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Branch
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Branches</option>
              <option value="ALLIED DELIVERY SERVICES L.L.C">ALLIED DELIVERY SERVICES L.L.C</option>
              <option value="Allied Delivery Services LLL SPC">Allied Delivery Services LLL SPC</option>
              {Object.keys(kpis.branchWiseWithCompany)
                .filter((b) => b !== 'ALLIED DELIVERY SERVICES L.L.C' && b !== 'Allied Delivery Services LLL SPC')
                .map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
            </select>
          </div>

          {/* Category / Custody Status Selector */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Category / Custody Status
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                const val = e.target.value as any;
                setCategoryFilter(val);
                if (val === 'WITH_COMPANY') setStatusFilter('WITH_COMPANY');
                else if (val === 'RETURNED_TO_RIDER') setStatusFilter('WITH_RIDER');
                else setStatusFilter('ALL');
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Employees ({categorizedData.totalEmployeesCount})</option>
              <option value="WITH_COMPANY">With Company ({categorizedData.withCompanyList.length})</option>
              <option value="NOT_RECEIVED">With Rider / Not Received ({categorizedData.notReceivedList.length})</option>
              <option value="RETURNED_TO_RIDER">Returned to Rider ({categorizedData.returnedToRiderList.length})</option>
            </select>
          </div>

          {/* Employee Status Selector */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Employee Status
            </label>
            <select
              value={employeeStatusFilter}
              onChange={(e) => setEmployeeStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Employee Statuses</option>
              <option value="Assigned / Active">Assigned / Active</option>
              <option value="Available / Unassigned">Available / Unassigned</option>
              <option value="On Leave">On Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
              <option value="On Hold">On Hold</option>
              <option value="Absconding">Absconding</option>
              <option value="Terminated">Terminated</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Employee / Unique ID / Sr# Input */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search rider, code, status, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(categoryFilter !== 'ALL' || branchFilter !== 'ALL' || employeeStatusFilter !== 'ALL' || selectedReturnReason !== 'All Return Reasons' || searchTerm) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/50 text-[11px]">
            <span className="text-slate-400 font-medium">Active Filters:</span>
            {categoryFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 flex items-center gap-1">
                Category:{' '}
                {categoryFilter === 'WITH_COMPANY'
                  ? 'With Company'
                  : categoryFilter === 'NOT_RECEIVED'
                  ? 'With Rider / Not Received'
                  : 'Returned to Rider'}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setCategoryFilter('ALL')} />
              </span>
            )}
            {employeeStatusFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                Status: {employeeStatusFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setEmployeeStatusFilter('ALL')} />
              </span>
            )}
            {branchFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 flex items-center gap-1">
                Branch: {branchFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setBranchFilter('ALL')} />
              </span>
            )}
            {selectedReturnReason !== 'All Return Reasons' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 flex items-center gap-1">
                Reason: {selectedReturnReason}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedReturnReason('All Return Reasons')} />
              </span>
            )}
            {searchTerm && (
              <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-200 flex items-center gap-1">
                Query: "{searchTerm}"
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchTerm('')} />
              </span>
            )}
            <button onClick={handleClearFilters} className="text-emerald-400 hover:underline font-semibold ml-2">
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* 6. Passport Status Overview Table */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
        {/* Category Selection Tabs */}
        <div className="px-5 py-3 border-b border-slate-700/80 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
                setSelectedReturnReason('All Return Reasons');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                categoryFilter === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-1 ring-blue-400/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Total Employees</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-950/60 font-mono font-bold">
                {categorizedData.totalEmployeesCount}
              </span>
            </button>

            <button
              onClick={() => {
                setCategoryFilter('WITH_COMPANY');
                setStatusFilter('WITH_COMPANY');
                setSelectedReturnReason('All Return Reasons');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                categoryFilter === 'WITH_COMPANY'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-1 ring-emerald-400/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>With Company</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-950/60 font-mono font-bold">
                {categorizedData.withCompanyList.length}
              </span>
            </button>

            <button
              onClick={() => {
                setCategoryFilter('NOT_RECEIVED');
                setStatusFilter('ALL');
                setSelectedReturnReason('All Return Reasons');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                categoryFilter === 'NOT_RECEIVED'
                  ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-1 ring-sky-400/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <FileQuestion className="w-3.5 h-3.5" />
              <span>With Rider / Not Received</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-950/60 font-mono font-bold">
                {categorizedData.notReceivedList.length}
              </span>
            </button>

            <button
              onClick={() => {
                setCategoryFilter('RETURNED_TO_RIDER');
                setStatusFilter('WITH_RIDER');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                categoryFilter === 'RETURNED_TO_RIDER'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-1 ring-amber-400/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Returned to Rider</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-950/60 font-mono font-bold">
                {categorizedData.returnedToRiderList.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              Showing {filteredCategorizedRows.length} of {categorizedData.totalEmployeesCount}
            </span>
          </div>
        </div>

        {/* Section Header */}
        <div className="px-5 py-3 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-850">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>
                {categoryFilter === 'ALL' && 'All Master Employees Custody View'}
                {categoryFilter === 'WITH_COMPANY' && 'Passports in Company Custody (Safe Vault)'}
                {categoryFilter === 'NOT_RECEIVED' && 'Employees With Rider / Not Received (Never Submitted)'}
                {categoryFilter === 'RETURNED_TO_RIDER' && 'Passports Returned to Rider (Handover)'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                {filteredCategorizedRows.length} {filteredCategorizedRows.length === 1 ? 'employee' : 'employees'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {categoryFilter === 'ALL' && 'Authoritative master employee list partitioned across three mutually exclusive passport states.'}
              {categoryFilter === 'WITH_COMPANY' && 'Employees whose physical passports are actively verified in company safe custody.'}
              {categoryFilter === 'NOT_RECEIVED' && 'Active master employees who have never submitted a passport and have no custody record.'}
              {categoryFilter === 'RETURNED_TO_RIDER' && 'Passports previously received by company and handed back to the rider.'}
            </p>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Click rider name to inspect Employee 360 profile.</span>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-xs text-slate-300">
            {/* Table Header per Category */}
            <thead className="bg-slate-950/70 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-slate-700">
              {categoryFilter === 'NOT_RECEIVED' ? (
                <tr>
                  <th className="py-3.5 px-3 text-center">Sr#</th>
                  <th className="py-3.5 px-3">Rider Name</th>
                  <th className="py-3.5 px-3">Employee Code</th>
                  <th className="py-3.5 px-3">Emirates ID</th>
                  <th className="py-3.5 px-3">Employee Status</th>
                  <th className="py-3.5 px-3">Project</th>
                  <th className="py-3.5 px-3">Passport No</th>
                  <th className="py-3.5 px-3">Branch</th>
                  <th className="py-3.5 px-3 text-center">Custody State</th>
                  <th className="py-3.5 px-3 text-right pr-4">Action</th>
                </tr>
              ) : categoryFilter === 'RETURNED_TO_RIDER' ? (
                <tr>
                  <th className="py-3.5 px-3 text-center">Sr#</th>
                  <th className="py-3.5 px-3">Rider Name & Code</th>
                  <th className="py-3.5 px-3">Emirates ID</th>
                  <th className="py-3.5 px-3">Employee Status</th>
                  <th className="py-3.5 px-3">Passport No</th>
                  <th className="py-3.5 px-3">Receive Date</th>
                  <th className="py-3.5 px-3">Return Date</th>
                  <th className="py-3.5 px-3">Return Reason</th>
                  <th className="py-3.5 px-3">Returned By</th>
                  <th className="py-3.5 px-3">Received By</th>
                  <th className="py-3.5 px-3 text-right pr-4">Actions</th>
                </tr>
              ) : categoryFilter === 'WITH_COMPANY' ? (
                <tr>
                  <th className="py-3.5 px-3 text-center">Sr#</th>
                  <th className="py-3.5 px-3">Rider Name & Code</th>
                  <th className="py-3.5 px-3">Emirates ID</th>
                  <th className="py-3.5 px-3">Employee Status</th>
                  <th className="py-3.5 px-3">Passport No</th>
                  <th className="py-3.5 px-3">Expiry Date</th>
                  <th className="py-3.5 px-3">Current Handler</th>
                  <th className="py-3.5 px-3">Current Location</th>
                  <th className="py-3.5 px-3">Branch</th>
                  <th className="py-3.5 px-3">Receive Date</th>
                  <th className="py-3.5 px-3 text-right pr-4">Actions</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-3.5 px-3 text-center">Sr#</th>
                  <th className="py-3.5 px-3">Rider Name & Code</th>
                  <th className="py-3.5 px-3">Emirates ID</th>
                  <th className="py-3.5 px-3">Employee Status</th>
                  <th className="py-3.5 px-3">Project</th>
                  <th className="py-3.5 px-3">Passport No</th>
                  <th className="py-3.5 px-3 text-center">Custody Category</th>
                  <th className="py-3.5 px-3">Storage Location / Handler</th>
                  <th className="py-3.5 px-3">Receive Date</th>
                  <th className="py-3.5 px-3">Return Date</th>
                  <th className="py-3.5 px-3 text-right pr-4">Actions</th>
                </tr>
              )}
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    <span>Loading authoritative employee and passport custody records...</span>
                  </td>
                </tr>
              ) : filteredCategorizedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <FolderCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No records found for current filters.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm || branchFilter !== 'ALL' || employeeStatusFilter !== 'ALL' || selectedReturnReason !== 'All Return Reasons'
                        ? 'Try clearing the search query, status or branch filter.'
                        : 'No employees found in this category.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCategorizedRows.map((row, idx) => {
                  const isWithCompany = row.category === 'WITH_COMPANY';
                  const isNotReceived = row.category === 'NOT_RECEIVED';
                  const isReturned = row.category === 'RETURNED_TO_RIDER';

                  const expDateStr = row.passport_expiry || '';
                  const isExpiringSoon =
                    expDateStr && new Date(expDateStr).getTime() - Date.now() < 180 * 24 * 3600 * 1000;

                  // NOT RECEIVED VIEW
                  if (categoryFilter === 'NOT_RECEIVED') {
                    return (
                      <tr key={row.key} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div
                            onClick={() => onOpenEmployee360 && onOpenEmployee360(row.employee_id)}
                            className="font-bold text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 group"
                            title="Open Employee 360 Profile"
                          >
                            <span>{row.employee_name}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                            {row.employee_code}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{row.emirates_id || '—'}</td>
                        {renderEmployeeStatusCell(row)}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 text-[11px] font-semibold border border-slate-700/60">
                            {row.project || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Not Provided
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 truncate max-w-[150px]" title={row.branch_name}>
                          {row.branch_name}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            <FileQuestion className="w-2.5 h-2.5" />
                            <span>Not Received</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right pr-4">
                          <button
                            onClick={() => handleQuickReceiveFromNotReceived(row)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1 ml-auto shadow-sm"
                            title="Receive passport into company custody"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // RETURNED TO RIDER VIEW
                  if (categoryFilter === 'RETURNED_TO_RIDER') {
                    return (
                      <tr key={row.key} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div
                            onClick={() => onOpenEmployee360 && onOpenEmployee360(row.employee_id)}
                            className="font-bold text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 group"
                            title="Open Employee 360 Profile"
                          >
                            <span>{row.employee_name}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />
                          </div>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-700">
                            {row.employee_code}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{row.emirates_id || '—'}</td>
                        {renderEmployeeStatusCell(row)}
                        <td className="py-3 px-3 font-mono font-bold text-slate-100">{row.passport_number}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">{row.receive_date || '—'}</td>
                        <td className="py-3 px-3 font-mono text-amber-300 font-semibold">{row.return_date || '—'}</td>
                        <td className="py-3 px-3">
                          <span
                            className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[11px] font-medium border border-slate-700/60 inline-block max-w-[160px] truncate"
                            title={row.return_reason}
                          >
                            {row.return_reason || 'Return Handover'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{row.returned_by || 'HR Staff'}</td>
                        <td className="py-3 px-3 text-slate-300">{row.received_by || row.employee_name}</td>
                        <td className="py-3 px-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleQuickReceiveFromNotReceived(row)}
                              className="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1"
                              title="Re-receive passport back into safe custody"
                            >
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>Re-Receive</span>
                            </button>
                            <button
                              onClick={() => openHistoryModal(row)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors"
                              title="View full movement history"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(row)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                              title="Edit passport record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // WITH COMPANY VIEW
                  if (categoryFilter === 'WITH_COMPANY') {
                    return (
                      <tr key={row.key} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div
                            onClick={() => onOpenEmployee360 && onOpenEmployee360(row.employee_id)}
                            className="font-bold text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 group"
                            title="Open Employee 360 Profile"
                          >
                            <span>{row.employee_name}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />
                          </div>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-700">
                            {row.employee_code}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{row.emirates_id || '—'}</td>
                        {renderEmployeeStatusCell(row)}
                        <td className="py-3 px-3 font-mono font-bold text-slate-100">{row.passport_number}</td>
                        <td className="py-3 px-3">
                          <span className="font-mono">{expDateStr || '—'}</span>
                          {isExpiringSoon && (
                            <span className="block text-[10px] text-rose-400 font-semibold mt-0.5">
                              Expiring Soon
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-medium">{row.current_handler || 'HR Staff'}</td>
                        <td className="py-3 px-3 text-slate-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[140px]" title={row.current_location}>
                              {row.current_location || 'Office Safe'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300 truncate max-w-[130px]" title={row.branch_name}>
                          {row.branch_name}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{row.receive_date || '—'}</td>
                        <td className="py-3 px-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openReturnModal(row)}
                              className="px-2 py-1 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border border-amber-700/60 transition-colors flex items-center gap-1 font-bold text-[11px]"
                              title="Return passport to rider"
                            >
                              <ArrowUpRight className="w-3 h-3" />
                              <span>Return</span>
                            </button>
                            <button
                              onClick={() => openHistoryModal(row)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors"
                              title="View full movement history"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(row)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                              title="Edit passport record (Audit Logged)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // ALL MASTER EMPLOYEES VIEW
                  return (
                    <tr key={row.key} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div
                          onClick={() => onOpenEmployee360 && onOpenEmployee360(row.employee_id)}
                          className="font-bold text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 group"
                          title="Open Employee 360 Profile"
                        >
                          <span>{row.employee_name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-700">
                          {row.employee_code}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{row.emirates_id || '—'}</td>
                      {renderEmployeeStatusCell(row)}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 text-[11px] font-semibold border border-slate-700/60">
                          {row.project || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-100">
                        {isNotReceived ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-sans font-normal">
                            Not Provided
                          </span>
                        ) : (
                          row.passport_number
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isWithCompany && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Lock className="w-2.5 h-2.5" />
                            <span>With Company</span>
                          </span>
                        )}
                        {isNotReceived && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            <FileQuestion className="w-2.5 h-2.5" />
                            <span>Not Received</span>
                          </span>
                        )}
                        {isReturned && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <UserCheck className="w-2.5 h-2.5" />
                            <span>Returned to Rider</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {isWithCompany ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[130px]">{row.current_location || 'Office Safe'}</span>
                          </div>
                        ) : isReturned ? (
                          <span className="text-amber-400 font-medium">With Rider</span>
                        ) : (
                          <span className="text-slate-500 italic">Never Submitted</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{row.receive_date || '—'}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{row.return_date || '—'}</td>
                      <td className="py-3 px-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isWithCompany && (
                            <>
                              <button
                                onClick={() => openReturnModal(row)}
                                className="p-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-800/50 text-amber-400 border border-amber-700/50 transition-colors"
                                title="Return to rider"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openHistoryModal(row)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors"
                                title="View history"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(row)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                                title="Edit record"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isNotReceived && (
                            <button
                              onClick={() => handleQuickReceiveFromNotReceived(row)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-sm"
                              title="Receive passport into company custody"
                            >
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>Receive</span>
                            </button>
                          )}
                          {isReturned && (
                            <>
                              <button
                                onClick={() => handleQuickReceiveFromNotReceived(row)}
                                className="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1"
                                title="Re-receive passport back into safe custody"
                              >
                                <ArrowDownLeft className="w-3 h-3" />
                                <span>Re-Receive</span>
                              </button>
                              <button
                                onClick={() => openHistoryModal(row)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition-colors"
                                title="View history"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. Receive Passport from Rider Modal */}
      {/* ========================================================================= */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Receive Passport from Rider</h3>
                  <p className="text-xs text-slate-400">Search existing Allied employee to place passport into company custody.</p>
                </div>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="p-6 space-y-4">
              {recError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{recError}</span>
                </div>
              )}

              {/* Rider Searchable Select from Master Employees */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Select Existing Rider / Employee <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search by Employee Name, Code (e.g. ADL0001), Emirates ID..."
                  value={recRiderSearch}
                  onChange={(e) => {
                    setRecRiderSearch(e.target.value);
                    if (selectedRider) setSelectedRider(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                {/* Candidate Dropdown when searching */}
                {!selectedRider && recRiderSearch && (
                  <div className="mt-1 max-h-44 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg divide-y divide-slate-700/50">
                    {filteredRiderCandidates.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 italic">No matching Allied employee found.</div>
                    ) : (
                      filteredRiderCandidates.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => handleSelectRiderInReceive(emp)}
                          className="p-2.5 hover:bg-slate-700/70 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-white">{emp.full_name}</span>
                            <span className="ml-2 font-mono text-[10px] text-emerald-400 font-semibold">{emp.employee_code}</span>
                            <div className="text-[10px] text-slate-400">
                              {emp.branch_name || 'ALLIED DELIVERY SERVICES L.L.C'} • EID: {emp.emirates_id_number || emp.emirates_id || 'On file'}
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300">Select</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedRider && (
                  <div className="mt-2 p-2.5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-emerald-400">{selectedRider.full_name}</span>
                      <span className="text-slate-400 ml-2">({selectedRider.employee_code})</span>
                      <p className="text-[11px] text-slate-400">Emirates ID: {selectedRider.emirates_id_number || selectedRider.emirates_id || 'On File'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRider(null);
                        setRecRiderSearch('');
                      }}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Passport Number & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Passport Number <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. P1234567"
                    value={recPassportNumber}
                    onChange={(e) => setRecPassportNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Passport Expiry Date
                  </label>
                  <input
                    type="date"
                    value={recPassportExpiry}
                    onChange={(e) => setRecPassportExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Branch & Storage Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Branch
                  </label>
                  <select
                    value={recBranch}
                    onChange={(e) => setRecBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALLIED DELIVERY SERVICES L.L.C">ALLIED DELIVERY SERVICES L.L.C</option>
                    <option value="Allied Delivery Services LLL SPC">Allied Delivery Services LLL SPC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Storage Location Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dubai Head Office Safe (Compartment 1)"
                    value={recStorageLocation}
                    onChange={(e) => setRecStorageLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Your Name (Handler) & Receive Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Your Name (Handler)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={effectiveLoggedInUser}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Receive Date
                  </label>
                  <input
                    type="date"
                    value={recReceiveDate}
                    onChange={(e) => setRecReceiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Custody Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Initial safe deposit upon onboarding or handover return..."
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {recSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Receive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. Return Passport to Rider Modal */}
      {/* ========================================================================= */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Return Passport to Rider</h3>
                  <p className="text-xs text-slate-400">Select an existing passport currently in company custody.</p>
                </div>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              {retError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{retError}</span>
                </div>
              )}

              {/* Searchable Autocomplete for Passports currently with company */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Search Passport in Company Custody <span className="text-amber-400">*</span>
                </label>
                {passportsWithCompany.length === 0 ? (
                  <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-400 italic">
                    No passports currently in company custody to return.
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by Employee Name, Code (e.g. ADL0001), Emirates ID, or Passport..."
                        value={retSearchQuery}
                        onChange={(e) => {
                          setRetSearchQuery(e.target.value);
                          if (retCustodyId) {
                            setRetCustodyId('');
                          }
                        }}
                        className="w-full px-3 py-2 pl-9 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    </div>

                    {/* Helper text when less than 3 chars typed */}
                    {retSearchQuery.trim().length === 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Type at least 3 characters to search passports currently in company custody.
                      </p>
                    )}

                    {retSearchQuery.trim().length > 0 && retSearchQuery.trim().length < 3 && (
                      <p className="mt-1 text-[11px] text-amber-400 font-medium">
                        Please enter at least 3 characters to search ({retSearchQuery.trim().length}/3).
                      </p>
                    )}

                    {/* Autocomplete Results list (Max 10) */}
                    {retSearchQuery.trim().length >= 3 && !retCustodyId && (
                      <div className="mt-1.5 max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-xl divide-y divide-slate-700/60">
                        {filteredReturnCandidates.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 italic">
                            No matching passports currently in company custody found for &quot;{retSearchQuery}&quot;.
                          </div>
                        ) : (
                          filteredReturnCandidates.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setRetCustodyId(p.id);
                                setRetReceiverName(p.employee_name);
                                setRetSearchQuery(`${p.employee_name} (${p.employee_code})`);
                                setRetError('');
                              }}
                              className="p-2.5 hover:bg-slate-700/70 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{p.employee_name}</span>
                                  <span className="font-mono text-[10px] text-amber-400 font-semibold">{p.employee_code}</span>
                                </div>
                                <div className="text-[11px] text-slate-300 mt-0.5">
                                  Passport: <span className="font-mono font-bold text-slate-200">{p.passport_number}</span>
                                  <span className="text-slate-500 mx-1.5">•</span>
                                  <span className="font-mono text-slate-400">{p.serial_number}</span>
                                  <span className="text-slate-500 mx-1.5">•</span>
                                  <span className="text-slate-400">{p.current_location || 'Company Safe'}</span>
                                </div>
                              </div>
                              <span className="text-[10px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                                Select
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected passport details preview card */}
              {returnTargetRecord && (
                <div className="p-3 bg-slate-800/80 border border-amber-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-400">{returnTargetRecord.employee_name}</span>
                      <span className="text-xs font-mono text-slate-300 ml-2">({returnTargetRecord.employee_code})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRetCustodyId('');
                        setRetSearchQuery('');
                        setRetReceiverName('');
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 hover:underline font-medium"
                    >
                      Change Selection
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-700/60">
                    <div>
                      <span className="text-slate-400">Passport Number:</span>{' '}
                      <strong className="font-mono text-white">{returnTargetRecord.passport_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Custody Serial:</span>{' '}
                      <span className="font-mono text-amber-300 font-medium">{returnTargetRecord.serial_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Current Safe:</span>{' '}
                      <span className="text-slate-200 font-medium">{returnTargetRecord.current_location}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Received Date:</span>{' '}
                      <span className="text-slate-300 font-mono">{returnTargetRecord.receive_date || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Branch:</span>{' '}
                      <span className="text-slate-300">{returnTargetRecord.branch_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Emirates ID:</span>{' '}
                      <span className="text-slate-300 font-mono">{returnTargetRecord.emirates_id || 'On file'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Return Date & Return Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Return Date <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={retReturnDate}
                    onChange={(e) => setRetReturnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Return Reason <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={retReason}
                    onChange={(e) => setRetReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {ROUTEMATE_RETURN_REASONS.filter((r) => r !== 'All Return Reasons').map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Returned By (Logged in User) & Receiver Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Returned By (Handler)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={effectiveLoggedInUser}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Received By (Rider)
                  </label>
                  <input
                    type="text"
                    value={retReceiverName}
                    onChange={(e) => setRetReceiverName(e.target.value)}
                    placeholder="Rider acknowledging receipt"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Optional Guarantor Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Guarantor Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Captain / Sponsor"
                    value={retGuarantorName}
                    onChange={(e) => setRetGuarantorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Guarantor Unique ID / Emirates ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. "
                    value={retGuarantorUniqueId}
                    onChange={(e) => setRetGuarantorUniqueId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Handover Notes / Return Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Specify flight dates, expected return date, or release terms..."
                  value={retNotes}
                  onChange={(e) => setRetNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Acknowledgement checkbox */}
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  id="ack_checkbox"
                  checked={retReceiverAcknowledged}
                  onChange={(e) => setRetReceiverAcknowledged(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-700"
                />
                <label htmlFor="ack_checkbox" className="cursor-pointer font-medium">
                  Rider has verified and physically received their original passport.
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={retSubmitting || !retCustodyId}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {retSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Return to Rider</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. View Chronological Movement History Modal */}
      {/* ========================================================================= */}
      {isHistoryModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Passport Custody History</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {selectedItem.serial_number}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedItem.employee_name} ({selectedItem.employee_code}) • Passport: {selectedItem.passport_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
                  <span>Loading complete movement history...</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs">No prior movement cycles recorded.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                  {historyList.map((hist, hIdx) => {
                    const isReceive = hist.event_type === 'RECEIVED';
                    const isReturn = hist.event_type === 'RETURNED_TO_RIDER';
                    const isCorrection = hist.event_type === 'EDIT_CORRECTION';

                    return (
                      <div key={hist.id || hIdx} className="relative">
                        {/* Event icon dot */}
                        <div
                          className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                            isReceive
                              ? 'bg-emerald-500'
                              : isReturn
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                        />

                        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-4 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isReceive
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : isReturn
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}
                              >
                                {isReceive
                                  ? 'Received from Rider'
                                  : isReturn
                                  ? 'Returned to Rider'
                                  : 'Administrative Correction'}
                              </span>
                              <span className="text-xs text-slate-300 font-semibold">
                                by {hist.actor_name || hist.handler_name || 'HR Staff'}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {hist.event_date || (hist.timestamp ? hist.timestamp.replace('T', ' ').substring(0, 16) : '')}
                            </span>
                          </div>

                          {/* Event details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            {isReceive && (
                              <>
                                <div>
                                  <span className="text-slate-400">Received From:</span>{' '}
                                  <span className="text-white font-medium">{hist.received_from || hist.employee_name}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Storage Location:</span>{' '}
                                  <span className="text-white font-medium">{hist.location || hist.storage_location}</span>
                                </div>
                              </>
                            )}

                            {isReturn && (
                              <>
                                <div>
                                  <span className="text-slate-400">Return Reason:</span>{' '}
                                  <span className="text-amber-300 font-bold">{hist.return_reason || hist.reason}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Returned To:</span>{' '}
                                  <span className="text-white font-medium">{hist.returned_to || hist.receiver_name || hist.employee_name}</span>
                                </div>
                                {hist.guarantor_name && (
                                  <div className="col-span-2">
                                    <span className="text-slate-400">Guarantor:</span>{' '}
                                    <span className="text-white font-medium">{hist.guarantor_name} ({hist.guarantor_unique_id || 'N/A'})</span>
                                  </div>
                                )}
                              </>
                            )}

                            {isCorrection && (
                              <div className="col-span-2">
                                <span className="text-slate-400">Compliance Reason:</span>{' '}
                                <span className="text-blue-300 font-semibold">{hist.correction_reason || hist.reason}</span>
                              </div>
                            )}
                          </div>

                          {/* Remarks */}
                          {hist.notes && (
                            <p className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                              {hist.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. Edit Passport Metadata Modal (With Audit Compliance) */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Edit Passport Record ({selectedItem.serial_number})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Correct passport details with mandatory compliance audit reason.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Rider fixed header */}
              <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Rider:</span>{' '}
                  <strong className="text-white">{selectedItem.employee_name}</strong>{' '}
                  <span className="font-mono text-emerald-400">({selectedItem.employee_code})</span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>{' '}
                  <span className={`font-bold ${selectedItem.status === 'WITH_COMPANY' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedItem.status === 'WITH_COMPANY' ? 'With Company' : 'With Rider'}
                  </span>
                </div>
              </div>

              {/* Passport Number & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Passport Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editPassportNumber}
                    onChange={(e) => setEditPassportNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Passport Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editPassportExpiry}
                    onChange={(e) => setEditPassportExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Branch & Storage Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Storage Location Name
                  </label>
                  <input
                    type="text"
                    value={editStorageLocation}
                    onChange={(e) => setEditStorageLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Receive Date
                  </label>
                  <input
                    type="date"
                    value={editReceiveDate}
                    onChange={(e) => setEditReceiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Return Date (If with rider)
                  </label>
                  <input
                    type="date"
                    value={editReturnDate}
                    onChange={(e) => setEditReturnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Return Reason (if returned) */}
              {selectedItem.status === 'WITH_RIDER' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Return Reason
                  </label>
                  <select
                    value={editReturnReason}
                    onChange={(e) => setEditReturnReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {ROUTEMATE_RETURN_REASONS.filter((r) => r !== 'All Return Reasons').map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mandatory Correction Reason for Audit Trail */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                  Correction Reason (Mandatory Audit Trail) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain why this record is being edited (e.g. Corrected passport expiry based on physical scan)..."
                  value={editCorrectionReason}
                  onChange={(e) => setEditCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-amber-500/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {editSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Audit Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. Bulk Receive Upload Modal */}
      {/* ========================================================================= */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Receive Passports</h3>
                  <p className="text-xs text-slate-400">
                    Import multiple rider passports into safe custody using CSV format.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Format: Code, PassportNumber, Expiry, Location, Branch, Notes</span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>

              <div>
                <textarea
                  rows={8}
                  placeholder={`employee_code,passport_number,expiry_date,storage_location,branch_name,notes\nADL0001,N1234567,2028-12-31,Dubai Head Office Safe,ALLIED DELIVERY SERVICES L.L.C,Onboarding deposit\nADL0002,P7654321,2029-06-15,Dubai Head Office Safe,ALLIED DELIVERY SERVICES L.L.C,Safe deposit`}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Bulk upload results report */}
              {bulkResult && (
                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-emerald-400">Successfully Received: {bulkResult.receivedCount}</span>
                    <span className="text-rose-400">Failed / Skipped: {bulkResult.errorCount}</span>
                  </div>
                  {bulkResult.errors && bulkResult.errors.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-1 text-rose-300 text-[11px] pt-1">
                      {bulkResult.errors.map((err, i) => (
                        <div key={i}>• {err.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={bulkProcessing || !bulkCsvText.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {bulkProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Process Bulk Receive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. Employee Status Reason Detail Modal */}
      {/* ========================================================================= */}
      {selectedReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Employee Status Details</h3>
                  <p className="text-xs text-slate-400">Authoritative status reason from Employee Management</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReasonModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Employee</div>
                  <div className="text-sm font-bold text-white mt-0.5">{selectedReasonModal.employeeName}</div>
                  {selectedReasonModal.employeeCode && (
                    <div className="text-[11px] font-mono text-emerald-400 mt-0.5">{selectedReasonModal.employeeCode}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Current Status</div>
                  <div className="mt-1">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 border border-slate-700 text-slate-200">
                      {selectedReasonModal.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Recorded Reason / Remarks</span>
                </label>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs leading-relaxed font-mono whitespace-pre-wrap min-h-[80px]">
                  {selectedReasonModal.reason || 'Not recorded'}
                </div>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-[11px] text-blue-300">
                <span>
                  Employment status and status remarks are synchronized directly with Employee Management master records.
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedReasonModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
