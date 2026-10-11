import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Lock,
  Search,
  Filter,
  Plus,
  Key,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  AlertCircle,
  Briefcase,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  officeStaffService,
  OfficeStaffUser,
  OfficeStaffListResponse,
} from '../../services/officeStaffService';
import { SystemUserAccount } from '../../types/erp';

interface OfficeStaffAccessViewProps {
  currentUser: SystemUserAccount;
  onNavigateModule?: (module: string) => void;
  onOpenEmployee360?: (employeeId: string) => void;
  lang?: 'EN' | 'AR';
}

export const OfficeStaffAccessView: React.FC<OfficeStaffAccessViewProps> = ({
  currentUser,
  onNavigateModule,
  onOpenEmployee360,
  lang = 'EN',
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataResponse, setDataResponse] = useState<OfficeStaffListResponse | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Master Roles for filter dropdown
  const [rolesList, setRolesList] = useState<any[]>([]);

  // Modals state
  const [statusModalUser, setStatusModalUser] = useState<OfficeStaffUser | null>(null);
  const [statusActionReason, setStatusActionReason] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  const [resetPwdUser, setResetPwdUser] = useState<OfficeStaffUser | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<string>('');
  const [showTempPwd, setShowTempPwd] = useState<boolean>(false);
  const [mustChangePwd, setMustChangePwd] = useState<boolean>(true);
  const [resettingPwd, setResettingPwd] = useState<boolean>(false);
  const [copiedPwd, setCopiedPwd] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Fetch Roles Master
  useEffect(() => {
    officeStaffService
      .getRoles()
      .then((roles) => setRolesList(roles || []))
      .catch((err) => console.error('Failed to load roles list:', err));
  }, []);

  // Fetch Office Staff Users with debounce
  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await officeStaffService.getStaffUsers({
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        role: selectedRole,
        status: selectedStatus,
        branch: selectedBranch,
      });
      setDataResponse(res);
    } catch (err: any) {
      console.error('Error fetching office staff:', err);
      setError(err.message || 'Failed to load authorized office staff.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedRole, selectedStatus, selectedBranch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaffData();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchStaffData]);

  // Handle Account Status Toggle (Active <-> Disabled)
  const handleConfirmStatusChange = async () => {
    if (!statusModalUser) return;
    const targetStatus = statusModalUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setUpdatingStatus(true);
    try {
      await officeStaffService.updateStaffStatus(
        statusModalUser.id,
        targetStatus,
        statusActionReason.trim() || undefined
      );
      setActionSuccessMsg(
        `ERP Account for @${statusModalUser.username} is now ${targetStatus}.`
      );
      setStatusModalUser(null);
      setStatusActionReason('');
      await fetchStaffData();
    } catch (err: any) {
      alert(err.message || 'Failed to change account status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Generate random secure temporary password
  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = 'Allied#';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewTempPassword(pwd);
  };

  // Open Reset Password Modal
  const handleOpenResetModal = (user: OfficeStaffUser) => {
    setResetPwdUser(user);
    generateSecurePassword();
    setShowTempPwd(true);
    setMustChangePwd(true);
    setCopiedPwd(false);
  };

  // Confirm Reset Password
  const handleConfirmResetPassword = async () => {
    if (!resetPwdUser) return;
    if (!newTempPassword || newTempPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setResettingPwd(true);
    try {
      await officeStaffService.resetTemporaryPassword(
        resetPwdUser.id,
        newTempPassword,
        mustChangePwd
      );
      setActionSuccessMsg(
        `Temporary password updated for @${resetPwdUser.username}. Remember to share credentials securely.`
      );
      setResetPwdUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setResettingPwd(false);
    }
  };

  // Copy password to clipboard
  const handleCopyPassword = () => {
    if (!newTempPassword) return;
    navigator.clipboard.writeText(newTempPassword);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  const metrics = dataResponse?.metrics || {
    totalStaff: 0,
    activeStaff: 0,
    disabledStaff: 0,
    configuredRolesCount: rolesList.length || 7,
  };

  return (
    <div className="space-y-6 max-w-[1750px] mx-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl transition-all animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{actionSuccessMsg}</span>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="p-1 hover:bg-emerald-700 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-900">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Office Staff Access
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                RBAC Security v2
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Manage authorized ERP login accounts for company office staff. Assign granular
              operational permissions and govern software access independently from the workforce
              master directory.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => fetchStaffData()}
              disabled={loading}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2" title="User login account creation is managed exclusively in Platform Admin">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Login Accounts Managed via Platform Admin</span>
            </div>
          </div>
        </div>

        {/* Informational Guidance Notice */}
        <div className="mt-4 p-3.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 rounded-xl flex items-start gap-3">
          <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
            <span className="font-semibold">Architectural Separation (Workforce Master ≠ ERP User): </span>
            Creating an employee does NOT automatically grant ERP access. Delivery riders and drivers
            do not receive ERP accounts. Accounts here represent authorized management and office personnel.
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Authorized Staff
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {metrics.totalStaff}
          </div>
          <div className="text-xs text-slate-500 mt-1">Authorized ERP users across company</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Active ERP Accounts
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.activeStaff}
          </div>
          <div className="text-xs text-slate-500 mt-1">Currently permitted to log in</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Disabled / Suspended
            </span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">
            {metrics.disabledStaff}
          </div>
          <div className="text-xs text-slate-500 mt-1">Access revoked (data preserved)</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Configured Roles
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {metrics.configuredRolesCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Canonical role templates defined</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name, Code, @username, Email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 transition-colors placeholder:text-slate-400"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 transition-colors"
            >
              <option value="ALL">All Roles (All Privileges)</option>
              {rolesList.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.displayName || r.role}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 transition-colors"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="DISABLED">Disabled Accounts</option>
              <option value="LOCKED">Locked Accounts</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500 transition-colors"
            >
              <option value="ALL">All Branches & Locations</option>
              <option value="b_dxb">Dubai Central Logistics HQ</option>
              <option value="b_auh">Abu Dhabi Hub</option>
              <option value="b_shj">Sharjah Logistics Center</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Staff Users Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading && !dataResponse ? (
          <div className="py-20 text-center">
            <RotateCcw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-slate-500 mt-2 font-medium">
              Loading authorized staff directory...
            </p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={() => fetchStaffData()}
              className="mt-3 px-4 py-1.5 text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800"
            >
              Retry
            </button>
          </div>
        ) : !dataResponse?.data || dataResponse.data.length === 0 ? (
          <div className="py-16 text-center">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mt-3">
              No Office Staff Accounts Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No authorized ERP user accounts match the selected filters or search keyword.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedRole('ALL');
                setSelectedStatus('ALL');
                setSelectedBranch('ALL');
              }}
              className="mt-4 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50/70 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-4 py-3.5">Employee Code</th>
                  <th className="px-4 py-3.5">ERP Username</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5">Account Status</th>
                  <th className="px-4 py-3.5">Last Login</th>
                  <th className="px-4 py-3.5">Created By</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {dataResponse.data.map((user) => {
                  const isActive = user.status === 'ACTIVE';
                  const isLocked = user.status === 'LOCKED';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Staff Member */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              user.avatarUrl ||
                              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
                            }
                            alt={user.fullName}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {user.isOwner && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-md">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              {user.designation || 'Staff Member'} &bull; {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Employee Code */}
                      <td className="px-4 py-3.5">
                        {user.employee_code ? (
                          <button
                            onClick={() => {
                              if (user.employee_id && onOpenEmployee360) {
                                onOpenEmployee360(user.employee_id);
                              }
                            }}
                            className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors inline-flex items-center gap-1"
                            title="View Employee Master Record"
                          >
                            <span>{user.employee_code}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ) : (
                          <span className="text-slate-400 font-normal italic">System Root</span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/60">
                          @{user.username}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                              : user.role === 'FLEET_MANAGER' || user.role === 'FLEET_SUPERVISOR'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : user.role === 'HR_MANAGER' || user.role === 'HR_OFFICER'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : user.role === 'PAYROLL_OFFICER'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{user.roleDisplayName || user.role}</span>
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[130px]">{user.branch_name}</span>
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : isLocked
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : isLocked ? 'bg-rose-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{user.status}</span>
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{user.lastLogin}</span>
                        </div>
                      </td>

                      {/* Created By */}
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        {user.createdBy || 'System Provision'}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Temporary Password */}
                          <button
                            onClick={() => handleOpenResetModal(user)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Reset Temporary Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Toggle Active / Disabled Status */}
                          <button
                            onClick={() => {
                              if (user.id === currentUser.id) {
                                alert('You cannot disable your own active login session.');
                                return;
                              }
                              setStatusModalUser(user);
                              setStatusActionReason('');
                            }}
                            disabled={user.id === currentUser.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.id === currentUser.id
                                ? 'opacity-30 cursor-not-allowed text-slate-400'
                                : isActive
                                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={isActive ? 'Disable ERP Account' : 'Re-enable ERP Account'}
                          >
                            {isActive ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {dataResponse?.pagination && (dataResponse.pagination.totalPages ?? 1) > 1 && (
          <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page <span className="font-semibold text-slate-800 dark:text-white">{dataResponse.pagination?.page ?? 1}</span> of{' '}
              <span className="font-semibold text-slate-800 dark:text-white">{dataResponse.pagination?.totalPages ?? 1}</span> ({dataResponse.pagination?.total ?? 0} total staff)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={(dataResponse.pagination?.page ?? 1) <= 1}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(dataResponse.pagination?.totalPages ?? 1, p + 1))}
                disabled={(dataResponse.pagination?.page ?? 1) >= (dataResponse.pagination?.totalPages ?? 1)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Enable / Disable ERP Account */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  statusModalUser.status === 'ACTIVE'
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                }`}
              >
                {statusModalUser.status === 'ACTIVE' ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {statusModalUser.status === 'ACTIVE'
                    ? 'Disable ERP Staff Access'
                    : 'Re-enable ERP Staff Access'}
                </h3>
                <p className="text-xs text-slate-500">
                  User: @{statusModalUser.username} ({statusModalUser.fullName})
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              <p>
                {statusModalUser.status === 'ACTIVE'
                  ? 'Disabling this account immediately revokes software login capability. The employee record, audit history, and associated logs remain completely preserved.'
                  : 'Re-enabling this account restores ERP access with the assigned role permissions.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Status Change (Recorded in Audit Log)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. End of contract, Department rotation, Security review..."
                value={statusActionReason}
                onChange={(e) => setStatusActionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setStatusModalUser(null)}
                disabled={updatingStatus}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                disabled={updatingStatus}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
                  statusModalUser.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {updatingStatus ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>
                  {statusModalUser.status === 'ACTIVE'
                    ? 'Confirm Disable Account'
                    : 'Confirm Re-enable Account'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Administrative Reset Temporary Password */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reset Temporary Password
                </h3>
                <p className="text-xs text-slate-500">
                  User: @{resetPwdUser.username} ({resetPwdUser.fullName})
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Temporary Password
                </label>
                <button
                  type="button"
                  onClick={generateSecurePassword}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate New</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showTempPwd ? 'text' : 'password'}
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full pl-3 pr-20 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowTempPwd(!showTempPwd)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title={showTempPwd ? 'Hide Password' : 'Show Password'}
                  >
                    {showTempPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Copy Password"
                  >
                    {copiedPwd ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="mustChangePwdCheckbox"
                checked={mustChangePwd}
                onChange={(e) => setMustChangePwd(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <label
                htmlFor="mustChangePwdCheckbox"
                className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Require employee to change password on next login
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setResetPwdUser(null)}
                disabled={resettingPwd}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetPassword}
                disabled={resettingPwd}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                {resettingPwd ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Update Password</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
