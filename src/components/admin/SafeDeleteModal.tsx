import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Trash2, X, CheckCircle2, Lock } from 'lucide-react';

interface SafeDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, confirmationPhrase?: string) => Promise<void>;
  title: string;
  recordIdentifier: string;
  entityType: string;
  isLiveTenant: boolean;
  requireConfirmationPhrase?: boolean;
  metadata?: {
    name?: string;
    code?: string;
    tenant?: string;
    status?: string;
  };
  dependencies?: {
    activePointers?: string[];
    historicalCounts?: { label: string; count: number; note?: string }[];
    warnings?: string[];
  };
  loading?: boolean;
}

export const SafeDeleteModal: React.FC<SafeDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  recordIdentifier,
  entityType,
  isLiveTenant,
  requireConfirmationPhrase,
  metadata,
  dependencies,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needsConfirmationPhrase = requireConfirmationPhrase ?? isLiveTenant;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setError(null);
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide an explicit audit reason (minimum 5 characters).');
      return;
    }
    if (needsConfirmationPhrase) {
      if (isLiveTenant && reason.trim().length < 10) {
        setError('LIVE Tenant Safety: Audit reason must be at least 10 characters.');
        return;
      }
      if (confirmationPhrase !== 'CONFIRM DELETE') {
        setError('Safety verification: You must type "CONFIRM DELETE" exactly.');
        return;
      }
    }

    try {
      await onConfirm(reason, confirmationPhrase);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isLiveTenant 
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50' 
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50'
        }`}>
          <div className="flex items-center gap-2.5">
            {isLiveTenant ? (
              <div className="p-2 bg-red-100 dark:bg-red-900/60 rounded-lg text-red-600 dark:text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {title}
                {isLiveTenant && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                    LIVE TENANT
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Controlled Platform Admin Deletion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
          {/* Target record */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400 font-medium">Target Record</div>
              <div className="text-[11px] text-slate-500 font-mono">
                Entity: {entityType}
              </div>
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {metadata?.name || recordIdentifier}
            </div>
            {metadata && (
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Employee Code</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{metadata.code || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Tenant</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{metadata.tenant || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Current Status</span>
                  <span className="inline-block font-semibold px-2 py-0.5 rounded text-[11px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 mt-0.5">
                    {metadata.status || '-'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Dependencies & Impact Analysis */}
          {dependencies && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Dependency Analysis
              </div>

              {Array.isArray(dependencies.activePointers) && dependencies.activePointers.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Active assignments will be automatically unlinked:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                    {(Array.isArray(dependencies.activePointers) ? dependencies.activePointers : []).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(dependencies.historicalCounts) && dependencies.historicalCounts.length > 0 && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(Array.isArray(dependencies.historicalCounts) ? dependencies.historicalCounts : []).map((h, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-200 dark:border-slate-800"
                    >
                      <span className="text-slate-400 text-[11px] block">{h.label}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{h.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(dependencies.warnings) && dependencies.warnings.map((w, i) => (
                <p key={i} className="text-xs text-slate-500 italic">
                  Note: {w}
                </p>
              ))}
            </div>
          )}

          {/* Reason Input (Audited) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Required Audit Reason <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400">Written to immutable audit trail</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this record is being removed (e.g. Duplicate entry cleanup, customer support ticket #1024)..."
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Safety confirmation phrase */}
          {needsConfirmationPhrase && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-300">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                {isLiveTenant ? 'Live Protection' : 'Safety Verification'}: Type "CONFIRM DELETE"
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-400">
                {isLiveTenant
                  ? 'This tenant is marked as LIVE. To prevent accidental data loss, please type the confirmation phrase exactly:'
                  : 'To confirm this controlled deletion action, please type the confirmation phrase exactly:'}
              </p>
              <input
                type="text"
                value={confirmationPhrase}
                onChange={(e) => setConfirmationPhrase(e.target.value)}
                placeholder="CONFIRM DELETE"
                className="w-full text-xs px-2.5 py-1.5 font-mono tracking-wider rounded bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 focus:outline-hidden focus:ring-1 focus:ring-red-500 uppercase"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {loading ? 'Processing...' : 'Confirm Hard Deletion'}
          </button>
        </div>
      </div>
    </div>
  );
};
