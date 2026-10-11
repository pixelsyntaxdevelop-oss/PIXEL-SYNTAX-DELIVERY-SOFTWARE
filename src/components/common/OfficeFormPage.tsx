import React, { useEffect, useMemo, useRef, useState } from 'react';

// The preview and PDF share a complete A4 sheet, including its safe print margins.
export const OFFICE_FORM_WIDTH = 210 * 96 / 25.4;
const PAGE_HEIGHT = 297 * 96 / 25.4;

export function officeFormDocument(content: string, title: string, baseUrl: string): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  // Apply the same readable layout to previously generated attendance snapshots,
  // while keeping their saved wording and assignment details intact.
  const attendance = content.includes('Employee Attendance') && content.includes('Leave Undertaking');
  // Keep the header geometry identical while hiding form-number lines in new and saved forms.
  let pageContent = content.replace(
    /<(div|p|span)(\s[^>]*)?>\s*Forms?\s+(?:Number|No\.?)\s*:\s*[^<]*<\/\1>/gi,
    (element) => element.replace(/^<(\w+)/, '<$1 data-form-number-hidden="true" aria-hidden="true"')
  );
  // Compact the trust certificate header in both new forms and saved snapshots.
  pageContent = pageContent.replace(
    /<table\b[^>]*class=["'][^"']*\bdeposit-trust-header\b[^"']*["'][^>]*>[\s\S]*?<\/table>/gi,
    (header) => header.replace(
      /<(div|p|span)\b[^>]*>\s*(?:Dubai|Forms?\s+(?:Number|No\.?)\s*:\s*[^<]*)\s*<\/\1>/gi,
      ''
    )
  );
  if (attendance) {
    if (!pageContent.includes('attendance-undertaking-document')) pageContent = pageContent.replace('<div ', '<div class="attendance-undertaking-document" ');
    if (!pageContent.includes('attendance-signature')) pageContent = pageContent.replace(/<\/div>\s*$/, "<div class=\"attendance-signature\" style=\"margin-top:18px;min-height:66px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;font-size:13px;\"><span>Rider / Employee Signature: ____________________</span><span lang=\"ar\" dir=\"rtl\">توقيع السائق / الموظف: ____________________</span></div>" + '</div>');
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><meta name="viewport" content="width=${OFFICE_FORM_WIDTH},initial-scale=1"><base href="${escape(baseUrl)}"><title>${escape(title)}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 210mm; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 14px; -webkit-text-size-adjust: none; text-size-adjust: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { min-height: 297mm; padding: 10mm; }
      table { border-collapse: collapse; }
      body > div { max-width: 100%; }
      @media print { html, body { width: 210mm; } }
      .attendance-undertaking-document { padding: 0 !important; min-height: 277mm !important; display: flex; flex-direction: column; }
      .attendance-undertaking-document > table { flex: 0 0 auto; margin-bottom: 16px !important; }
      .attendance-undertaking-document > div:not(.attendance-signature) { flex: 1; display: flex; flex-direction: column; }
      .attendance-undertaking-document > div:not(.attendance-signature) > table { flex: 1; height: 100%; }
      .attendance-undertaking-document td[lang="en"] { font-size: 12px !important; line-height: 18px !important; padding: 12px 10px !important; }
      .attendance-undertaking-document td[lang="ar"] { font-size: 13px !important; line-height: 20px !important; padding: 12px 10px !important; }
      .attendance-undertaking-document td p { margin-bottom: 10px !important; }
      .attendance-undertaking-document .attendance-signature { flex: 0 0 auto; break-inside: avoid; }
      .deposit-trust-document { min-height: 277mm; display: flex; flex-direction: column; }
      .deposit-trust-document > .deposit-trust-header { flex: 0 0 auto; }
      .deposit-trust-header td { height: auto !important; padding: 12px 8px !important; text-align: center; vertical-align: middle; }
      .deposit-trust-body { flex: 1; display: flex; flex-direction: column; }
      .deposit-trust-body > table { flex: 1; height: 100%; }
      .deposit-trust-body th { height: 30px; }
      .deposit-trust-body td { text-align: justify; }
      .deposit-trust-signature { flex: 0 0 auto; }
      img { max-width: 100%; }
      [data-form-number-hidden] { visibility: hidden !important; }
      .no-print { display: none !important; }
    </style></head><body>${pageContent}</body></html>`;
}

export const OfficeFormPage: React.FC<{ content: string; title: string }> = ({ content, title }) => {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(PAGE_HEIGHT);
  const srcDoc = useMemo(() => officeFormDocument(content, title, window.location.href), [content, title]);

  useEffect(() => {
    const target = container.current;
    if (!target) return;
    const resize = () => setScale(Math.min(1, target.clientWidth / OFFICE_FORM_WIDTH));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHeight(PAGE_HEIGHT);
    const iframe = frame.current;
    let observer: ResizeObserver | undefined;
    const measure = () => {
      const body = iframe?.contentDocument?.body;
      if (body) setHeight(Math.max(PAGE_HEIGHT, body.scrollHeight, body.getBoundingClientRect().height));
    };
    const loaded = () => {
      observer?.disconnect();
      const body = iframe?.contentDocument?.body;
      if (body) {
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
      measure();
    };
    iframe?.addEventListener('load', loaded);
    return () => { iframe?.removeEventListener('load', loaded); observer?.disconnect(); };
  }, [srcDoc]);

  return (
    <div ref={container} className="w-full min-w-0" style={{ overflow: 'hidden' }}>
      <div style={{ width: OFFICE_FORM_WIDTH * scale, height: height * scale, margin: '0 auto', position: 'relative' }}>
        <iframe ref={frame} title={title} srcDoc={srcDoc} sandbox="allow-same-origin"
          style={{ width: OFFICE_FORM_WIDTH, height, position: 'absolute', top: 0, left: 0, border: 0, display: 'block', background: '#fff', transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }} />
      </div>
    </div>
  );
};
