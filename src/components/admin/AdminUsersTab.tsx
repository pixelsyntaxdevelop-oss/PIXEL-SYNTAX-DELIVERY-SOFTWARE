import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  KeyRound,
  Shield,
  UserCheck,
  UserX,
  X,
  Check,
  UserPlus,
  Lock,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import {
  platformAdminService,
  AdminUser,
} from '../../services/platformAdminService';

interface AdminUsersTabProps {
  tenantId: string;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ tenantId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [newRole, setNewRole] = useState('OPERATIONS');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [tempCode, setTempCode] = useState<string | null>(null);

  // New User Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleToAssign, setNewRoleToAssign] = useState('OPERATIONS');
  const [newDesignation, setNewDesignation] = useState('Operations Officer');
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [newBranch, setNewBranch] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [mustChangePasswordOnCreate, setMustChangePasswordOnCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Direct Password Reset Modal State
  const [directPasswordModalOpen, setDirectPasswordModalOpen] = useState(false);
  const [directNewPassword, setDirectNewPassword] = useState('');
  const [directPasswordError, setDirectPasswordError] = useState<string | null>(null);
  const [directPasswordSuccess, setDirectPasswordSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await platformAdminService.getUsers(tenantId);
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleToggleStatus = async (user: AdminUser) => {
    const confirm = window.confirm(`Toggle active status for user "${user.fullName}" (${user.username})?`);
    if (!confirm) return;
    const success = await platformAdminService.toggleUserStatus(tenantId, user.id);
    if (success) await loadData();
    else alert('Failed to update user status.');
  };

  const handleOpenRoleModal = (user: AdminUser) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;
    const success = await platformAdminService.updateUserRole(tenantId, selectedUser.id, newRole);
    if (success) {
      setRoleModalOpen(false);
      await loadData();
    } else {
      alert('Failed to update role.');
    }
  };

  const handleResetAuth = async (user: AdminUser) => {
    setSelectedUser(user);
    const res = await platformAdminService.resetUserAuth(tenantId, user.id);
    if (res.success) {
      setTempCode(res.tempCode || 'AUTH-RESET-SUCCESS');
      setResetModalOpen(true);
    } else {
      alert('Failed to reset user authentication.');
    }
  };

  const handleForceLogout = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to terminate all active sessions for @${user.username}?`)) return;
    const res = await platformAdminService.forceLogoutUser(tenantId, user.id);
    if (res.success) {
      setActionSuccessMsg(`Active sessions terminated for @${user.username}`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadData();
    } else {
      alert(res.error || 'Failed to terminate user sessions.');
    }
  };

  const handleRequirePasswordChange = async (user: AdminUser) => {
    const res = await platformAdminService.requirePasswordChange(tenantId, user.id);
    if (res.success) {
      setActionSuccessMsg(`@${user.username} will be required to change password on next sign-in`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await loadData();
    } else {
      alert(res.error || 'Failed to update requirement.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newUsername.trim() || !newFullName.trim() || !newPassword) {
      setCreateError('Username, Full Name, and Password are required.');
      return;
    }

    if (newPassword.length < 6) {
      setCreateError('Password must be at least 6 characters long.');
      return;
    }

    const res = await platformAdminService.createUser(tenantId, {
      username: newUsername.trim(),
      fullName: newFullName.trim(),
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      password: newPassword,
      role: newRoleToAssign,
      designation: newDesignation.trim() || newRoleToAssign,
      status: newStatus,
      assignedBranchIds: newBranch.trim() ? [newBranch.trim()] : [],
      assignedDepartmentIds: newDepartment.trim() ? [newDepartment.trim()] : [],
      mustChangePassword: mustChangePasswordOnCreate,
    } as any);

    if (res.success) {
      setCreateModalOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewBranch('');
      setNewDepartment('');
      setNewStatus('ACTIVE');
      setMustChangePasswordOnCreate(false);
      await loadData();
    } else {
      setCreateError(res.error || 'Failed to create user account.');
    }
  };

  const handleOpenDirectPasswordModal = (user: AdminUser) => {
    setSelectedUser(user);
    setDirectNewPassword('');
    setDirectPasswordError(null);
    setDirectPasswordSuccess(null);
    setDirectPasswordModalOpen(true);
  };

  const handleSaveDirectPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setDirectPasswordError(null);

    if (!directNewPassword || directNewPassword.length < 6) {
      setDirectPasswordError('Password must be at least 6 characters.');
      return;
    }

    const res = await platformAdminService.resetUserPassword(tenantId, selectedUser.id, directNewPassword);
    if (res.success) {
      setDirectPasswordSuccess(res.message || 'Password updated successfully.');
      setTimeout(() => {
        setDirectPasswordModalOpen(false);
      }, 1500);
    } else {
      setDirectPasswordError(res.error || 'Failed to update password.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            User Accounts & Security ({users.length})
          </h3>
          <p className="text-xs text-slate-500">
            Tenant staff credentials, individual logins, and cryptographic session resets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Staff Account</span>
          </button>
          <button
            onClick={loadData}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-3">Username</th>
              <th className="py-3 px-3">Email</th>
              <th className="py-3 px-3">Assigned Role</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Last Login</th>
              <th className="py-3 px-4 text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {(!Array.isArray(users) || users.length === 0) ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  {loading ? 'Loading user accounts...' : 'No accounts registered for this tenant.'}
                </td>
              </tr>
            ) : (
              (Array.isArray(users) ? users : []).map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {u.fullName}
                      </span>
                      {u.employee_code && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {u.employee_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{u.designation || 'Staff'}</span>
                      {u.mustChangePassword && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Pwd Reset Pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                    @{u.username}
                  </td>
                  <td className="py-3 px-3 text-slate-500">{u.email}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-[11px]">
                    {u.lastLogin ? u.lastLogin.substring(0, 16).replace('T', ' ') : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1 rounded ${
                          u.status === 'ACTIVE'
                            ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                        }`}
                        title={u.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                      >
                        {u.status === 'ACTIVE' ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenRoleModal(u)}
                        className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        title="Change User Role"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDirectPasswordModal(u)}
                        className="p-1 text-emerald-600 hover:text-emerald-700 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                        title="Reset Account Password"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequirePasswordChange(u)}
                        className="p-1 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950/50"
                        title="Require Password Change on Next Login"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleForceLogout(u)}
                        className="p-1 text-rose-600 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="Force Terminate All Active Sessions"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleResetAuth(u)}
                        className="p-1 text-purple-600 hover:text-purple-700 rounded hover:bg-purple-50 dark:hover:bg-purple-950/50"
                        title="Revoke Cryptographic Token & Reset 2FA"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role Change Modal */}
      {roleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Change User Role
              </h3>
              <button onClick={() => setRoleModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Target: <strong>{selectedUser.fullName}</strong> (@{selectedUser.username})
              </p>
              <div>
                <label className="block text-slate-500 mb-1">Select New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-semibold"
                >
                  <option value="COMPANY_ADMIN">COMPANY_ADMIN</option>
                  <option value="HR">HR</option>
                  <option value="OPERATIONS">OPERATIONS</option>
                  <option value="FLEET_MANAGER">FLEET_MANAGER</option>
                  <option value="PAYROLL">PAYROLL</option>
                  <option value="RECRUITMENT">RECRUITMENT</option>
                  <option value="ATTENDANCE">ATTENDANCE</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setRoleModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Password Reset Modal */}
      {directPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Reset Staff Password</span>
              </h3>
              <button onClick={() => setDirectPasswordModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDirectPassword} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Set a new password for <strong>{selectedUser.fullName}</strong> (@{selectedUser.username}). This will invalidate all active sessions immediately.
              </p>

              {directPasswordError && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {directPasswordError}
                </div>
              )}

              {directPasswordSuccess && (
                <div className="p-2.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {directPasswordSuccess}
                </div>
              )}

              <div>
                <label className="block text-slate-500 mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  value={directNewPassword}
                  onChange={(e) => setDirectNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDirectPasswordModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Reset Modal */}
      {resetModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-600" />
                Authentication Sessions Revoked
              </h3>
              <button onClick={() => setResetModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                All active session tokens for user <strong>{selectedUser.fullName}</strong> (@{selectedUser.username}) have been permanently revoked.
              </p>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg">
                <span className="text-[11px] text-purple-700 dark:text-purple-300 block mb-1">
                  Session Revocation Status:
                </span>
                <span className="text-xs font-mono font-bold text-purple-900 dark:text-purple-100 tracking-wider">
                  ALL TOKENS INVALIDATED • FORCED LOGOUT ENFORCED
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                The user will be required to re-authenticate with their credentials upon their next interaction.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Register Individual Staff Account</span>
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              {createError && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. tariq_ops"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Tariq Mansoor"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Staff Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. tariq@deliverysoftwarepixel.site"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Mobile / Phone</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +971 50 123 4567"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Role *</label>
                  <select
                    value={newRoleToAssign}
                    onChange={(e) => {
                      setNewRoleToAssign(e.target.value);
                      if (!newDesignation || newDesignation === 'Operations Officer') {
                        setNewDesignation(e.target.value);
                      }
                    }}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold"
                  >
                    <option value="COMPANY_ADMIN">COMPANY_ADMIN</option>
                    <option value="HR">HR</option>
                    <option value="OPERATIONS">OPERATIONS</option>
                    <option value="FLEET_MANAGER">FLEET_MANAGER</option>
                    <option value="PAYROLL">PAYROLL</option>
                    <option value="RECRUITMENT">RECRUITMENT</option>
                    <option value="ATTENDANCE">ATTENDANCE</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Designation</label>
                  <input
                    type="text"
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder="e.g. Fleet Coordinator"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Account Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Assign Branch (Opt)</label>
                  <input
                    type="text"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    placeholder="e.g. Dubai HQ"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Department (Opt)</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="e.g. Fleet Ops"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Initial Password * (min 6 chars)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="createMustChangePwd"
                  checked={mustChangePasswordOnCreate}
                  onChange={(e) => setMustChangePasswordOnCreate(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="createMustChangePwd" className="text-slate-600 dark:text-slate-300 text-xs cursor-pointer select-none">
                  Require password change upon first login
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
