import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Building2,
  Shield,
  Loader2,
} from 'lucide-react';

interface SetupFirstUserViewProps {
  onCompleted?: () => void;
  onGoToLogin?: () => void;
}

export const SetupFirstUserView: React.FC<SetupFirstUserViewProps> = ({
  onCompleted,
  onGoToLogin,
}) => {
  // Setup availability status
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);
  const [canSetup, setCanSetup] = useState<boolean>(false);
  const [existingUserCount, setExistingUserCount] = useState<number>(0);

  // Form Fields
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  // Check setup eligibility on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/setup-status')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setCanSetup(Boolean(data.canSetup));
        setExistingUserCount(data.totalRegisteredUsers || data.totalUsers || 0);
        setIsCheckingStatus(false);
      })
      .catch(() => {
        // Fallback to bootstrap status if setup-status route is pending restart
        fetch('/api/auth/bootstrap-first-user/status')
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted) return;
            setCanSetup(Boolean(data.canBootstrap));
            setExistingUserCount(data.totalRegisteredUsers || 0);
            setIsCheckingStatus(false);
          })
          .catch(() => {
            if (!isMounted) return;
            setIsCheckingStatus(false);
            setCanSetup(true); // Allow form attempt
          });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim();
    const cleanFullName = fullName.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setErrorMessage('Please enter a username (e.g. Emirates ID or Staff ID).');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    if (!cleanFullName) {
      setErrorMessage('Please enter the full name for this user.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/setup-first-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          fullName: cleanFullName,
          password: cleanPassword,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Failed to create first user.');
      }

      setSuccessData({
        user: result.user,
        username: cleanUsername,
        fullName: cleanFullName,
      });
      setCanSetup(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during user creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToLogin = () => {
    if (onCompleted) {
      onCompleted();
    } else if (onGoToLogin) {
      onGoToLogin();
    } else {
      window.location.href = '/login';
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-medium text-slate-300">Checking Allied ERP system status...</p>
        </div>
      </div>
    );
  }

  // If already locked / users exist
  if (!canSetup && !successData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Setup Route Disabled</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Allied ERP already has registered staff user accounts ({existingUserCount} active user{existingUserCount !== 1 ? 's' : ''}).
              The one-time initial setup route has been permanently locked for security.
            </p>
          </div>
          <button
            onClick={handleProceedToLogin}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>Proceed to Login Screen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // If user just successfully created
  if (successData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">First ERP User Created!</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The initial staff account <strong className="text-slate-200">@{successData.username}</strong> has been registered in the database with role <strong className="text-blue-400">ERP_USER</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-left text-xs space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Username:</span>
              <span className="font-mono text-white font-semibold">@{successData.username}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Full Name:</span>
              <span className="text-white font-medium">{successData.fullName}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Role:</span>
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800 text-[11px]">ERP_USER</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Setup Route:</span>
              <span className="text-emerald-400 font-semibold">Permanently Locked</span>
            </div>
          </div>

          <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-left text-[11px] text-blue-200">
            💡 <strong>Next Step:</strong> Log in with this account. You can then navigate to <strong>Settings → Office Staff Access</strong> inside the ERP to create your remaining staff users.
          </div>

          <button
            onClick={handleProceedToLogin}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>Go to Login Screen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header Branding */}
        <div className="flex items-center gap-3.5 pb-5 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Allied Delivery Services L.L.C
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold">
                Setup
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Initial ERP User Provisioning &bull; One-Time System Activation
            </p>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="p-3.5 bg-blue-950/40 border border-blue-800/50 rounded-2xl text-xs text-blue-200 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Welcome to Allied ERP. Create your first operational staff account below.
            Once this account is created, this setup route will be permanently closed and all additional users can be created from within the ERP.
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-950/50 border border-rose-800/60 rounded-2xl text-xs text-rose-200 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Username (Emirates ID / Staff ID) */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300">
                Username (Emirates ID / Staff ID) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. XXX-XXXX-XXXXXXX-X or EMP-101 or tariq.ops"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-500">You will use this username to sign into the ERP.</p>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Muhammad Tariq"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter initial password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Optional Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Email Address <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="staff@alliedfleet.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            {/* Optional Phone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Mobile Number <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="+971 50 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            {/* Role (Fixed) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                System Role
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-sm text-white">ERP_USER</span>
                <span className="text-[10px] text-slate-400 ml-auto bg-slate-800/60 px-2 py-0.5 rounded">
                  Equal Operational Access
                </span>
              </div>
            </div>

            {/* Status (Active / Disabled) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'DISABLED')}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-white focus:outline-hidden transition-colors"
              >
                <option value="ACTIVE">Active (Can log in immediately)</option>
                <option value="DISABLED">Disabled (Account paused)</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Initial ERP User...</span>
                </>
              ) : (
                <>
                  <span>Create First ERP User & Activate System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleProceedToLogin}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Already have an account? Go to Login &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
