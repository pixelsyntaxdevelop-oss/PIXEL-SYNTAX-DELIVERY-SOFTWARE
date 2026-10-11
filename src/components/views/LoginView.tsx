import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { authService, AuthSessionData } from '../../services/authService';
import { LoginBrandPanel } from '../common/LoginBrandPanel';
import {
  getCachedBranding,
  setCachedBranding,
  preloadImage,
  fetchAuthoritativeTenantContext,
  hasBrandingChanged,
} from '../../utils/brandingCache';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSessionData) => void;
  onNavigateToSetup?: () => void;
}

interface TenantBrandingContext {
  isPlatformDomain: boolean;
  tenantId?: string;
  companyName: string;
  logoUrl?: string | null;
  portalTitle: string;
  loginHeroUrl?: string | null;
  loginBgUrl?: string | null;
  loginTagline?: string | null;
  status: string;
  allowTenantSelection: boolean;
  customHero?: boolean;
}

interface MathChallenge {
  num1: number;
  num2: number;
  operator: '+' | '-';
  answer: number;
}

const generateMathChallenge = (): MathChallenge => {
  const isAddition = Math.random() > 0.35;
  if (isAddition) {
    const num1 = Math.floor(Math.random() * 9) + 1; // 1 - 9
    const num2 = Math.floor(Math.random() * 9) + 1; // 1 - 9
    return { num1, num2, operator: '+', answer: num1 + num2 };
  } else {
    const num1 = Math.floor(Math.random() * 9) + 6; // 6 - 14
    const num2 = Math.floor(Math.random() * (num1 - 2)) + 1; // 1 to num1 - 2
    return { num1, num2, operator: '-', answer: num1 - num2 };
  }
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onNavigateToSetup }) => {
  // Sync page title cleanly to "Pixel Syntax Delivery"
  useEffect(() => {
    document.title = 'Pixel Syntax Delivery';
  }, []);

  // Synchronously load last valid cached branding for instant first render (<300ms)
  const initialCache = getCachedBranding('company_pixel_syntax');
  const [brandingLoading, setBrandingLoading] = useState<boolean>(false);
  const [branding, setBranding] = useState<TenantBrandingContext>(() => ({
    isPlatformDomain: false,
    tenantId: 'company_pixel_syntax',
    companyName: initialCache.companyName || 'Pixel Syntax',
    logoUrl: initialCache.mainLogoUrl || '/pixel-syntax-logo.png',
    portalTitle: initialCache.portalTitle || initialCache.portalSubtitle || 'Pixel Syntax',
    loginHeroUrl: initialCache.loginHeroUrl || '/pixel-syntax-logo.png',
    loginBgUrl: null,
    loginTagline: initialCache.loginTagline || 'Fleet & Logistics Management Portal',
    status: 'ACTIVE',
    allowTenantSelection: false,
    customHero: true,
  }));
  const [canSetup, setCanSetup] = useState<boolean>(false);
  const [logoImageError, setLogoImageError] = useState(false);

  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Security Math Challenge State
  const [mathQuestion, setMathQuestion] = useState<MathChallenge>(generateMathChallenge);
  const [userMathAnswer, setUserMathAnswer] = useState('');
  const [mathError, setMathError] = useState(false);

  // UI Flow State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'LOGIN' | 'FORGOT_PASSWORD' | 'RESET_CONFIRM'>('LOGIN');

  // Forgot / Reset Password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check setup eligibility
  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.canSetup) {
          setCanSetup(true);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch safe authoritative branding resolved purely from request domain with background revalidation (deduplicated)
  useEffect(() => {
    let isMounted = true;

    // Immediately trigger preload for cached images if present
    const cached = getCachedBranding('company_pixel_syntax');
    if (cached) {
      if (cached.loginHeroUrl) preloadImage(cached.loginHeroUrl);
      if (cached.mainLogoUrl) preloadImage(cached.mainLogoUrl);
      if (cached.headerLogoUrl) preloadImage(cached.headerLogoUrl);
    }

    const refreshBranding = () => {
      fetchAuthoritativeTenantContext('company_pixel_syntax')
        .then((ctx) => {
          if (!isMounted) return;
          if (ctx) {
            // Preload image binaries immediately
            if (ctx.loginHeroUrl) preloadImage(ctx.loginHeroUrl);
            if (ctx.logoUrl) preloadImage(ctx.logoUrl);

            const isAllied = (ctx.tenantId || 'company_pixel_syntax') === 'company_pixel_syntax';
            const nextHero = ctx.loginHeroUrl || (isAllied ? '/pixel-syntax-logo.png' : null);
            const nextLogo = ctx.logoUrl || (isAllied ? '/pixel-syntax-logo.png' : null);

            // Persist safe metadata to localStorage client-side branding cache
            setCachedBranding(ctx.tenantId || 'company_pixel_syntax', {
              mainLogoUrl: nextLogo,
              headerLogoUrl: ctx.headerLogoUrl || nextLogo,
              loginHeroUrl: nextHero,
              companyName: ctx.companyName || 'Pixel Syntax',
              portalSubtitle: ctx.portalTitle || 'Pixel Syntax',
              portalTitle: ctx.portalTitle || 'Pixel Syntax',
              loginTagline: ctx.loginTagline || 'Fleet & Logistics Management Portal',
              faviconUrl: ctx.faviconUrl || '/favicon.png',
            });

            const applyBrandingUpdate = () => {
              if (!isMounted) return;
              setBranding((prev) => {
                if (
                  prev.loginHeroUrl === nextHero &&
                  prev.logoUrl === nextLogo &&
                  prev.companyName === (ctx.companyName || prev.companyName) &&
                  prev.portalTitle === (ctx.portalTitle || prev.portalTitle)
                ) {
                  return prev;
                }
                return {
                  isPlatformDomain: Boolean(ctx.isPlatformDomain),
                  tenantId: ctx.tenantId,
                  companyName: ctx.companyName || 'Pixel Syntax',
                  logoUrl: nextLogo,
                  portalTitle: ctx.portalTitle || 'Pixel Syntax',
                  loginHeroUrl: nextHero,
                  loginBgUrl: ctx.loginBgUrl || null,
                  loginTagline: ctx.loginTagline || 'Fleet & Logistics Management Portal',
                  status: ctx.status || 'ACTIVE',
                  allowTenantSelection: Boolean(ctx.allowTenantSelection),
                  customHero: Boolean(nextHero),
                };
              });
            };

            if (nextHero) {
              const img = new Image();
              img.referrerPolicy = 'no-referrer';
              img.onload = applyBrandingUpdate;
              img.onerror = applyBrandingUpdate;
              img.src = nextHero;
            } else {
              applyBrandingUpdate();
            }
          }
        })
        .catch(() => {});
    };

    refreshBranding();

    const handleUpdated = (e: any) => {
      if (!isMounted) return;
      if (e?.detail) {
        const nextHero = e.detail.loginHeroUrl !== undefined ? e.detail.loginHeroUrl : branding.loginHeroUrl;
        const nextLogo = e.detail.logoUrl !== undefined ? e.detail.logoUrl : branding.logoUrl;
        if (nextHero) preloadImage(nextHero);
        if (nextLogo) preloadImage(nextLogo);

        setCachedBranding('company_pixel_syntax', {
          mainLogoUrl: nextLogo,
          loginHeroUrl: nextHero,
          companyName: e.detail.companyName || branding.companyName,
          portalSubtitle: e.detail.portalTitle || branding.portalTitle,
          loginTagline: e.detail.loginTagline || branding.loginTagline,
        });

        setBranding((prev) => ({
          ...prev,
          logoUrl: nextLogo,
          loginHeroUrl: nextHero,
          loginBgUrl: e.detail.loginBgUrl !== undefined ? e.detail.loginBgUrl : prev.loginBgUrl,
          companyName: e.detail.companyName || prev.companyName,
          portalTitle: e.detail.portalTitle || prev.portalTitle,
          loginTagline: e.detail.loginTagline || prev.loginTagline,
          customHero: Boolean(nextHero),
        }));
        setLogoImageError(false);
        setBrandingLoading(false);
      } else {
        refreshBranding();
      }
    };

    window.addEventListener('tenant_branding_updated', handleUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('tenant_branding_updated', handleUpdated);
    };
  }, []);

  const handleRefreshMathChallenge = () => {
    setMathQuestion(generateMathChallenge());
    setUserMathAnswer('');
    setMathError(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setMathError(false);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    // Verify Security Math Challenge
    const parsedMathAnswer = parseInt(userMathAnswer.trim(), 10);
    if (isNaN(parsedMathAnswer) || parsedMathAnswer !== mathQuestion.answer) {
      setMathError(true);
      setErrorMessage('Incorrect security verification calculation. Please try again.');
      handleRefreshMathChallenge();
      return;
    }

    setLoading(true);
    try {
      const res = await authService.loginWithCredentials(
        identifier.trim(),
        password,
        rememberMe
      );

      if (res.success && res.session) {
        setSuccessMessage('Authentication verified. Loading workspace...');
        setTimeout(() => {
          onLoginSuccess(res.session!);
        }, 200);
      } else {
        setErrorMessage(res.error || 'Invalid email or password.');
        handleRefreshMathChallenge();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
      handleRefreshMathChallenge();
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!forgotIdentifier.trim()) {
      setErrorMessage('Please enter your registered email.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.forgotPassword(forgotIdentifier.trim());
      if (res.success) {
        setSuccessMessage(res.message || 'Password reset instructions generated.');
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setMode('RESET_CONFIRM');
        }
      } else {
        setErrorMessage(res.error || 'Unable to process reset request.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetToken.trim()) {
      setErrorMessage('Please provide your reset token.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.confirmResetPassword(resetToken.trim(), newPassword);
      if (res.success) {
        setSuccessMessage('Password updated successfully. Please sign in with your new password.');
        setPassword('');
        setUserMathAnswer('');
        handleRefreshMathChallenge();
        setMode('LOGIN');
      } else {
        setErrorMessage(res.error || 'Invalid or expired reset token.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // Authoritative company title
  const displayCompanyTitle = 'Pixel Syntax Delivery';

  return (
    <div
      id="login-page-container"
      className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4 sm:p-6 font-sans select-text"
    >
      {/* Centered White Rounded Rectangle Container */}
      <div
        id="login-main-card"
        className="w-full max-w-[940px] bg-white rounded-3xl shadow-xl border border-slate-200/80 p-5 sm:p-7 flex flex-col sm:flex-row gap-6 sm:gap-7 items-center justify-center overflow-hidden"
      >
        {/* SHARED LEFT PROMOTIONAL / HERO BRAND PANEL */}
        <LoginBrandPanel
          loginHeroUrl={branding.loginHeroUrl}
          companyName={branding.companyName || displayCompanyTitle}
          portalTitle={branding.portalTitle}
          loginTagline={branding.loginTagline}
          logoUrl={branding.logoUrl}
          isLoading={brandingLoading}
        />

        {/* RIGHT COLUMN: Sign-in form */}
        <div
          id="login-right-column"
          className="w-full sm:flex-1 flex flex-col justify-center py-2 px-1 sm:px-3 bg-white"
        >
          {/* Centered Company Logo, Title & Subtitle */}
          <div className="text-center mb-6">
            {!logoImageError && (
              <div className="flex justify-center mb-3">
                <img
                  id="login-main-logo"
                  src={branding.logoUrl || '/pixel-syntax-logo.png'}
                  alt=""
                  aria-label={branding.companyName || displayCompanyTitle}
                  referrerPolicy="no-referrer"
                  className="h-12 max-w-[200px] object-contain"
                  onError={() => {
                    if (branding.logoUrl && branding.logoUrl !== '/pixel-syntax-logo.png') {
                      setBranding((prev) => ({ ...prev, logoUrl: '/pixel-syntax-logo.png' }));
                    } else {
                      setLogoImageError(true);
                    }
                  }}
                />
              </div>
            )}
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900">
              {branding.companyName || displayCompanyTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Verify your identity to access the portal
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 shadow-xs"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span className="leading-relaxed font-medium">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="login-success-alert"
              className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
              <span className="leading-relaxed font-medium">{successMessage}</span>
            </div>
          )}

          {/* SETUP CALLOUT (Only visible when 0 ERP users exist) */}
          {canSetup && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2 text-left">
              <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-blue-900">Initial Setup: </span>
                Zero staff users exist.{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToSetup) {
                      onNavigateToSetup();
                    } else {
                      window.location.href = '/setup';
                    }
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1"
                >
                  <span>Provision First User (/setup)</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* PRIMARY LOGIN FORM */}
          {mode === 'LOGIN' && (
            <form
              action="#"
              method="POST"
              onSubmit={(e) => {
                e.preventDefault();
                if (e && typeof e.stopPropagation === 'function') {
                  e.stopPropagation();
                }
                handleLoginSubmit(e);
              }}
              className="space-y-4"
            >
              {/* EMAIL field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  EMAIL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    id="login-identifier"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-3.5 h-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              {/* PASSWORD field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setForgotIdentifier(identifier);
                      setMode('FORGOT_PASSWORD');
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 h-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* SECURITY CHECK row: math question on the left, answer input on the right */}
              <div id="login-security-check-row">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  SECURITY CHECK
                </label>
                <div className="flex items-center gap-3">
                  {/* Math problem on the left */}
                  <div className="flex-1 h-11 px-4 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between select-none">
                    <span className="font-mono font-bold text-sm text-slate-900 tracking-wider">
                      {mathQuestion.num1} {mathQuestion.operator} {mathQuestion.num2} = ?
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshMathChallenge}
                      title="New calculation"
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Answer input on the right */}
                  <div className="w-32 sm:w-36 shrink-0">
                    <input
                      type="number"
                      id="login-math-answer"
                      value={userMathAnswer}
                      onChange={(e) => {
                        setUserMathAnswer(e.target.value);
                        if (mathError) setMathError(false);
                      }}
                      placeholder="Enter answer"
                      className={`w-full h-11 px-3 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                        mathError
                          ? 'border-red-500 focus:ring-red-500/20 focus:border-red-600 bg-red-50/30'
                          : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                      }`}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Please solve the calculation above.
                </p>
                {mathError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    Incorrect calculation answer.
                  </p>
                )}
              </div>

              {/* Remember me checkbox */}
              <div className="pt-0.5">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="login-remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
              </div>

              {/* Full-width blue Login button */}
              <button
                type="submit"
                id="login-submit-btn"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-[#0066ff] hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold tracking-wide transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD WORKFLOW */}
          {mode === 'FORGOT_PASSWORD' && (
            <form
              action="#"
              method="POST"
              onSubmit={(e) => {
                e.preventDefault();
                if (e && typeof e.stopPropagation === 'function') {
                  e.stopPropagation();
                }
                handleForgotPasswordSubmit(e);
              }}
              className="space-y-4"
            >
              <div className="text-left mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>Account Recovery</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your registered email to generate password reset instructions.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  EMAIL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full pl-10 pr-3.5 h-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('LOGIN');
                  }}
                  className="w-1/2 h-11 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 h-11 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Request Reset</span>}
                </button>
              </div>
            </form>
          )}

          {/* CONFIRM RESET PASSWORD WORKFLOW */}
          {mode === 'RESET_CONFIRM' && (
            <form
              action="#"
              method="POST"
              onSubmit={(e) => {
                e.preventDefault();
                if (e && typeof e.stopPropagation === 'function') {
                  e.stopPropagation();
                }
                handleResetPasswordConfirm(e);
              }}
              className="space-y-4"
            >
              <div className="text-left mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>Set New Password</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter the authorization token and your new password.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  AUTHORIZATION TOKEN
                </label>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Enter reset token"
                  className="w-full px-3.5 h-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  NEW PASSWORD (MIN 6 CHARACTERS)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full px-3.5 h-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  CONFIRM NEW PASSWORD
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3.5 h-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="w-1/2 h-11 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Update Password</span>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
