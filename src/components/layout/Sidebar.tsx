import React, { useState, useEffect } from 'react';
import {
  Search,
  Home,
  Calendar,
  FileText,
  Users,
  Shield,
  ClipboardList,
  Stamp,
  BarChart2,
  Ticket,
  Package,
  Bike,
  Smartphone,
  Car,
  Gift,
  Truck,
  CreditCard,
  Fuel,
  Landmark,
  Store,
  Handshake,
  Wallet,
  Settings,
  Wrench,
  Sliders,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  DollarSign,
  Contact,
  MessageSquare,
  HardDrive,
  UserCheck,
  X,
  FolderKanban,
  LayoutDashboard,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { NavigationModule, SystemUserAccount } from '../../types/erp';
import { LanguageMode } from '../../data/translations';

interface SidebarProps {
  activeTenantName?: string;
  activeTenantLogoUrl?: string | null;
  activeTenantId?: string | null;
  currentModule?: NavigationModule;
  activeModule?: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  lang?: LanguageMode;
  currentUser?: SystemUserAccount;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  subItems?: { id: string; label: string }[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  activeModule,
  onSelectModule,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  currentUser,
  activeTenantName,
  activeTenantLogoUrl,
  activeTenantId,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const selectedMod = activeModule || currentModule || 'doc_expiry_listing';
  const [searchFilter, setSearchFilter] = useState('');
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = !isMobileOpen && (controlledCollapsed ?? localCollapsed);
  const toggleCollapse = onToggleCollapse ?? (() => setLocalCollapsed(v => !v));
  const name = 'Pixel Syntax';
  const logo = '/pixel-syntax-logo.webp';
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  const handleSelectModule = (mod: NavigationModule) => {
    onSelectModule(mod);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Helper check if module ID is allowed for currentUser
  const isModuleAllowed = (moduleId: string): boolean => {
    if (moduleId === 'platform_admin' || moduleId === 'multi_tenant_saas') {
      return false; // Platform Admin & Multi-Tenant SaaS Portal are strictly separate from normal ERP sidebar
    }
    if (!currentUser) return true; // Default allow if no user context
    const allowed = Array.isArray(currentUser.allowedModules) ? currentUser.allowedModules : ['ALL'];
    if (currentUser.isOwner || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'COMPANY_ADMIN' || allowed.includes('ALL')) return true;
    if (moduleId === 'riders_drivers') {
      return (
        allowed.includes('riders_drivers') ||
        allowed.includes('emp_mgmt') ||
        allowed.includes('employees_list')
      );
    }
    if (moduleId === 'passport_mgmt') {
      return (
        allowed.includes('passport_mgmt') ||
        allowed.includes('passport_list')
      );
    }
    return allowed.includes(moduleId);
  };

  // Keep all submenus closed until explicitly opened (search can reveal matches).
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const menuSections: MenuSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'operations_dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'PEOPLE',
      items: [
        {
          id: 'riders_drivers',
          label: 'Employees',
          icon: Users,
        },
        {
          id: 'recruitment',
          label: 'Visa',
          icon: UserCheck,
        },
        {
          id: 'att_mgmt',
          label: 'Attendance',
          icon: Calendar,
          subItems: [
            { id: 'attendance_daily', label: 'Daily Attendance' },
            { id: 'attendance_monthly', label: 'Monthly Attendance' },
            { id: 'attendance_holidays', label: 'Holidays' },
          ],
        },
        {
          id: 'doc_expiry_mgmt',
          label: 'Documents',
          icon: FileText,
        },
        {
          id: 'passport_mgmt',
          label: 'Passports',
          icon: Stamp,
        },
        {
          id: 'office_forms',
          label: 'Office Forms',
          icon: ClipboardList,
          subItems: [
            { id: 'forms_create', label: 'Create Form' },
            { id: 'forms_list', label: 'Employee Forms' },
            { id: 'forms_templates_types', label: 'Template Types' },
            { id: 'forms_templates', label: 'Form Templates' },
          ],
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'projects_list',
          label: 'Projects',
          icon: FolderKanban,
          subItems: [
            { id: 'projects_list', label: 'All Projects' },
            { id: 'projects_create', label: 'Create Project' },
            { id: 'projects_assignments', label: 'Assignments' },
            { id: 'projects_assign', label: 'Assign Project' },
            { id: 'projects_transfer', label: 'Transfer Project' },
          ],
        },
        { id: 'rider_project_mgmt', label: 'Rider Operations', icon: Bike },
        { id: 'captain_perf', label: 'Rider Performance', icon: BarChart2 },
      ],
    },
    {
      title: 'FLEET',
      items: [
        { id: 'sim_card_mgmt', label: 'SIMs', icon: Smartphone },
        { id: 'veh_mgmt', label: 'Vehicles', icon: Car },
        { id: 'traffic_fines_mgmt', label: 'Fines', icon: Ticket },
        { id: 'salik_mgmt', label: 'Salik', icon: Landmark },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { id: 'hr_payroll', label: 'Payroll', icon: DollarSign },
        { id: 'payroll_loan_mgmt', label: 'Loans', icon: Landmark },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        { id: 'operational_reports', label: 'Reports', icon: FileText },
        { id: 'data_import_center', label: 'Data Import', icon: HardDrive },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        {
          id: 'office_staff_access',
          label: 'Staff Access',
          icon: Shield,
          subItems: [
            { id: 'settings_users', label: 'Staff Accounts' },
            { id: 'roles_permissions', label: 'Roles & Permissions' },
          ],
        },
        { id: 'sys_configuration', label: 'Settings', icon: Sliders },
      ],
    },
  ];

  return (
    <>
      {isMobileOpen && (
        <div onClick={onCloseMobile} className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden" />
      )}
      <aside aria-label="ERP navigation"
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-30 flex flex-col h-[100dvh] lg:h-screen shrink-0 bg-[#111f36] text-slate-200 border-r border-[#26364c] shadow-xl motion-safe:transition-[width,transform] duration-200 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'w-16' : 'w-[85vw] max-w-[300px] lg:w-64'}`}>
        <div className={`shrink-0 border-b border-white/10 pt-safe ${collapsed ? 'p-2' : 'px-3 pt-3 pb-2'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className={`min-w-0 flex items-center ${collapsed ? 'justify-center w-full' : 'flex-1 justify-center'}`}>
              {logo && failedLogo !== logo ? (
                <div className={`flex items-center justify-center overflow-hidden ${collapsed ? 'w-11 h-10 p-1' : 'w-[176px] h-[64px]'}`}>
                  <img src={logo} alt={name} referrerPolicy="no-referrer" onError={() => setFailedLogo(logo)}
                    className="w-full h-full object-contain"  />
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="bg-[#233b45] text-[#b4e45d] rounded-lg p-2 shrink-0"><Building2 className="w-5 h-5" /></span>
                  {!collapsed && <span className="text-sm font-semibold text-white truncate">{name}</span>}
                </div>
              )}
            </div>
            {onCloseMobile && <button type="button" onClick={onCloseMobile} aria-label="Close navigation" className="lg:hidden absolute right-2 top-2 p-2 rounded-lg text-slate-300 hover:bg-white/10"><X className="w-5 h-5" /></button>}
          </div>
          {!collapsed && (
            <>
              <label className="relative block mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input aria-label="Search menu" type="search" placeholder="Search menu..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                  className="w-full bg-white/[.06] border border-white/10 rounded-md h-8 pl-8 pr-2 text-xs text-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#a8d96a]" />
              </label>
            </>
          )}
        </div>
        <nav aria-label="Modules" className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2.5 py-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-600">
          {menuSections.map(sec => {
            const term = searchFilter.trim().toLowerCase();
            const permitted = sec.items.filter(item => isModuleAllowed(item.id) || item.subItems?.some(sub => isModuleAllowed(sub.id)));
            const matching = permitted.filter(item => !term || item.label.toLowerCase().includes(term) || item.subItems?.some(sub => isModuleAllowed(sub.id) && sub.label.toLowerCase().includes(term)));
            if (!matching.length) return null;
            return (
              <div key={sec.title} className="space-y-1">
                {!collapsed && sec.title !== 'OVERVIEW' && <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-[.12em] text-slate-400 uppercase">{sec.title}</p>}
                {matching.map(item => {
                  const children = item.subItems?.filter(sub => isModuleAllowed(sub.id)) || [];
                  const hasChildren = children.length > 0;
                  const Icon = item.icon;
                  const active = selectedMod === item.id || children.some(sub => sub.id === selectedMod)
                    || (item.id === 'riders_drivers' && ['riders_drivers','employees_list','emp_mgmt','employees_create'].includes(selectedMod))
                    || (item.id === 'passport_mgmt' && ['passport_mgmt','passport_list'].includes(selectedMod));
                  const expanded = Boolean(term) || (expandedKeys[item.id] ?? false);
                  return (
                    <div key={item.id}>
                      <button type="button" title={item.label} aria-label={item.label} aria-current={active && !hasChildren ? 'page' : undefined} aria-expanded={hasChildren && !collapsed ? expanded : undefined}
                        onClick={() => {
                          if (hasChildren) {
                            if (collapsed) { toggleCollapse(); setExpandedKeys(prev => ({...prev,[item.id]:true})); }
                            else setExpandedKeys(prev => ({...prev,[item.id]:!expanded}));
                          } else if (isModuleAllowed(item.id)) handleSelectModule(item.id as NavigationModule);
                        }}
                        className={`group w-full flex items-center gap-2.5 rounded-lg min-h-[34px] text-[13px] font-normal motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b4e45d] ${collapsed ? 'justify-center px-1' : 'px-2.5'} ${active ? 'bg-[#283f57] text-white' : 'text-slate-300 hover:bg-white/[.07] hover:text-white'}`}>
                        <Icon className={`w-[17px] h-[17px] shrink-0 ${active ? 'text-[#b4e45d]' : 'text-slate-400 group-hover:text-white'}`} />
                        {!collapsed && <><span className="truncate flex-1 text-left">{item.label}</span>{hasChildren && <ChevronDown className={`w-3.5 h-3.5 text-slate-400 motion-safe:transition-transform ${expanded ? '' : '-rotate-90'}`} />}</>}
                      </button>
                      {hasChildren && expanded && !collapsed && (
                        <div className="ml-[18px] border-l border-white/10 pl-3 py-1 space-y-0.5">
                          {children.map(sub => <button type="button" key={sub.id} title={sub.label} aria-current={selectedMod === sub.id ? 'page' : undefined} onClick={() => handleSelectModule(sub.id as NavigationModule)}
                            className={`w-full text-left min-h-[32px] px-2 rounded-md text-[12px] truncate motion-safe:transition-colors focus-visible:outline focus-visible:outline-[#b4e45d] ${selectedMod === sub.id ? 'bg-[#283f57] text-[#c2ef84] font-semibold' : 'text-slate-300 hover:bg-white/[.07] hover:text-white'}`}>{sub.label}</button>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!collapsed && searchFilter.trim() && !menuSections.some(sec => sec.items.some(item => (isModuleAllowed(item.id) || item.subItems?.some(sub => isModuleAllowed(sub.id))) && (item.label.toLowerCase().includes(searchFilter.trim().toLowerCase()) || item.subItems?.some(sub => isModuleAllowed(sub.id) && sub.label.toLowerCase().includes(searchFilter.trim().toLowerCase()))))) && <p className="p-3 text-xs text-slate-400">No matching modules</p>}
        </nav>
        <div className="shrink-0 p-2.5 border-t border-white/10 pb-safe">
          <button type="button" onClick={toggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={`hidden lg:flex w-full items-center gap-2 rounded-lg p-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4" /> Collapse sidebar</>}
          </button>
          {onCloseMobile && <button type="button" onClick={onCloseMobile} className="lg:hidden w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-white/10 text-xs font-semibold text-white"><X className="w-4 h-4"/> Close navigation</button>}
        </div>
      </aside>
    </>
  );
};
