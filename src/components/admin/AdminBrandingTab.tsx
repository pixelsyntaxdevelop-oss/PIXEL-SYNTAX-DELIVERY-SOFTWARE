import React, { useState, useEffect } from 'react';
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Save,
  Trash2,
  Lock,
  Sparkles,
  HelpCircle,
  Mail,
  Phone,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { platformAdminService, TenantBranding } from '../../services/platformAdminService';
import { LoginBrandPanel } from '../common/LoginBrandPanel';
import { setCachedBranding, preloadImage } from '../../utils/brandingCache';

interface AdminBrandingTabProps {
  tenantId: string;
  isLiveProtected: boolean;
  onBrandingUpdated?: () => void;
}

export const AdminBrandingTab: React.FC<AdminBrandingTabProps> = ({
  tenantId,
  isLiveProtected,
  onBrandingUpdated,
}) => {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [portalTitle, setPortalTitle] = useState('');
  const [loginTagline, setLoginTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loginHeroUrl, setLoginHeroUrl] = useState('');
  const [loginBgUrl, setLoginBgUrl] = useState('');
  const [sidebarLogoUrl, setSidebarLogoUrl] = useState('');
  const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#059669');
  const [secondaryColor, setSecondaryColor] = useState('#2563eb');
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');

  // Demo Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetPreviewData, setResetPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchBranding = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await platformAdminService.getTenantBranding(tenantId);
      if (data) {
        setBranding(data);
        setCompanyName(data.companyName || '');
        setPortalTitle(data.portalTitle || '');
        setLoginTagline(data.loginTagline || '');
        setLogoUrl(data.logoUrl || '');
        setLoginHeroUrl(data.loginHeroUrl || '');
        setLoginBgUrl(data.loginBgUrl || '');
        setSidebarLogoUrl(data.sidebarLogoUrl || '');
        setHeaderLogoUrl(data.headerLogoUrl || '');
        setFaviconUrl(data.faviconUrl || '');
        setSupportEmail(data.supportEmail || '');
        setSupportPhone(data.supportPhone || '');
        setPrimaryColor(data.primaryColor || '#059669');
        setSecondaryColor(data.secondaryColor || '#2563eb');
        setTurnstileEnabled(Boolean(data.turnstileEnabled));
        setTurnstileSiteKey(data.turnstileSiteKey || '');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to fetch tenant branding profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, [tenantId]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await platformAdminService.updateTenantBranding(tenantId, {
        companyName,
        portalTitle,
        loginTagline,
        logoUrl: logoUrl || null,
        loginHeroUrl: loginHeroUrl || null,
        loginBgUrl: loginBgUrl || null,
        sidebarLogoUrl: sidebarLogoUrl || null,
        headerLogoUrl: headerLogoUrl || null,
        faviconUrl: faviconUrl || null,
        supportEmail,
        supportPhone,
        primaryColor,
        secondaryColor,
        turnstileEnabled,
        turnstileSiteKey,
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Tenant branding updated successfully.' });
        if (res.branding) {
          setBranding(res.branding);
          setCachedBranding(tenantId, {
            mainLogoUrl: res.branding.logoUrl || logoUrl,
            loginHeroUrl: res.branding.loginHeroUrl || loginHeroUrl,
            companyName: res.branding.companyName || companyName,
            portalSubtitle: res.branding.portalTitle || portalTitle,
            loginTagline: res.branding.loginTagline || loginTagline,
          });
          if (res.branding.loginHeroUrl || loginHeroUrl) preloadImage(res.branding.loginHeroUrl || loginHeroUrl);
          if (res.branding.logoUrl || logoUrl) preloadImage(res.branding.logoUrl || logoUrl);
        } else {
          setCachedBranding(tenantId, {
            mainLogoUrl: logoUrl,
            loginHeroUrl: loginHeroUrl,
            companyName: companyName,
            portalSubtitle: portalTitle,
            loginTagline: loginTagline,
          });
          if (loginHeroUrl) preloadImage(loginHeroUrl);
          if (logoUrl) preloadImage(logoUrl);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tenant_branding_updated', { detail: res.branding || {
            companyName,
            portalTitle,
            loginTagline,
            logoUrl,
            loginHeroUrl,
            loginBgUrl,
            sidebarLogoUrl,
            headerLogoUrl,
            faviconUrl,
          } }));
        }
        if (onBrandingUpdated) onBrandingUpdated();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update branding.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving branding settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (assetType: 'logo' | 'hero' | 'bg' | 'sidebar' | 'header' | 'favicon') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp';
    input.onchange = async (event: any) => {
      const file = event.target?.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setMessage({
          type: 'error',
          text: 'INVALID_FILE_TYPE: Only PNG, JPEG, and WEBP image files are allowed.',
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage({
          type: 'error',
          text: 'FILE_TOO_LARGE: Image file size exceeds maximum limit of 5MB.',
        });
        return;
      }

      setMessage(null);

      try {
        setUploadingAsset(assetType);
        const res = await platformAdminService.uploadBrandingAsset(
          tenantId,
          assetType,
          file
        );

        if (res.success && res.assetUrl) {
          if (assetType === 'logo') {
            setLogoUrl(res.assetUrl);
            setHeaderLogoUrl(res.assetUrl);
            setSidebarLogoUrl(res.assetUrl);
          } else if (assetType === 'hero') {
            setLoginHeroUrl(res.assetUrl);
          } else if (assetType === 'bg') {
            setLoginBgUrl(res.assetUrl);
          } else if (assetType === 'sidebar') {
            setSidebarLogoUrl(res.assetUrl);
          } else if (assetType === 'header') {
            setHeaderLogoUrl(res.assetUrl);
          } else if (assetType === 'favicon') {
            setFaviconUrl(res.assetUrl);
          }

          setMessage({
            type: 'success',
            text: `${assetType.toUpperCase()} image uploaded and applied successfully. Click "Save Branding Changes" to persist.`,
          });
        } else {
          const specificError = res.code || res.error || 'UPLOAD_FAILED';
          setMessage({ type: 'error', text: `${specificError}: ${res.error || 'Failed to upload asset.'}` });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Error processing image upload.' });
      } finally {
        setUploadingAsset(null);
      }
    };
    input.click();
  };

  const handleOpenResetModal = async () => {
    if (tenantId === 'company_pixel_syntax') {
      setMessage({ type: 'error', text: 'CRITICAL: Resetting production tenant "company_pixel_syntax" is strictly forbidden.' });
      return;
    }
    setShowResetModal(true);
    setLoadingPreview(true);
    try {
      const res = await platformAdminService.getDemoResetPreview(tenantId);
      if (res.success && res.data) {
        setResetPreviewData(res.data);
      }
    } catch (e: any) {
      console.error('Failed to load demo reset preview:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleResetDemoData = async () => {
    if (tenantId === 'company_pixel_syntax') {
      setMessage({ type: 'error', text: 'CRITICAL: Resetting production tenant "company_pixel_syntax" is strictly forbidden.' });
      setShowResetModal(false);
      return;
    }

    if (resetPhrase !== 'RESET DEMO') {
      setMessage({ type: 'error', text: 'Please type "RESET DEMO" exactly to confirm reset.' });
      return;
    }

    setResetting(true);
    try {
      const res = await platformAdminService.resetDemoTenantData(tenantId, resetPhrase);
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Demo training workspace cleanly reset.' });
        setShowResetModal(false);
        setResetPhrase('');
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to reset demo workspace.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reset demo tenant.' });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-xs">Loading tenant branding configuration...</span>
      </div>
    );
  }

  const isDemo = tenantId === 'company_demo';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tenant Branding & Visual Identity</h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isLiveProtected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                }`}
              >
                {isLiveProtected ? 'Live Protected' : 'Test / Simulation Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure company logos, login hero artwork, typography titles, and security credentials for {companyName || tenantId}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Safe Reset Action for Demo Workspace Only */}
          {isDemo && (
            <button
              onClick={handleOpenResetModal}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              title="Reset simulated records in demo tenant without touching live data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
          )}

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Branding Changes
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Form Controls (Left) vs Live Login Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Identity & Typography Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-blue-500" />
              Portal Identity & Typography
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company Legal / Display Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Pixel Syntax Delivery Software"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Portal Subtitle / System Header
                </label>
                <input
                  type="text"
                  value={portalTitle}
                  onChange={(e) => setPortalTitle(e.target.value)}
                  placeholder="e.g. Secure Operations Portal"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Login Screen Tagline
                </label>
                <input
                  type="text"
                  value={loginTagline}
                  onChange={(e) => setLoginTagline(e.target.value)}
                  placeholder="e.g. Premier UAE Delivery & Fleet Logistics Operations"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Support Email
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@alliedfleet.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Support Phone
                </label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+971 4 000 0000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Visual Assets & Logos Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              Brand Assets & Image Storage
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Uploaded assets are safely stored in object storage with immutable references.
            </p>

            <div className="space-y-4">
              {/* Main Company Logo */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Shield className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Main Company Logo</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Displayed on the login card, header, and official documents.
                    </span>
                    {logoUrl && (
                      <span className="text-[10px] font-mono text-blue-500 dark:text-blue-400 truncate max-w-xs block mt-0.5">
                        {logoUrl}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleFileUpload('logo')}
                    disabled={uploadingAsset === 'logo'}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {uploadingAsset === 'logo' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload Logo
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Clear logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Left Login Promotional Image / Artwork */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      {loginHeroUrl ? (
                        <img src={loginHeroUrl} alt="Hero" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-7 h-7 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Left Column Promotional Image / Artwork
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block max-w-md">
                        Displayed on the left promotional card of the login page. You can upload an image file or paste an image URL.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => handleFileUpload('hero')}
                      disabled={uploadingAsset === 'hero'}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {uploadingAsset === 'hero' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload Image File
                    </button>
                    {loginHeroUrl && (
                      <button
                        type="button"
                        onClick={() => setLoginHeroUrl('')}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Clear hero image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct Image URL input */}
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Direct Image URL (optional)
                  </label>
                  <input
                    type="text"
                    value={loginHeroUrl}
                    onChange={(e) => setLoginHeroUrl(e.target.value)}
                    placeholder="https://example.com/promotional-banner.jpg"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Favicon & Header / Sidebar Variant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Favicon / App Icon</span>
                    <span className="text-[10px] text-slate-400 block">Browser tab icon (.ico, .png)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFileUpload('favicon')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg"
                  >
                    {faviconUrl ? 'Replace' : 'Upload'}
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Sidebar Logo</span>
                    <span className="text-[10px] text-slate-400 block">Compact navigation brand mark</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFileUpload('sidebar')}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg"
                  >
                    {sidebarLogoUrl ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Color Palette & Security Settings Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Theme Colors & Bot Protection
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Brand Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Secondary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Cloudflare Turnstile Settings */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Cloudflare Turnstile Bot Defense
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={turnstileEnabled}
                    onChange={(e) => setTurnstileEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {turnstileEnabled && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Turnstile Site Key (Client-Side)
                  </label>
                  <input
                    type="text"
                    value={turnstileSiteKey}
                    onChange={(e) => setTurnstileSiteKey(e.target.value)}
                    placeholder="0x4AAAAAA..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Challenge widget automatically verifies legitimate human users before allowing password submissions.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Login Screen Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Live Login Screen Preview
              </span>
              <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono">
                {tenantId}
              </span>
            </div>

            {/* Preview Viewport Mockup (Modern Two-Column Light Layout matching Allied Delivery reference) */}
            <div className="bg-[#f0f4f8] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-md relative overflow-hidden flex flex-col justify-center min-h-[420px]">
              {/* Centered White Container Mockup */}
              <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden flex flex-row text-left p-3.5 gap-3 items-center">
                {/* SHARED LEFT PROMOTIONAL / HERO BRAND PANEL */}
                <LoginBrandPanel
                  loginHeroUrl={loginHeroUrl}
                  companyName={companyName}
                  portalTitle={portalTitle}
                  loginTagline={loginTagline}
                  logoUrl={logoUrl}
                  isLoading={loading}
                />

                {/* Right Column: Allied Delivery, subtitle, form fields, security check */}
                <div className="flex-1 min-w-0 p-2 flex flex-col justify-center bg-white space-y-2">
                  <div className="text-center">
                    {logoUrl ? (
                      <div className="inline-flex items-center justify-center mb-1.5">
                        <img
                          src={logoUrl}
                          alt={companyName || 'Company Logo'}
                          referrerPolicy="no-referrer"
                          className="h-7 w-auto max-w-[120px] object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs mb-1.5"
                        style={{ backgroundColor: primaryColor || '#10b981' }}
                      >
                        {(companyName || 'T').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h5 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900">
                      {companyName || 'Allied Delivery'}
                    </h5>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      Verify your identity to access the portal
                    </span>
                  </div>

                  {/* Mock Form Inputs */}
                  <div className="space-y-1.5 pt-1">
                    <div>
                      <span className="text-[8px] font-bold text-slate-600 uppercase block mb-0.5">EMAIL</span>
                      <div className="h-6 rounded bg-white border border-slate-300 px-2 flex items-center text-[9px] text-slate-400">
                        Enter your email
                      </div>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-600 uppercase block mb-0.5">PASSWORD</span>
                      <div className="h-6 rounded bg-white border border-slate-300 px-2 flex items-center text-[9px] text-slate-400">
                        ••••••••
                      </div>
                    </div>
                    {/* Math Challenge Mock */}
                    <div>
                      <span className="text-[8px] font-bold text-slate-600 uppercase block mb-0.5">SECURITY CHECK</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-6 rounded bg-slate-50 border border-slate-300 px-2 flex items-center justify-between text-[8px] text-slate-700 font-mono font-bold">
                          <span>7 + 8 = ?</span>
                        </div>
                        <span className="w-8 h-6 bg-white border border-slate-300 rounded text-center text-[9px] font-bold flex items-center justify-center">15</span>
                      </div>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div className="flex items-center gap-1 text-[8px] text-slate-600 pt-0.5">
                    <div className="w-2.5 h-2.5 rounded border border-slate-300 bg-blue-600" />
                    <span>Remember me</span>
                  </div>

                  {/* Full-width blue Login Button */}
                  <button
                    type="button"
                    disabled
                    className="w-full h-6 rounded bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center opacity-90 cursor-default"
                  >
                    <span>Login</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory Callout */}
            <div className="p-3.5 bg-blue-500/5 border border-blue-500/15 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                Branding configurations take effect immediately across all users connecting under this tenant. In
                production, domain-matching logic links this tenant to incoming HTTP requests.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Reset Demo Workspace (company_demo)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Clears simulated operational data only. All system configuration, branding, and accounts remain intact.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs">
              <Shield className="w-4 h-4 inline mr-1 text-emerald-500" />
              <strong>Production Safe:</strong> Pixel Syntax Delivery Software. (company_pixel_syntax) is completely
              isolated and unaffected.
            </div>

            {/* Dependency / Count Preview (Requirement 11) */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Operational Records Preview
                </span>
                {loadingPreview && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />}
              </div>

              {resetPreviewData?.counts ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Employees:</span>
                    <span className="font-mono font-semibold">{resetPreviewData.counts.employees}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Recruitment Candidates:</span>
                    <span className="font-mono font-semibold">{resetPreviewData.counts.candidates}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Projects:</span>
                    <span className="font-mono font-semibold">{resetPreviewData.counts.projects}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Vehicles:</span>
                    <span className="font-mono font-semibold">{resetPreviewData.counts.vehicles}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>SIMs:</span>
                    <span className="font-mono font-semibold">{resetPreviewData.counts.sims}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Assignments:</span>
                    <span className="font-mono font-semibold text-rose-500">{resetPreviewData.counts.assignments} (to clear)</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Payroll Test Records:</span>
                    <span className="font-mono font-semibold text-rose-500">{resetPreviewData.counts.payroll} (to clear)</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Fines:</span>
                    <span className="font-mono font-semibold text-rose-500">{resetPreviewData.counts.fines} (to clear)</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Salik:</span>
                    <span className="font-mono font-semibold text-rose-500">{resetPreviewData.counts.salik} (to clear)</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span>Documents:</span>
                    <span className="font-mono font-semibold">{resetPreviewData.counts.documents}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-2">
                  {loadingPreview ? 'Loading operational record counts...' : 'Ready to preview operational items.'}
                </div>
              )}

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-emerald-600 dark:text-emerald-400">
                ✓ Preserved: System Config, Staff Accounts ({resetPreviewData?.preservedConfig?.staffAccountsCount || 0}), Roles/RBAC, Document Types, Formulas, Branding
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="font-mono text-rose-600 font-bold">RESET DEMO</span> to proceed:
              </label>
              <input
                type="text"
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                placeholder="RESET DEMO"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white uppercase"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetPhrase('');
                }}
                className="w-1/2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDemoData}
                disabled={resetPhrase !== 'RESET DEMO' || resetting}
                className="w-1/2 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Confirm Reset</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
