/**
 * Authoritative Office Forms Templates and Schemas (Runtime-Neutral)
 * Pure data models and initial templates safe for Cloudflare Worker and Express runtimes.
 * Zero dependencies on Express, body-parser, or Node HTTP streams.
 */

export interface FormTemplateTypeRecord {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string;
  category: 'HR' | 'FLEET' | 'TELECOM' | 'LEGAL' | 'GENERAL' | 'ASSETS';
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormTemplateRecord {
  id: string;
  tenant_id: string;
  name: string;
  template_type: string; // e.g. 'BIKE_UNDERTAKING' | 'SIM_UNDERTAKING' | 'ASSET_HANDOVER' | 'SALARY_CERTIFICATE' | 'GENERAL_POLICY' | 'NOC_REQUEST' | 'DEPOSIT_FORM'
  description: string;
  category: 'HR' | 'FLEET' | 'TELECOM' | 'LEGAL' | 'GENERAL' | 'ASSETS';
  content: string; // HTML template with {{placeholders}}
  placeholders: string[];
  version: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedFormRecord {
  id: string;
  tenant_id: string;
  form_number: string; // e.g. OF-2026-0001
  document_serial: string;
  form_title: string;
  template_id: string;
  template_name: string;
  template_type: string;
  category: string;
  template_version?: number;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  emirates_id?: string;
  passport_number?: string;
  vehicle_plate?: string;
  sim_number?: string;
  project_name?: string;
  issuance_branch: string;
  rendered_content: string;
  snapshot_data: Record<string, any>;
  status: 'GENERATED' | 'SIGNED' | 'APPROVED' | 'ARCHIVED' | 'VOID';
  void_reason?: string;
  voided_at?: string;
  voided_by?: string;
  voided_by_id?: string;
  signed_file_url?: string;
  signed_file_name?: string;
  signed_at?: string;
  signed_by?: string;
  signed_uploaded_by?: string;
  signed_uploaded_by_id?: string;
  generated_by: string;
  generated_by_id: string;
  generated_at: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  generated_by_name?: string;
}

/**
 * Server-side HTML Sanitization:
 * Strictly blocks <script>, inline JS event handlers, executable elements, and unsafe URL protocols.
 * Preserves safe document elements: tables, English and Arabic text, RTL formatting, safe images, and layout styles.
 */
export function sanitizeTemplateHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  let sanitized = html;

  // 1. Strip all <script>...</script> tags and unclosed script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<\/?script\b[^>]*>/gi, '');

  // 2. Strip dangerous embedded / executable container tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<\/?iframe\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<\/?object\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/?embed\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/?applet\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/?meta\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/?link\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
  sanitized = sanitized.replace(/<\/?form\b[^>]*>/gi, '');

  // 3. Strip all inline JavaScript event handlers (e.g. onclick, onload, onerror, onmouseover, etc.)
  sanitized = sanitized.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 4. Strip unsafe executable URI schemes from href and src (javascript:, vbscript:, data:text/html)
  sanitized = sanitized.replace(/\s+(href|src)\s*=\s*["']?\s*(?:javascript|vbscript|data:\s*text\/html):[^"'>\s]*/gi, ' $1="#"');

  // 5. Clean CSS expressions or script bindings in style attributes
  sanitized = sanitized.replace(/style\s*=\s*(["'])(.*?)\1/gi, (_match, quote, styleContent) => {
    const cleanStyle = styleContent
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/javascript\s*:[^;]*/gi, '')
      .replace(/-moz-binding\s*:[^;]*/gi, '');
    return `style=${quote}${cleanStyle}${quote}`;
  });

  return sanitized;
}

export const initialFormTemplateTypes: FormTemplateTypeRecord[] = [
  {
    id: 'type_fleet_handover',
    tenant_id: 'company_pixel_syntax',
    code: 'FLEET_HANDOVER',
    name: 'Fleet & Vehicle Handover',
    description: 'Vehicle custody, motorcycle handover undertakings, fine liability, and maintenance agreements.',
    category: 'FLEET',
    color: '#059669',
    is_active: true,
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'type_telecom_sim',
    tenant_id: 'company_pixel_syntax',
    code: 'TELECOM_SIM',
    name: 'SIM Card & Device Handover',
    description: 'Corporate SIM card assignments, telecom compliance, data usage, and device tracking.',
    category: 'TELECOM',
    color: '#0284c7',
    is_active: true,
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'type_hr_undertaking',
    tenant_id: 'company_pixel_syntax',
    code: 'HR_UNDERTAKING',
    name: 'HR Undertakings & Policies',
    description: 'General conduct, company code of ethics, safety compliance, and employee acknowledgements.',
    category: 'HR',
    color: '#2563eb',
    is_active: true,
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'type_asset_liability',
    tenant_id: 'company_pixel_syntax',
    code: 'ASSET_LIABILITY',
    name: 'Asset & Equipment Custody',
    description: 'Delivery box, uniform, safety gear, helmet, POS machine, and smartphone hardware handover.',
    category: 'ASSETS',
    color: '#d97706',
    is_active: true,
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'type_certificate_noc',
    tenant_id: 'company_pixel_syntax',
    code: 'CERTIFICATE_NOC',
    name: 'Certificates & NOCs',
    description: 'Salary certificates, No Objection Certificates for driving licenses, banks, and consular embassies.',
    category: 'HR',
    color: '#7c3aed',
    is_active: true,
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'type_passport_custody',
    tenant_id: 'company_pixel_syntax',
    code: 'PASSPORT_CUSTODY',
    name: 'Passport Custody & Vault',
    description: 'Deposit receipts, safe custody acknowledgement, and temporary passport release undertakings.',
    category: 'LEGAL',
    color: '#e11d48',
    is_active: true,
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
];

// Employee Forms catalog; SIM templates remain available to the SIM undertaking workflow.
export const EMPLOYEE_FORM_TEMPLATE_IDS = ['tmpl_asset_acknowledgment', 'tmpl_bike_undertaking', 'tmpl_commitment_letter', 'tmpl_deposit_trust', 'tmpl_attendance_leave', 'tmpl_employment_agreement'] as const;
export const isEmployeeFormTemplate = (id: string) => (EMPLOYEE_FORM_TEMPLATE_IDS as readonly string[]).includes(id);

// Fixed particulars supplied in the approved LT0018 reference.
export const DEPOSIT_TRUST_REFERENCE_DEFAULTS = {
  deposit_address: 'Abu Dhabi',
  creditor_name: 'System User',
  creditor_emirates_id: '',
  deposit_amount: '',
} as const;

export const initialFormTemplates: FormTemplateRecord[] = [
  {
    id: 'tmpl_bike_undertaking',
    tenant_id: 'company_pixel_syntax',
    name: 'Bike Undertaking',
    template_type: 'BIKE_UNDERTAKING',
    description: 'Forms Number: LT0016 - Allied Delivery Services official Bike Undertaking for food/grocery delivery vehicle handover.',
    category: 'FLEET',
    placeholders: [
      'employee_name',
      'mobile_number',
      'company_mobile',
      'company_mbl',
      'passport_number',
      'emirates_id',
      'current_bike',
      'bike_number',
      'project',
      'date',
      'issue_date',
      'company_logo_html',
    ],
    version: 6,
    content: `
<div class="bike-undertaking-document" style="font-family: Arial, Helvetica, sans-serif; width: 100%; max-width: 1200px; min-height: 640px; margin: 0 auto; padding: 18px; color: #293241; background: #fff; box-sizing: border-box; font-size: 12px;">
  <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 22px;">
    <tr>
      <td style="width: 20%; height: 106px; border: 1px solid #111; text-align: center; vertical-align: middle; padding: 8px;">{{company_logo_html}}</td>
      <td style="width: 80%; border: 1px solid #111; text-align: center; vertical-align: middle; padding: 8px;">
        <div style="font-size: 23px; line-height: 28px; font-weight: 700; color: #101827;">Bike Undertaking</div>
        <div style="font-size: 15px; font-weight: 700; color: #101827;">Pixel Syntax Delivery Software</div>
        <div style="font-size: 11px; margin-top: 4px;">Dubai</div>
        <div style="font-size: 12px; margin-top: 7px; color: #111;">Forms Number: LT0016</div>
      </td>
    </tr>
  </table>
  <div style="position: relative;">
    <div style="position: absolute; top: 110px; left: 28%; width: 50%; opacity: 0.045; pointer-events: none; z-index: 0; text-align: center;">{{company_logo_html}}</div>
    <table style="position: relative; z-index: 1; width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; line-height: 18px; color: #293241;">
      <tr><td style="border: 1px solid #111; padding: 5px 6px; font-weight: 700;">Name : {{employee_name}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 5px 6px;">Company Mbl: {{company_mobile}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 5px 6px;">Passport Num: {{passport_number}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 5px 6px;">EID Number: {{emirates_id}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 5px 6px;">Bike Number: {{current_bike}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 5px 6px; font-weight: 700;">Project: {{project}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 5px 6px;">Issue Date: {{date}}</td></tr>
      <tr><td style="border: 1px solid #111; padding: 7px 6px; line-height: 18px;">I am writing to confirm that I am utilizing the assigned Bike {{current_bike}}, strictly for food/grocery delivery purposes. I fully understand the importance of adhering to the designated purpose for this vehicle, and I assure you that it will not be used for any other activities outside of this scope.</td></tr>
    </table>
  </div>
  <div style="font-size: 12px; margin: 2px 6px 0;">Employee Sign</div>
  <div style="font-size: 12px; margin: 46px 6px 0;">Employee Thumb</div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-09-13T10:00:00Z',
  },
  {
    id: 'tmpl_sim_undertaking',
    tenant_id: 'company_pixel_syntax',
    name: 'SIM Undertaking',
    template_type: 'SIM_UNDERTAKING',
    description: 'Formal SIM card custody undertaking (Forms Number: LT0020).',
    category: 'TELECOM',
    placeholders: [
      'employee_name',
      'employee_id',
      'employee_code',
      'employee_identifier',
      'emirates_id',
      'current_sim',
      'company_name',
    ],
    version: 2,
    content: `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; padding: 28px 32px; color: #000; line-height: 1.6; background: #ffffff;">
  <!-- BORDERED TABLE HEADER - EXACT OLD STYLE -->
  <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 24px;">
    <tr>
      <td style="width: 32%; border: 1.5px solid #000; padding: 12px 10px; text-align: center; vertical-align: middle;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div style="font-family: Arial, sans-serif; font-weight: 900; font-size: 24px; letter-spacing: 1px;">
            <span style="color: #10b981;">ALLIE</span><span style="color: #0f172a;">D</span>
          </div>
          <svg width="34" height="34" viewBox="0 0 64 64" fill="#0f172a" style="display: inline-block;">
            <path d="M48 24h-6l-2-6h-8l-2 4h-4v2h5l1.5-3h5.5l2 6h-6v2h7l2 6h-7v2h8.5l-1 3H20l-1-3h8v-2h-9l1.5-4.5L18 20H12v-2h7l1.8-5.4A2 2 0 0 1 22.7 11h8.6a2 2 0 0 1 1.9 1.4L35 18h9v6z" fill="#0f172a" />
            <rect x="14" y="14" width="10" height="10" rx="1.5" fill="#059669" />
            <circle cx="28" cy="12" r="4.5" fill="#0f172a" />
            <circle cx="16" cy="42" r="8" stroke="#0f172a" stroke-width="4" fill="none" />
            <circle cx="16" cy="42" r="3" fill="#10b981" />
            <circle cx="48" cy="42" r="8" stroke="#0f172a" stroke-width="4" fill="none" />
            <circle cx="48" cy="42" r="3" fill="#10b981" />
            <path d="M4 38h8M2 42h6M6 46h6" stroke="#10b981" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div style="font-size: 9.5px; font-weight: bold; color: #10b981; margin-top: 3px; text-align: center;">الأنيـد لتوصيـل الطلبـات ش.ذ.م.م</div>
        <div style="font-size: 8px; font-weight: bold; color: #1e293b; text-align: center; letter-spacing: 0.5px;">Pixel Syntax Delivery Software</div>
      </td>
      <td style="width: 68%; border: 1.5px solid #000; padding: 12px 16px; text-align: center; vertical-align: middle;">
        <h2 style="margin: 0 0 4px 0; font-size: 19px; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: 0.5px;">SIM Undertaking</h2>
        <h3 style="margin: 0 0 3px 0; font-size: 15px; font-weight: bold; color: #000;">Pixel Syntax Delivery Software</h3>
        <div style="margin: 0 0 4px 0; font-size: 13px; font-weight: normal; color: #000;">Dubai</div>
        <div style="margin: 0; font-size: 12px; font-weight: bold; color: #000;">Forms Number: LT0020</div>
      </td>
    </tr>
  </table>

  <!-- FIRST PARAGRAPH - EXACT OLD STYLE -->
  <p style="font-size: 13.5px; line-height: 1.7; margin-bottom: 20px; text-align: justify; color: #000;">
    ,I, <strong style="text-decoration: underline;">{{employee_name}}</strong>, {{employee_identifier}} hereby acknowledge that I have received the <strong style="text-decoration: underline;">{{current_sim}}</strong> Company SIM card from Allied Delivery Services for official business purposes.
  </p>

  <!-- NUMBERED TERMS INTRO -->
  <p style="font-size: 13.5px; font-weight: bold; margin-bottom: 12px; color: #000;">
    I undertake and agree to the following:
  </p>

  <!-- NUMBERED TERMS 1 - 9 -->
  <ol style="font-size: 13px; line-height: 1.75; margin-bottom: 24px; padding-left: 24px; color: #000;">
    <li style="margin-bottom: 8px;">The SIM card provided to me is the property of Pixel Syntax Delivery Software and is issued solely for official business and operational communication.</li>
    <li style="margin-bottom: 8px;">I shall be personally responsible for the safekeeping and proper handling of the SIM card at all times and will not hand it over or transfer it to any unauthorized person.</li>
    <li style="margin-bottom: 8px;">I will not use this SIM card for any illegal, unauthorized, fraudulent, or personal international activities and premium services.</li>
    <li style="margin-bottom: 8px;">In the event of loss, theft, or damage to the SIM card, I will immediately report it to Pixel Syntax Delivery Software management within 24 hours so the number can be barred immediately.</li>
    <li style="margin-bottom: 8px;">Any replacement costs, re-issuance fees, or financial penalties resulting from negligence or loss of the SIM card will be borne by me and deducted from my monthly salary.</li>
    <li style="margin-bottom: 8px;">Any usage charges, international calling, roaming fees, or data usage exceeding the allocated monthly package limit will be my direct financial responsibility and deducted from my payroll.</li>
    <li style="margin-bottom: 8px;">I agree to keep the SIM card active, powered, and inserted in the designated delivery smartphone during working hours to maintain uninterrupted contact with dispatch and customers.</li>
    <li style="margin-bottom: 8px;">The company reserves the right to inspect, audit, suspend, or retrieve the SIM card connection at any time without prior notice.</li>
    <li style="margin-bottom: 8px;">Upon resignation, project transfer, or termination of employment, I agree to return the SIM card immediately in good condition to Pixel Syntax Delivery Software.</li>
  </ol>

  <!-- ACCEPTANCE PARAGRAPH -->
  <p style="font-size: 13.5px; line-height: 1.6; margin-bottom: 38px; text-align: justify; color: #000;">
    I confirm that I have read, understood, and accepted the above terms and conditions and agree to abide by them.
  </p>

  <!-- BOTTOM SECTION - ONLY EMPLOYEE, BLANK DATE -->
  <div style="margin-top: 36px; font-size: 13.5px; color: #000; line-height: 2;">
    <div style="margin-bottom: 18px;">
      <strong>Employee Name:</strong> {{employee_name}}
    </div>
    <div style="margin-bottom: 24px;">
      <strong>Employee Signature:</strong> ____________________
    </div>
    <div>
      <strong>Date:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    </div>
  </div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'tmpl_asset_acknowledgment',
    tenant_id: 'company_pixel_syntax',
    name: 'Acknowledgment of Company Assets',
    template_type: 'ASSET_LIABILITY',
    description: 'Bilingual A4 acknowledgment of SIM card, bike, rider kit and delivery box, with employee signature and thumb impression.',
    category: 'ASSETS',
    placeholders: ['employee_name', 'employee_full_name', 'arabic_name', 'company_name', 'company_logo_html', 'current_bike', 'current_sim', 'date'],
    version: 2,
    content: `
<div class="company-assets-document" style="font-family:Arial,Helvetica,sans-serif;width:100%;margin:0;color:#111;background:#fff;min-height:277mm;display:flex;flex-direction:column;">
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #111;margin-bottom:14px;flex:0 0 auto;">
    <tr>
      <td style="width:22%;border:1px solid #111;height:88px;padding:8px;text-align:center;vertical-align:middle;">{{company_logo_html}}</td>
      <td style="border:1px solid #111;padding:12px;text-align:center;vertical-align:middle;">
        <div style="font-size:20px;font-weight:700;line-height:26px;">Acknowledgment of Company Assets</div>
        <div lang="ar" dir="rtl" style="font-size:17px;font-weight:700;line-height:24px;margin-top:4px;">إقرار باستلام ممتلكات الشركة</div>
        <div style="font-size:13px;font-weight:600;line-height:18px;margin-top:4px;">{{company_name}}</div>
      </td>
    </tr>
  </table>
  <div class="company-assets-body" style="flex:1;display:flex;flex-direction:column;">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #111;flex:1;height:100%;">
      <tr style="height:36px;">
        <th style="width:50%;border:1px solid #111;padding:8px;text-align:left;font-size:13px;line-height:18px;">Acknowledgment of Company Assets</th>
        <th lang="ar" dir="rtl" style="width:50%;border:1px solid #111;padding:8px;text-align:right;font-size:14px;line-height:20px;">إقرار باستلام ممتلكات الشركة</th>
      </tr>
      <tr style="height:40px;">
        <td style="border:1px solid #111;padding:8px 10px;font-size:15px;font-weight:700;line-height:22px;">{{employee_full_name}}</td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:8px 10px;font-size:15px;font-weight:700;line-height:22px;">{{employee_name}}</td>
      </tr>
      <tr style="height:100px;">
        <td lang="en" style="border:1px solid #111;padding:10px;font-size:14px;line-height:21px;vertical-align:top;">
          <p style="font-weight:700;margin:0 0 8px;">We congratulate you for joining {{company_name}}.</p>
          <p style="margin:0;">Please find the SIM card, bike, rider kit and delivery box listed below, handed over to you to support you in carrying out your duties.</p>
        </td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:10px;font-size:15px;line-height:23px;vertical-align:top;text-align:right;">
          <p style="font-weight:700;margin:0 0 8px;">نهنئك بانضمامك إلى {{company_name}}.</p>
          <p style="margin:0;">تم تسليمك شريحة الاتصال والدراجة ومستلزمات السائق وصندوق التوصيل الموضحة أدناه لدعمك في أداء مهامك.</p>
        </td>
      </tr>
      <tr style="height:32px;">
        <th style="border:1px solid #111;padding:6px 10px;text-align:left;font-size:13px;line-height:18px;">Serial No. / Particulars / Quantity</th>
        <th lang="ar" dir="rtl" style="border:1px solid #111;padding:6px 10px;text-align:right;font-size:14px;line-height:20px;">الرقم / التفاصيل / الكمية</th>
      </tr>
      <tr style="height:42px;">
        <td style="border:1px solid #111;padding:8px 10px;font-size:14px;line-height:20px;"><b>SIM Card:</b> {{current_sim}}</td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:8px 10px;font-size:15px;line-height:22px;text-align:right;"><b>شريحة الاتصال:</b> <span dir="ltr">{{current_sim}}</span></td>
      </tr>
      <tr style="height:42px;">
        <td style="border:1px solid #111;padding:8px 10px;font-size:14px;line-height:20px;"><b>Bike Number:</b> {{current_bike}}</td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:8px 10px;font-size:15px;line-height:22px;text-align:right;"><b>رقم الدراجة:</b> <span dir="ltr">{{current_bike}}</span></td>
      </tr>
      <tr style="height:42px;">
        <td style="border:1px solid #111;padding:8px 10px;font-size:14px;line-height:20px;"><b>Rider Kit:</b> 1</td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:8px 10px;font-size:15px;line-height:22px;text-align:right;"><b>مستلزمات السائق:</b> 1</td>
      </tr>
      <tr style="height:42px;">
        <td style="border:1px solid #111;padding:8px 10px;font-size:14px;line-height:20px;"><b>Delivery Data Box:</b> 1</td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:8px 10px;font-size:15px;line-height:22px;text-align:right;"><b>صندوق التوصيل:</b> 1</td>
      </tr>
      <tr>
        <td lang="en" style="border:1px solid #111;padding:12px 10px;vertical-align:top;font-size:14px;line-height:22px;text-align:justify;">
          <p style="margin:0 0 12px;">I hereby acknowledge that I have received the above-mentioned assets provided by {{company_name}}. I understand that these assets are the property of the company and are entrusted to me solely for performing my official duties.</p>
          <p style="margin:0;">I assure you that I will take every possible measure to safeguard these assets while they are under my care. I also consent to returning them promptly in the event of my resignation or if I take extended leave abroad.</p>
        </td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;padding:12px 10px;vertical-align:top;font-size:15px;line-height:24px;text-align:justify;">
          <p style="margin:0 0 12px;">أقر بموجب هذا بأنني استلمت الممتلكات المذكورة أعلاه من {{company_name}}. وأفهم أن هذه الممتلكات ملك للشركة وقد عُهد بها إليّ فقط لأداء مهامي الرسمية.</p>
          <p style="margin:0;">أتعهد باتخاذ جميع الإجراءات الممكنة للحفاظ على هذه الممتلكات أثناء وجودها في عهدتي. كما أوافق على إعادتها فورًا في حال استقالتي أو حصولي على إجازة طويلة خارج البلاد.</p>
        </td>
      </tr>
    </table>
  </div>
  <div class="company-assets-signature" style="flex:0 0 auto;margin-top:18px;min-height:166px;break-inside:avoid;font-size:13px;line-height:20px;">
    <div style="margin-bottom:10px;"><b>Name / الاسم:</b> {{employee_full_name}}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr>
        <td style="width:55%;vertical-align:top;padding-right:24px;">
          <div style="font-weight:700;">Employee Sign / توقيع الموظف</div>
          <div style="height:60px;border-bottom:1px solid #111;margin-bottom:10px;"></div>
          <div><b>Date / التاريخ:</b> {{date}}</div>
        </td>
        <td style="width:45%;vertical-align:top;padding-left:14px;">
          <div style="font-weight:700;margin-bottom:8px;">Employee Thumb / بصمة الموظف</div>
          <div style="width:130px;height:105px;border:1px dashed #111;"></div>
        </td>
      </tr>
    </table>
  </div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-10-10T16:00:00Z',
  },
  {
    id: 'tmpl_deposit_trust',
    tenant_id: 'company_pixel_syntax',
    name: 'Certificate Of Deposit In Trust',
    template_type: 'DEPOSIT_FORM',
    description: 'Bilingual LT0018 cash deposit certificate with employee details and approved reference particulars, automatically populated.',
    category: 'LEGAL',
    placeholders: [
      'employee_name', 'arabic_name', 'passport_number', 'company_mobile',
      'deposit_address', 'creditor_name', 'creditor_emirates_id', 'deposit_amount',
      'date',
    ],
    version: 6,
    content: `
<div class="deposit-trust-document" style="font-family:Arial,Helvetica,sans-serif;width:100%;margin:0 auto;color:#111;background:#fff;">
  <table class="deposit-trust-header" style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #111;margin:0 0 14px 0;">
    <tr>
      <td style="text-align:center;vertical-align:middle;padding:12px 8px;">
        <div style="font-size:20px;font-weight:700;line-height:24px;">Certificate Of Deposit In Trust</div>
      </td>
    </tr>
  </table>
  <div class="deposit-trust-body">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #111;">
      <tr>
        <th style="width:50%;border:1px solid #111;text-align:left;font-size:12px;padding:6px 8px;font-weight:600;">Certificate Of Deposit In Trust</th>
        <th lang="ar" dir="rtl" style="width:50%;border:1px solid #111;text-align:right;font-size:12px;padding:6px 8px;font-weight:600;">سند أمانة</th>
      </tr>
      <tr>
        <td lang="en" style="border:1px solid #111;vertical-align:top;padding:10px;font-size:15px;line-height:22px;font-weight:600;overflow-wrap:break-word;">
          I am the signatory below: {{employee_name}}, Holder of Passport No. {{passport_number}}. I acknowledge with full legal capacity that I received from Mr. {{creditor_name}}, UAE nationality ID No. {{creditor_emirates_id}}, an amount of AED: {{deposit_amount}} in cash. And that this amount is available to me as a matter of honesty. I undertake to return it to its owner in full upon request; without any delay, and I undertake to bear all civil and criminal responsibilities in the event that I do not return this amount to its owner in full, and I acknowledge that this bond is like a final and conclusive judgment, as if issued by the competent court, and that I waive my right to appeal it or its contents with any official reference or with the competent enforcement departments, and the creditor has the right to execute it with the competent enforcement departments at any time he wants, with my admission in advance that this bond is clear and known to me and does not need an explanation, and I also drop my right to claim its invalidity for any reason whatsoever and I never have the right to request its installment and I drop my right to claim that this statement is false, or to request to swear an oath on the validity of this statement, as well as I drop my right to claim that my signature is forged or denied, and that my signature below is an acknowledgement of the above.
        </td>
        <td lang="ar" dir="rtl" style="border:1px solid #111;vertical-align:top;text-align:right;padding:10px;font-family:Arial,Tahoma,sans-serif;font-size:16px;line-height:26px;font-weight:600;overflow-wrap:break-word;">
          أنا الموقع أدناه: {{arabic_name}}، حامل جواز سفر رقم {{passport_number}}. أقر وأنا بكامل الأهلية القانونية بأني استلمت من السيد {{creditor_name}}، إماراتي الجنسية، هوية رقم {{creditor_emirates_id}}، مبلغاً وقدره {{deposit_amount}} درهم نقداً، وأن هذا المبلغ متوفر عندي على سبيل الأمانة. وأتعهد برده لصاحبه كاملاً عند الطلب، ودون أي تأخير. وأتعهد بتحمل كافة المسؤوليات المدنية والجزائية في حال عدم إعادتي لهذا المبلغ لصاحبه كاملاً. وأقر بأن هذا السند هو بمثابة حكم مبرم وقطعي وكأنه صادر عن المحكمة المختصة، وأني أسقط حقي بالطعن به أو بمحتوياته لدى أي مرجع رسمي أو لدى دوائر التنفيذ المختصة. ويحق للدائن تنفيذه لدى دوائر التنفيذ المختصة في أي وقت يريده مع إقراري وعلمي بأن هذا السند واضح ومعلوم لدي ولا يحتاج إلى تفسير. وأني أسقط حقي بالادعاء ببطلانه لأي سبب كان، ولا يحق لي طلب تقسيط مبلغه، كما أسقط حقي بالادعاء ببطلان أو كذب هذا الإقرار أو طلب تحليف اليمين القانونية على صحة هذا الإقرار، وأن توقيعي أدناه إقرار مني بما ورد أعلاه.
        </td>
      </tr>
    </table>
  </div>
  <div class="deposit-trust-signature" style="font-size:12px;padding-top:10px;break-inside:avoid;">
    <div>Date: {{date}}</div>
    <div style="margin-top:10px;display:flex;justify-content:space-between;gap:16px;"><span>Name: {{employee_name}}</span><span lang="ar" dir="rtl">الاسم: {{arabic_name}}</span></div>
    <div style="margin-top:12px;display:flex;justify-content:space-between;"><span>Sign / Signature</span><span lang="ar" dir="rtl">التوقيع</span></div>
    <div style="height:36px;border-bottom:1px solid #111;width:55%;"></div>
  </div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-10-07T00:00:00Z',
  },
  {
    id: 'tmpl_commitment_letter',
    tenant_id: 'company_pixel_syntax',
    name: 'Employee Acknowledgment & Commitment Letter',
    template_type: 'HR_UNDERTAKING',
    description: 'Exact bilingual saved body containing company rules, road safety, COD remittance, and employee undertakings.',
    category: 'HR',
    placeholders: [
      'employee_name',
      'employee_id',
      'employee_code',
      'emirates_id',
      'mobile',
      'company_name',
      'branch',
      'project',
      'date',
      'reference_no',
      'company_logo_html',
      'company_mobile',
      'passport_number',
    ],
    version: 4,
    content: `
<div style="font-family:Arial,Helvetica,sans-serif;width:100%;max-width:1200px;min-height:880px;margin:0 auto;padding:18px;color:#111;background:#fff;box-sizing:border-box;">
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:18px;"><tr>
    <td style="width:20%;height:88px;border:1px solid #111;text-align:center;vertical-align:middle;padding:8px;">{{company_logo_html}}</td>
    <td style="width:80%;border:1px solid #111;text-align:center;vertical-align:middle;padding:8px;">
      <div style="font-size:16px;font-weight:700;line-height:20px;">Employee Acknowledgment &amp; Commitment Letter</div>
      <div style="font-size:13px;">Pixel Syntax Delivery Software</div>
      <div style="font-size:10px;">Dubai</div>
      <div style="font-size:10px;margin-top:6px;">Forms Number: LT0019</div>
    </td>
  </tr></table>
  <table style="font-size:10px;border-collapse:collapse;margin:0 6px 12px;"><tr><td style="padding:6px 20px 6px 0;">EID No</td><td>{{emirates_id}}</td></tr><tr><td style="padding:6px 20px 6px 0;">Company Sim</td><td>{{company_mobile}}</td></tr><tr><td style="padding:6px 20px 6px 0;">Passport No</td><td>{{passport_number}}</td></tr></table>
  <div style="position:relative;margin:0 6px;">
    <div style="position:absolute;top:160px;left:28%;width:44%;opacity:0.06;pointer-events:none;">{{company_logo_html}}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;position:relative;">
      <tr><td colspan="2" style="border:1px solid #111;text-align:center;font-size:10px;padding:6px;">{{employee_name}}</td></tr>
      <tr><td colspan="2" style="border:1px solid #111;text-align:center;font-size:10px;padding:6px;">Employee Acknowledgment &amp; Commitment Letter (خطاب إقرار والتزام الموظف)</td></tr>
      <tr>
        <td style="width:50%;border:1px solid #111;padding:12px 5px;vertical-align:top;font-size:9px;line-height:16px;height:410px;">
          <p style="margin:0 0 8px;">Employee Acknowledgment &amp; Commitment Letter</p><ol style="padding-left:14px;margin:0;line-height:16px;">
          <li><strong>UAE Laws &amp; Company Bylaws:</strong> I commit to strict adherence to UAE Labour Laws, traffic regulations, and all internal administrative and operational policies.</li>
          <li><strong>Road Safety &amp; Helmet:</strong> I agree to ride safely, obey designated speed limits, avoid mobile phone usage while driving, and wear my protective helmet and gear at all times.</li>
          <li><strong>COD Remittance:</strong> I pledge to remit all customer Cash-on-Delivery collections daily to authorized company kiosks before the conclusion of my shift without any delay.</li>
          <li><strong>Custody of Assets:</strong> I undertake to maintain company property (motorcycles, SIM cards, POS devices, delivery gear) in proper condition and return them upon termination.</li>
          <li><strong>Violations Liability:</strong> I bear sole personal responsibility for any traffic or municipal fines arising from non-compliance or unauthorized driving.</li>
        </ol>
        </td>
        <td dir="rtl" style="width:50%;border:1px solid #111;padding:12px 5px;vertical-align:top;font-size:10px;line-height:18px;text-align:right;">
          <p style="margin:0 0 8px;">خطاب إقرار والتزام الموظف</p><ol style="padding-right:14px;margin:0;line-height:18px;">
          <li><strong>قوانين الدولة ولوائح الشركة:</strong> أتعهد بالالتزام التام بقوانين العمل والأنظمة المرورية في دولة الإمارات العربية المتحدة وكافة السياسات التشغيلية المعتمدة.</li>
          <li><strong>السلامة المرورية والخوذة:</strong> ألتزم بالقيادة الآمنة والتقيد بالسرعات المحددة وارتداء الخوذة الواقية ومعدات السلامة طوال الوقت، وعدم استخدام الهاتف أثناء القيادة.</li>
          <li><strong>توريد مبالغ الدفع عند الاستلام:</strong> أتعهد بالتوريد اليومي الفوري لجميع مبالغ الـ COD المحصلة من العملاء قبل انتهاء الوردية دون أي تأخير أو اقتطاع.</li>
          <li><strong>الحفاظ على العهد:</strong> أتعهد بالمحافظة التامة على كافة ممتلكات الشركة المسلمة إليّ (الدراجات، والشرائح، والأجهزة) وإعادتها سليمة فور انتهاء العمل.</li>
          <li><strong>المسؤولية عن المخالفات:</strong> أقر بمسؤوليتي الشخصية الكاملة عن سداد أي مخالفات مرورية أو غرامات ناتجة عن عدم الالتزام أو القيادة غير المصرح بها.</li>
        </ol>
        </td>
      </tr>
    </table>
  </div>
  <div style="font-size:10px;margin:28px 6px 0;">Company Sign</div>
  <div style="font-size:10px;margin:45px 6px 0;">Employee Sign</div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
  "id": "tmpl_attendance_leave",
  "tenant_id": "company_pixel_syntax",
  "name": "Employee Attendance, Working Hours & Leave Undertaking",
  "template_type": "HR_UNDERTAKING",
  "description": "Bilingual attendance and leave undertaking with assigned project, bike and SIM embedded in the text.",
  "category": "HR",
  "placeholders": [
    "employee_name",
    "employee_full_name",
    "project",
    "current_bike",
    "current_sim",
    "company_logo_html"
  ],
  "version": 3,
  "content": "<div class=\"attendance-undertaking-document\" style=\"font-family:Arial,Helvetica,sans-serif;width:100%;min-height:277mm;margin:0 auto;padding:0;color:#111;background:#fff;box-sizing:border-box;\">\n  <table style=\"width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:22px;\"><tr>\n    <td style=\"width:20%;height:88px;border:1px solid #111;text-align:center;vertical-align:middle;padding:8px;\">{{company_logo_html}}</td>\n    <td style=\"width:80%;border:1px solid #111;text-align:center;vertical-align:middle;padding:8px;\">\n      <div style=\"font-size:16px;font-weight:700;line-height:20px;\">Employee Attendance, Working Hours &amp; Leave Undertaking</div>\n      <div lang=\"ar\" dir=\"rtl\" style=\"font-size:16px;line-height:24px;margin-top:4px;\">إقرار وتعهد الموظف بالحضور وساعات العمل والإجازات</div>\n      <div style=\"font-size:13px;line-height:18px;margin-top:6px;\">Pixel Syntax Delivery Software</div>\n    </td>\n  </tr></table>\n  <div style=\"position:relative;\">\n    <div style=\"position:absolute;top:160px;left:28%;width:44%;opacity:0.045;pointer-events:none;\">{{company_logo_html}}</div>\n    <table style=\"width:100%;border-collapse:collapse;table-layout:fixed;position:relative;\">\n      <tr>\n        <td lang=\"en\" style=\"width:50%;border:1px solid #111;padding:12px 10px;vertical-align:top;font-size:12px;line-height:18px;\">\n          <p style=\"margin:0 0 12px;\">I, <strong>{{employee_full_name}}</strong>, working on the <strong>{{project}}</strong> project, acknowledge my work inventory: bike <strong>{{current_bike}}</strong> and company SIM <strong>{{current_sim}}</strong>.</p>\n          <p style=\"margin:0 0 12px;\">I undertake to complete all required working days and the full working hours scheduled by the company and project provider. I will perform my assigned duties properly and ensure that my attendance and work meet the project’s requirements for valid working days and working hours. I will not leave early, shorten my shift or take leave without prior approval.</p>\n          <p style=\"margin:0 0 12px;\">I understand that I am required to work on weekends according to the assigned roster. I may take <strong>one weekly day off on a non-weekend day</strong>, subject to prior approval and the company’s duty schedule. I will not take a weekend off without specific approval.</p>\n          <p style=\"margin:0 0 12px;\">I undertake to inform my supervisor before being absent from work. I understand that absence without prior notification or approval may result in a <strong>penalty of AED 200 per day</strong>, as the project provider charges penalties for absence. Any recovery from my wages will be subject to applicable UAE labour law and required procedures.</p>\n          <p style=\"margin:0 0 12px;\">If an emergency prevents me from attending work, I will inform my supervisor as soon as possible, explain the valid reason and provide supporting proof to request leave.</p>\n          <p style=\"margin:0 0 12px;\">If I intend to take planned leave, I will inform the company <strong>at least one month in advance</strong> and obtain approval before starting my leave.</p>\n          <p style=\"margin:0;\">I confirm that I have read and understood this undertaking.</p>\n        </td>\n        <td lang=\"ar\" dir=\"rtl\" style=\"width:50%;border:1px solid #111;padding:12px 10px;vertical-align:top;font-size:13px;line-height:20px;text-align:right;\">\n          <p style=\"margin:0 0 12px;\">أنا، <strong dir=\"auto\">{{employee_name}}</strong>، أعمل في مشروع <strong dir=\"auto\">{{project}}</strong>، وأقر بعهدة العمل: الدراجة رقم <strong dir=\"ltr\">{{current_bike}}</strong> وشريحة الشركة رقم <strong dir=\"ltr\">{{current_sim}}</strong>.</p>\n          <p style=\"margin:0 0 12px;\">أتعهد بإكمال جميع أيام العمل المطلوبة وكامل ساعات العمل المحددة في جدول الشركة والجهة المشغلة للمشروع. كما ألتزم بأداء مهامي على الوجه المطلوب، وباستيفاء حضوري وعملي لمتطلبات المشروع المتعلقة بأيام وساعات العمل المعتمدة. ولن أغادر العمل مبكراً أو أختصر ورديتي أو آخذ إجازة دون موافقة مسبقة.</p>\n          <p style=\"margin:0 0 12px;\">أقر بأنني ملزم بالعمل خلال عطلة نهاية الأسبوع وفقاً لجدول المناوبات المحدد. ويجوز لي أخذ <strong>يوم راحة واحد أسبوعياً في يوم غير أيام عطلة نهاية الأسبوع</strong>، بعد الحصول على موافقة مسبقة ووفقاً لجدول العمل المعتمد لدى الشركة. ولن آخذ إجازة خلال عطلة نهاية الأسبوع دون موافقة خاصة.</p>\n          <p style=\"margin:0 0 12px;\">أتعهد بإبلاغ مشرفي قبل التغيب عن العمل. وأدرك أن الغياب دون إخطار مسبق أو موافقة قد يترتب عليه <strong>جزاء بقيمة ٢٠٠ درهم عن كل يوم غياب</strong>، نظراً إلى أن الجهة المشغّلة للمشروع تفرض جزاءات بسبب الغياب. ويخضع أي خصم من أجري لقانون العمل الإماراتي والإجراءات المطلوبة.</p>\n          <p style=\"margin:0 0 12px;\">إذا منعتني حالة طارئة من الحضور إلى العمل، أتعهد بإبلاغ مشرفي في أقرب وقت ممكن، وتوضيح السبب المشروع وتقديم المستندات المؤيدة لطلب الإجازة.</p>\n          <p style=\"margin:0 0 12px;\">إذا رغبت في الحصول على إجازة مخططة، أتعهد بإبلاغ الشركة <strong>قبل موعدها بشهر واحد على الأقل</strong>، والحصول على الموافقة قبل البدء بها.</p>\n          <p style=\"margin:0;\">أقر بأنني قرأت هذا التعهد وفهمت مضمونه.</p>\n        </td>\n      </tr>\n    </table>\n  </div>\n  <div class=\"attendance-signature\" style=\"margin-top:18px;min-height:66px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;font-size:13px;\"><span>Rider / Employee Signature: ____________________</span><span lang=\"ar\" dir=\"rtl\">توقيع السائق / الموظف: ____________________</span></div>\n</div>",
  "created_at": "2026-10-01T22:40:00Z",
  "updated_at": "2026-10-02T10:13:20Z"
},
  {
    id: 'tmpl_salary_cert',
    tenant_id: 'company_pixel_syntax',
    name: 'Official Salary Certificate',
    template_type: 'SALARY_CERTIFICATE',
    description: 'Official company salary certificate for bank accounts, tenancy agreements, and visa applications.',
    category: 'HR',
    placeholders: [
      'employee_name',
      'employee_id',
      'employee_code',
      'emirates_id',
      'passport_number',
      'designation',
      'joining_date',
      'salary',
      'company_name',
      'branch',
      'date',
      'reference_no',
    ],
    version: 1,
    content: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #5b21b6; font-size: 22px; margin: 0; text-transform: uppercase;">{{company_name}}</h1>
    <h2 style="font-size: 16px; color: #475569; margin: 6px 0 0 0;">TO WHOM IT MAY CONCERN — SALARY CERTIFICATE</h2>
    <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Ref: {{reference_no}} | Date of Issue: {{date}}</p>
  </div>

  <div style="font-size: 14px; margin-bottom: 24px; text-align: justify; line-height: 1.8;">
    <p>This is to certify that <strong>Mr. {{employee_name}}</strong> (Emirates ID: <strong>{{emirates_id}}</strong>, Passport No: <strong>{{passport_number}}</strong>, Employee Code: <strong>{{employee_code}}</strong>) is a permanent employee of <strong>{{company_name}}</strong>.</p>
    <p>He has been working with us since <strong>{{joining_date}}</strong> and is currently holding the position of <strong>{{designation}}</strong>.</p>
    
    <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-weight: bold; color: #5b21b6;">Monthly Gross Remuneration: AED {{salary}} (Dirhams)</p>
    </div>

    <p>This certificate is issued upon the request of the employee without any financial liability, guarantee, or obligation on the part of {{company_name}} or its executives.</p>
  </div>

  <div style="margin-top: 60px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 24px; font-size: 13px;">
    <div>
      <p style="margin: 0; font-weight: bold;">Human Resources &amp; Personnel Department</p>
      <p style="margin: 0; color: #64748b;">{{company_name}}</p>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">Issued in Dubai, United Arab Emirates</p>
    </div>
    <div style="border: 2px dashed #94a3b8; width: 120px; height: 70px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px;">
      [ Company Stamp ]
    </div>
  </div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'tmpl_general_policy',
    tenant_id: 'company_pixel_syntax',
    name: 'General Responsibility & Policy Undertaking',
    template_type: 'HR_UNDERTAKING',
    description: 'Code of conduct, road safety adherence, zero tolerance policy, and operational integrity pledge.',
    category: 'HR',
    placeholders: [
      'employee_name',
      'employee_id',
      'employee_code',
      'emirates_id',
      'mobile',
      'company_name',
      'branch',
      'project',
      'date',
      'reference_no',
    ],
    version: 1,
    content: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #1d4ed8; font-size: 22px; margin: 0; text-transform: uppercase;">{{company_name}}</h1>
    <h2 style="font-size: 16px; color: #475569; margin: 6px 0 0 0;">OPERATIONAL CODE OF CONDUCT &amp; ROAD SAFETY UNDERTAKING</h2>
    <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Ref: {{reference_no}} | Date: {{date}} | Issuing Branch: {{branch}}</p>
  </div>

  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px;">
    <p style="margin: 0;">This declaration binds <strong>{{employee_name}}</strong> (Code: <strong>{{employee_code}}</strong>, Emirates ID: <strong>{{emirates_id}}</strong>) deployed on <strong>{{project}}</strong>.</p>
  </div>

  <div style="font-size: 13px; margin-bottom: 24px; text-align: justify; line-height: 1.8;">
    <p>I solemnly undertake and confirm that during my tenure with <strong>{{company_name}}</strong>, I shall strictly adhere to:</p>
    <ol style="padding-left: 20px;">
      <li><strong>Road Safety &amp; UAE Traffic Laws:</strong> Wear helmet securely fastened, adhere to designated speed corridors, never ride on pedestrian pathways, and avoid phone usage while operating the vehicle.</li>
      <li><strong>Customer Respect &amp; Ethics:</strong> Treat all dispatch personnel, store vendors, and residential customers with utmost professionalism and courtesy.</li>
      <li><strong>Cash on Delivery (COD) Compliance:</strong> Daily remittance of all COD collected cash before shift closure to authorized dispatch kiosks without retention or delay.</li>
      <li><strong>Substance Zero Tolerance:</strong> Zero tolerance policy regarding narcotics, alcohol, or illicit behavior during active service hours.</li>
    </ol>
  </div>

  <div style="margin-top: 50px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 24px; font-size: 13px;">
    <div style="width: 45%;">
      <p style="font-weight: bold; margin-bottom: 40px;">Employee Signature:</p>
      <div style="border-bottom: 1px solid #000; width: 100%; margin-bottom: 6px;"></div>
      <p style="margin: 0;">Name: {{employee_name}}</p>
      <p style="margin: 0; color: #64748b; font-size: 11px;">Date: {{date}}</p>
    </div>
    <div style="width: 45%;">
      <p style="font-weight: bold; margin-bottom: 40px;">Operations &amp; Compliance Lead:</p>
      <div style="border-bottom: 1px solid #000; width: 100%; margin-bottom: 6px;"></div>
      <p style="margin: 0;">For {{company_name}}</p>
      <p style="margin: 0; color: #64748b; font-size: 11px;">Date: {{date}}</p>
    </div>
  </div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'tmpl_noc',
    tenant_id: 'company_pixel_syntax',
    name: 'No Objection Certificate (NOC)',
    template_type: 'CERTIFICATE_NOC',
    description: 'Official company NOC for UAE Driving License file opening or commercial bank account.',
    category: 'HR',
    placeholders: [
      'employee_name',
      'employee_id',
      'employee_code',
      'emirates_id',
      'passport_number',
      'designation',
      'joining_date',
      'company_name',
      'branch',
      'date',
      'reference_no',
    ],
    version: 1,
    content: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="color: #6d28d9; font-size: 22px; margin: 0; text-transform: uppercase;">{{company_name}}</h1>
    <h2 style="font-size: 16px; color: #475569; margin: 6px 0 0 0;">NO OBJECTION CERTIFICATE (N.O.C.)</h2>
    <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Ref: {{reference_no}} | Date: {{date}}</p>
  </div>

  <div style="font-size: 14px; margin-bottom: 24px; text-align: justify; line-height: 1.8;">
    <p><strong>TO WHOM IT MAY CONCERN</strong></p>
    <p>This is to certify that <strong>{{company_name}}</strong> has <strong>NO OBJECTION</strong> whatsoever for our employee, <strong>Mr. {{employee_name}}</strong>, holding Emirates ID No. <strong>{{emirates_id}}</strong> and Passport No. <strong>{{passport_number}}</strong>, currently employed with us as <strong>{{designation}}</strong> since <strong>{{joining_date}}</strong>, to open a driver license traffic file or official banking facility with competent UAE authorities.</p>
    <p>This No Objection Certificate is issued at the specific request of the employee without any financial liability or recurring guarantee on the part of the company.</p>
  </div>

  <div style="margin-top: 60px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 24px; font-size: 13px;">
    <div>
      <p style="margin: 0; font-weight: bold;">Authorized Human Resources Signatory</p>
      <p style="margin: 0; color: #64748b;">{{company_name}}</p>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">Issued at {{branch}}</p>
    </div>
    <div style="border: 2px dashed #94a3b8; width: 120px; height: 70px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px;">
      [ Company Seal ]
    </div>
  </div>
</div>
    `.trim(),
    created_at: '2025-01-01T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 'tmpl_employment_agreement',
    tenant_id: 'company_pixel_syntax',
    name: 'Employment Offer Letter & Agreement (Two-Year Term)',
    template_type: 'EMPLOYMENT_AGREEMENT',
    description: 'Bilingual offer letter with employee identity autofill, hourly wage progression, and signature fields.',
    category: 'HR',
    placeholders: [
      'employee_name', 'employee_code', 'nationality', 'passport_number',
      'emirates_id', 'designation', 'branch', 'joining_date', 'company_name', 'date',
      'company_logo_html',
    ],
    version: 6,
    content: `
<div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; width: 100%; box-sizing: border-box; padding: 16px; font-size: 12px; line-height: 1.4;">
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="width: 18%; border: 1px solid #111827; text-align: center; vertical-align: middle; padding: 7px;">{{company_logo_html}}</td>
      <td style="width: 82%; border: 1px solid #111827; text-align: center; padding: 8px;">
        <div style="font-size: 19px; font-weight: 700;">EMPLOYMENT OFFER LETTER &amp; AGREEMENT</div>
        <div dir="rtl" style="font-size: 18px; font-weight: 700;">عرض عمل واتفاقية توظيف</div>
        <div style="font-size: 13px; font-weight: 700;">{{company_name}}</div>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
    <tr><td style="width: 35%; border: 1px solid #374151; padding: 6px; font-weight: 700;">Employee name / اسم الموظف</td><td style="border: 1px solid #374151; padding: 6px;">{{employee_name}}</td></tr>
    <tr><td style="border: 1px solid #374151; padding: 6px; font-weight: 700;">Employee code / الرقم الوظيفي</td><td style="border: 1px solid #374151; padding: 6px;">{{employee_code}}</td></tr>
    <tr><td style="border: 1px solid #374151; padding: 6px; font-weight: 700;">Nationality / الجنسية</td><td style="border: 1px solid #374151; padding: 6px;">{{nationality}}</td></tr>
    <tr><td style="border: 1px solid #374151; padding: 6px; font-weight: 700;">Passport no. / رقم جواز السفر</td><td style="border: 1px solid #374151; padding: 6px;">{{passport_number}}</td></tr>
    <tr><td style="border: 1px solid #374151; padding: 6px; font-weight: 700;">Start date / تاريخ بدء العمل</td><td style="border: 1px solid #374151; padding: 6px;">{{joining_date}}</td></tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
    <tr><th style="width: 50%; border: 1px solid #374151; padding: 7px; text-align: left; background: #f3f4f6;">OFFER TERMS</th><th dir="rtl" style="width: 50%; border: 1px solid #374151; padding: 7px; text-align: right; background: #f3f4f6;">شروط العرض</th></tr>
    <tr>
      <td style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>1. Term.</strong> The offered employment term is two (2) years from the commencement date recorded in the official employment contract.</td>
      <td dir="rtl" style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>١. المدة.</strong> مدة التوظيف المعروضة سنتان (٢) من تاريخ البدء المسجل في عقد العمل الرسمي.</td>
    </tr>
    <tr>
      <td style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>2. Hourly wage.</strong> AED 5 per hour during the first five (5) months; AED 6 per hour after completing those five months. Work hours, payment dates, overtime, and other entitlements follow the official contract and applicable requirements.</td>
      <td dir="rtl" style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>٢. الأجر بالساعة.</strong> ٥ دراهم إماراتية لكل ساعة خلال الأشهر الخمسة الأولى، ثم ٦ دراهم إماراتية لكل ساعة بعد إكمالها. وتخضع ساعات العمل ومواعيد الدفع والعمل الإضافي والاستحقاقات الأخرى للعقد الرسمي والمتطلبات المعمول بها.</td>
    </tr>
    <tr>
      <td style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>3. Duties and attendance.</strong> The employee will perform the assigned duties, follow the communicated roster and lawful company procedures, and notify the supervisor promptly about absence or delay.</td>
      <td dir="rtl" style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>٣. المهام والحضور.</strong> يؤدي الموظف المهام المكلف بها، ويلتزم بجدول العمل والإجراءات النظامية المعلنة، ويبلغ المشرف فوراً عند الغياب أو التأخير.</td>
    </tr>
    <tr>
      <td style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>4. Work authorization and termination.</strong> The company will process required work authorization. Renewal, notice, and termination are governed by the official employment contract and applicable requirements. This offer does not impose a penalty for lawful termination or waive employee rights.</td>
      <td dir="rtl" style="border: 1px solid #374151; padding: 7px; vertical-align: top; font-size: 12px; line-height: 1.4;"><strong>٤. تصريح العمل وإنهاء الخدمة.</strong> تتولى الشركة إجراءات تصريح العمل المطلوب. ويخضع التجديد والإشعار وإنهاء الخدمة لعقد العمل الرسمي والمتطلبات المعمول بها. ولا يفرض هذا العرض غرامة على الإنهاء النظامي أو يتنازل عن حقوق الموظف.</td>
    </tr>
  </table>

  <p style="margin: 8px 0 10px; font-size: 12px; line-height: 1.45;"><strong>Acceptance / القبول:</strong> I have read and understood this offer, including the two-year term and hourly wage schedule, and accept it subject to the official employment contract. / قرأت هذا العرض وفهمت شروطه، بما فيها مدة السنتين وجدول الأجر بالساعة، وأوافق عليه وفقاً لعقد العمل الرسمي.</p>

  <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
    <tr>
      <td style="width: 50%; border: 1px solid #374151; padding: 10px; vertical-align: top; height: 232px; font-size: 12px; line-height: 1.45;">
        <strong>Employee / الموظف</strong><br />{{employee_name}}<br />
        Signature / التوقيع: __________________________<br />
        Date / التاريخ: __________________<br />
        Thumb impression / بصمة الإبهام:
        <div style="width: 145px; height: 100px; border: 1px dashed #6b7280; margin-top: 4px;"></div>
      </td>
      <td style="width: 50%; border: 1px solid #374151; padding: 10px; vertical-align: top; height: 205px; font-size: 12px; line-height: 1.45;">
        <strong>For {{company_name}} / عن الشركة</strong><br />
        Authorized representative / المفوض: __________________<br />
        Signature / التوقيع: ________________________________<br />
        Date / التاريخ: __________________<br />
        Company stamp / ختم الشركة:
        <div style="width: 150px; height: 100px; border: 1px dashed #6b7280; margin-top: 4px;"></div>
      </td>
    </tr>
  </table>
</div>
    `.trim(),
    created_at: '2026-10-09T00:00:00Z',
    updated_at: '2026-10-09T00:00:00Z',
  },
];

export const initialGeneratedForms: GeneratedFormRecord[] = [];
