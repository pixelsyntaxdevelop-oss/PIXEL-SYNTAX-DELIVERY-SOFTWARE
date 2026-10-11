import React, { useEffect, useState } from 'react';
import {
  X,
  Eye,
  Download,
  Calendar,
  ShieldCheck,
  History,
  FileText,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Share2,
  Copy,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import { clientStorageService } from '../../services/fileStorageService';
import { DbEntityDocument, DbDocumentActivity, DbDocumentVersion } from '../../types/database';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DbEntityDocument | null;
  pairedDocument?: DbEntityDocument | null;
  onReplace?: (doc: DbEntityDocument) => void;
  lang?: 'EN' | 'AR';
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  pairedDocument,
  onReplace,
  lang = 'EN',
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'activity' | 'versions'>('preview');
  const [activities, setActivities] = useState<DbDocumentActivity[]>([]);
  const [versions, setVersions] = useState<DbDocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DbDocumentVersion | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [pairedUrl, setPairedUrl] = useState('');
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!isOpen || !pairedDocument) { setPairedUrl(''); return; }
    let current = true;
    setPairedUrl('');
    clientStorageService.getAuthorizedReadUrl(pairedDocument.id)
      .then((file) => { if (current) setPairedUrl(file.readUrl); })
      .catch((err) => { if (current) setPreviewError(err?.message || 'Back image could not load'); });
    return () => { current = false; };
  }, [isOpen, pairedDocument?.id]);

  useEffect(() => {
    if (isOpen && document) {
      let current = true;
      setPreviewUrl('');
      setPreviewError('');
      setCopyFeedback('');
      clientStorageService.getAuthorizedReadUrl(document.id)
        .then((file) => { if (current) setPreviewUrl(file.readUrl); })
        .catch((err) => { if (current) setPreviewError(err?.message || 'Saved file could not load'); });
      setLoading(true);
      Promise.all([
        documentService.getDocumentActivity(document.id),
        documentService.getDocumentVersions(document.id),
      ])
        .then(([acts, vers]) => {
          setActivities(acts);
          setVersions(vers);
          const current = vers.find((v) => v.is_current) || vers[0] || null;
          setSelectedVersion(current);
        })
        .catch(console.error)
        .finally(() => { if (current) setLoading(false); });
      return () => { current = false; };
    }
  }, [isOpen, document?.id]);

  if (!isOpen || !document) return null;

  const handleAuthorizedDownload = async (target: DbEntityDocument = document) => {
    setDownloading(true);
    try {
      await clientStorageService.triggerFileDownload(target.id, undefined, target.current_file_name);
    } catch (err) {
      console.error('Authorized download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyImage = async (sourceUrl = previewUrl, sourceDoc: DbEntityDocument = document) => {
    if (!sourceUrl || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setCopyFeedback('Copy is unavailable in this browser or the file has not loaded.');
      return;
    }
    setCopying(true);
    setCopyFeedback('');
    try {
      // Invoke clipboard.write during the click; the Blob promise can render a PDF afterward.
      const png = (async (): Promise<Blob> => {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error('Saved file could not be read.');
        const source = await response.blob();
        const canvas = window.document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Image conversion is unavailable.');

        if (source.type === 'application/pdf' || /\.pdf$/i.test(sourceDoc.current_file_name || '')) {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
          const task = pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()) });
          const pdf = await task.promise;
          try {
            const page = await pdf.getPage(1);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(2, 1800 / base.width) });
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          } finally {
            await task.destroy();
          }
        } else if (source.type.startsWith('image/')) {
          const bitmap = await createImageBitmap(source);
          try {
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            ctx.drawImage(bitmap, 0, 0);
          } finally {
            bitmap.close();
          }
        } else {
          throw new Error('Only images and PDF pages can be copied as an image.');
        }
        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed.')), 'image/png');
        });
      })();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopyFeedback('Image copied. Paste it in WhatsApp with Ctrl+V.');
    } catch (err) {
      setCopyFeedback(err instanceof Error ? err.message : 'Image could not be copied.');
    } finally {
      setCopying(false);
    }
  };

  const daysRemaining = document.expiry_date ? Math.ceil((new Date(`${document.expiry_date}T23:59:59Z`).getTime() - Date.now()) / 86400000) : null;
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {document.document_type_name}
                </h3>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-extrabold text-[10px] rounded-md font-mono">
                  v{selectedVersion?.version_number || document.current_version_number}
                </span>
                {isExpired ? (
                  <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 font-black text-[10px] rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> EXPIRED ({Math.abs(daysRemaining || 0)}d ago)
                  </span>
                ) : isExpiringSoon ? (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-black text-[10px] rounded-md flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {daysRemaining} DAYS LEFT
                  </span>
                ) : !document.expiry_date ? (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-black text-[10px] rounded-md">EXPIRY NOT SET</span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-black text-[10px] rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {daysRemaining} DAYS LEFT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Entity: <span className="font-bold text-slate-700 dark:text-slate-200">{document.entity_name}</span> ({document.entity_type}) • Doc #: <span className="font-mono">{document.document_number}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyImage()}
              disabled={copying || !previewUrl}
              title="Copy the image or first PDF page for pasting into WhatsApp"
              className="px-3.5 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              {copying ? 'Copying...' : 'Copy Image'}
            </button>
            <button
              onClick={() => handleAuthorizedDownload()}
              disabled={downloading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Authorizing...' : pairedDocument ? 'Download Front' : 'Download'}
            </button>
            {pairedDocument && <button onClick={() => handleAuthorizedDownload(pairedDocument)} disabled={downloading || !pairedUrl} className="px-3.5 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs disabled:opacity-50">Download Back</button>}
            {onReplace && (
              <button
                onClick={() => {
                  onClose();
                  onReplace(document);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Renew / Replace
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-3 border-b-2 text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Document Viewer & Metadata
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`py-3 px-3 border-b-2 text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'versions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Version History ({versions.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-3 border-b-2 text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Compliance Audit Trail ({activities.length})
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'preview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Document Image / PDF Canvas */}
              <div className="lg:col-span-7 space-y-3">
                {pairedDocument && <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Front</p>}
                <div className="p-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner flex items-center justify-center min-h-[380px] max-h-[480px] overflow-hidden relative group">
                  {previewUrl ? (previewUrl.startsWith('data:application/pdf') ?
                    <iframe title={document.document_type_name} src={previewUrl + '#toolbar=0'} className="w-full h-[460px] border-0 rounded-xl" /> :
                    <img src={previewUrl} alt={document.document_type_name} className="w-full h-full object-contain rounded-xl max-h-[460px]" />
                  ) : <p className="text-sm text-slate-300">{previewError || 'Loading saved document...'}</p>}
                  <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-mono text-slate-300 flex items-center gap-2 border border-white/10">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Secure document storage
                  </div>
                </div>

                {pairedDocument && <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Back</p>
                  <div className="p-2 bg-slate-900 rounded-2xl min-h-[220px] flex items-center justify-center">
                    {pairedUrl ? <img src={pairedUrl} alt={document.document_type_name + ' back'} className="max-h-[400px] w-full object-contain rounded-xl"/> : <p className="text-sm text-slate-300">{previewError || 'Loading back image...'}</p>}
                  </div>
                  <button type="button" onClick={() => handleCopyImage(pairedUrl, pairedDocument)} disabled={!pairedUrl || copying} className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 text-xs font-bold border border-slate-200 dark:border-slate-600 disabled:opacity-50"><Copy className="inline w-3.5 h-3.5 mr-1"/>Copy Back Image</button>
                </div>}
                {copyFeedback && <p role="status" className="text-xs font-semibold text-blue-700 dark:text-blue-300 px-2">{copyFeedback}</p>}
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 font-mono">
                  <span>File: {document.current_file_name || 'document.pdf'}</span>
                  <span>Saved document</span>
                </div>
              </div>

              {/* Metadata Details Card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Document Compliance Passport
                  </h4>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Document Type</span>
                      <span className="font-bold text-slate-900 dark:text-white">{document.document_type_name}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Document Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{document.document_number}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Issue Date</span>
                      <span className="font-bold text-slate-900 dark:text-white">{document.issue_date || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Expiry Date</span>
                      <span className={`font-bold ${isExpired ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{document.expiry_date || 'No Expiry'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Days Remaining</span>
                      <span className={`font-mono font-extrabold ${isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {daysRemaining !== null ? (isExpired ? `Expired ${Math.abs(daysRemaining)} days ago` : `${daysRemaining} days left`) : 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Issuing Authority</span>
                      <span className="font-bold text-slate-900 dark:text-white">{document.issuing_authority || 'ICP / Government'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">Issuing Country</span>
                      <span className="font-bold text-slate-900 dark:text-white">{document.issuing_country || 'UAE'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Branch Office</span>
                      <span className="font-bold text-slate-900 dark:text-white">{document.branch_name || 'Dubai Head Office'}</span>
                    </div>
                  </div>
                </div>

                {document.notes && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/60 dark:border-blue-800/60 text-xs">
                    <p className="font-black text-blue-900 dark:text-blue-300 mb-1">Compliance Notes:</p>
                    <p className="text-slate-700 dark:text-slate-300">{document.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-3">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    ver.is_current
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs px-2 py-0.5 bg-blue-600 text-white rounded-md">
                          v{ver.version_number}
                        </span>
                        {ver.is_current && (
                          <span className="text-[11px] font-black text-emerald-600">Active Current</span>
                        )}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Doc #: {ver.document_number}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Reason: {ver.replacement_reason || 'Initial upload'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Uploaded by {ver.uploaded_by} on {ver.uploaded_at?.substring(0, 10)} • Expiry: {ver.expiry_date || 'N/A'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await clientStorageService.triggerFileDownload(document.id, ver.id, ver.file_name);
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-600 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-[10px]">
                      {act.action}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{act.details}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        By {act.performed_by} ({act.performed_by_role}) • IP: {act.ip_address}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">
                    {act.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
