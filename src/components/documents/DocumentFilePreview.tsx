import React, { useEffect, useRef, useState } from 'react';
import { clientStorageService } from '../../services/fileStorageService';

interface Props {
  source?: string;
  documentId?: string;
  version?: number | string;
  fileName?: string;
  mimeType?: string;
  label: string;
  full?: boolean;
}

// Render PDFs ourselves rather than relying on the browser's embedded PDF viewer.
// The original document is never modified, and stored files are only fetched with authorization.
export function DocumentFilePreview({source,documentId,version,fileName,mimeType,label,full=false}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [visible,setVisible] = useState(full);
  const [image,setImage] = useState('');
  const [error,setError] = useState('');
  const [pdf,setPdf] = useState<any>(null);
  const [page,setPage] = useState(1);
  const [pageCount,setPageCount] = useState(0);
  const [loading,setLoading] = useState(true);
  const [rendering,setRendering] = useState(false);
  useEffect(() => {
    if (full || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const target=container.current;
    if (!target) return;
    const observer=new IntersectionObserver(entries => {
      if (entries.some(entry=>entry.isIntersecting)) {setVisible(true);observer.disconnect();}
    },{rootMargin:'100px'});
    observer.observe(target);
    return ()=>observer.disconnect();
  },[full]);

  useEffect(() => {
    let active=true;
    let task:any;
    const controller=new AbortController();
    setImage('');setError('');setPdf(null);setPage(1);setPageCount(0);setLoading(true);setRendering(false);
    if (!visible || (!source && !documentId)) return;
    const load=async()=>{
      try {
        const file=source ? {readUrl:source,mimeType:mimeType || ''} : await clientStorageService.getAuthorizedReadUrl(documentId!);
        if (!active) return;
        const isPdf=file.mimeType==='application/pdf' || mimeType==='application/pdf' || /\.pdf$/i.test(fileName || '') || file.readUrl.startsWith('data:application/pdf');
        if (!isPdf) {setImage(file.readUrl);return;}
        const response=await fetch(file.readUrl,{signal:controller.signal});
        if(!response.ok) throw new Error('PDF could not be read');
        const data=new Uint8Array(await response.arrayBuffer());
        const pdfjs=await import('pdfjs-dist');
        if(!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
        task=pdfjs.getDocument({data});
        const doc=await task.promise;
        if(active) {setPdf(doc);setPageCount(doc.numPages);}
      } catch(err:any) {if(active) setError(err?.message || 'Document preview unavailable');}
      finally {if(active) setLoading(false);}
    };
    void load();
    return ()=>{active=false;controller.abort();if(task) void task.destroy().catch(()=>{});};
  },[visible,source,documentId,version,fileName,mimeType]);

  useEffect(()=>{
    if(!pdf) return;
    let active=true;let renderTask:any;let pdfPage:any;
    setRendering(true);setImage('');setError('');
    const render=async()=>{
      try {
        pdfPage=await pdf.getPage(page);
        if(!active) return;
        const base=pdfPage.getViewport({scale:1});
        const max=full ? 1600 : 650;
        const viewport=pdfPage.getViewport({scale:Math.min(2,max/Math.max(base.width,base.height))});
        const canvas=window.document.createElement('canvas');
        const context=canvas.getContext('2d');
        if(!context) throw new Error('Preview renderer unavailable');
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        renderTask=pdfPage.render({canvas,canvasContext:context,viewport,background:'rgb(255,255,255)'});
        await renderTask.promise;
        if(active) setImage(canvas.toDataURL('image/png'));
      } catch(err:any){if(active) setError(err?.message || 'PDF page could not render');}
      finally{if(active)setRendering(false);}
    };
    void render();
    return()=>{active=false;if(renderTask)renderTask.cancel();};
  },[pdf,page,full]);
  const busy=loading || rendering || (pdf && !image && !error);
  return <div ref={container} className={full?'w-full flex flex-col items-center gap-2':'w-full h-full min-w-0 flex items-center justify-center overflow-hidden'}>
    {image && !error ? <img src={image} alt={label+(pageCount?' — page '+page:'')} onError={()=>setError('Image preview unavailable')} className={full?'w-full max-h-[65vh] object-contain rounded-lg':'w-full h-full object-contain'}/> :
      <p role={error?'alert':undefined} className="p-2 text-center text-xs text-slate-500 dark:text-slate-300">{error ? 'Preview unavailable — use Download' : busy ? 'Loading preview…' : 'No preview available'}</p>}
    {full && pageCount>1 && <div className="flex items-center gap-3 text-xs">
      <button type="button" disabled={page<=1||rendering} onClick={()=>setPage(p=>p-1)} className="px-3 py-2 border rounded-lg disabled:opacity-40">Previous</button>
      <span>Page {page} of {pageCount}</span>
      <button type="button" disabled={page>=pageCount||rendering} onClick={()=>setPage(p=>p+1)} className="px-3 py-2 border rounded-lg disabled:opacity-40">Next</button>
    </div>}
  </div>;
}
