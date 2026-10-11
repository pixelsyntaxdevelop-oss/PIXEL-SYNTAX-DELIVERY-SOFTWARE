import React, { useState } from 'react';
import { Lock, Shield, Check, X, Edit, Save } from 'lucide-react';
import { RolePermission, UserRole } from '../../types/erp';
import { Badge } from '../common/Badge';

interface RolesPermissionsViewProps {
  roles: RolePermission[];
  lang: 'EN' | 'AR';
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({ roles: initialRoles, lang }) => {
  const [roles, setRoles] = useState<RolePermission[]>(initialRoles);
  const [selectedRole, setSelectedRole] = useState<UserRole>('SUPER_ADMIN');

  const currentRoleData = roles.find((r) => r.role === selectedRole) || roles[0];

  const handleToggle = (category: string, permKey: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.role === selectedRole) {
          const updatedPerms = { ...r.permissions };
          const cat = updatedPerms[category as keyof typeof updatedPerms] as any;
          if (cat && typeof cat[permKey] === 'boolean') {
            cat[permKey] = !cat[permKey];
          }
          return { ...r, permissions: updatedPerms };
        }
        return r;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-purple-600" />
            {lang === 'EN' ? 'Role-Based Access Control (RBAC) Matrix' : 'مصفوفة الصلاحيات والأدوار (RBAC)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Configure granular permissions for Super Admin, Fleet Manager, Dispatcher, HR, Finance, Drivers, and Branch Officers.'
              : 'تخصيص الصلاحيات الدقيقة للمديرين، مديري الأسطول، التوزيع، المالية، والموظفين.'}
          </p>
        </div>

        <button
          onClick={() => alert('RBAC Security Configuration Saved')}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all shrink-0"
        >
          <Save className="w-4 h-4" />
          {lang === 'EN' ? 'Save Security Matrix' : 'حفظ مصفوفة الصلاحيات'}
        </button>
      </div>

      {/* Role Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        {roles.map((r) => (
          <button
            key={r.role}
            onClick={() => setSelectedRole(r.role)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedRole === r.role
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {r.displayName}
          </button>
        ))}
      </div>

      {/* Permission Switches Grid */}
      {currentRoleData && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{currentRoleData.displayName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{currentRoleData.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(currentRoleData.permissions).map(([catKey, catVal]) => (
              <div key={catKey} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {catKey} MODULE
                </h4>

                <div className="space-y-2 text-xs">
                  {Object.entries(catVal).map(([permKey, permVal]) => (
                    <div key={permKey} className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{permKey}</span>
                      <button
                        onClick={() => handleToggle(catKey, permKey)}
                        className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          permVal ? 'bg-purple-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 bg-white rounded-full shadow-md"></span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
