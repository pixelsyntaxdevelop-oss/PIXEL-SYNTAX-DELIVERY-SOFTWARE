import React from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { SystemUserAccount } from '../../types/erp';

interface CreateOfficeStaffAccessViewProps {
  currentUser: SystemUserAccount;
  onNavigateModule: (module: string) => void;
  onOpenEmployee360?: (employeeId: string) => void;
  lang?: 'EN' | 'AR';
}

export const CreateOfficeStaffAccessView: React.FC<CreateOfficeStaffAccessViewProps> = ({
  currentUser: _currentUser,
  onNavigateModule,
  lang: _lang = 'EN',
}) => {
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={() => onNavigateModule('settings_users')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Office Staff Access</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Staff Credential Provisioning Restricted
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centralized Governance Policy Enforced
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl mt-0.5 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              User Accounts & Role Management is Controlled Exclusively from Platform Admin
            </h3>
            <p>
              Under Allied Enterprise Security Policy, staff login account creation, credential generation, role assignments, and permission overrides are strictly centralized in the <strong>Platform Admin Panel</strong>.
            </p>
            <p>
              The standard ERP workspace is designed for operational employee master records (HR profiles, documents, assignments, attendance). To provision a login account for an employee, please navigate to:
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 text-xs font-semibold">
              Platform Admin Panel &rarr; Tenant: Allied Delivery &rarr; User Accounts & Security &rarr; Create Staff Account
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateModule('employees_list')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Go to Employee Master
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('settings_users')}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            View Office Staff Access List
          </button>
        </div>
      </div>
    </div>
  );
};
