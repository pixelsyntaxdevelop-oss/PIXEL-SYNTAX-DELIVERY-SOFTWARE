import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Sun,
  Moon,
  Settings,
  Sparkles,
  Search,
  CheckCircle,
  Clock,
  User,
  Menu,
  Truck,
  Smartphone,
  Briefcase,
  Users,
  X,
  ExternalLink,
  ChevronRight,
  Shield,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Building,
} from 'lucide-react';
import { SystemUserAccount, NavigationModule } from '../../types/erp';
import { LanguageMode } from '../../data/translations';
// Header.tsx - Authoritative Tenant Header
import { masterEmployeeService } from '../../services/masterEmployeeService';

import {
  getCachedBranding,
  fetchAuthoritativeTenantContext,
  hasBrandingChanged,
} from '../../utils/brandingCache';

interface HeaderProps {
  userRole?: string;
  lang: LanguageMode;
  onToggleLang: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenAiCopilot?: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  currentUser?: SystemUserAccount;
  activeTenantName?: string;
  activeTenantLogoUrl?: string | null;
  onOpenUserSwitcher?: () => void;
  onToggleMobileSidebar?: () => void;
  onNavigateModule?: (module: NavigationModule) => void;
  onSelectEmployee?: (employeeId: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userRole,
  lang,
  onToggleLang,
  theme = 'light',
  onToggleTheme,
  onOpenAiCopilot,
  onOpenNotifications,
  notificationCount = 3,
  currentUser,
  activeTenantName = 'Pixel Syntax Delivery Software',
  activeTenantLogoUrl,
  onOpenUserSwitcher,
  onToggleMobileSidebar,
  onNavigateModule,
  onSelectEmployee,
  onLogout,
}) => {
  const isDark = theme === 'dark';
  const [seconds, setSeconds] = useState(74);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    employees: Array<{ id: string; title: string; subtitle: string; status: string; badge: string; plate?: string; phone?: string }>;
    vehicles: Array<{ id: string; title: string; subtitle: string; status: string; badge: string }>;
    sims: Array<{ id: string; title: string; subtitle: string; status: string; badge: string }>;
    projects: Array<{ id: string; title: string; subtitle: string; status: string; badge: string }>;
  }>({ employees: [], vehicles: [], sims: [], projects: [] });
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Account Menu Popover State
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [logoImageError, setLogoImageError] = useState(false);

  // Authoritative custom tenant logo state
  const isDemoOrMockLogo = (url?: string | null) => {
    if (!url) return true;
    if (url.includes('images.unsplash.com') || url.includes('photo-1586528116311-ad8dd3c8310d')) return true;
    return false;
  };

  const tenantId = currentUser?.tenantId || 'company_pixel_syntax';
  const cachedInitial = getCachedBranding(tenantId);

  const [isBrandingLoading, setIsBrandingLoading] = useState<boolean>(false);

  const [headerLogoUrl, setHeaderLogoUrl] = useState<string | null>(() => {
    if (activeTenantLogoUrl && !isDemoOrMockLogo(activeTenantLogoUrl)) {
      return activeTenantLogoUrl;
    }
    const candidate = cachedInitial.headerLogoUrl || cachedInitial.mainLogoUrl;
    return candidate && !isDemoOrMockLogo(candidate) ? candidate : null;
  });

  // Sync when prop changes
  useEffect(() => {
    setLogoImageError(false);
    if (!isDemoOrMockLogo(activeTenantLogoUrl)) {
      setHeaderLogoUrl(activeTenantLogoUrl || null);
    } else {
      const c = getCachedBranding(currentUser?.tenantId || 'company_pixel_syntax');
      const candidate = c.headerLogoUrl || c.mainLogoUrl;
      setHeaderLogoUrl(candidate && !isDemoOrMockLogo(candidate) ? candidate : null);
    }
  }, [activeTenantLogoUrl, currentUser?.tenantId]);

  // Check if current context is Allied Delivery (by tenantId, hostname, or tenant name)
  const isAlliedContext =
    !currentUser?.tenantId ||
    currentUser.tenantId === 'company_pixel_syntax' ||
    currentUser.tenantId === 'GLOBAL_SUPER_ADMIN' ||
    !activeTenantName ||
    activeTenantName.toLowerCase().includes('allied') ||
    activeTenantName === 'Operations Portal' ||
    (typeof window !== 'undefined' && (
      window.location.hostname.includes('allied') ||
      window.location.hostname === 'deliverysoftwarepixel.site' ||
      !window.location.hostname ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('run.app') ||
      window.location.hostname.includes('webcontainer')
    ));

  // Fetch authoritative tenant branding directly to guarantee synchronization with Platform Admin (deduplicated)
  useEffect(() => {
    let isMounted = true;
    const fetchAuthoritativeBranding = async () => {
      try {
        const tenantIdToFetch = currentUser?.tenantId || 'company_pixel_syntax';
        const data = await fetchAuthoritativeTenantContext(tenantIdToFetch);
        if (data && isMounted) {
          // Use authoritative Main Company Logo or Header Logo, NEVER login hero artwork
          const candidate = data.headerLogoUrl || data.logoUrl;
          if (candidate && !isDemoOrMockLogo(candidate)) {
            // Preload before updating state to eliminate any image flash or layout jump
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            img.onload = () => {
              if (isMounted) {
                setHeaderLogoUrl(candidate);
                setLogoImageError(false);
              }
            };
            img.src = candidate;
          } else if (candidate === null || candidate === '') {
            setHeaderLogoUrl(null);
          }
        }
      } catch {
      }
    };

    fetchAuthoritativeBranding();

    // Listen to real-time branding updates from Platform Admin
    const handleBrandingUpdated = (e: any) => {
      const b = e?.detail;
      if (b) {
        const candidate = b.headerLogoUrl || b.logoUrl;
        if (candidate && !isDemoOrMockLogo(candidate)) {
          const img = new Image();
          img.referrerPolicy = 'no-referrer';
          img.onload = () => {
            if (isMounted) {
              setHeaderLogoUrl(candidate);
              setLogoImageError(false);
            }
          };
          img.src = candidate;
        } else if (candidate === null || candidate === '') {
          setHeaderLogoUrl(null);
        }
      }
    };

    window.addEventListener('tenant_branding_updated', handleBrandingUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('tenant_branding_updated', handleBrandingUpdated);
    };
  }, [currentUser?.tenantId]);

  // Live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 90));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Search query with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ employees: [], vehicles: [], sims: [], projects: [] });
      setSearching(false);
      return;
    }

    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const res = await masterEmployeeService.globalSearch(searchQuery);
        setSearchResults(res);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalResults =
    searchResults.employees.length +
    searchResults.vehicles.length +
    searchResults.sims.length +
    searchResults.projects.length;

  return (
    <header className="h-14 sm:h-16 min-w-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 px-2 sm:px-6 shrink-0 sticky top-0 z-30 shadow-xs">
      {/* Mobile Expandable Search Bar Overlay */}
      {isMobileSearchExpanded && (
        <div className="absolute inset-0 bg-white dark:bg-slate-900 z-50 flex items-center min-w-0 px-2 sm:px-3 gap-1.5 sm:gap-2 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-blue-600 shrink-0" />
          <input
            type="text"
            autoFocus
            aria-label="Search riders, vehicles, SIMs and projects"
            placeholder="Search rider, bike, SIM, project..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            className="flex-1 min-w-0 w-full py-2 bg-transparent text-slate-900 dark:text-slate-100 text-base sm:text-sm border-none focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-2 shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              setIsMobileSearchExpanded(false);
              setIsSearchOpen(false);
            }}
            className="px-2 py-2 min-h-[40px] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Left: Mobile Toggle & ALLIED Brand Logo */}
      <div className="flex items-center gap-1 sm:gap-4 min-w-0 shrink">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 lg:hidden text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-hidden min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {headerLogoUrl && !logoImageError ? (
          <div className="flex items-center select-none min-w-0 max-w-[96px] sm:max-w-none" id="header-tenant-logo-container">
            <img
              src="/pixel-syntax-logo.webp"
              alt=""
              aria-label={activeTenantName || 'Pixel Syntax Delivery Software'}
              referrerPolicy="no-referrer"
              onError={() => setLogoImageError(true)}
              className="max-h-[34px] sm:max-h-[42px] w-auto max-w-full object-contain object-center transition-all drop-shadow-xs"
              style={{
                maxHeight: '42px',
                width: 'auto',
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          </div>
        ) : isAlliedContext ? (
          /* Authoritative Allied Company Logo mark on first paint */
          <div className="flex items-center select-none min-w-0 max-w-[96px] sm:max-w-none" id="authoritative-allied-header-logo">
            <img
              src="/pixel-syntax-logo.webp"
              alt="Pixel Syntax Delivery Software"
              className="max-h-[42px] w-auto max-w-full object-contain object-center transition-all drop-shadow-xs"
              style={{
                maxHeight: '42px',
                width: 'auto',
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 select-none">
            <div className="h-8 w-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black text-sm shadow-xs">
              {(activeTenantName || 'T')[0]}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-extrabold text-slate-900 dark:text-white text-xs tracking-tight leading-none uppercase">
                {activeTenantName || 'Operations Portal'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">Operations Portal</span>
            </div>
          </div>
        )}
      </div>

      {/* Center: Global Instant Search Bar (Desktop) */}
      <div ref={searchRef} className="relative flex-1 max-w-md mx-2 sm:mx-6 hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Quick search rider, plate number, SIM, project..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-xl text-xs border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Results Popover (Desktop & Mobile) */}
      {isSearchOpen && searchQuery.trim().length > 0 && (
        <div className="fixed md:absolute top-16 left-2 right-2 md:left-auto md:right-auto md:w-full md:max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[75vh] overflow-y-auto z-50 text-xs">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Search Results for "{searchQuery}"</span>
            {searching ? (
              <span className="text-blue-600 animate-pulse">Searching...</span>
            ) : (
              <span>{totalResults} items found</span>
            )}
          </div>

          {totalResults === 0 && !searching && (
            <div className="p-6 text-center text-slate-400">
              <p>No matching records found.</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Try searching by Rider Name, Emirates ID, Bike Plate, or Mobile Number.
              </p>
            </div>
          )}

          {/* 1. EMPLOYEES */}
          {searchResults.employees.length > 0 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Riders & Employees ({searchResults.employees.length})</span>
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setIsMobileSearchExpanded(false);
                      setSearchQuery('');
                      if (onSelectEmployee) {
                        onSelectEmployee(emp.id);
                      } else if (onNavigateModule) {
                        onNavigateModule('riders_drivers');
                      }
                    }}
                    className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{emp.title}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                            emp.status === 'Active' || emp.status === 'Assigned'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{emp.subtitle}</span>
                        {emp.plate && (
                          <span className="font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 rounded-xs">
                            🏍️ {emp.plate}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. VEHICLES */}
          {searchResults.vehicles.length > 0 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                <span>Fleet Vehicles ({searchResults.vehicles.length})</span>
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setIsMobileSearchExpanded(false);
                      setSearchQuery('');
                      if (onNavigateModule) onNavigateModule('riders_drivers');
                    }}
                    className="w-full text-left p-2 hover:bg-amber-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{v.title}</span>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded-full">
                          {v.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{v.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. SIM CARDS */}
          {searchResults.sims.length > 0 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>SIM Cards ({searchResults.sims.length})</span>
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.sims.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setIsMobileSearchExpanded(false);
                      setSearchQuery('');
                      if (onNavigateModule) onNavigateModule('sim_management');
                    }}
                    className="w-full text-left p-2 hover:bg-sky-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{s.title}</span>
                        <span className="text-[9px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.2 rounded-full">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. PROJECTS */}
          {searchResults.projects.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Projects ({searchResults.projects.length})</span>
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setIsMobileSearchExpanded(false);
                      setSearchQuery('');
                      if (onNavigateModule) onNavigateModule('drivers_assign_proj');
                    }}
                    className="w-full text-left p-2 hover:bg-indigo-50 dark:hover:bg-slate-800/80 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{p.title}</span>
                        <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded-full">
                          {p.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{p.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right: Tenant Company & Status Badges, Icons & User Profile */}
      <div className="flex items-center gap-0 sm:gap-2.5 shrink-0>
        {/* Mobile Search Icon Toggle */}
        <button
          onClick={() => {
            setIsMobileSearchExpanded(true);
            setIsSearchOpen(true);
          }}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          title="Search Records"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* TENANT WORKSPACE BADGE */}
        <button
          onClick={onOpenUserSwitcher}
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
          title="Click to Switch Multi-Tenant Workspace or User Account"
        >
          <Building className="w-3.5 h-3.5 text-slate-500" />
          <span className="truncate max-w-[180px] font-mono text-[11px]">{activeTenantName}</span>
        </button>

        {/* System Edition Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Enterprise</span>
          <span className="text-slate-400">•</span>
          <span className="text-[10px] text-slate-500">RouteMate</span>
        </div>

        {/* AI Copilot Button */}
        {onOpenAiCopilot && (
          <button
            onClick={onOpenAiCopilot}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </button>
        )}

        {/* Theme Toggle (Sun/Moon) */}
        <button
          onClick={onToggleTheme}
          className="hidden sm:flex p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Sun className="w-4.5 h-4.5 text-amber-500" />}
        </button>

        {/* Notifications Icon with Badge */}
        <button
          onClick={onOpenNotifications}
          className="relative p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Notifications"
        >
          <Bell className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">
            {notificationCount}
          </span>
        </button>

        {/* Settings Gear */}
        <button
          onClick={() => onNavigateModule?.("sys_configuration")}
          className="hidden md:flex p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="System Configuration"
        >
          <Settings className="w-4.5 h-4.5 text-slate-500" />
        </button>

        {/* User Profile Avatar & Account Menu Popover */}
        <div ref={accountMenuRef} className="relative">
          <button
            onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
            className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-lg transition-all group"
            title="Account Profile & ERP Access"
          >
            <div
              className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                currentUser?.isOwner ? 'bg-purple-600 ring-2 ring-purple-400' : 'bg-slate-800'
              }`}
            >
              {currentUser ? currentUser.fullName.charAt(0) : <User className="w-4 h-4" />}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-blue-600 transition-colors flex items-center gap-1">
                <span>{currentUser?.fullName || 'Authorized Staff'}</span>
                {currentUser?.isOwner && <span className="text-[10px]">👑</span>}
              </span>
              <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                {currentUser ? (currentUser.isOwner ? 'Main System Owner' : currentUser.role) : 'SUPER ADMIN'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
          </button>

          {/* Account Dropdown Menu */}
          {isAccountMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1rem))] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95">
              {/* Authenticated Staff Header */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                      currentUser?.isOwner ? 'bg-purple-600' : 'bg-slate-800'
                    }`}
                  >
                    {currentUser ? currentUser.fullName.charAt(0) : <User className="w-4 h-4" />}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {currentUser?.fullName}
                    </div>
                    <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                      @{currentUser?.username || 'user'}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-900">
                    {currentUser?.isOwner ? 'Main System Owner' : currentUser?.role || 'SUPER_ADMIN'}
                  </span>
                  <span className="text-slate-500 truncate max-w-[120px]">
                    {activeTenantName}
                  </span>
                </div>
              </div>

              {/* Mobile controls remain accessible in the account menu. */}
              <div className="sm:hidden space-y-1">
                {onToggleTheme && (
                  <button type="button" onClick={() => { setIsAccountMenuOpen(false); onToggleTheme(); }}
                    className="w-full min-h-11 text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5">
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span>{isDark ? 'Light appearance' : 'Dark appearance'}</span>
                  </button>
                )}
                {onOpenAiCopilot && (
                  <button type="button" onClick={() => { setIsAccountMenuOpen(false); onOpenAiCopilot(); }}
                    className="w-full min-h-11 text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span>AI Assistant</span>
                  </button>
                )}
              </div>

              {/* Navigation Links */}
              <div className="space-y-1">
                {onOpenUserSwitcher && (
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenUserSwitcher();
                    }}
                    className="xl:hidden w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2.5"
                  >
                    <Building className="w-4 h-4 text-slate-500" />
                    <span className="truncate">Switch Tenant: {activeTenantName}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    if (onNavigateModule) onNavigateModule('settings_users');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Office Staff Access &amp; RBAC</span>
                </button>

                <button
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    if (onNavigateModule) onNavigateModule('roles_permissions');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Role &amp; Permissions Master</span>
                </button>
              </div>

              {/* QA Switcher (Available for developer QA testing on demo tenant) */}
              {onOpenUserSwitcher && (
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenUserSwitcher();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Switch Test Staff (QA Mode)</span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              )}

              {/* Secure Sign Out */}
              {onLogout && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-2.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out &amp; Invalidate Session</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
