import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Building,
  Users,
  Car,
  Smartphone,
  FolderKanban,
  Ticket,
  Landmark,
  FileText,
  FileCheck2,
  Clock,
  ChevronDown,
  Lock,
  ArrowLeft,
  RefreshCw,
  LayoutDashboard,
  AlertTriangle,
  Palette,
  Calendar,
  LogOut,
  BookOpen,
} from 'lucide-react';
import { UserRole } from '../../types/erp';
import {
  platformAdminService,
  AdminTenant,
  AdminDashboardData,
} from '../../services/platformAdminService';
import { AdminDashboardTab } from '../admin/AdminDashboardTab';
import { AdminEmployeesTab } from '../admin/AdminEmployeesTab';
import { AdminPassportTab } from '../admin/AdminPassportTab';
import { AdminVehiclesTab } from '../admin/AdminVehiclesTab';
import { AdminSimsTab } from '../admin/AdminSimsTab';
import { AdminProjectsTab } from '../admin/AdminProjectsTab';
import { AdminFinesTab } from '../admin/AdminFinesTab';
import { AdminSalikTab } from '../admin/AdminSalikTab';
import { AdminDocumentsTab } from '../admin/AdminDocumentsTab';
import { AdminAttendanceTab } from '../admin/AdminAttendanceTab';
import { AdminUsersTab } from '../admin/AdminUsersTab';
import { AdminIntegrityTab } from '../admin/AdminIntegrityTab';
import { AdminAuditTab } from '../admin/AdminAuditTab';
import { AdminBrandingTab } from '../admin/AdminBrandingTab';

interface PlatformAdminViewProps {
  currentUser: {
    id?: string;
    name: string;
    role: UserRole;
    tenantId?: string;
  };
  initialTab?: string;
  onReturnToErp?: () => void;
  onLogout?: () => void;
}

export const PlatformAdminView: React.FC<PlatformAdminViewProps> = ({
  currentUser,
  initialTab,
  onReturnToErp,
  onLogout,
}) => {
  const isSuperOrPlatformAdmin =
    currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'PLATFORM_ADMIN';

  // State
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('company_pixel_syntax');
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam) return tabParam;
        const hash = window.location.hash.replace('#', '');
        if (hash) return hash;
      } catch {
        // fallback
      }
    }
    return 'dashboard';
  });

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        window.history.replaceState(null, '', url.toString());
      } catch {
        // Safe fallback
      }
    }
  };
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Load Tenants on mount
  useEffect(() => {
    if (!isSuperOrPlatformAdmin) return;
    const loadTenants = async () => {
      setLoadingTenants(true);
      try {
        const list = await platformAdminService.getTenants();
        const safeList = Array.isArray(list) ? list : [];
        setTenants(safeList);
        if (safeList.length > 0) {
          // If current selection is in list keep it, otherwise default to first or company_pixel_syntax
          const exists = safeList.some((t) => t.id === selectedTenantId);
          if (!exists) {
            setSelectedTenantId(safeList[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load tenants list:', err);
        setTenants([]);
      } finally {
        setLoadingTenants(false);
      }
    };
    loadTenants();
  }, [isSuperOrPlatformAdmin]);

  // Load Dashboard data whenever selectedTenantId changes
  const loadDashboard = async () => {
    if (!selectedTenantId) return;
    setLoadingDashboard(true);
    try {
      const data = await platformAdminService.getDashboard(selectedTenantId);
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (!isSuperOrPlatformAdmin || !selectedTenantId) return;
    loadDashboard();
  }, [selectedTenantId, isSuperOrPlatformAdmin]);

  const handleUpdateTenantMode = async (mode: 'SETUP' | 'TESTING' | 'LIVE') => {
    const confirm = window.confirm(
      `Are you sure you want to change tenant "${selectedTenantId}" mode to "${mode}"?`
    );
    if (!confirm) return;
    const success = await platformAdminService.updateTenantMode(selectedTenantId, mode);
    if (success) {
      await loadDashboard();
      const updatedTenants = await platformAdminService.getTenants();
      setTenants(updatedTenants);
    } else {
      alert('Failed to update tenant mode.');
    }
  };

  // 1. Strict Access Control Gate
  if (!isSuperOrPlatformAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Access Restricted: Software Owner & Support Only
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            The Platform Admin Panel is strictly segregated from normal company operations. Your current role (
            <span className="font-mono font-bold text-red-600">{currentUser.role}</span>) does not have
            sufficient administrative privileges to inspect or modify multi-tenant master data.
          </p>
        </div>

        {onReturnToErp && (
          <div className="pt-4">
            <button
              onClick={onReturnToErp}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Company ERP Dashboard
            </button>
          </div>
        )}
      </div>
    );
  }

  const currentTenant = tenants.find((t) => t.id === selectedTenantId) || {
    id: selectedTenantId,
    name: selectedTenantId,
    go_live_status: 'TESTING',
    is_live_protected: selectedTenantId === 'company_pixel_syntax',
  };

  const isLiveTenant = currentTenant.go_live_status === 'LIVE';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees & Duplicates', icon: Users },
    { id: 'vehicles', label: 'Vehicles & Plates', icon: Car },
    { id: 'sims', label: 'SIM Cards', icon: Smartphone },
    { id: 'projects', label: 'Projects & Contracts', icon: FolderKanban },
    { id: 'fines', label: 'Traffic Fines', icon: Ticket },
    { id: 'salik', label: 'Salik Tolls', icon: Landmark },
    { id: 'attendance', label: 'Attendance Records', icon: Calendar },
    { id: 'documents', label: 'Document Storage', icon: FileText },
    { id: 'passports', label: 'Passport Management', icon: BookOpen },
    { id: 'users', label: 'User Accounts & Roles', icon: ShieldCheck },
    { id: 'branding', label: 'Tenant Branding & Identity', icon: Palette },
    { id: 'integrity', label: 'Data Integrity Center', icon: FileCheck2 },
    { id: 'audit', label: 'Audit Trail (Immutable)', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar: Multi-Tenant Header & Mode Controller */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white px-5 py-3 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Platform Admin Panel</h1>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Software Owner Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Tenant Governance, Master Data Correction, and Audit Registry
              </p>
            </div>
          </div>

          {/* Tenant Selector & Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
              <Building className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <div className="text-xs mr-2">
                <span className="text-[10px] text-slate-400 block font-medium">Active Tenant:</span>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-hidden cursor-pointer"
                >
                  {(Array.isArray(tenants) ? tenants : []).map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                      {t.name} ({t.id}) [{t.go_live_status || 'TESTING'}]
                    </option>
                  ))}
                  {(!Array.isArray(tenants) || tenants.length === 0) && (
                    <option value={selectedTenantId} className="bg-slate-900 text-white">
                      {selectedTenantId}
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Mode Indicator Pill */}
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 ${
                isLiveTenant
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : currentTenant.go_live_status === 'TESTING'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {isLiveTenant && <ShieldCheck className="w-3.5 h-3.5" />}
              {currentTenant.go_live_status || 'TESTING'}
            </span>

            {onLogout ? (
              <button
                onClick={onLogout}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-700/60 text-rose-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                title="Sign out of Platform Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                Admin Logout
              </button>
            ) : onReturnToErp ? (
              <button
                onClick={onReturnToErp}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                title="Switch back to regular ERP application view"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to ERP
              </button>
            ) : null}
          </div>
        </div>

        {/* Live Tenant Warning */}
        {isLiveTenant && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2 text-[11px] text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>LIVE PROTECTION ACTIVE:</strong> Deletions in this tenant require SUPER_ADMIN authority, minimum 10-character reason, and confirmation phrase &quot;CONFIRM DELETE&quot;.
            </span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-65px)]">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Platform Modules
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  data-testid={`admin-nav-${item.id}`}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 px-3 text-[11px] text-slate-400 space-y-1 shrink-0">
            <div>
              Actor: <span className="text-slate-700 dark:text-slate-200 font-semibold">{currentUser.name}</span>
            </div>
            <div>
              Role: <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{currentUser.role}</span>
            </div>
          </div>
        </aside>

        {/* Tab Content Panel */}
        <main className="flex-1 p-5 overflow-y-auto max-w-7xl">
          {activeTab === 'dashboard' && (
            <AdminDashboardTab
              data={dashboardData}
              loading={loadingDashboard}
              onRefresh={loadDashboard}
              onNavigateTab={(tab) => handleSelectTab(tab)}
              onUpdateTenantMode={handleUpdateTenantMode}
            />
          )}

          {activeTab === 'employees' && (
            <AdminEmployeesTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              currentUserRole={currentUser.role}
              currentUserName={currentUser.name}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'vehicles' && (
            <AdminVehiclesTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'sims' && (
            <AdminSimsTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'projects' && (
            <AdminProjectsTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'fines' && (
            <AdminFinesTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'salik' && (
            <AdminSalikTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'documents' && (
            <AdminDocumentsTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'passports' && (
            <AdminPassportTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'attendance' && (
            <AdminAttendanceTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'users' && (
            <AdminUsersTab tenantId={selectedTenantId} />
          )}

          {activeTab === 'branding' && (
            <AdminBrandingTab
              tenantId={selectedTenantId}
              isLiveProtected={isLiveTenant}
              onBrandingUpdated={loadDashboard}
            />
          )}

          {activeTab === 'integrity' && (
            <AdminIntegrityTab
              tenantId={selectedTenantId}
              isLiveTenant={isLiveTenant}
              onRefreshParentCounts={loadDashboard}
            />
          )}

          {activeTab === 'audit' && (
            <AdminAuditTab tenantId={selectedTenantId} />
          )}
        </main>
      </div>
    </div>
  );
};
