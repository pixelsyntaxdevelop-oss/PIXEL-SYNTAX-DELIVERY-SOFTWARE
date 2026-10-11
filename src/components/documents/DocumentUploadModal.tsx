import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Search, Upload, X } from 'lucide-react';
import { documentService, EntitySearchResult } from '../../services/documentService';
import { clientStorageService, MAX_FILE_SIZE_BYTES } from '../../services/fileStorageService';
import { DbDocumentType, DbEntityDocument } from '../../types/database';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'Employee' | 'Vehicle';
  onSuccess: (newDoc: any) => void;
  preselectedEntityType?: 'Employee' | 'Vehicle' | 'Company';
  preselectedEntityId?: string;
  preselectedEntityName?: string;
  preselectedEntityReferenceNumber?: string;
  lang?: 'EN' | 'AR';
}

const priority = ['dt_eid', 'dt_passport', 'dt_labor', 'dt_visa', 'dt_dl', 'dt_mulkiya'];
const hasSides = (id: string) => ['dt_eid', 'dt_dl', 'dt_mulkiya'].includes(id);
const slotOf = (doc: DbEntityDocument): 'pdf' | 'front' | 'back' => {
  const name = doc.current_file_name || '';
  if ((doc as any).current_mime_type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  return /^back__/.test(name) ? 'back' : 'front';
};
const labelFor = (type: DbDocumentType) => type.id === 'dt_mulkiya' ? 'Bike Mulkiya' : type.name;

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen, onClose, onSuccess, mode = 'Employee', preselectedEntityId, preselectedEntityName,
  preselectedEntityReferenceNumber,
}) => {
  const [types, setTypes] = useState<DbDocumentType[]>([]);
  const [employee, setEmployee] = useState<EntitySearchResult | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [docs, setDocs] = useState<DbEntityDocument[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [savedPreviews, setSavedPreviews] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [expiryDirty, setExpiryDirty] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFiles({});
    setExpiryDates({});
    setExpiryDirty({});
    setError('');
    setProgress('');
    setEmployee(preselectedEntityId ? {
      id: preselectedEntityId, entityId: preselectedEntityId,
      name: preselectedEntityName || mode, code: preselectedEntityReferenceNumber,
      type: mode,
    } : null);
    setQuery('');
    setLoading(true);
    documentService.getDocumentTypes()
      .then((all) => setTypes(all.filter((t) => t.is_active !== false &&
        (mode === 'Vehicle' ? (t.category === 'VEHICLE' || t.id === 'dt_mulkiya') :
          ((t.category === 'EMPLOYEE' || t.category === 'OTHER') && t.id !== 'dt_mulkiya')))
        .sort((a, b) => {
          const ai = priority.indexOf(a.id), bi = priority.indexOf(b.id);
          return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.name.localeCompare(b.name);
        })))
      .catch((e) => setError(e.message || 'Document types could not load'))
      .finally(() => setLoading(false));
  }, [isOpen, mode, preselectedEntityId, preselectedEntityName, preselectedEntityReferenceNumber]);

  useEffect(() => {
    if (!isOpen || employee || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      documentService.searchEntities(query.trim(), mode)
        .then((found) => { if (current) setResults(found); })
        .catch((e) => { if (current) setError(e.message || 'Employee search failed'); });
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [isOpen, query, employee, mode]);

  useEffect(() => {
    if (!isOpen || !employee) {
      setDocs([]);
      setSavedPreviews({});
      return;
    }
    let current = true;
    setLoadingDocs(true);
    setDocs([]);
    setSavedPreviews({});
    documentService.getDocuments({ entityType: mode, entityId: employee.id, pageSize: 500 })
      .then(async ({ documents }) => {
        if (!current) return;
        const active = documents.filter((d) => !d.is_archived && d.status !== 'ARCHIVED');
        setDocs(active);
        setExpiryDates(Object.fromEntries(active.map((d) => [d.document_type_id, d.expiry_date || ''])));
        setExpiryDirty({});
        const images = active.filter((d) => d.current_file_name).slice(0, 30);
        const signed = await Promise.allSettled(images.map(async (d) => ({
          id: d.id, url: (await clientStorageService.getAuthorizedReadUrl(d.id)).readUrl,
        })));
        if (current) setSavedPreviews(Object.fromEntries(signed
          .filter((result): result is PromiseFulfilledResult<{ id: string; url: string }> => result.status === 'fulfilled')
          .map((result) => [result.value.id, result.value.url])));
      })
      .catch((e) => { if (current) setError(e.message || 'Documents could not load'); })
      .finally(() => { if (current) setLoadingDocs(false); });
    return () => { current = false; };
  }, [isOpen, employee?.id, mode]);

  useEffect(() => {
    const urls = Object.fromEntries(Object.entries(files)
      .map(([id, file]) => [id, URL.createObjectURL(file)]));
    setPreviews(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  if (!isOpen) return null;

  const selectFile = (id: string, file?: File) => {
    if (!file) return;
    const slot = id.split(':')[1];
    if (!(slot === 'pdf' ? file.type === 'application/pdf' : slot === 'file' ? ['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) : ['image/png', 'image/jpeg'].includes(file.type))) {
      setError('PDF, JPG ya PNG file select karein');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Har file maximum 10 MB ho sakti hai');
      return;
    }
    setError('');
    const [typeId] = id.split(':');
    const named = slot === 'front' || slot === 'back'
      ? new File([file], `${slot}__${file.name}`, { type: file.type }) : file;
    setFiles((previous) => {
      const next = { ...previous };
      if (hasSides(typeId)) {
        if (slot === 'pdf') { delete next[`${typeId}:front`]; delete next[`${typeId}:back`]; }
        else delete next[`${typeId}:pdf`];
      }
      next[id] = named;
      return next;
    });
  };

  const saveAll = async () => {
    if (!employee || saving) return;
    const queued = Object.entries(files);
    const expiryUpdates = docs.filter((d) => expiryDirty[d.document_type_id] && expiryDates[d.document_type_id] !== undefined);
    if (!queued.length && !expiryUpdates.length) { setError('Kam az kam ek document select karein ya expiry date add karein'); return; }
    setSaving(true);
    setError('');
    let completed = 0;
    const failures: string[] = [];
    const replacedIds = new Set<string>();
    const archivedIds = new Set<string>();
    for (const [key, file] of queued) {
      const [typeId, slot = 'pdf'] = key.split(':');
      const type = types.find((item) => item.id === typeId);
      if (!type) continue;
      const matching = docs.filter((d) => d.document_type_id === typeId)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const existing = matching.find((d) => slotOf(d) === slot) ||
        (!hasSides(typeId) ? matching[0] : undefined) ||
        (hasSides(typeId) && slot === 'pdf' ? matching[0] :
          hasSides(typeId) && slot === 'front' ? matching.find((d) => slotOf(d) === 'pdf') : undefined);
      setProgress(`Uploading ${completed + failures.length + 1} / ${queued.length}: ${labelFor(type)}`);
      try {
        const result = await clientStorageService.uploadDocumentDirectly(file, {
          entity_type: mode,
          entity_id: employee.id,
          entity_name: employee.name,
          document_type_id: typeId,
          document_type_name: type.name,
          document_number: existing?.document_number || `DOC-${crypto.randomUUID()}`,
          documentId: existing?.id,
          versionNumber: existing ? (existing.current_version_number || 1) + 1 : undefined,
          replacementReason: existing ? 'New scan uploaded from employee document boxes' : undefined,
          description: `${type.name} for ${employee.name}`,
        });
        const expiryDate = expiryDates[typeId] || '';
        if (result.document && expiryDate) {
          result.document = await clientStorageService.updateDocumentExpiry(result.document.id, expiryDate);
        }
        completed++;
        if (existing) replacedIds.add(existing.id);
        setFiles((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
        if (result.document) {
          try {
            const saved = await clientStorageService.getAuthorizedReadUrl(result.document.id);
            setSavedPreviews((previous) => ({ ...previous, [result.document.id]: saved.readUrl }));
          } catch { /* The saved document remains available through View saved. */ }
        }
        if (result.document) setDocs((previous) => [
          result.document, ...previous.filter((d) => d.id !== result.document.id),
        ]);
        if (result.document && hasSides(typeId) && slot === 'pdf') {
          // A single PDF replaces the old pair; keep only the PDF as the active record.
          for (const stale of matching.filter((d) => d.id !== result.document.id)) {
            try {
              await documentService.archiveDocument(stale.id);
              archivedIds.add(stale.id);
              setDocs((previous) => previous.filter((d) => d.id !== stale.id));
            } catch (e: any) {
              failures.push(`${labelFor(type)} old scan: ${e?.message || 'Could not archive'}`);
            }
          }
        }
      } catch (e: any) {
        failures.push(`${labelFor(type)}: ${e?.message || 'Upload failed'}`);
      }
    }
    for (const existing of expiryUpdates) {
      if (replacedIds.has(existing.id) || archivedIds.has(existing.id)) continue;
      const expiryDate = expiryDates[existing.document_type_id] || '';
      setProgress(`Saving expiry: ${existing.document_type_name || existing.document_type_id}`);
      try {
        const updated = await clientStorageService.updateDocumentExpiry(existing.id, expiryDate);
        setDocs((previous) => previous.map((d) => d.id === updated.id ? updated : d));
        setExpiryDirty((previous) => ({ ...previous, [existing.document_type_id]: false }));
        completed++;
      } catch (e: any) {
        failures.push(`${existing.document_type_name || existing.document_type_id}: ${e?.message || 'Expiry save failed'}`);
      }
    }
    setSaving(false);
    setProgress('');
    if (completed) onSuccess({ uploaded: completed });
    if (failures.length) {
      setError(`${completed} saved. ${failures.join(' | ')}. Failed files are still selected; retry Save.`);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ height: "calc(100dvh - 24px)", maxHeight: 840 }}>
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between gap-3">
          <div>
            <h3 className="font-bold text-base">{mode === 'Vehicle' ? 'Vehicle Documents' : 'Employee Documents'}</h3>
            <p className="text-xs text-slate-500">{mode === 'Vehicle' ? 'Bike plate search karein' : 'Employee select karein'}, boxes mein files lagayein, phir Save All karein.</p>
          </div>
          <button type="button" aria-label="Close" disabled={saving} onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && <div role="alert" className="flex gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs break-words"><AlertTriangle size={16} className="shrink-0"/>{error}</div>}
          <div className="relative">
            <label className="block text-xs font-bold mb-1.5">{mode === 'Vehicle' ? 'Vehicle / Bike *' : 'Employee *'}</label>
            {employee ? (
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 dark:bg-slate-800 dark:border-slate-700 p-3 gap-2 text-sm">
                <span className="font-semibold">{employee.name} <span className="text-xs text-slate-500">{employee.code}</span></span>
                {!preselectedEntityId && <button type="button" disabled={saving} onClick={() => { setEmployee(null); setFiles({}); setQuery(''); }} className="text-blue-700 text-xs font-bold">Change</button>}
              </div>
            ) : (
              <>
                <div className="relative"><Search size={16} className="absolute top-3 left-3 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === 'Vehicle' ? 'Search bike plate number or code' : 'Search employee name or code'} className="w-full border dark:border-slate-700 dark:bg-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm"/></div>
                {query.trim().length >= 2 && <div className="relative z-20 mt-2 w-full max-h-[340px] overflow-y-auto overscroll-contain border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-lg divide-y divide-slate-100 dark:divide-slate-700">
                  {results.map((person) => <button key={person.id} type="button" onClick={() => { setEmployee(person); setQuery(''); setResults([]); setFiles({}); setError(''); }} className="block w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 text-sm min-h-12">{person.name} <span className="text-xs text-slate-500">{person.code}</span></button>)}
                  {!results.length && <p className="p-3 text-xs text-slate-500">No matching {mode === 'Vehicle' ? 'vehicle' : 'employee'} yet</p>}
                </div>}
              </>
            )}
          </div>
          {employee && (loading || loadingDocs) && <p className="text-sm text-slate-500">Loading document boxes...</p>}
          {employee && !loading && !loadingDocs && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {types.map((type) => {
              const matches = docs.filter((d) => d.document_type_id === type.id)
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
              const renderSlot = (slot: 'pdf' | 'front' | 'back' | 'file') => {
                const key = type.id + ':' + slot;
                const file = files[key];
                const existing = slot === 'file' ? matches[0] : matches.find((d) => slotOf(d) === slot);
                const preview = previews[key] || (existing ? savedPreviews[existing.id] : '');
                return <div key={slot} className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">{slot === 'file' ? 'Document file' : slot === 'pdf' ? 'Single PDF' : slot === 'front' ? 'Front image' : 'Back image'}</span>
                    {existing && <span className="text-[10px] text-emerald-700">Saved</span>}
                  </div>
                  <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    {preview ? ((slot === 'pdf' || (slot === 'file' && (file ? file.type === 'application/pdf' : !!existing && slotOf(existing) === 'pdf')))
                      ? <iframe src={preview + '#toolbar=0&navpanes=0&scrollbar=0'} title={labelFor(type) + ' PDF'} className="w-full h-full pointer-events-none border-0"/>
                      : <img src={preview} alt={labelFor(type) + ' ' + slot} className="h-full w-full object-contain"/>) :
                      <div className="text-center text-slate-400"><FileText size={20} className="mx-auto mb-1"/><span className="text-[11px]">Empty</span></div>}
                  </div>
                  {existing && <button type="button" onClick={async () => {
                    try {
                      const url = (await clientStorageService.getAuthorizedReadUrl(existing.id)).readUrl;
                      const blob = await (await fetch(url)).blob();
                      const objectUrl = URL.createObjectURL(blob);
                      window.open(objectUrl, '_blank', 'noopener,noreferrer');
                      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
                    } catch (e: any) { setError(e.message || 'Document could not open'); }
                  }} className="text-xs text-blue-700 font-semibold">View saved</button>}
                  <label className="block cursor-pointer text-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 py-2 text-xs font-bold">
                    {file ? 'Change selected' : existing ? 'Upload new version' : 'Choose file'}
                    <input type="file" accept={slot === 'pdf' ? '.pdf' : slot === 'file' ? '.pdf,.jpg,.jpeg,.png' : '.jpg,.jpeg,.png'} disabled={saving} className="sr-only" onChange={(e) => { selectFile(key, e.target.files?.[0]); e.target.value = ''; }}/>
                  </label>
                  {file && <div className="flex items-center justify-between gap-1 text-[11px] text-emerald-700">
                    <span className="truncate" title={file.name}>Ready: {file.name}</span>
                    <button type="button" disabled={saving} onClick={() => setFiles((previous) => {
                      const next = { ...previous }; delete next[key]; return next;
                    })} className="text-rose-600 shrink-0">Remove</button>
                  </div>}
                </div>;
              };
              return <div key={type.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 min-w-0 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm">{labelFor(type)}</h4>
                  {!!matches.length && <span className="text-[10px] text-emerald-700 bg-emerald-50 rounded px-2 py-1">Saved</span>}
                </div>
                {hasSides(type.id) ? <>
                  <p className="text-[11px] text-slate-500">Front aur back images, ya ek PDF select karein.</p>
                  <div className="grid grid-cols-2 gap-2">{renderSlot('front')}{renderSlot('back')}</div>
                  {renderSlot('pdf')}
                </> : renderSlot('file')}
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Expiry date
                  <input type="date" value={expiryDates[type.id] || ''} disabled={saving} onChange={(event) => {
                    setExpiryDates((previous) => ({ ...previous, [type.id]: event.target.value }));
                    setExpiryDirty((previous) => ({ ...previous, [type.id]: true }));
                  }} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1.5 text-xs" />
                </label>
              </div>;
            })}
            {!types.length && <p className="text-sm text-rose-600">No document types available. Please check Document Settings.</p>}
          </div>}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
          <span className="text-xs text-slate-500">{progress || `${Object.keys(files).length} files selected`}</span>
          <button type="button" disabled={!employee || (!Object.keys(files).length && !Object.values(expiryDirty).some(Boolean)) || saving || loadingDocs} onClick={saveAll} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
            {saving ? 'Uploading...' : <><Upload size={16}/> Save All Documents</>}
          </button>
        </div>
      </div>
    </div>
  );
};
