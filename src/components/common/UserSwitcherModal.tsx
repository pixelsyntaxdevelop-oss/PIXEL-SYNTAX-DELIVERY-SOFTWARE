import React, { useState } from 'react';
import {
  Users,
  Shield,
  Check,
  X,
  UserCheck,
  Lock,
  Plus,
  Key,
  ShieldAlert,
  ChevronRight,
  LogOut,
  Sparkles,
  Layers,
  Settings,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { SystemUserAccount } from '../../types/erp';
import { ALL_ERP_MODULE_IDS } from '../../data/defaultUserAccounts';

interface UserSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUserAccount;
  allUsers: SystemUserAccount[];
  onSwitchUser: (user: SystemUserAccount) => void;
  onCreateUser: (newUser: SystemUserAccount) => void;
}

const MODULE_CATEGORY_GROUPS = [
  {
    name: 'MONITORING & COMMAND CENTER',
    modules: [
      { id: 'operations_dashboard', label: 'Operations Command Center' },
      { id: 'fleet_dashboard', label: 'Live Fleet Telemetry' },
    ],
  },
  {
    name: 'HUMAN RESOURCES',
    modules: [
      { id: 'employees_list', label: 'Employee Directory & 360' },
      { id: 'recruitment', label: 'Recruitment Pipeline' },
      { id: 'attendance_daily', label: 'Daily Employee Attendance' },
      { id: 'attendance_monthly', label: 'Monthly Employee Attendance' },
      { id: 'doc_expiry_listing', label: 'Document Expiry Listing' },
      { id: 'forms_list', label: 'Employee Office Forms' },
      { id: 'passport_list', label: 'Passport Management' },
    ],
  },
  {
    name: 'OPERATIONS & FLEET',
    modules: [
      { id: 'rider_project_mgmt', label: 'Rider / Project Management' },
      { id: 'captain_perf', label: 'Rider Performance' },
      { id: 'vehicle_status', label: 'Vehicle Management' },
      { id: 'traffic_fines_mgmt', label: 'Traffic Fines' },
      { id: 'salik_mgmt', label: 'Salik Management' },
      { id: 'sim_mgmt', label: 'SIM Card Management' },
    ],
  },
  {
    name: 'PAYROLL & FINANCE',
    modules: [
      { id: 'hr_payroll', label: 'Payroll' },
      { id: 'payroll_loan_mgmt', label: 'Loan Management' },
    ],
  },
  {
    name: 'REPORTS & CONFIGURATION',
    modules: [
      { id: 'operational_reports', label: 'Operations Reports & CSV' },
      { id: 'data_import_center', label: 'Bulk Data Import Center' },
      { id: 'sys_configuration', label: 'Configuration' },
      { id: 'user_access_mgmt', label: 'User Access & Audit Logs' },
    ],
  },
];

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onSwitchUser,
  onCreateUser,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'SWITCH' | 'CREATE'>('SWITCH');

  // Form state for creating new user
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'FLEET_MANAGER' | 'HR_MANAGER' | 'DISPATCHER' | 'ACCOUNTANT' | 'OPERATIONS_MANAGER'>('OPERATIONS_MANAGER');
  const [designation, setDesignation] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'fleet_dashboard',
    'employees_list',
  ]);

  const handleToggleModule = (modId: string) => {
    setSelectedModules((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const handleSelectAllCategory = (modIds: string[]) => {
    const allSelected = modIds.every((id) => selectedModules.includes(id));
    if (allSelected) {
      setSelectedModules((prev) => prev.filter((id) => !modIds.includes(id)));
    } else {
      setSelectedModules((prev) => Array.from(new Set([...prev, ...modIds])));
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username) {
      alert('Please fill in Full Name and Username');
      return;
    }

    const newUser: SystemUserAccount = {
      id: `user_emp_${Date.now()}`,
      username: username.toLowerCase().replace(/\s+/g, '_'),
      fullName,
      email: email || `${username}@alliedfleet.com`,
      phone: phone || '0500000000',
      role,
      designation: designation || `${role.replace('_', ' ')} Executive`,
      isOwner: false,
      status: 'ACTIVE',
      createdDate: new Date().toISOString().split('T')[0],
      lastLogin: 'Never logged in',
      allowedModules: selectedModules,
    };

    onCreateUser(newUser);
    alert(`✅ Employee account for "${fullName}" created successfully with ${selectedModules.length} permitted modules!`);
    setActiveTab('SWITCH');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>System Multi-User Access & Login Manager</span>
                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded text-[10px] font-mono uppercase font-bold border border-purple-500/40">
                  Owner Control Panel
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Switch active employee logins or assign custom access permissions per section
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 sm:px-6 pt-3 shrink-0 gap-3">
          <button
            onClick={() => setActiveTab('SWITCH')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'SWITCH'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Switch Active Login ({allUsers.length} Users)</span>
          </button>

          {currentUser.isOwner && (
            <button
              onClick={() => setActiveTab('CREATE')}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'CREATE'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Plus className="w-4 h-4 text-purple-500" />
              <span>+ Create Employee Login Access</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'SWITCH' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-xl text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Current Active Session:</span>{' '}
                  <span className="font-mono text-purple-700 dark:text-purple-300 font-extrabold">
                    {currentUser.fullName} ({currentUser.designation})
                  </span>
                </div>
                {currentUser.isOwner && (
                  <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold uppercase">
                    Main Owner
                  </span>
                )}
              </div>

              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select User to Login As:
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allUsers.map((usr) => {
                  const isSelected = usr.id === currentUser.id;

                  return (
                    <div
                      key={usr.id}
                      onClick={() => {
                        onSwitchUser(usr);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 relative ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/30'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-purple-400 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                            usr.isOwner ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
                          }`}>
                            {usr.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{usr.fullName}</span>
                              {usr.isOwner && <span className="text-amber-500">👑</span>}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              @{usr.username} • {usr.designation}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-semibold group-hover:bg-purple-600 group-hover:text-white shrink-0">
                            Switch Login
                          </span>
                        )}
                      </div>

                      {/* Permitted Modules Summary Badge */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-purple-500" />
                          <span>
                            {usr.isOwner || usr.allowedModules.includes('ALL')
                              ? 'All ERP Modules (Unrestricted)'
                              : `${usr.allowedModules.length} Modules Allowed`}
                          </span>
                        </span>
                        <span className="font-mono text-slate-400">Last: {usr.lastLogin.split(' ')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'CREATE' && currentUser.isOwner && (
            <form onSubmit={handleCreateSubmit} className="space-y-5 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Main Owner Security Control:</span>
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Create a new login for your employee and explicitly choose which sections they can view on their PC. They will not see any section you do not select.
                </p>
              </div>

              {/* User Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raza Ahmed"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Username / Login ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. raza_ops"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Employee Role
                  </label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="OPERATIONS_MANAGER">Operations Manager</option>
                    <option value="FLEET_MANAGER">Fleet Manager</option>
                    <option value="HR_MANAGER">HR Manager</option>
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="ACCOUNTANT">Accountant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Designation Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Bike & Vehicle Manager"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="raza@alliedfleet.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    placeholder="0501234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Granular Module Access Checkboxes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                      <Lock className="w-4 h-4 text-purple-600" />
                      <span>Section & Module Access Granular Control</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Check the boxes for sections this employee is allowed to view and manage.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold rounded-lg text-xs font-mono">
                    {selectedModules.length} Selected
                  </span>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {MODULE_CATEGORY_GROUPS.map((cat, catIdx) => {
                    const catModIds = cat.modules.map((m) => m.id);
                    const allCatSelected = catModIds.every((id) => selectedModules.includes(id));

                    return (
                      <div
                        key={catIdx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-purple-700 dark:text-purple-400 tracking-wider">
                            {cat.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllCategory(catModIds)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                          >
                            {allCatSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {cat.modules.map((mod) => {
                            const isChecked = selectedModules.includes(mod.id);

                            return (
                              <label
                                key={mod.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-purple-100/60 dark:bg-purple-900/40 border-purple-400 font-bold text-slate-900 dark:text-white'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleModule(mod.id)}
                                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                                />
                                <span className="text-[11px]">{mod.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('SWITCH')}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Create Account & Save Permissions</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
