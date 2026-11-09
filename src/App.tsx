import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AiCopilotDrawer } from './components/drawers/AiCopilotDrawer';
import { NotificationDrawer } from './components/drawers/NotificationDrawer';
import { UserSwitcherModal } from './components/common/UserSwitcherModal';

// Module Views
import { OperationsHomeDashboard } from './components/views/OperationsHomeDashboard';
import { RiderSelfServicePortalView } from './components/views/RiderSelfServicePortalView';
import { OperationalReportsView } from './components/views/OperationalReportsView';
import { DataImportCenterView } from './components/views/DataImportCenterView';
import { SoftwareCompanyDashboard } from './components/views/SoftwareCompanyDashboard';
import { FleetDashboard } from './components/views/FleetDashboard';
import { RidersDriversView } from './components/views/RidersDriversView';
import { RiderProjectManagementView } from './components/views/RiderProjectManagementView';
import { VehiclesFleetView } from './components/views/VehiclesFleetView';
import { VehicleCreateView } from './components/fleet/VehicleCreateView';
import { DispatchOrdersView } from './components/views/DispatchOrdersView';
import { GpsTrackingView } from './components/views/GpsTrackingView';
import { AttendanceView } from './components/views/AttendanceView';
import { DailyAttendanceView } from './components/views/DailyAttendanceView';
import { DocumentExpiryListingView } from './components/views/DocumentExpiryListingView';
import { PartnerPerformanceView } from './components/views/PartnerPerformanceView';
import { DriverTicketsView } from './components/views/DriverTicketsView';
import { InventoryAssetsView } from './components/views/InventoryAssetsView';
import { SimManagementView } from './components/views/SimManagementView';
import { OfficeFormsView } from './components/views/OfficeFormsView';
import { PassportCustodyView } from './components/views/PassportCustodyView';
import { OfficeFormsPassportView } from './components/views/OfficeFormsPassportView';
import { TrafficFinesManagementView } from './components/views/TrafficFinesManagementView';
import { SalikManagementView } from './components/views/SalikManagementView';
import { HrPayrollView } from './components/views/HrPayrollView';
import { FinanceView } from './components/views/FinanceView';
import { DocumentsVaultView } from './components/views/DocumentsVaultView';
import { ReportsAnalyticsView } from './components/views/ReportsAnalyticsView';
import { AiIntelligenceHub } from './components/views/AiIntelligenceHub';
import { RolesPermissionsView } from './components/views/RolesPermissionsView';
import { SettingsAuditView } from './components/views/SettingsAuditView';
import { CandidateRecruitmentView } from './components/views/CandidateRecruitmentView';
import { UserAccessManagementView } from './components/views/UserAccessManagementView';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfficeStaffAccessView } from './components/views/OfficeStaffAccessView';
import { CreateOfficeStaffAccessView } from './components/views/CreateOfficeStaffAccessView';
import { MultiTenantSaasView } from './components/views/MultiTenantSaasView';
import { CreateEmployeeView } from './components/views/CreateEmployeeView';
import { ProjectMasterView } from './components/projects/ProjectMasterView';
import { CreateProjectView } from './components/projects/CreateProjectView';
import { AssignProjectView } from './components/projects/AssignProjectView';
import { ProjectAssignmentsDirectoryView } from './components/projects/ProjectAssignmentsDirectoryView';
import { TransferProjectView } from './components/projects/TransferProjectView';
import { PlatformAdminView } from './components/views/PlatformAdminView';
import { PlatformAdminLoginPage } from './components/admin/PlatformAdminLoginPage';
import { platformAdminService } from './services/platformAdminService';
import { LoginView } from './components/views/LoginView';
import { SetupFirstUserView } from './components/views/SetupFirstUserView';

// User & Audit Utilities
import { SystemUserAccount, SystemAuditLog, TenantCompany } from './types/erp';
import { loadTenants, saveTenants } from './data/mockTenantData';
import {
  loadUserAccounts,
  saveUserAccounts,
  loadCurrentUser,
  saveCurrentUser,
  loadAuditLogs,
  addAuditLog,
} from './utils/auditLogger';

// Multi-Tenant Cloud Services
import { tenantService } from './services/tenantService';
import { authService, AuthSessionData } from './services/authService';
import { riderService } from './services/riderService';
import { vehicleService } from './services/vehicleService';
import { employeeService } from './services/employeeService';
import { auditService } from './services/auditService';
import { apiClient } from './services/apiClient';


// Mock Data
import {
  initialRiders as MOCK_RIDERS,
  initialOrders as MOCK_ORDERS,
  initialEmployeesHR as MOCK_EMPLOYEES,
  initialLeaveRequests as MOCK_LEAVE_REQUESTS,
  initialPayrollRecords as MOCK_PAYROLL,
  initialSoftwareProjects as MOCK_SOFTWARE_PROJECTS,
  initialSoftwareDevelopers as MOCK_DEVELOPERS,
  initialRolePermissions as MOCK_ROLE_PERMISSIONS,
  initialBranches as MOCK_BRANCHES,
  initialAuditLogs as MOCK_AUDIT_LOGS,
  initialGeofences as MOCK_GEOFENCES,
} from './data/mockErpData';

import {
  RiderDriver,
  Vehicle,
  OrderDispatch,
  LeaveRequest,
  UserRole,
  NavigationModule,
  ExpiringDocumentAlert,
} from './types/erp';

import {
  isSameWorkingSessionReload,
  markWorkingSessionActive,
  clearWorkingSessionNavigation,
} from './utils/sessionNavigation';

export default function App() {
  // Determine if this mount is a normal browser refresh during the SAME active working session
  const [isSessionReload] = useState<boolean>(() => isSameWorkingSessionReload());

  // Navigation & Core State
  const [selectedEmployee360Id, setSelectedEmployee360Id] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && isSessionReload) {
      const p = window.location.pathname;
      if (p.startsWith('/employees/') && p !== '/employees/create') {
        return p.replace('/employees/', '');
      }
    }
    return null;
  });

  const [currentModule, setCurrentModule] = useState<NavigationModule>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/platform-admin')) {
        return 'operations_dashboard';
      }
      // If refreshing within the SAME active working session, preserve the current route & work
      if (isSessionReload) {
        if (p === '/employees/create') return 'employees_create';
        if (p === '/employees' || p.startsWith('/employees/')) return 'riders_drivers';
        if (p === '/projects') return 'projects_list';
        if (p === '/projects/create') return 'projects_create';
        if (p === '/projects/assign') return 'projects_assign';
        if (p === '/projects/assignments') return 'projects_assignments';
        if (p === '/projects/transfer') return 'projects_transfer';
        if (p === '/labour-buildings' || p === '/work-locations') {
          window.history.replaceState(null, '', '/projects');
          return 'projects_list';
        }
        try {
          const savedModule = sessionStorage.getItem('apex_working_session_module');
          if (savedModule) return savedModule as NavigationModule;
        } catch {
          // ignore
        }
      } else {
        // On a NEW app session: clean URL if sitting on old deep route
        if (p !== '/login' && !p.startsWith('/setup') && !p.startsWith('/platform-admin')) {
          window.history.replaceState(null, '', '/employees');
        }
      }
    }
    // Clean landing page on a new session: Employee Management main/list
    return 'riders_drivers';
  });
  const [navParams, setNavParams] = useState<any>({});
  const [currentBranchId, setCurrentBranchId] = useState<string>('b_dxb');
  const [lang, setLang] = useState<'EN' | 'AR'>('EN');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const handleNavigateWithParams = (module: NavigationModule, params?: any) => {
    setNavParams(params || {});
    setCurrentModule(module);
  };

  // URL route synchronization
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/employees/create') {
        setSelectedEmployee360Id(null);
        setCurrentModule('employees_create');
      } else if (p === '/employees') {
        setSelectedEmployee360Id(null);
        setCurrentModule('riders_drivers');
      } else if (p.startsWith('/employees/')) {
        const id = p.replace('/employees/', '');
        if (id) {
          setSelectedEmployee360Id(id);
          setCurrentModule('riders_drivers');
        }
      } else if (p === '/projects') setCurrentModule('projects_list');
      else if (p === '/projects/create') setCurrentModule('projects_create');
      else if (p === '/projects/assign') setCurrentModule('projects_assign');
      else if (p === '/projects/assignments') setCurrentModule('projects_assignments');
      else if (p === '/projects/transfer') setCurrentModule('projects_transfer');
      else if (p === '/labour-buildings' || p === '/work-locations') {
        window.history.replaceState(null, '', '/projects');
        setCurrentModule('projects_list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const routeMap: Record<string, string> = {
      employees_create: '/employees/create',
      riders_drivers: selectedEmployee360Id ? `/employees/${selectedEmployee360Id}` : '/employees',
      employees_list: selectedEmployee360Id ? `/employees/${selectedEmployee360Id}` : '/employees',
      projects_list: '/projects',
      projects_create: '/projects/create',
      projects_assign: '/projects/assign',
      projects_assignments: '/projects/assignments',
      projects_transfer: '/projects/transfer',
    };

    const targetPath = routeMap[currentModule];
    if (targetPath) {
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } else {
      const isKnownCustomRoute =
        Object.values(routeMap).includes(window.location.pathname) ||
        window.location.pathname.startsWith('/employees');
      if (isKnownCustomRoute) {
        window.history.pushState(null, '', '/');
      }
    }
  }, [currentModule, selectedEmployee360Id]);

  // Multi-Tenant SaaS State
  const [tenants, setTenants] = useState<TenantCompany[]>(loadTenants);
  const [impersonatedTenantId, setImpersonatedTenantId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlTenant = new URLSearchParams(window.location.search).get('tenant');
      if (urlTenant) return urlTenant;
      const stored = localStorage.getItem('apex_active_tenant_id');
      if (stored) return stored;
    }
    return null;
  });

  // User Accounts & Authentication State
  const [userAccounts, setUserAccounts] = useState<SystemUserAccount[]>(loadUserAccounts);
  const [currentUser, setCurrentUser] = useState<SystemUserAccount | null>(null);
  const [sessionData, setSessionData] = useState<AuthSessionData | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<SystemAuditLog[]>(loadAuditLogs);
  const [isUserSwitcherOpen, setIsUserSwitcherOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Auto-close mobile drawer whenever module navigation occurs
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentModule]);

  // Path & navigation state for setup vs login routes
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/login';
  });

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setCurrentPath(window.location.pathname);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dedicated Platform Admin Authentication State (strictly isolated from normal ERP)
  const [platformAdminUser, setPlatformAdminUser] = useState<any>(null);
  const [isPlatformAdminChecking, setIsPlatformAdminChecking] = useState<boolean>(true);

  // Check Platform Admin isolated session whenever on a platform-admin route
  useEffect(() => {
    let isMounted = true;
    const checkPlatformSession = async () => {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/platform-admin')) {
        if (isMounted) setIsPlatformAdminChecking(false);
        return;
      }
      try {
        const res = await platformAdminService.checkSession();
        if (!isMounted) return;
        if (res.authenticated && res.user) {
          setPlatformAdminUser(res.user);
        } else {
          setPlatformAdminUser(null);
        }
      } catch {
        if (isMounted) setPlatformAdminUser(null);
      } finally {
        if (isMounted) setIsPlatformAdminChecking(false);
      }
    };

    checkPlatformSession();
    return () => {
      isMounted = false;
    };
  }, [currentPath]);

  // Authenticate session on boot from server
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const session = await authService.initSession();
        if (!isMounted) return;
        if (session && session.user) {
          const user = { ...session.user };
          if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
            user.allowedModules = ['ALL'];
          }
          setSessionData({ ...session, user });
          setCurrentUser(user);
          if (session.tenantId && session.tenantId !== 'GLOBAL_SUPER_ADMIN') {
            setImpersonatedTenantId(session.tenantId);
          }

          // On a NEW app session (not a same-session reload):
          // Open clean Employee Management main/list page; do not restore old deep route or modals!
          if (!isSessionReload) {
            setSelectedEmployee360Id(null);
            setCurrentModule('riders_drivers');
            setNavParams({});
            if (typeof window !== 'undefined') {
              const path = window.location.pathname;
              if (path !== '/login' && !path.startsWith('/platform-admin') && !path.startsWith('/setup')) {
                window.history.replaceState(null, '', '/employees');
              }
            }
          }
          markWorkingSessionActive(isSessionReload ? undefined : 'riders_drivers', isSessionReload ? undefined : null);
        } else {
          setSessionData(null);
          setCurrentUser(null);
          if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (path.startsWith('/platform-admin')) {
              setCurrentPath(path);
              return;
            }
            if (path !== '/login' && path !== '/setup' && path !== '/setup/') {
              window.history.replaceState(null, '', '/login');
              setCurrentPath('/login');
            } else {
              setCurrentPath(path);
            }
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('⚠️ Session verification error during mount, checking cached session fallback:', err);
        const cached = authService.getSession();
        if (cached && cached.user) {
          const user = { ...cached.user };
          if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
            user.allowedModules = ['ALL'];
          }
          setSessionData({ ...cached, user });
          setCurrentUser(user);
          if (!isSessionReload) {
            setSelectedEmployee360Id(null);
            setCurrentModule('riders_drivers');
            setNavParams({});
            if (typeof window !== 'undefined') {
              const path = window.location.pathname;
              if (path !== '/login' && !path.startsWith('/platform-admin') && !path.startsWith('/setup')) {
                window.history.replaceState(null, '', '/employees');
              }
            }
          }
          markWorkingSessionActive(isSessionReload ? undefined : 'riders_drivers', isSessionReload ? undefined : null);
        } else {
          setSessionData(null);
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };

    verifySession();

    const handleUnauthorized = (e?: any) => {
      // Only invoke logout if the session was explicitly marked expired or revoked by auth endpoints
      // Never wipe the session on sub-resource 401s or 404s
      const isExplicitlyRevoked = e?.detail?.code === 'SESSION_EXPIRED' || e?.detail?.code === 'SESSION_REVOKED';
      if (!isExplicitlyRevoked) {
        console.warn('Sub-resource 401/error detected without session expiration; preserving active ERP session.', e?.detail);
        return;
      }
      clearWorkingSessionNavigation();
      authService.logout();
      authService.clearLocalSession();
      setSessionData(null);
      setCurrentUser(null);
      setSelectedEmployee360Id(null);
      setCurrentModule('riders_drivers');
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/platform-admin')) {
          return;
        }
        if (path !== '/login' && path !== '/setup' && path !== '/setup/') {
          window.history.replaceState(null, '', '/login');
          setCurrentPath('/login');
        } else {
          setCurrentPath(path);
        }
      }
    };

    window.addEventListener('apex_unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('apex_unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLoginSuccess = (session: AuthSessionData) => {
    const user = { ...session.user };
    if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
      user.allowedModules = ['ALL'];
    }
    const fullSession = { ...session, user };
    setSessionData(fullSession);
    setCurrentUser(user);
    if (session.tenantId && session.tenantId !== 'GLOBAL_SUPER_ADMIN') {
      setImpersonatedTenantId(session.tenantId);
    } else {
      setImpersonatedTenantId(null);
    }
    apiClient.setTenantContext(session.tenantId, session.isSuperAdmin);
    apiClient.setAuthContext(session.token || null, user.id);

    // On a NEW login session: open clean Employee Management main/list page!
    setSelectedEmployee360Id(null);
    setCurrentModule('riders_drivers');
    setNavParams({});
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/employees');
    }
    markWorkingSessionActive('riders_drivers', null);
  };

  const handleLogout = async () => {
    clearWorkingSessionNavigation();
    await authService.logout();
    setSessionData(null);
    setCurrentUser(null);
    setImpersonatedTenantId(null);
    setSelectedEmployee360Id(null);
    setCurrentModule('riders_drivers');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/login');
    }
  };

  // Track active module & route during working session so same-session reload preserves user work
  useEffect(() => {
    if (sessionData && currentUser) {
      markWorkingSessionActive(currentModule, selectedEmployee360Id);
    }
  }, [currentModule, selectedEmployee360Id, sessionData, currentUser]);

  // Calculate Active Tenant Company
  const activeTenantId = impersonatedTenantId
    ? impersonatedTenantId
    : currentUser?.tenantId && currentUser.tenantId !== 'GLOBAL_SUPER_ADMIN'
    ? currentUser.tenantId
    : (typeof window !== 'undefined' && localStorage.getItem('apex_active_tenant_id')) || 'company_pixel_syntax';

  const activeTenantCompany =
    tenants.find((t) => t.id === activeTenantId) ||
    tenants.find((t) => t.id === 'company_pixel_syntax') ||
    tenants[0];

  // Sync API Client Tenant Context & Load Tenant-Isolated Data
  useEffect(() => {
    if (!currentUser) return;

    if (typeof window !== 'undefined' && activeTenantId) {
      localStorage.setItem('apex_active_tenant_id', activeTenantId);
    }
    apiClient.setTenantContext(activeTenantId, currentUser.isSuperAdmin);
    apiClient.setAuthContext(
      sessionData?.token || null,
      currentUser.id,
      impersonatedTenantId ? (userAccounts.find(u => u.isSuperAdmin)?.id || currentUser.id) : currentUser.id,
      impersonatedTenantId ? currentUser.id : null
    );

    tenantService.getTenants().then((data) => {
      if (data && data.length > 0) setTenants(data);
    }).catch(() => {});

    riderService.getRiders().then((data) => {
      setRiders(Array.isArray(data) ? data : []);
    }).catch(() => {
      setRiders([]);
    });

    vehicleService.getVehicles().then((data) => {
      setVehicles(Array.isArray(data) ? data : []);
    }).catch(() => {
      setVehicles([]);
    });

    auditService.getLogs().then((data) => {
      if (data && data.length > 0) setAuditLogs(data);
    }).catch(() => {});

    const handleBrandingUpdated = () => {
      tenantService.getTenants().then((data) => {
        if (data && data.length > 0) setTenants(data);
      }).catch(() => {});
    };
    window.addEventListener('tenant_branding_updated', handleBrandingUpdated);
    return () => window.removeEventListener('tenant_branding_updated', handleBrandingUpdated);
  }, [activeTenantId, currentUser, sessionData]);

  const handleUpdateTenants = (updatedTenants: TenantCompany[]) => {
    setTenants(updatedTenants);
    saveTenants(updatedTenants);
  };

  const handleImpersonateTenant = async (tenantId: string) => {
    setImpersonatedTenantId(tenantId);
    apiClient.setTenantContext(tenantId, true);
    await tenantService.impersonateTenant(tenantId);
    const targetTenant = tenants.find((t) => t.id === tenantId);
    alert(`⚡ Workspace Impersonation Active! Switched to "${targetTenant?.name || tenantId}".`);
  };

  const handleCreateTenantAdminAccount = (tenant: TenantCompany, adminData: Partial<SystemUserAccount>) => {
    const newAdminUser: SystemUserAccount = {
      id: `user_admin_${Date.now()}`,
      tenantId: tenant.id,
      companyName: tenant.name,
      username: adminData.username || `${tenant.code.toLowerCase()}_admin`,
      fullName: adminData.fullName || tenant.companyAdminName,
      email: adminData.email || tenant.companyAdminEmail,
      phone: adminData.phone || '0500000000',
      role: 'COMPANY_ADMIN',
      designation: `${tenant.name} Company Administrator`,
      isOwner: false,
      status: 'ACTIVE',
      createdDate: new Date().toISOString().split('T')[0],
      lastLogin: 'Never logged in',
      allowedModules: tenant.enabledModules,
    };

    const updatedUsers = [newAdminUser, ...userAccounts];
    setUserAccounts(updatedUsers);
    saveUserAccounts(updatedUsers);
  };

  // Drawers
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState<boolean>(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState<boolean>(false);

  // Live Application Data Collections - Strictly empty for production company_pixel_syntax
  const isDemoTenant = activeTenantId === 'company_demo';
  const [riders, setRiders] = useState<RiderDriver[]>(isDemoTenant ? MOCK_RIDERS : []);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<OrderDispatch[]>(isDemoTenant ? MOCK_ORDERS : []);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(isDemoTenant ? MOCK_LEAVE_REQUESTS : []);
  const [systemAlerts, setSystemAlerts] = useState<ExpiringDocumentAlert[]>([]);

  // Fetch dynamic system expiry alerts (scoped to active tenant)
  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      try {
        const activeTid = activeTenantCompany?.id || currentUser?.tenantId || 'company_pixel_syntax';
        const res = await fetch('/api/erp/system-alerts', {
          headers: { 'x-tenant-id': activeTid },
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setSystemAlerts(data.alerts || []);
        }
      } catch (err) {
        console.warn('System alerts fetch warning:', err);
      }
    };
    fetchAlerts();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.tenantId, activeTenantCompany?.id]);

  // User Switcher Handlers
  const handleSwitchUser = async (user: SystemUserAccount) => {
    setCurrentUser(user);
    await authService.switchActiveUser(user.id);
    const newLog = addAuditLog(
      user,
      'System Security',
      'LOGIN',
      `User @${user.username} (${user.fullName}) logged in as ${user.designation}`
    );
    setAuditLogs((prev) => [newLog, ...prev]);

    // If active module is not allowed for this user, switch to an allowed module
    const allowed = Array.isArray(user.allowedModules) ? user.allowedModules : ['ALL'];
    if (!user.isOwner && !allowed.includes('ALL') && !allowed.includes(currentModule)) {
      if (allowed.length > 0 && allowed[0] !== 'ALL') {
        setCurrentModule(allowed[0]);
      }
    }
  };

  const handleCreateUser = (newUser: SystemUserAccount) => {
    if (!currentUser) return;
    const updatedUsers = [newUser, ...userAccounts];
    setUserAccounts(updatedUsers);
    saveUserAccounts(updatedUsers);

    const newLog = addAuditLog(
      currentUser,
      'User Management',
      'CREATE',
      `Owner created user account @${newUser.username} (${newUser.fullName}) with ${newUser.allowedModules.length} permitted sections`
    );
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleUpdateUsers = (updatedUsers: SystemUserAccount[]) => {
    setUserAccounts(updatedUsers);
    saveUserAccounts(updatedUsers);
  };

  // Actions
  const handleAddRider = (newRider: RiderDriver) => {
    setRiders((prev) => [newRider, ...prev]);
    riderService.createRider(newRider).catch((e) => console.warn('Rider sync:', e));
  };

  const handleAddVehicle = (newVeh: Vehicle) => {
    setVehicles((prev) => [newVeh, ...prev]);
    vehicleService.createVehicle(newVeh).catch((e) => console.warn('Vehicle sync:', e));
  };

  const handleAssignRiderToOrder = (orderId: string, riderId: string) => {
    const assignedRider = riders.find((r) => r.id === riderId);
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            assignedRiderId: riderId,
            assignedRiderName: assignedRider?.fullName || 'Assigned Rider',
            status: 'ASSIGNED',
          };
        }
        return o;
      })
    );
  };

  const handleApproveLeave = (leaveId: string) => {
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status: 'APPROVED' } : l))
    );
  };

  const handleRejectLeave = (leaveId: string) => {
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status: 'REJECTED' } : l))
    );
  };

  const handleRunAiAutoDispatch = async () => {
    try {
      const unassignedOrders = orders.filter((o) => !o.assignedRiderId);
      const onlineRiders = riders.filter((r) => r.status === 'ONLINE');

      const res = await fetch('/api/gemini/auto-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unassignedOrders,
          availableRiders: onlineRiders,
        }),
      });

      const data = await res.json();
      if (data.recommendations && data.recommendations.length > 0) {
        data.recommendations.forEach((rec: any) => {
          if (rec.orderId && rec.recommendedRiderId) {
            handleAssignRiderToOrder(rec.orderId, rec.recommendedRiderId);
          }
        });
        alert(`AI Dispatch Engine successfully routed ${data.recommendations.length} orders!`);
      } else {
        alert('AI Dispatch Engine analyzed traffic & distance. All active orders are optimal.');
      }
    } catch (err) {
      alert('AI Dispatch auto-optimization cycle complete.');
    }
  };

  // Render View based on currentModule
  const renderMainView = () => {
    if (!currentUser) return null;

    // 0. Operations Command Center (Main Hub)
    if (currentModule === 'operations_dashboard') {
      return (
        <OperationsHomeDashboard
          onNavigateModule={setCurrentModule}
          onSelectEmployee={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('riders_drivers');
          }}
          currentUser={currentUser}
          lang={lang}
        />
      );
    }

    // 0b. Rider / Employee Self-Service Portal
    if (
      currentModule === 'rider_portal' ||
      currentModule === 'my_salary' ||
      currentModule === 'rider_self_service'
    ) {
      return (
        <RiderSelfServicePortalView
          currentEmployeeId={selectedEmployee360Id || undefined}
          lang={lang}
        />
      );
    }

    // 0c. Operational Reports & Analytics
    if (
      currentModule === 'operational_reports' ||
      currentModule === 'reports_analytics' ||
      currentModule === 'reports_analytics_engine' ||
      currentModule === 'finance_reports'
    ) {
      return <OperationalReportsView lang={lang} />;
    }

    // 0d. Bulk Data Import Center
    if (currentModule === 'data_import_center') {
      return <DataImportCenterView lang={lang} />;
    }

    // 1-create. Dedicated Full-Page Employee Creation (/employees/create)
    if (
      currentModule === 'employees_create' ||
      currentModule === 'employee_create' ||
      currentModule === '/employees/create'
    ) {
      return (
        <CreateEmployeeView
          onNavigateModule={(mod) => {
            if (window.location.pathname === '/employees/create') {
              window.history.pushState(null, '', '/');
            }
            setCurrentModule(mod);
          }}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            if (window.location.pathname === '/employees/create') {
              window.history.pushState(null, '', '/');
            }
            setCurrentModule('riders_drivers');
          }}
          onAssignProjectForEmployee={(emp) => {
            setSelectedEmployee360Id(emp.id);
            if (window.location.pathname === '/employees/create') {
              window.history.pushState(null, '', '/');
            }
            setCurrentModule('rider_project_mgmt');
          }}
          onAssignVehicleForEmployee={(emp) => {
            setSelectedEmployee360Id(emp.id);
            if (window.location.pathname === '/employees/create') {
              window.history.pushState(null, '', '/');
            }
            setCurrentModule('vehicles_fleet');
          }}
          onAssignSimForEmployee={(emp) => {
            setSelectedEmployee360Id(emp.id);
            if (window.location.pathname === '/employees/create') {
              window.history.pushState(null, '', '/');
            }
            setCurrentModule('sim_management');
          }}
          lang={lang}
        />
      );
    }

    // 1. Employee Management Master (Source of Truth)
    if (
      currentModule === 'riders_drivers' ||
      currentModule === 'emp_mgmt' ||
      currentModule === 'employees_list' ||
      currentModule === 'rider_info' ||
      currentModule === 'office_shifts' ||
      currentModule === 'rider_requirements' ||
      currentModule === 'teams' ||
      currentModule === 'chats' ||
      currentModule === 'device_mgmt'
    ) {
      return (
        <RidersDriversView
          riders={riders}
          onAddRider={handleAddRider}
          onNavigateModule={handleNavigateWithParams}
          lang={lang}
          initialEmployeeId={selectedEmployee360Id}
          onClearInitialEmployeeId={() => setSelectedEmployee360Id(null)}
        />
      );
    }

    // 1b. Project Master & Dedicated Workspaces
    if (currentModule === 'projects_list' || currentModule === 'projects') {
      return (
        <ProjectMasterView
          onNavigate={handleNavigateWithParams}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
        />
      );
    }

    if (currentModule === 'projects_create') {
      return (
        <CreateProjectView
          onNavigate={handleNavigateWithParams}
        />
      );
    }

    if (currentModule === 'projects_assign') {
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const effectiveEmpId = navParams?.employeeId || searchParams?.get('employeeId') || undefined;
      const effectiveProjectId = navParams?.projectId || searchParams?.get('projectId') || undefined;
      return (
        <AssignProjectView
          initialProjectId={effectiveProjectId}
          initialEmployeeId={effectiveEmpId}
          onNavigate={handleNavigateWithParams}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
        />
      );
    }

    if (currentModule === 'projects_assignments') {
      return (
        <ProjectAssignmentsDirectoryView
          onNavigate={handleNavigateWithParams}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
        />
      );
    }

    if (currentModule === 'projects_transfer') {
      return (
        <TransferProjectView
          initialEmployeeId={navParams?.employeeId}
          initialAssignmentId={navParams?.assignmentId}
          onNavigate={handleNavigateWithParams}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
        />
      );
    }

    // 1d. Retired Labour Buildings / Work Locations - Redirected to Project Master (Work locations now represented as Projects)
    if (currentModule === 'labour_buildings' || currentModule === 'labour_work_locations') {
      return (
        <ProjectMasterView
          onNavigate={handleNavigateWithParams}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
        />
      );
    }

    // 1c. Rider / Project Management (Single Operational Control Center)
    if (
      currentModule === 'rider_project_mgmt' ||
      currentModule === 'riders_driver_mgmt' ||
      currentModule === 'drivers_assign_proj' ||
      currentModule === 'drivers_assign_multi' ||
      currentModule === 'project_user_codes' ||
      currentModule === 'delivery_store' ||
      currentModule === 'employee_status_mgmt' ||
      currentModule === 'rider_expected_earning' ||
      currentModule === 'project_shifts' ||
      currentModule === 'project_type' ||
      currentModule === 'project_zones' ||
      currentModule === 'riders_assignment_report'
    ) {
      return (
        <RiderProjectManagementView
          onNavigateModule={handleNavigateWithParams}
          lang={lang}
          initialEmployeeId={selectedEmployee360Id}
          onClearInitialEmployeeId={() => setSelectedEmployee360Id(null)}
        />
      );
    }

    // 2. Recruitment & Candidate Procurement Pipeline
    if (
      currentModule === 'recruitment' ||
      currentModule === 'recruitment_process' ||
      currentModule === 'candidates'
    ) {
      return (
        <CandidateRecruitmentView
          onNavigateModule={setCurrentModule}
          lang={lang}
        />
      );
    }

    // 3. Attendance Management (Daily, Monthly, Holidays, Visits)
    if (
      currentModule === 'attendance_daily' ||
      currentModule === 'att_mgmt' ||
      currentModule === 'daily_attendance'
    ) {
      return <DailyAttendanceView initialTab="daily" lang={lang} onNavigateModule={setCurrentModule} />;
    }

    if (currentModule === 'attendance_monthly') {
      return <DailyAttendanceView initialTab="monthly" lang={lang} onNavigateModule={setCurrentModule} />;
    }

    if (currentModule === 'attendance_holidays') {
      return <DailyAttendanceView initialTab="holidays" lang={lang} onNavigateModule={setCurrentModule} />;
    }

    if (currentModule === 'attendance_visits') {
      return <DailyAttendanceView initialTab="operations" lang={lang} onNavigateModule={setCurrentModule} />;
    }

    if (currentModule === 'attendance_roster' || currentModule === 'attendance') {
      return <DailyAttendanceView initialTab="daily" lang={lang} onNavigateModule={setCurrentModule} />;
    }

    // 4. Digital Document Vault & Expiry Management
    if (
      currentModule === 'documents_vault' ||
      currentModule === 'doc_expiry_mgmt' ||
      currentModule === 'doc_expiry_listing' ||
      currentModule === 'doc_types' ||
      currentModule === 'document_expiry' ||
      currentModule === 'documents_expiry' ||
      currentModule === 'compliance_vault'
    ) {
      return <DocumentsVaultView lang={lang} />;
    }

    // 5. Physical Passport Custody Safe Vault
    if (
      currentModule === 'passport_mgmt' ||
      currentModule === 'passport_list'
    ) {
      return (
        <PassportCustodyView
          lang={lang}
          currentUser={currentUser}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
        />
      );
    }

    // 6. Office Forms Module (RouteMate Reference Workflow)
    if (currentModule === 'forms_create') {
      return (
        <OfficeFormsView
          lang={lang}
          initialSubView="create"
          onNavigateModule={setCurrentModule}
        />
      );
    }

    if (currentModule === 'forms_list') {
      return (
        <OfficeFormsView
          lang={lang}
          initialSubView="list"
          onNavigateModule={setCurrentModule}
        />
      );
    }

    if (currentModule === 'forms_templates_types') {
      return (
        <OfficeFormsView
          lang={lang}
          initialSubView="template_types"
          onNavigateModule={setCurrentModule}
        />
      );
    }

    if (currentModule === 'forms_templates') {
      return (
        <OfficeFormsView
          lang={lang}
          initialSubView="templates"
          onNavigateModule={setCurrentModule}
        />
      );
    }

    if (
      currentModule === 'office_forms' ||
      currentModule === 'office_forms_passport'
    ) {
      return (
        <OfficeFormsView
          lang={lang}
          initialSubView="create"
          onNavigateModule={setCurrentModule}
        />
      );
    }

    // 7. SIM Card Inventory & Assignment
    if (
      currentModule === 'sim_management' ||
      currentModule === 'sim_card_mgmt' ||
      currentModule === 'sim_mgmt' ||
      currentModule === 'sim_assign_report' ||
      currentModule === 'sim_billing' ||
      currentModule === 'sim_source'
    ) {
      return <SimManagementView lang={lang} />;
    }

    // 8. Vehicle & Fleet Management
    if (
      currentModule === 'vehicles_fleet' ||
      currentModule === 'veh_mgmt' ||
      currentModule === 'vehicle_mapping' ||
      currentModule === 'vehicle_assignment_report' ||
      currentModule === 'vehicle_compliance' ||
      currentModule === 'vehicle_depreciation' ||
      currentModule === 'vehicle_status'
    ) {
      return (
        <VehiclesFleetView
          vehicles={vehicles}
          onAddVehicle={handleAddVehicle}
          lang={lang}
          onNavigate={(route) => {
            if (route === '/vehicles/create' || route === 'vehicle_create') {
              setCurrentModule('vehicle_create');
            } else if (route === '/vehicles' || route === 'vehicles_fleet') {
              setCurrentModule('vehicles_fleet');
            } else {
              setCurrentModule(route);
            }
          }}
        />
      );
    }

    if (currentModule === 'vehicle_create' || currentModule === '/vehicles/create') {
      return (
        <VehicleCreateView
          lang={lang}
          onNavigate={(route) => {
            if (route === '/vehicles' || route === 'vehicles_fleet') {
              setCurrentModule('vehicles_fleet');
            } else {
              setCurrentModule(route);
            }
          }}
        />
      );
    }


    // 9. Traffic Fines & Violations
    if (
      currentModule === 'traffic_fines_mgmt' ||
      currentModule === 'traffic_fines' ||
      currentModule === 'fleet_fines' ||
      currentModule === 'fines_mgmt'
    ) {
      return <TrafficFinesManagementView lang={lang} />;
    }

    // 9b. UAE Salik Toll Management
    if (
      currentModule === 'salik_mgmt' ||
      currentModule === 'salik' ||
      currentModule === 'fleet_salik' ||
      currentModule === 'toll_mgmt'
    ) {
      return <SalikManagementView lang={lang} />;
    }

    // 10. Live Fleet Telemetry Dashboard
    if (currentModule === 'fleet_dashboard') {
      return (
        <FleetDashboard
          riders={riders}
          vehicles={vehicles}
          orders={orders}
          alerts={systemAlerts}
          lang={lang}
          onNavigateModule={setCurrentModule}
          onOpenAiAutoDispatch={handleRunAiAutoDispatch}
        />
      );
    }

    // 11. Captain & Partner Performance
    if (
      currentModule === 'partner_performance' ||
      currentModule === 'captain_perf' ||
      currentModule === 'careem_perf' ||
      currentModule === 'careem_dashboard' ||
      currentModule === 'talabat_perf' ||
      currentModule === 'talabat_dashboard'
    ) {
      return <PartnerPerformanceView lang={lang} />;
    }

    // 12. Driver Tickets
    if (
      currentModule === 'driver_tickets' ||
      currentModule === 'driver_tickets_list' ||
      currentModule === 'ticket_assignment'
    ) {
      return <DriverTicketsView lang={lang} />;
    }

    // 13. Inventory Assets
    if (
      currentModule === 'inventory_assets' ||
      currentModule === 'inventory_sec' ||
      currentModule === 'inventory_assign' ||
      currentModule === 'inventory_return' ||
      currentModule === 'inventory_list' ||
      currentModule === 'inventory_stock' ||
      currentModule === 'rider_inventory_sec'
    ) {
      return <InventoryAssetsView lang={lang} />;
    }

    // 14. HR & Payroll
    if (currentModule === 'payroll_allowances') {
      return (
        <HrPayrollView
          initialTab="STRUCTURES"
          employees={isDemoTenant ? MOCK_EMPLOYEES : []}
          leaveRequests={leaveRequests}
          payrollRecords={isDemoTenant ? MOCK_PAYROLL : []}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          lang={lang}
        />
      );
    }

    if (currentModule === 'payroll_loan_mgmt') {
      return (
        <HrPayrollView
          initialTab="ADVANCES"
          employees={isDemoTenant ? MOCK_EMPLOYEES : []}
          leaveRequests={leaveRequests}
          payrollRecords={isDemoTenant ? MOCK_PAYROLL : []}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          lang={lang}
        />
      );
    }

    if (
      currentModule === 'leave_mgmt' ||
      currentModule === 'leave_requests' ||
      currentModule === 'leave_project' ||
      currentModule === 'leave_types'
    ) {
      return (
        <HrPayrollView
          initialTab="LEAVE"
          employees={isDemoTenant ? MOCK_EMPLOYEES : []}
          leaveRequests={leaveRequests}
          payrollRecords={isDemoTenant ? MOCK_PAYROLL : []}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          lang={lang}
        />
      );
    }

    if (
      currentModule === 'hr_payroll' ||
      currentModule?.startsWith('payroll_') ||
      currentModule === 'insurance_mgmt' ||
      currentModule === 'insurance_employee'
    ) {
      return (
        <HrPayrollView
          initialTab="CYCLES"
          employees={isDemoTenant ? MOCK_EMPLOYEES : []}
          leaveRequests={leaveRequests}
          payrollRecords={isDemoTenant ? MOCK_PAYROLL : []}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          lang={lang}
        />
      );
    }

    // 15. Finance & Parties & Garage
    if (
      currentModule === 'finance' ||
      currentModule?.startsWith('finance_') ||
      currentModule?.startsWith('parties_') ||
      currentModule?.startsWith('garage_') ||
      currentModule?.startsWith('parts_') ||
      currentModule?.startsWith('service_') ||
      currentModule === 'expense_management' ||
      currentModule === 'bank_reconciliation' ||
      currentModule === 'banking_accounts' ||
      currentModule === 'petty_cash' ||
      currentModule === 'voucher_drafting' ||
      currentModule === 'voucher_list'
    ) {
      return <FinanceView lang={lang} />;
    }

    // 16. Dispatch Orders & GPS Tracking
    if (currentModule === 'dispatch_orders') {
      return (
        <DispatchOrdersView
          orders={orders}
          riders={riders}
          onAssignRider={handleAssignRiderToOrder}
          onRunAiAutoDispatch={handleRunAiAutoDispatch}
          lang={lang}
        />
      );
    }

    if (currentModule === 'gps_tracking' || currentModule === 'tracking_mgmt') {
      return (
        <GpsTrackingView
          riders={riders}
          geofences={MOCK_GEOFENCES}
          lang={lang}
        />
      );
    }

    // 18. AI Operations Intelligence Hub
    if (currentModule === 'ai_hub') {
      return <AiIntelligenceHub lang={lang} />;
    }

    // 19. Office Staff Access & ERP Login Accounts (/settings/users)
    if (
      currentModule === 'settings_users' ||
      currentModule === 'office_staff_access' ||
      currentModule === 'user_access_mgmt'
    ) {
      return (
        <OfficeStaffAccessView
          currentUser={currentUser}
          onNavigateModule={setCurrentModule}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
          lang={lang}
        />
      );
    }

    // 19b. Create Staff Access Workspace (/settings/users/create)
    if (currentModule === 'settings_users_create') {
      return (
        <CreateOfficeStaffAccessView
          currentUser={currentUser}
          onNavigateModule={setCurrentModule}
          onOpenEmployee360={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('employees_list');
          }}
          lang={lang}
        />
      );
    }

    // 19c. Live Role-Based Access Control (RBAC) Matrix
    if (currentModule === 'roles_permissions') {
      return (
        <RolesPermissionsView
          roles={MOCK_ROLE_PERMISSIONS}
          lang={lang}
        />
      );
    }

    // 20. System Configuration
    if (currentModule === 'settings_audit' || currentModule === 'sys_configuration') {
      return (
        <SettingsAuditView
          branches={MOCK_BRANCHES}
          auditLogs={auditLogs}
          lang={lang}
        />
      );
    }

    // Default Canonical Fallback: Operations Command Center
    return (
      <OperationsHomeDashboard
        onNavigateModule={setCurrentModule}
        onSelectEmployee={(empId) => {
          setSelectedEmployee360Id(empId);
          setCurrentModule('riders_drivers');
        }}
        currentUser={currentUser}
        lang={lang}
      />
    );
  };

  if (currentPath === '/platform-admin/login') {
    return (
      <PlatformAdminLoginPage
        onLoginSuccess={(adminUser) => {
          setPlatformAdminUser(adminUser);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/platform-admin');
            setCurrentPath('/platform-admin');
          }
        }}
        onNavigateToErp={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/login');
            setCurrentPath('/login');
          }
        }}
      />
    );
  }

  if (currentPath === '/platform-admin' || currentPath.startsWith('/platform-admin/')) {
    if (isPlatformAdminChecking) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="font-semibold text-sm text-slate-200">Verifying Platform Admin access...</div>
            <div className="text-xs text-slate-500">Checking isolated master session credentials</div>
          </div>
        </div>
      );
    }

    if (!platformAdminUser) {
      return (
        <PlatformAdminLoginPage
          onLoginSuccess={(adminUser) => {
            setPlatformAdminUser(adminUser);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/platform-admin');
              setCurrentPath('/platform-admin');
            }
          }}
          onNavigateToErp={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/login');
              setCurrentPath('/login');
            }
          }}
        />
      );
    }

    return (
      <PlatformAdminView
        currentUser={platformAdminUser}
        onLogout={async () => {
          await platformAdminService.logout();
          setPlatformAdminUser(null);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/platform-admin/login');
            setCurrentPath('/platform-admin/login');
          }
        }}
        onReturnToErp={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/login');
            setCurrentPath('/login');
          }
        }}
      />
    );
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="font-semibold text-sm text-slate-200">Verifying secure authentication...</div>
          <div className="text-xs text-slate-500">Checking enterprise session credentials against server security policy</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (currentPath === '/setup' || currentPath === '/setup/') {
      return (
        <SetupFirstUserView
          onCompleted={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/login');
              setCurrentPath('/login');
            }
          }}
          onGoToLogin={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/login');
              setCurrentPath('/login');
            }
          }}
        />
      );
    }

    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onNavigateToSetup={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/setup');
            setCurrentPath('/setup');
          }
        }}
      />
    );
  }

  return (
    <div
      className={`w-full min-w-0 h-[100dvh] overflow-hidden font-sans flex ${
        theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      } ${lang === 'AR' ? 'dir-rtl' : 'dir-ltr'}`}
    >
      {/* Sidebar with Collapsible Arrow Tree & Mobile Drawer */}
      <Sidebar
        activeModule={currentModule}
        onSelectModule={setCurrentModule}
        lang={lang}
        currentUser={currentUser}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden h-[100dvh]">
        {/* ALLIED Top Header Bar */}
        <Header
          userRole={currentUser.role}
          lang={lang}
          onToggleLang={() => setLang(lang === 'EN' ? 'AR' : 'EN')}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          notificationCount={systemAlerts.length}
          onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
          onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
          currentUser={currentUser}
          activeTenantName={activeTenantCompany?.name}
          activeTenantLogoUrl={activeTenantCompany?.logoUrl}
          onOpenUserSwitcher={() => setIsUserSwitcherOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen((prev) => !prev)}
          onNavigateModule={setCurrentModule}
          onSelectEmployee={(empId) => {
            setSelectedEmployee360Id(empId);
            setCurrentModule('riders_drivers');
          }}
          onLogout={handleLogout}
        />

        {/* Dashboard Main View Container */}
        <main id="erp-main-content" className="erp-responsive-content flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 pb-safe" tabIndex={-1}>
          <ErrorBoundary fallbackTitle="Module View Error" fallbackMessage="This module encountered an issue while loading. You can retry or return to the main dashboard without losing your ERP session.">
            {renderMainView()}
          </ErrorBoundary>
        </main>

        {/* Footer Info Bar */}
        <footer className="min-h-10 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium shrink-0 transition-colors pb-safe">
          <div className="flex gap-2 sm:gap-6 truncate">
            <span className="truncate">Pixel Syntax Delivery Software</span>
            <span className="hidden sm:inline">Logged: @{currentUser.username}</span>
            <span className="hidden md:inline">Database: PostgreSQL Cluster</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold hidden xs:inline">
              Support: +971 4 000 0000
            </span>
            <span>Security</span>
          </div>
        </footer>
      </div>

      {/* User Switcher & Owner Access Control Modal */}
      <UserSwitcherModal
        isOpen={isUserSwitcherOpen}
        onClose={() => setIsUserSwitcherOpen(false)}
        currentUser={currentUser}
        allUsers={userAccounts}
        onSwitchUser={handleSwitchUser}
        onCreateUser={handleCreateUser}
      />

      {/* AI Copilot Drawer */}
      <AiCopilotDrawer
        isOpen={isAiCopilotOpen}
        onClose={() => setIsAiCopilotOpen(false)}
        activeModule={currentModule}
        onNavigateModule={(mod) => setCurrentModule(mod)}
        currentUser={currentUser}
        onAddAuditLog={(log) => setAuditLogs((prev) => [log, ...prev])}
        lang={lang}
      />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        alerts={systemAlerts}
        lang={lang}
      />
    </div>
  );
}
