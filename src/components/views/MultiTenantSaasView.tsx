import React, { useState } from 'react';
import {
  Building2,
  Shield,
  Users,
  HardDrive,
  Sparkles,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Key,
  ExternalLink,
  Edit3,
  Trash2,
  Power,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Lock,
  ArrowRight,
  ShieldAlert,
  Server,
  Download,
  Filter,
  Check,
  ChevronRight,
  CreditCard,
  DollarSign,
  Activity,
  Globe,
  Mail,
  Phone,
  FileText,
} from 'lucide-react';
import { TenantCompany, PlanTier, TenantStatus, SystemUserAccount, SystemAuditLog } from '../../types/erp';
import { PreProductionResetModal } from '../admin/PreProductionResetModal';

interface MultiTenantSaasViewProps {
  tenants: TenantCompany[];
  onUpdateTenants: (tenants: TenantCompany[]) => void;
  currentUser: SystemUserAccount;
  onImpersonateTenant: (tenantId: string) => void;
  onAddAuditLog: (log: SystemAuditLog) => void;
  onCreateTenantAdminAccount: (tenant: TenantCompany, adminUser: Partial<SystemUserAccount>) => void;
  lang: 'EN' | 'AR';
}

export const MultiTenantSaasView: React.FC<MultiTenantSaasViewProps> = ({
  tenants,
  onUpdateTenants,
  currentUser,
  onImpersonateTenant,
  onAddAuditLog,
  onCreateTenantAdminAccount,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'TENANTS' | 'WIZARD' | 'PLANS' | 'HEALTH' | 'AUDIT'>('TENANTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');

  // Selected Tenant for Edit Limits Modal
  const [editingTenant, setEditingTenant] = useState<TenantCompany | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Setup Wizard State
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wCompanyName, setWCompanyName] = useState('');
  const [wCompanyCode, setWCompanyCode] = useState('');
  const [wDomain, setWDomain] = useState('');
  const [wTradeLicense, setWTradeLicense] = useState('');
  const [wTaxId, setWTaxId] = useState('');
  const [wCountry, setWCountry] = useState('United Arab Emirates');
  const [wCity, setWCity] = useState('Dubai');
  const [wCurrency, setWCurrency] = useState('AED');
  const [wPlan, setWPlan] = useState<PlanTier>('ENTERPRISE_PRO');

  // Quotas
  const [wMaxUsers, setWMaxUsers] = useState<number>(50);
  const [wMaxRiders, setWMaxRiders] = useState<number>(200);
  const [wMaxVehicles, setWMaxVehicles] = useState<number>(150);
  const [wMaxBranches, setWMaxBranches] = useState<number>(5);
  const [wMaxStorageGB, setWMaxStorageGB] = useState<number>(50);
  const [wAiMonthly, setWAiMonthly] = useState<number>(25000);

  // Admin Account Form
  const [wAdminName, setWAdminName] = useState('');
  const [wAdminEmail, setWAdminEmail] = useState('');
  const [wAdminUsername, setWAdminUsername] = useState('');
  const [wAdminPhone, setWAdminPhone] = useState('');

  // Stats Calculations
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedTenants = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const totalRidersAll = tenants.reduce((acc, t) => acc + (t.usage?.activeRiders || 0), 0);
  const totalStorageGB = tenants.reduce((acc, t) => acc + (t.usage?.usedStorageGB || 0), 0).toFixed(1);
  const totalStorageAllocated = tenants.reduce((acc, t) => acc + (t.limits?.maxStorageGB || 50), 0);
  const totalAiRequests = tenants.reduce((acc, t) => acc + (t.usage?.aiRequestsUsed || 0), 0);

  const planPricing: Record<string, number> = {
    ENTERPRISE_PRO: 1500,
    ENTERPRISE_GROWTH: 2500,
    ENTERPRISE_CUSTOM: 4500,
    STANDARD: 800,
    STARTER: 400,
  };
  const calculatedMrr = tenants
    .filter((t) => t.status === 'ACTIVE')
    .reduce((acc, t) => acc + (planPricing[t.plan] || 0), 0);

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPlan = planFilter === 'ALL' || t.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Action: Toggle Suspend / Activate Tenant
  const handleToggleTenantStatus = (tenantId: string) => {
    const updated = tenants.map((t) => {
      if (t.id === tenantId) {
        const nextStatus: TenantStatus = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return { ...t, status: nextStatus };
      }
      return t;
    });
    onUpdateTenants(updated);

    const targetTenant = tenants.find((t) => t.id === tenantId);
    onAddAuditLog({
      id: `log_tenant_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'TENANT_STATUS_TOGGLE',
      module: 'MULTI_TENANT_SAAS',
      details: `Updated tenant "${targetTenant?.name}" status to ${
        targetTenant?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
      }`,
      status: 'SUCCESS',
    });
  };

  // Action: Delete Tenant
  const handleDeleteTenant = (tenantId: string) => {
    const targetTenant = tenants.find((t) => t.id === tenantId);
    if (!targetTenant) return;

    if (
      confirm(
        `Are you sure you want to PERMANENTLY DELETE tenant "${targetTenant.name}"? This action cannot be undone and will isolate all company database records.`
      )
    ) {
      const updated = tenants.filter((t) => t.id !== tenantId);
      onUpdateTenants(updated);

      onAddAuditLog({
        id: `log_del_tenant_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        action: 'TENANT_DELETE',
        module: 'MULTI_TENANT_SAAS',
        details: `Deleted Tenant Company "${targetTenant.name}" (ID: ${tenantId})`,
        status: 'SUCCESS',
      });
    }
  };

  // Action: Complete Wizard and Launch Company
  const handleCompleteSetupWizard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wCompanyName || !wCompanyCode || !wAdminEmail || !wAdminName) {
      alert('Please fill in all required Company Name, Code, and Admin details.');
      return;
    }

    const newTenantId = `company_${wCompanyCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-4)}`;

    const newTenant: TenantCompany = {
      id: newTenantId,
      code: wCompanyCode.toUpperCase(),
      name: wCompanyName,
      tradeLicenseNumber: wTradeLicense || 'CN-PENDING-2026',
      taxRegistrationNumber: wTaxId || 'TRN-PENDING-2026',
      domain: wDomain || `${wCompanyCode.toLowerCase()}.ae`,
      status: 'ACTIVE',
      plan: wPlan,
      subscriptionStart: new Date().toISOString().split('T')[0],
      subscriptionExpiry: '2027-12-31',
      createdDate: new Date().toISOString().split('T')[0],
      companyAdminEmail: wAdminEmail,
      companyAdminName: wAdminName,
      country: wCountry,
      city: wCity,
      currency: wCurrency,
      primaryColor: '#2563eb',
      limits: {
        maxUsers: wMaxUsers,
        maxRiders: wMaxRiders,
        maxVehicles: wMaxVehicles,
        maxBranches: wMaxBranches,
        maxStorageGB: wMaxStorageGB,
        aiRequestsMonthly: wAiMonthly,
        smsMonthly: 5000,
        whatsappMonthly: 2500,
      },
      usage: {
        activeUsers: 1,
        activeRiders: 0,
        activeVehicles: 0,
        usedBranches: 1,
        usedStorageGB: 0.1,
        aiRequestsUsed: 0,
        smsUsed: 0,
        whatsappUsed: 0,
      },
      enabledModules: [
        'fleet_dashboard',
        'attendance_daily',
        'doc_expiry_listing',
        'employees_list',
        'vehicle_mapping',
        'payroll_employees',
        'roles_permissions',
      ],
    };

    const newTenantsList = [newTenant, ...tenants];
    onUpdateTenants(newTenantsList);

    // Provision Company Admin Account
    onCreateTenantAdminAccount(newTenant, {
      fullName: wAdminName,
      email: wAdminEmail,
      username: wAdminUsername || `${wCompanyCode.toLowerCase()}_admin`,
      phone: wAdminPhone || '0500000000',
    });

    onAddAuditLog({
      id: `log_wiz_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'TENANT_WIZARD_CREATE',
      module: 'MULTI_TENANT_SAAS',
      details: `Provisioned new SaaS Company Tenant "${wCompanyName}" with Company Admin @${wAdminEmail}`,
      status: 'SUCCESS',
    });

    alert(`🎉 Success! Company Workspace "${wCompanyName}" has been provisioned and Company Admin account created!`);

    // Reset Wizard Form
    setWizardStep(1);
    setWCompanyName('');
    setWCompanyCode('');
    setWDomain('');
    setWAdminName('');
    setWAdminEmail('');
    setWAdminUsername('');
    setActiveTab('TENANTS');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 rounded-2xl text-white shadow-xl border border-indigo-800/40">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 font-mono text-xs font-bold uppercase tracking-widest mb-1">
            <Globe className="w-4 h-4 text-emerald-400 animate-spin" /> Platform SaaS Control Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            Multi-Tenant Enterprise Portal <Sparkles className="w-6 h-6 text-amber-300" />
          </h1>
          <p className="text-sm text-indigo-200/80 mt-1 max-w-2xl">
            Isolated workspace architecture for enterprise companies. Global Super Admin management, automated company setup, subscription limits, and cross-tenant RBAC security.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsResetModalOpen(true)}
            id="btn-open-database-qa-reset"
            className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-rose-300 border border-rose-500/40 hover:border-rose-400 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            title="Pre-Production Data QA & Reset Console"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" /> Database QA & Reset
          </button>

          <button
            onClick={() => setActiveTab('WIZARD')}
            className="px-4 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Provision New Company
          </button>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-500" /> Active Tenants
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {activeTenants} <span className="text-xs font-normal text-slate-500">/ {totalTenants} Total</span>
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold">{suspendedTenants} Suspended</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Monthly MRR
          </span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {calculatedMrr > 0 ? `$${calculatedMrr.toLocaleString()}` : '$0.00'}
          </p>
          <p className="text-[10px] text-slate-400">
            {calculatedMrr > 0 ? 'Active Subscriptions' : 'No active subscriptions'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-500" /> Total Riders
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalRidersAll > 0 ? totalRidersAll : '0'}
          </p>
          <p className="text-[10px] text-indigo-600 font-semibold">
            {totalRidersAll > 0 ? 'Across all companies' : 'No riders registered'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-amber-500" /> Storage Capacity
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalStorageGB} GB</p>
          <p className="text-[10px] text-slate-400">Of {totalStorageAllocated} GB Allocated</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500" /> AI Calls (Month)
          </span>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {totalAiRequests.toLocaleString()}
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold">100% RBAC Guarded</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('TENANTS')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'TENANTS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" /> Company Tenants Directory ({tenants.length})
        </button>

        <button
          onClick={() => setActiveTab('WIZARD')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'WIZARD'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Company Setup Wizard
        </button>

        <button
          onClick={() => setActiveTab('PLANS')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'PLANS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" /> Subscription Plans & Licenses
        </button>

        <button
          onClick={() => setActiveTab('HEALTH')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'HEALTH'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-800/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4" /> Cloud Health & Data Isolation
        </button>
      </div>

      {/* TAB 1: TENANTS DIRECTORY */}
      {activeTab === 'TENANTS' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant company name, code, domain..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="EXPIRED">Expired</option>
              </select>

              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Plans</option>
                <option value="ENTERPRISE_PRO">Enterprise Pro</option>
                <option value="BUSINESS_GROWTH">Business Growth</option>
                <option value="STARTER_SME">Starter SME</option>
                <option value="TRIAL">Trial</option>
              </select>
            </div>
          </div>

          {/* Tenants Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTenants.map((tenant) => {
              const isExpired = new Date(tenant.subscriptionExpiry) < new Date();
              const riderPercent = Math.round((tenant.usage.activeRiders / tenant.limits.maxRiders) * 100);
              const userPercent = Math.round((tenant.usage.activeUsers / tenant.limits.maxUsers) * 100);

              return (
                <div
                  key={tenant.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: tenant.primaryColor || '#2563eb' }}
                  />

                  {/* Top Bar: Company Header & Badges */}
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        {tenant.logoUrl ? (
                          <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight flex items-center gap-2">
                          {tenant.name}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {tenant.code}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>🌐 {tenant.domain}</span>
                          <span>• {tenant.city}, {tenant.country}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] px-2.5 py-1 font-extrabold rounded-full ${
                          tenant.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : tenant.status === 'SUSPENDED'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {tenant.status}
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                        {tenant.plan.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Company Details & Admin Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Company Admin</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        {tenant.companyAdminName}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block">{tenant.companyAdminEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Subscription Expiry</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {tenant.subscriptionExpiry}
                      </span>
                      <span className={`text-[10px] font-bold ${isExpired ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isExpired ? '⚠️ Subscription Expired' : 'Valid License'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Quotas Meters */}
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Riders Allocation</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tenant.usage.activeRiders} / {tenant.limits.maxRiders} ({riderPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            riderPercent > 90 ? 'bg-rose-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(riderPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg text-center">
                        <span className="text-slate-400 text-[10px] block">Users</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tenant.usage.activeUsers} / {tenant.limits.maxUsers}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg text-center">
                        <span className="text-slate-400 text-[10px] block">Storage</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tenant.usage.usedStorageGB} / {tenant.limits.maxStorageGB} GB
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg text-center">
                        <span className="text-slate-400 text-[10px] block">AI Monthly</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {tenant.usage.aiRequestsUsed} / {tenant.limits.aiRequestsMonthly}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => onImpersonateTenant(tenant.id)}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                      title="Switch into this company's isolated workspace as Super Admin"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-300" />
                      <span>Impersonate Workspace</span>
                    </button>

                    <button
                      onClick={() => setEditingTenant(tenant)}
                      className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Edit Subscription & Limits"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Quotas
                    </button>

                    <button
                      onClick={() => handleToggleTenantStatus(tenant.id)}
                      className={`p-2 rounded-xl text-xs font-semibold transition-colors ${
                        tenant.status === 'ACTIVE'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                      }`}
                      title={tenant.status === 'ACTIVE' ? 'Suspend Company' : 'Activate Company'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteTenant(tenant.id)}
                      className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl transition-colors"
                      title="Delete Tenant Company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY SETUP WIZARD */}
      {activeTab === 'WIZARD' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" /> Company Provisioning & Setup Wizard
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Automated multi-tenant setup: creates isolated company database scope, company admin user, default roles, branches, and resource allocations.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className={`px-2.5 py-1 rounded-full ${wizardStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                1. Company
              </span>
              <span>→</span>
              <span className={`px-2.5 py-1 rounded-full ${wizardStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                2. Quotas
              </span>
              <span>→</span>
              <span className={`px-2.5 py-1 rounded-full ${wizardStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                3. Admin User
              </span>
            </div>
          </div>

          <form onSubmit={handleCompleteSetupWizard} className="space-y-6 max-w-3xl">
            {/* STEP 1: COMPANY INFORMATION */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-in fade-in">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
                  Step 1: Company Profile & Identification
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={wCompanyName}
                      onChange={(e) => setWCompanyName(e.target.value)}
                      placeholder="e.g. Paramount Express Delivery L.L.C"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company Code (Unique Tenant Prefix) *
                    </label>
                    <input
                      type="text"
                      required
                      value={wCompanyCode}
                      onChange={(e) => setWCompanyCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      placeholder="e.g. PARAMOUNT"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Domain / Website
                    </label>
                    <input
                      type="text"
                      value={wDomain}
                      onChange={(e) => setWDomain(e.target.value)}
                      placeholder="e.g. paramount.ae"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Trade License Number
                    </label>
                    <input
                      type="text"
                      value={wTradeLicense}
                      onChange={(e) => setWTradeLicense(e.target.value)}
                      placeholder="e.g. CN-9948201"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tax Registration TRN
                    </label>
                    <input
                      type="text"
                      value={wTaxId}
                      onChange={(e) => setWTaxId(e.target.value)}
                      placeholder="e.g. TRN-100293848100003"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City & Country
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={wCity}
                        onChange={(e) => setWCity(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                      />
                      <input
                        type="text"
                        value={wCountry}
                        onChange={(e) => setWCountry(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!wCompanyName || !wCompanyCode) {
                        alert('Please fill in Company Name and Code');
                        return;
                      }
                      setWizardStep(2);
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2"
                  >
                    Next: Subscription Quotas <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SUBSCRIPTION & LIMITS */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-in fade-in">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
                  Step 2: Subscription Plan & Resource Limits
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Select SaaS Plan Tier
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setWPlan('ENTERPRISE_PRO');
                        setWMaxUsers(100);
                        setWMaxRiders(500);
                        setWMaxStorageGB(100);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wPlan === 'ENTERPRISE_PRO'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block text-slate-900 dark:text-white">Enterprise Pro</span>
                      <span className="text-[10px] text-slate-500">$999/month • Unlimited Scale</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWPlan('BUSINESS_GROWTH');
                        setWMaxUsers(25);
                        setWMaxRiders(100);
                        setWMaxStorageGB(50);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wPlan === 'BUSINESS_GROWTH'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block text-slate-900 dark:text-white">Business Growth</span>
                      <span className="text-[10px] text-slate-500">$499/month • Medium Fleets</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWPlan('STARTER_SME');
                        setWMaxUsers(10);
                        setWMaxRiders(30);
                        setWMaxStorageGB(20);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wPlan === 'STARTER_SME'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block text-slate-900 dark:text-white">Starter SME</span>
                      <span className="text-[10px] text-slate-500">$199/month • Small Hub</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Max User Accounts
                    </label>
                    <input
                      type="number"
                      value={wMaxUsers}
                      onChange={(e) => setWMaxUsers(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Max Riders / Drivers
                    </label>
                    <input
                      type="number"
                      value={wMaxRiders}
                      onChange={(e) => setWMaxRiders(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Max Vehicles
                    </label>
                    <input
                      type="number"
                      value={wMaxVehicles}
                      onChange={(e) => setWMaxVehicles(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cloud Storage (GB)
                    </label>
                    <input
                      type="number"
                      value={wMaxStorageGB}
                      onChange={(e) => setWMaxStorageGB(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Monthly AI Requests
                    </label>
                    <input
                      type="number"
                      value={wAiMonthly}
                      onChange={(e) => setWAiMonthly(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2"
                  >
                    Next: Company Admin Credentials <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: COMPANY ADMIN ACCOUNT */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-in fade-in">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b pb-2">
                  Step 3: Company Admin User Setup
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company Admin Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={wAdminName}
                      onChange={(e) => setWAdminName(e.target.value)}
                      placeholder="e.g. Tariq Mansoor"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={wAdminEmail}
                      onChange={(e) => setWAdminEmail(e.target.value)}
                      placeholder="e.g. admin@paramount.ae"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={wAdminUsername}
                      onChange={(e) => setWAdminUsername(e.target.value)}
                      placeholder="e.g. paramount_admin"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={wAdminPhone}
                      onChange={(e) => setWAdminPhone(e.target.value)}
                      placeholder="e.g. 0501234567"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automated Provisioning Summary:
                  </span>
                  <p>
                    Upon clicking Launch, the platform will automatically isolate data for Tenant Code{' '}
                    <strong className="font-mono">{wCompanyCode || 'PENDING'}</strong>, create default roles (HR Manager, Fleet Manager, Dispatcher, Finance), generate standard department structures, and grant full Company Admin access to <strong>{wAdminEmail}</strong>.
                  </p>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" /> Provision & Launch Company Workspace
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION PLANS & LICENSES */}
      {activeTab === 'PLANS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter Plan */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm relative">
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Starter SME</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">$199 / mo</h3>
                <p className="text-xs text-slate-500">Ideal for small regional delivery hubs and single fleet operations.</p>
              </div>
              <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Up to 10 Admin Users</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Up to 30 Riders / Drivers</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 20 GB Secure Cloud Storage</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 5,000 AI Copilot Requests</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Basic Attendance & Tracking</li>
              </ul>
            </div>

            {/* Growth Plan */}
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-600 rounded-2xl p-6 space-y-4 shadow-md relative">
              <span className="absolute -top-3 right-6 bg-blue-600 text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-xs">
                Most Popular
              </span>
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Business Growth</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">$499 / mo</h3>
                <p className="text-xs text-slate-500">For expanding fleet providers needing multi-branch coordination.</p>
              </div>
              <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Up to 25 Admin Users</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Up to 100 Riders / Drivers</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 50 GB Secure Cloud Storage</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 15,000 AI Copilot Requests</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Full HR, Payroll & SIM Billing</li>
              </ul>
            </div>

            {/* Enterprise Pro */}
            <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl relative">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Enterprise Pro</span>
                <h3 className="text-2xl font-bold text-white mt-1">$999 / mo</h3>
                <p className="text-xs text-slate-400">Complete multi-country logistics, unlimited custom roles, and priority Gemini AI.</p>
              </div>
              <ul className="text-xs space-y-2 text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Up to 100 Admin Users</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Up to 500 Riders / Drivers</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 100 GB Dedicated Storage</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 50,000 AI Copilot Requests</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Custom Integrations & Dedicated Support</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD HEALTH & DATA ISOLATION */}
      {activeTab === 'HEALTH' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-500" /> Cloud Container & Multi-Tenant Data Guardrails
              </h3>
              <p className="text-xs text-slate-500">Real-time system health, tenant isolation telemetry, and security checks.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Operational
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tenant Data Isolation</span>
                <span className="text-emerald-600 font-bold">STRICT ENFORCED</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Every query automatically appends <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">tenant_id = :active_tenant</code> parameter. 0 data leaks detected.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Container CPU Usage</span>
                <span className="text-blue-600 font-bold">14.2%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[14%]" />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Postgres Connections</span>
                <span className="text-purple-600 font-bold">24 Active</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full w-[24%]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TENANT QUOTAS MODAL */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Edit Quotas: {editingTenant.name}
              </h3>
              <button onClick={() => setEditingTenant(null)} className="p-1 text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Max Users Limit</label>
                <input
                  type="number"
                  value={editingTenant.limits.maxUsers}
                  onChange={(e) =>
                    setEditingTenant({
                      ...editingTenant,
                      limits: { ...editingTenant.limits, maxUsers: Number(e.target.value) },
                    })
                  }
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Max Riders Limit</label>
                <input
                  type="number"
                  value={editingTenant.limits.maxRiders}
                  onChange={(e) =>
                    setEditingTenant({
                      ...editingTenant,
                      limits: { ...editingTenant.limits, maxRiders: Number(e.target.value) },
                    })
                  }
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Max Storage (GB)</label>
                <input
                  type="number"
                  value={editingTenant.limits.maxStorageGB}
                  onChange={(e) =>
                    setEditingTenant({
                      ...editingTenant,
                      limits: { ...editingTenant.limits, maxStorageGB: Number(e.target.value) },
                    })
                  }
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setEditingTenant(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const updated = tenants.map((t) => (t.id === editingTenant.id ? editingTenant : t));
                  onUpdateTenants(updated);
                  setEditingTenant(null);
                  alert('Tenant subscription limits updated!');
                }}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Production QA and Database Reset Modal */}
      <PreProductionResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        lang={lang}
      />
    </div>
  );
};
