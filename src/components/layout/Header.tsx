import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sun, Moon, User, Menu, LogOut, ChevronDown } from 'lucide-react';
import { SystemUserAccount, NavigationModule } from '../../types/erp';
import { LanguageMode } from '../../data/translations';

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


export const Header: React.FC<HeaderProps> = ({ theme = 'light', onToggleTheme, onOpenNotifications, notificationCount = 0, currentUser, onToggleMobileSidebar, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const control = 'p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-5 shrink-0 sticky top-0 z-30">
      <div>{onToggleMobileSidebar && <button type="button" onClick={onToggleMobileSidebar} aria-label="Open navigation" className={control + ' lg:hidden'}><Menu className="w-5 h-5"/></button>}</div>
      <div className="flex items-center gap-2">
        {onToggleTheme && <button type="button" onClick={onToggleTheme} aria-label="Toggle theme" className={control}>{theme === 'dark' ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>}
        {onOpenNotifications && <button type="button" onClick={onOpenNotifications} aria-label="Notifications" className={control + ' relative'}><Bell className="w-5 h-5"/>{notificationCount > 0 && <span className="absolute top-0 right-0 rounded-full bg-blue-600 text-white text-[10px] px-1">{notificationCount}</span>}</button>}
        <div ref={ref} className="relative">
          <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
            <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">{currentUser?.fullName?.charAt(0) || <User className="w-4 h-4"/>}</span>
            <span className="hidden sm:block text-sm font-medium text-slate-800 dark:text-slate-100">{currentUser?.fullName || 'Account'}</span><ChevronDown className="w-4 h-4 text-slate-400"/>
          </button>
          {open && <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2">
            <div className="px-3 py-2 text-xs text-slate-500">{currentUser?.role}</div>
            {onLogout && <button type="button" onClick={() => { setOpen(false); onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg"><LogOut className="w-4 h-4"/>Sign out</button>}
          </div>}
        </div>
      </div>
    </header>
  );
};
