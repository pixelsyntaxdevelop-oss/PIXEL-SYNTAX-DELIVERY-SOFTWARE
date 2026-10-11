import React, { useState } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  Lock,
  UserCheck,
  Activity,
  Search,
  Filter,
  Plus,
  Key,
  Edit,
  Trash2,
  Check,
  X,
  Layers,
  Clock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  Car,
  FileText,
  UserPlus,
} from 'lucide-react';
import { SystemUserAccount, SystemAuditLog, NavigationModule } from '../../types/erp';

interface UserAccessManagementViewProps {
  currentUser: SystemUserAccount;
  userAccounts: SystemUserAccount[];
  auditLogs: SystemAuditLog[];
  onUpdateUsers: (users: SystemUserAccount[]) => void;
  onOpenUserModal: () => void;
  lang?: 'EN' | 'AR';
}

export const UserAccessManagementView: React.FC<UserAccessManagementViewProps> = ({
  currentUser,
  userAccounts,
  auditLogs,
  onUpdateUsers,
  onOpenUserModal,
  lang = 'EN',
}) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'AUDIT_LOGS'>('USERS');

  // Filters for Audit Logs
  const [logSearchKeyword, setLogSearchKeyword] = useState('');
  const [logFilterUser, setLogFilterUser] = useState('ALL');
  const [logFilterModule, setLogFilterModule] = useState('ALL');
  const [logFilterAction, setLogFilterAction] = useState('ALL');

  // Filter User Accounts
  const [userSearch, setUserSearch] = useState('');

  const filteredUsers = userAccounts.filter((u) => {
    return (
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.designation.toLowerCase().includes(userSearch.toLowerCase())
    );
  });

  // Filter Audit Logs
  const filteredLogs = auditLogs.filter((log) => {
    const keywordMatch =
      log.details.toLowerCase().includes(logSearchKeyword.toLowerCase()) ||
      log.userName.toLowerCase().includes(logSearchKeyword.toLowerCase()) ||
      log.module.toLowerCase().includes(logSearchKeyword.toLowerCase());

    const userMatch = logFilterUser === 'ALL' || log.userId === logFilterUser;
    const moduleMatch = logFilterModule === 'ALL' || log.module === logFilterModule;
    const actionMatch = logFilterAction === 'ALL' || log.actionType === logFilterAction;

    return keywordMatch && userMatch && moduleMatch && actionMatch;
  });

  // Toggle User Status (Active/Inactive)
  const handleToggleStatus = (userId: string) => {
    if (!currentUser.isOwner) {
      alert('Only the Main System Owner can change user account status.');
      return;
    }
    onUpdateUsers(
      userAccounts.map((u) => {
        if (u.id === userId && !u.isOwner) {
          const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 min-h-screen">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-purple-600" />
            <span>Main Owner User Access Control & Audit Tracker</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage employee login accounts, assign modular permissions, and track who performed which bike, SIM, or employee action.
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {currentUser.isOwner && (
            <button
              onClick={onOpenUserModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Employee Login</span>
            </button>
          )}

          <button
            onClick={onOpenUserModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
          >
            <Users className="w-4 h-4 text-purple-400" />
            <span>Switch Active Login</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Registered System Logins</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{userAccounts.length}</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {userAccounts.filter((u) => u.status === 'ACTIVE').length} Active Accounts
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Logged User Profile</p>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-1 truncate max-w-[150px]">
              {currentUser.fullName}
            </p>
            <p className="text-[10px] text-purple-600 font-bold uppercase mt-0.5">
              {currentUser.isOwner ? '👑 Main System Owner' : currentUser.role}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">System Audit Trail Events</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{auditLogs.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Immutable Activity Log</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Security Enforcements</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">2FA & RBAC</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Granular Sidebar Filtering</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-6 pt-3 gap-4">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'USERS'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employee Login Accounts ({userAccounts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'AUDIT_LOGS'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Audit Trail & Activity Logs ({auditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: USER ACCOUNTS LIST & PERMISSIONS */}
        {activeTab === 'USERS' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user name, username, or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="text-xs text-slate-500 font-semibold">
                Showing {filteredUsers.length} of {userAccounts.length} user accounts
              </div>
            </div>

            {/* Users Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((usr) => (
                <div
                  key={usr.id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 flex flex-col justify-between ${
                    usr.isOwner
                      ? 'bg-purple-50/50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-900'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs ${
                          usr.isOwner ? 'bg-purple-600 text-white' : 'bg-slate-800 text-white'
                        }`}>
                          {usr.fullName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{usr.fullName}</span>
                            {usr.isOwner && <span className="text-amber-500">👑</span>}
                          </h3>
                          <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-semibold">
                            @{usr.username}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          usr.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {usr.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <p><span className="font-bold text-slate-400">Designation:</span> {usr.designation}</p>
                      <p><span className="font-bold text-slate-400">System Role:</span> {usr.role}</p>
                      <p><span className="font-bold text-slate-400">Email:</span> {usr.email}</p>
                    </div>

                    {/* Allowed Sections List */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                        <span>Permitted Sections & Modules:</span>
                      </p>
                      {usr.isOwner || usr.allowedModules.includes('ALL') ? (
                        <span className="inline-block px-2 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold">
                          All ERP Sections Access Allowed
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {usr.allowedModules.map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px] font-mono font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Controls */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Last Login: {usr.lastLogin}
                    </span>

                    {currentUser.isOwner && !usr.isOwner && (
                      <button
                        onClick={() => handleToggleStatus(usr.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                          usr.status === 'ACTIVE'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                        }`}
                      >
                        {usr.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: IMMUTABLE AUDIT TRAIL LOGS */}
        {activeTab === 'AUDIT_LOGS' && (
          <div className="p-6 space-y-6">
            {/* Audit Log Filters */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5" /> Filter Audit Log Records
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    SEARCH KEYWORD
                  </label>
                  <input
                    type="text"
                    placeholder="Search bike, SIM, user, or details..."
                    value={logSearchKeyword}
                    onChange={(e) => setLogSearchKeyword(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    FILTER BY USER
                  </label>
                  <select
                    value={logFilterUser}
                    onChange={(e) => setLogFilterUser(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="ALL">All Users</option>
                    {userAccounts.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    FILTER BY MODULE
                  </label>
                  <select
                    value={logFilterModule}
                    onChange={(e) => setLogFilterModule(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="ALL">All Modules</option>
                    <option value="Vehicle Management">Vehicle Management</option>
                    <option value="Sim Management">Sim Management</option>
                    <option value="Candidate Recruitment">Candidate Recruitment</option>
                    <option value="Driver Tickets">Driver Tickets</option>
                    <option value="System Security">System Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    ACTION TYPE
                  </label>
                  <select
                    value={logFilterAction}
                    onChange={(e) => setLogFilterAction(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="ASSIGN">ASSIGN</option>
                    <option value="UNASSIGN">UNASSIGN</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="LOGIN">LOGIN</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor & User Profile</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Action Details</th>
                    <th className="p-3 font-mono">IP Address</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        No audit log events match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{log.timestamp}</td>

                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          <span>{log.userName}</span>
                        </td>

                        <td className="p-3 font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {log.userRole}
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.actionType === 'ASSIGN'
                                ? 'bg-blue-600 text-white'
                                : log.actionType === 'CREATE'
                                ? 'bg-emerald-600 text-white'
                                : log.actionType === 'UPDATE'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 text-white'
                            }`}
                          >
                            {log.actionType}
                          </span>
                        </td>

                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                          {log.module}
                        </td>

                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200 max-w-md truncate">
                          {log.details}
                        </td>

                        <td className="p-3 font-mono text-slate-400 text-[11px]">{log.ipAddress}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
