import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { NavigationModule, SystemUserAccount } from '../../types/erp';
import { LanguageMode } from '../../data/translations';

interface SidebarProps {
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
  collapsed = false,
  onToggleCollapse,
  currentUser,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const selectedMod = activeModule || currentModule || 'doc_expiry_listing';
  const [searchFilter, setSearchFilter] = useState('');

  // Allow keyboard users to dismiss the mobile navigation drawer.
  useEffect(() => {
    if (!isMobileOpen || !onCloseMobile) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileOpen, onCloseMobile]);

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

  // Track expanded parent items. Default expand "Vehicle Management", "Attendance Management", "Document Expiry Management", "Office Staff Access"
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({
    'veh_mgmt': true,
    'att_mgmt': true,
    'doc_expiry_mgmt': true,
    'office_staff_access': true,
  });

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const menuSections: MenuSection[] = [
    {
      title: 'COMMAND CENTER',
      items: [
        { id: 'operations_dashboard', label: 'Operations Dashboard', icon: Home },
        { id: 'fleet_dashboard', label: 'Live Fleet Telemetry', icon: Truck },
      ],
    },
    {
      title: 'HUMAN RESOURCES',
      items: [
        {
          id: 'riders_drivers',
          label: 'Employee Management',
          icon: Users,
        },
        {
          id: 'recruitment',
          label: 'Recruitment Pipeline',
          icon: UserCheck,
        },
        {
          id: 'att_mgmt',
          label: 'Attendance Management',
          icon: Calendar,
          subItems: [
            { id: 'attendance_daily', label: 'Daily Employee Attendance' },
            { id: 'attendance_monthly', label: 'Monthly Employee Attendance' },
            { id: 'attendance_holidays', label: 'Holiday Management' },
          ],
        },
        {
          id: 'doc_expiry_mgmt',
          label: 'Document Expiry Management',
          icon: FileText,
        },
        {
          id: 'passport_mgmt',
          label: 'Passport Management',
          icon: Stamp,
        },
        {
          id: 'office_forms',
          label: 'Office Forms',
          icon: ClipboardList,
          subItems: [
            { id: 'forms_create', label: 'Create Employee Forms' },
            { id: 'forms_list', label: 'Employee Forms' },
            { id: 'forms_templates_types', label: 'Form Template Types' },
            { id: 'forms_templates', label: 'Form Templates' },
          ],
        },
      ],
    },
    {
      title: 'DELIVERY & FLEET',
      items: [
        {
          id: 'projects_list',
          label: 'Project Management',
          icon: FolderKanban,
          subItems: [
            { id: 'projects_list', label: 'Project Master' },
            { id: 'projects_create', label: 'Create Project' },
            { id: 'projects_assignments', label: 'Assignments Directory' },
            { id: 'projects_assign', label: 'Assign Project' },
            { id: 'projects_transfer', label: 'Transfer Project' },
          ],
        },
        { id: 'rider_project_mgmt', label: 'Rider Operations Control', icon: Bike },
        { id: 'captain_perf', label: 'Rider Performance', icon: BarChart2 },
        { id: 'sim_card_mgmt', label: 'SIM Card Management', icon: Smartphone },
        { id: 'veh_mgmt', label: 'Vehicle Management', icon: Car },
        { id: 'traffic_fines_mgmt', label: 'Traffic Fines', icon: Ticket },
        { id: 'salik_mgmt', label: 'Salik Management', icon: Landmark },
      ],
    },
    {
      title: 'PAYROLL & LOANS',
      items: [
        { id: 'hr_payroll', label: 'Payroll', icon: DollarSign },
        { id: 'payroll_loan_mgmt', label: 'Loan Management', icon: Landmark },
      ],
    },
    {
      title: 'REPORTS & TOOLS',
      items: [
        { id: 'operational_reports', label: 'Operations Reports & CSV', icon: FileText },
        { id: 'data_import_center', label: 'Bulk Data Import Center', icon: HardDrive },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        {
          id: 'office_staff_access',
          label: 'Office Staff Access',
          icon: Shield,
          subItems: [
            { id: 'settings_users', label: 'Staff Accounts & RBAC' },
            { id: 'roles_permissions', label: 'Role & Permission Master' },
          ],
        },
        { id: 'sys_configuration', label: 'System Configuration & Audit', icon: Sliders },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-30 flex flex-col h-[100dvh] lg:h-screen bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 shrink-0 select-none ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-[85vw] max-w-[300px] lg:w-16' : 'w-[85vw] max-w-[300px] lg:w-72'}`}
      >
        {/* Top Header inside Sidebar with Mobile Close Button */}
        <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800/80 pt-safe">
          {!collapsed ? (
            <div className="relative flex-1 mr-2">
              <input
                type="text"
                placeholder="Filter menu..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-blue-500 placeholder-slate-400"
              />
            </div>
          ) : null}

          {/* Close button on Mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Close Navigation Drawer"
              aria-label="Close navigation drawer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {menuSections.map((sec, secIdx) => {
          // First filter items by currentUser module permissions
          const permittedItems = sec.items.filter((item) => {
            if (isModuleAllowed(item.id)) return true;
            if (item.subItems && item.subItems.some((sub) => isModuleAllowed(sub.id))) return true;
            return false;
          });

          // Then filter items if searching
          const matchingItems = permittedItems.filter((item) => {
            if (!searchFilter) return true;
            const term = searchFilter.toLowerCase();
            const parentMatch = (item.label || '').toLowerCase().includes(term);
            const childMatch = item.subItems?.some((sub) =>
              (sub.label || '').toLowerCase().includes(term)
            );
            return parentMatch || childMatch;
          });

          if (matchingItems.length === 0) return null;

          return (
            <div key={secIdx} className="space-y-0.5">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 mt-2">
                  {sec.title}
                </p>
              )}

              {matchingItems.map((item) => {
                // Filter sub-items by currentUser module permission
                const allowedSubItems = item.subItems?.filter((sub) => isModuleAllowed(sub.id));
                const hasSubItems = allowedSubItems && allowedSubItems.length > 0;
                const Icon = item.icon;
                const isExpanded = searchFilter ? true : Boolean(expandedKeys[item.id]);

                const isParentActive =
                  selectedMod === item.id ||
                  allowedSubItems?.some((sub) => sub.id === selectedMod) ||
                  (item.id === 'riders_drivers' &&
                    ['riders_drivers', 'employees_list', 'emp_mgmt', 'employees_create'].includes(selectedMod)) ||
                  (item.id === 'passport_mgmt' &&
                    ['passport_mgmt', 'passport_list'].includes(selectedMod));

                return (
                  <div key={item.id} className="space-y-0.5">
                    {/* Parent Menu Item Button */}
                    <button
                      onClick={() => {
                        if (hasSubItems) {
                          toggleExpand(item.id);
                          // Select first child if clicking parent
                          if (item.subItems && item.subItems[0]) {
                            handleSelectModule(item.subItems[0].id as NavigationModule);
                          }
                        } else {
                          handleSelectModule(item.id as NavigationModule);
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2.5 lg:py-1.5 min-h-[44px] lg:min-h-0 rounded text-xs font-medium transition-colors ${
                        isParentActive && !hasSubItems
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                      title={item.label}
                    >
                      {/* Left Arrow Icon (▸ when collapsed, ▾ when expanded) */}
                      {hasSubItems && !collapsed && (
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] shrink-0 w-3">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      )}

                      {/* Icon */}
                      <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />

                      {/* Parent Label */}
                      {!collapsed && (
                        <span className="min-w-0 flex-1 text-left font-medium text-[12px] leading-snug whitespace-normal break-words lg:truncate">
                          {item.label}
                        </span>
                      )}
                    </button>

                    {/* Sub-Items Tree List */}
                    {hasSubItems && isExpanded && !collapsed && (
                      <div className="pl-8 pr-1 space-y-0.5 py-0.5">
                        {allowedSubItems!.map((sub) => {
                          const isSubActive = selectedMod === sub.id;

                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSelectModule(sub.id as NavigationModule)}
                              title={sub.label}
                              className={`w-full text-left py-2.5 lg:py-1 px-2.5 min-h-[44px] lg:min-h-0 rounded text-[11px] leading-snug transition-colors block whitespace-normal break-words lg:truncate ${
                                isSubActive
                                  ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Collapsed View Button / Mobile Close */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 pb-safe">
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-full items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {!collapsed && <span>Collapsed View</span>}
        </button>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
          >
            <X className="w-4 h-4" />
            <span>Close Navigation</span>
          </button>
        )}
      </div>
    </aside>
    </>
  );
};
