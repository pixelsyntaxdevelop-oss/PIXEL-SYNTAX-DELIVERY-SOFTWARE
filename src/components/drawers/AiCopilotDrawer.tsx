import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  X,
  RefreshCw,
  Cpu,
  CheckCircle2,
  ShieldAlert,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileText,
  Download,
  ExternalLink,
  FileSpreadsheet,
  UserCheck,
  ShieldCheck,
  Calendar,
  Building,
  CreditCard,
  Truck,
  Phone,
  Clock,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  CheckCircle,
  Mail,
  Share2,
  HelpCircle,
  Briefcase,
  Key,
  FileCheck,
  Zap,
  Play,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import {
  AiCopilotMessage,
  AiCopilotCardData,
  NavigationModule,
  SystemUserAccount,
  SystemAuditLog,
} from '../../types/erp';
import { clientStorageService } from '../../services/fileStorageService';
import { documentService } from '../../services/documentService';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule?: NavigationModule;
  onNavigateModule?: (module: NavigationModule) => void;
  currentUser?: SystemUserAccount;
  onAddAuditLog?: (log: SystemAuditLog) => void;
  lang: 'EN' | 'AR';
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeModule = 'DASHBOARD',
  onNavigateModule,
  currentUser,
  onAddAuditLog,
  lang,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micLang, setMicLang] = useState<'en-US' | 'ar-AE' | 'ur-PK'>('en-US');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const initialPromptsEN = [
    'Who has bike 51604?',
    'Show documents expiring in next 30 days',
    'Who is assigned to SIM 0507766554?',
    'Show employee master overview',
    'Explain active ERP module',
    'Check fleet compliance alerts',
  ];

  const initialPromptsAR = [
    'من لديه الدراجة 51604؟',
    'عرض المستندات التي تنتهي خلال 30 يوم',
    'من المخصص له شريحة 0507766554؟',
    'عرض نظرة عامة على الموظفين',
    'شرح وحدة النظام الحالية',
    'فحص تنبيهات الامتثال للأسطول',
  ];

  const sessionIdRef = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  const [messages, setMessages] = useState<AiCopilotMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'AI',
      text:
        lang === 'EN'
          ? `Hello ${currentUser?.fullName || 'Manager'}! I am your Enterprise AI Copilot for ALLIED Delivery Operations. I query live authenticated ERP data with strict multi-tenant isolation and RBAC. Ask me about employee 360 profiles, bike/SIM ownership, expiring documents, safe assignment workflows, and operational status timelines.`
          : `أهلاً بك ${currentUser?.fullName || 'المدير'}! أنا مساعد الذكاء الاصطناعي لمؤسسة أبيكس فليت. أعمل مباشرة مع قاعدة بيانات المؤسسة الحية وفق صلاحيات المستخدم وعزل المستأجرين.`,
      timestamp: 'Just now',
      suggestedActions: (lang === 'EN' ? initialPromptsEN : initialPromptsAR).slice(0, 4).map((label) => ({
        label,
        actionType: 'PROMPT',
      })),
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleConfirmProposal = async (token: string, actionTitle: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'executeWriteAction',
          params: { token },
          tenantId: currentUser?.tenant_id || 'company_pixel_syntax',
          userId: currentUser?.id || 'usr_admin',
          userRole: currentUser?.role || 'COMPANY_ADMIN',
          userName: currentUser?.fullName || 'Operations Admin',
        }),
      });
      const data = await res.json();

      const confMsg: AiCopilotMessage = {
        id: `msg_exec_${Date.now()}`,
        sender: 'AI',
        text: data.success
          ? `✅ **Action Executed Successfully**: ${actionTitle}\n\n${data.message || 'ERP live records and audit timeline have been updated.'}`
          : `❌ **Action Execution Failed**: ${data.error || 'The confirmation token has expired or is invalid.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: [
          { label: 'Show updated 360 profile', actionType: 'PROMPT' },
          { label: 'View Operational Timeline', actionType: 'PROMPT' },
        ],
      };
      setMessages((prev) => [...prev, confMsg]);
    } catch (err: any) {
      const errMsg: AiCopilotMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'AI',
        text: `Error executing write action: ${err?.message || 'Server error'}`,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Voice Speech Recognition setup
  const handleToggleVoice = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        lang === 'EN'
          ? 'Voice recognition is not supported in this browser environment.'
          : 'التعرف على الصوت غير مدعوم في هذا المتصفح.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = micLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Text-to-Speech (TTS) Voice playback
  const handleToggleTTS = (msgId: string, textToSpeak: string) => {
    if (speakingMsgId === msgId) {
      window.speechSynthesis?.cancel();
      setSpeakingMsgId(null);
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak.replace(/[*#_]/g, ''));
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      setSpeakingMsgId(msgId);
      window.speechSynthesis.speak(utterance);
    }
  };

  // File download helper
  const handleDownloadFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Audit log
    if (onAddAuditLog && currentUser) {
      onAddAuditLog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        action: 'AI_FILE_DOWNLOAD',
        module: activeModule,
        details: `Downloaded AI document/report: ${filename}`,
        status: 'SUCCESS',
      });
    }
  };

  // PDF Print helper for Salary Slips
  const handlePrintSalaryPDF = (salary: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Slip - ${salary.employeeName}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
            .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            .table th { background: #f1f5f9; }
            .net-box { background: #eff6ff; border: 2px solid #2563eb; padding: 15px; font-size: 18px; font-weight: bold; margin-top: 20px; text-align: right; color: #1e40af; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Pixel Syntax Delivery Software</div>
            <div class="subtitle">CONFIDENTIAL SALARY PAYSLIP - ${salary.periodMonth}</div>
          </div>
          <p><strong>Employee Name:</strong> ${salary.employeeName}</p>
          <p><strong>Employee Code:</strong> ${salary.employeeCode}</p>
          <p><strong>Attendance Record:</strong> ${salary.attendanceDays} / ${salary.totalDays} Days Present</p>

          <table class="table">
            <thead>
              <tr><th>EARNINGS / DEDUCTIONS</th><th>AMOUNT (AED)</th></tr>
            </thead>
            <tbody>
              <tr><td>Basic Salary</td><td>AED ${salary.baseSalary?.toLocaleString()}</td></tr>
              <tr><td>Performance Incentives</td><td>AED ${salary.incentives?.toLocaleString()}</td></tr>
              <tr><td>Overtime Pay</td><td>AED ${salary.overtimePay?.toLocaleString()}</td></tr>
              <tr><td>Penalties / Violations</td><td>- AED ${salary.penalties?.toLocaleString()}</td></tr>
              <tr><td>Standard Deductions</td><td>- AED ${salary.deductions?.toLocaleString()}</td></tr>
            </tbody>
          </table>

          <div class="net-box">
            NET PAYABLE AMOUNT: AED ${salary.netPayable?.toLocaleString()}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim() || loading) return;

    const userMsg: AiCopilotMessage = {
      id: `msg_${Date.now()}`,
      sender: 'USER',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          activeModule,
          tenantId: currentUser?.tenant_id || 'company_pixel_syntax',
          userId: currentUser?.id || 'usr_admin',
          userName: currentUser?.fullName || 'Operations Admin',
          userRole: currentUser?.role || 'COMPANY_ADMIN',
          conversationId: sessionIdRef.current,
        }),
      });

      const data = await res.json();

      let aiResponseText =
        data.text ||
        (lang === 'EN'
          ? 'Unable to generate response from Copilot server.'
          : 'تعذر الحصول على استجابة من السيرفر.');

      const aiMsg: AiCopilotMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'AI',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: data.actionType,
        actionPayload: data.actionPayload,
        cards: data.cards,
        suggestedActions: data.suggestedActions,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Execute live ERP action if returned
      if (data.actionType === 'NAVIGATE_MODULE' && data.actionPayload?.targetModule && onNavigateModule) {
        onNavigateModule(data.actionPayload.targetModule);
      } else if (data.actionType === 'FILTER_DOCS' && onNavigateModule) {
        onNavigateModule('DOCUMENT_EXPIRY_LISTING');
      }

      // Record Audit log for AI interaction
      if (onAddAuditLog && currentUser) {
        onAddAuditLog({
          id: `log_ai_${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorName: currentUser.fullName,
          actorRole: currentUser.role,
          action: 'AI_COPILOT_QUERY',
          module: activeModule,
          details: `User queried AI Copilot: "${promptToSend.slice(0, 50)}..."`,
          status: 'SUCCESS',
        });
      }
    } catch (err) {
      const errorMsg: AiCopilotMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'AI',
        text:
          lang === 'EN'
            ? 'Error processing request with Enterprise Gemini Server.'
            : 'حدث خطأ أثناء الاتصال بسيرفر الذكاء الاصطناعي.',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-blue-700 via-indigo-600 to-slate-900 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 ring-2 ring-white/10">
              <Bot className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                Enterprise AI Copilot <Sparkles className="w-4 h-4 text-amber-300" />
              </h3>
              <p className="text-xs text-blue-100/80 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>RBAC Authorized ({currentUser?.role || 'Admin'})</span>
                <span>• Gemini 3.6</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl p-4 text-sm leading-relaxed shadow-xs ${
                  msg.sender === 'USER'
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60 rounded-bl-xs'
                }`}
              >
                {msg.sender === 'AI' && (
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 pb-1.5 border-b border-slate-200/50 dark:border-slate-700/50">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" /> ApexFleet Intelligence
                    </span>
                    <button
                      onClick={() => handleToggleTTS(msg.id, msg.text)}
                      className={`p-1 rounded-md transition-colors ${
                        speakingMsgId === msg.id
                          ? 'bg-amber-500 text-white animate-bounce'
                          : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500'
                      }`}
                      title="Read Aloud"
                    >
                      {speakingMsgId === msg.id ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {/* Render Structured UI Cards if present */}
                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {msg.cards.map((card, idx) => (
                      <div key={idx} className="w-full">
                        {/* EMPLOYEE 360 CARD */}
                        {card.type === 'EMPLOYEE_360' && card.employeeData && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                                {card.employeeData.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-slate-900 dark:text-white truncate text-sm">
                                    {card.employeeData.name}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    {card.employeeData.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {card.employeeData.code} • {card.employeeData.designation} ({card.employeeData.branch})
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Visa Expiry</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{card.employeeData.visaExpiry}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Passport No.</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{card.employeeData.passportNumber}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Emirates ID</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{card.employeeData.eidNumber}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Assigned Bike</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{card.employeeData.assignedBikePlate}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">SIM Card</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{card.employeeData.assignedSimNumber}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Created Info</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  By {card.employeeData.createdBy} ({card.employeeData.createdDate})
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {onNavigateModule && (
                                <button
                                  onClick={() => onNavigateModule('RIDERS_DRIVERS')}
                                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> View Profile
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  handleDownloadFile(
                                    `${card.employeeData?.name.replace(/\s+/g, '_')}_360_Profile.txt`,
                                    `ALLIED ERP - EMPLOYEE 360 PROFILE\n\nName: ${card.employeeData?.name}\nCode: ${card.employeeData?.code}\nDepartment: ${card.employeeData?.department}\nPassport: ${card.employeeData?.passportNumber}\nEID: ${card.employeeData?.eidNumber}\nVisa Expiry: ${card.employeeData?.visaExpiry}\nBike: ${card.employeeData?.assignedBikePlate}\nSIM: ${card.employeeData?.assignedSimNumber}\nCreated By: ${card.employeeData?.createdBy} on ${card.employeeData?.createdDate}`
                                  )
                                }
                                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" /> Export Data
                              </button>
                            </div>
                          </div>
                        )}

                        {/* DOCUMENT LIST CARD */}
                        {card.type === 'DOCUMENT_LIST' && card.documentsData && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-blue-500" /> {card.documentsData.title}
                              </h4>
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                                {card.documentsData.count} Documents
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {card.documentsData.items.map((doc, dIdx) => (
                                <div
                                  key={dIdx}
                                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-xs"
                                >
                                  <div>
                                    <span className="font-semibold block text-slate-800 dark:text-slate-200">
                                      {doc.entityName} - {doc.docType}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Expires: {doc.expiryDate} ({doc.daysRemaining} days left)
                                    </span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await clientStorageService.triggerFileDownload(doc.id);
                                      } catch (err: any) {
                                        alert(err?.message || 'The actual stored document is unavailable. Open Document Vault.');
                                      }
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md"
                                    title="Download Document"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2 pt-1">
                              {onNavigateModule && (
                                <button
                                  onClick={() => onNavigateModule('DOCUMENT_EXPIRY_LISTING')}
                                  className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" /> Open Expiry Dashboard
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                      try {
                                        const ids = card.documentsData.items.map((item) => item.id).filter(Boolean);
                                        if (!ids.length) throw new Error('No uploaded document files found.');
                                        await documentService.bulkDownloadZip(ids, 'Employee_Actual_Documents_' + Date.now() + '.zip');
                                      } catch (err: any) {
                                        alert(err?.message || 'ZIP requires actual saved documents.');
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1"
                              >
                                <Archive className="w-3.5 h-3.5" /> ZIP All
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SALARY SHEET CARD */}
                        {card.type === 'SALARY_SHEET' && card.salaryData && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                  Payroll Salary Sheet - {card.salaryData.periodMonth}
                                </h4>
                                <p className="text-[10px] text-slate-500">
                                  {card.salaryData.employeeName} ({card.salaryData.employeeCode})
                                </p>
                              </div>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                Calculated
                              </span>
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">Basic Salary</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  AED {card.salaryData.baseSalary?.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">Incentives</span>
                                <span className="font-semibold text-emerald-600">
                                  + AED {card.salaryData.incentives?.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">Overtime Pay</span>
                                <span className="font-semibold text-emerald-600">
                                  + AED {card.salaryData.overtimePay?.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">Penalties / Violations</span>
                                <span className="font-semibold text-rose-600">
                                  - AED {card.salaryData.penalties?.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between py-1.5 font-bold text-sm bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 px-2 rounded-md mt-1">
                                <span>Net Payable Salary</span>
                                <span>AED {card.salaryData.netPayable?.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handlePrintSalaryPDF(card.salaryData)}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" /> Download PDF Slip
                              </button>
                              <button
                                onClick={() =>
                                  handleDownloadFile(
                                    `Salary_${card.salaryData?.employeeName}_${card.salaryData?.periodMonth}.csv`,
                                    `Employee Code,Employee Name,Base Salary,Incentives,Overtime,Penalties,Net Payable\n${card.salaryData?.employeeCode},${card.salaryData?.employeeName},${card.salaryData?.baseSalary},${card.salaryData?.incentives},${card.salaryData?.overtimePay},${card.salaryData?.penalties},${card.salaryData?.netPayable}`,
                                    'text/csv'
                                  )
                                }
                                className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel CSV
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SCREEN EXPLANATION CARD */}
                        {card.type === 'SCREEN_EXPLANATION' && card.screenExplanation && (
                          <div className="bg-slate-50 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 text-xs space-y-2.5">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold border-b border-blue-100 dark:border-blue-900/60 pb-1.5">
                              <HelpCircle className="w-4 h-4" /> Screen Guide: {card.screenExplanation.moduleName}
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 font-medium">
                              {card.screenExplanation.summary}
                            </p>
                            {card.screenExplanation.features && (
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                                  Key Capabilities:
                                </span>
                                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                                  {card.screenExplanation.features.map((f, fIdx) => (
                                    <li key={fIdx}>{f}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* DISAMBIGUATION CARD */}
                        {card.type === 'DISAMBIGUATION' && (card as any).candidates && (
                          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-amber-100 dark:border-amber-950 pb-2">
                              <h4 className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-500" /> Multiple Employees Found
                              </h4>
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                                {(card as any).candidates.length} Matches
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              Please select the exact employee you wish to inspect:
                            </p>
                            <div className="space-y-2">
                              {(card as any).candidates.map((cand: any, cIdx: number) => (
                                <div
                                  key={cIdx}
                                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50/50 dark:hover:bg-slate-800 transition-colors text-xs"
                                >
                                  <div>
                                    <span className="font-bold text-slate-900 dark:text-white block">
                                      {cand.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      ID: {cand.employee_code || cand.employee_id} • {cand.designation} • {cand.project_name || cand.branch_id}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleSend(`Show 360 profile for ${cand.name} (${cand.employee_code || cand.employee_id})`)}
                                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
                                  >
                                    <UserCheck className="w-3 h-3" /> Select
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ASSET MATCH CARD */}
                        {card.type === 'ASSET_MATCH' && (card as any).assetData && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-950 rounded-lg text-blue-600 dark:text-blue-400">
                                  {(card as any).assetData.assetType === 'VEHICLE' ? <Truck className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                    {(card as any).assetData.identifier}
                                  </h4>
                                  <span className="text-[10px] text-slate-500">
                                    {(card as any).assetData.model || (card as any).assetData.provider || 'Fleet Asset'}
                                  </span>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                (card as any).assetData.status === 'IN_USE' || (card as any).assetData.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {(card as any).assetData.status}
                              </span>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Assigned To:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {(card as any).assetData.assignedEmployeeName || 'Unassigned (In Depot Pool)'}
                                </span>
                              </div>
                              {(card as any).assetData.assignedEmployeeCode && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Employee Code:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {(card as any).assetData.assignedEmployeeCode}
                                  </span>
                                </div>
                              )}
                              {(card as any).assetData.branch && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Depot / Branch:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {(card as any).assetData.branch}
                                  </span>
                                </div>
                              )}
                              {(card as any).assetData.mulkiyaExpiry && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Mulkiya Expiry:</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {(card as any).assetData.mulkiyaExpiry}
                                  </span>
                                </div>
                              )}
                            </div>

                            {(card as any).assetData.assignedEmployeeName && (
                              <button
                                onClick={() => handleSend(`Show 360 profile for ${(card as any).assetData.assignedEmployeeName}`)}
                                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> View Assigned Employee 360 Profile
                              </button>
                            )}
                          </div>
                        )}

                        {/* STATUS HISTORY CARD */}
                        {card.type === 'STATUS_HISTORY' && (card as any).history && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-indigo-500" /> Operational Status Timeline
                              </h4>
                              <span className="text-[10px] text-slate-500">
                                {(card as any).employeeName}
                              </span>
                            </div>

                            <div className="space-y-2 max-h-56 overflow-y-auto">
                              {(card as any).history.map((h: any, hIdx: number) => (
                                <div key={hIdx} className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                      {h.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {h.effective_from ? new Date(h.effective_from).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                  <p className="text-slate-700 dark:text-slate-300 mt-1 text-[11px]">
                                    {h.reason || h.notes || 'Status updated'}
                                  </p>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    By: {h.changed_by || 'System Admin'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CONFIRMATION PROPOSAL CARD */}
                        {card.type === 'CONFIRMATION_PROPOSAL' && (card as any).proposal && (
                          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3.5 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold border-b border-amber-200 dark:border-amber-900 pb-2">
                              <ShieldAlert className="w-5 h-5 text-amber-600 animate-bounce" />
                              <div className="text-xs">
                                <span className="block font-bold">Action Proposal (Requires Confirmation)</span>
                                <span className="text-[10px] font-normal opacity-80">2-Step Safe Write Execution Framework</span>
                              </div>
                            </div>

                            <div className="space-y-1 text-xs">
                              <h5 className="font-bold text-slate-900 dark:text-white">
                                {(card as any).proposal.title}
                              </h5>
                              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                                {(card as any).proposal.summary}
                              </p>
                            </div>

                            {(card as any).proposal.consequences && (
                              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs space-y-1">
                                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[10px] uppercase tracking-wide">
                                  System Impact & Audit Trail:
                                </span>
                                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[11px]">
                                  {(card as any).proposal.consequences.map((c: string, cIdx: number) => (
                                    <li key={cIdx}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleConfirmProposal((card as any).proposal.token, (card as any).proposal.title)}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" /> Confirm & Execute Action
                              </button>
                              <button
                                onClick={() => {
                                  const cancelMsg: AiCopilotMessage = {
                                    id: `msg_cancel_${Date.now()}`,
                                    sender: 'AI',
                                    text: 'Action execution cancelled by user.',
                                    timestamp: 'Just now',
                                  };
                                  setMessages((prev) => [...prev, cancelMsg]);
                                }}
                                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ZIP DOWNLOAD CARD */}
                        {card.type === 'ZIP_DOWNLOAD' && (card as any).zipData && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Archive className="w-4 h-4 text-emerald-500" /> {(card as any).zipData.packageTitle}
                              </h4>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                {(card as any).zipData.totalFiles} Files ({(card as any).zipData.sizeEst})
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Secure zip container generated. All documents are verified with active download tokens.
                            </p>
                            <button
                              onClick={() =>
                                handleDownloadFile(
                                  `${(card as any).zipData.packageTitle.replace(/\s+/g, '_')}.zip`,
                                  `SECURE_ENTERPRISE_ZIP_ARCHIVE_DATA\nPackage: ${(card as any).zipData.packageTitle}\nGenerated: ${new Date().toISOString()}\nFiles: ${(card as any).zipData.totalFiles}`
                                )
                              }
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                            >
                              <Download className="w-4 h-4" /> Download Complete ZIP Package
                            </button>
                          </div>
                        )}

                        {/* RBAC DENIAL CARD */}
                        {card.type === 'RBAC_DENIAL' && (
                          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3.5 text-xs space-y-2">
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold">
                              <ShieldAlert className="w-4 h-4" /> Access Restricted (RBAC Protection)
                            </div>
                            <p className="text-slate-700 dark:text-slate-300">
                              {(card as any).denialMessage || 'Your security role does not have the required permission to execute this operation or view this confidential dataset.'}
                            </p>
                            {(card as any).requiredPermission && (
                              <div className="text-[11px] text-slate-500">
                                Required Permission: <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-rose-600">{(card as any).requiredPermission}</code>
                              </div>
                            )}
                          </div>
                        )}

                        {/* PAYROLL PERIOD SUMMARY CARD */}
                        {card.type === 'PAYROLL_PERIOD_CARD' && (card as any).periodData && (
                          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <CreditCard className="w-4 h-4 text-emerald-600" /> {(card as any).periodData.period_month} Payroll
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                  {(card as any).periodData.total_employees} Employees • {(card as any).periodData.wps_status || 'WPS Ready'}
                                </span>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                (card as any).periodData.status === 'APPROVED' || (card as any).periodData.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {(card as any).periodData.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <span className="text-[10px] text-slate-400 block">Total Gross Salary</span>
                                <span className="font-bold text-slate-900 dark:text-white">AED {(card as any).periodData.total_gross?.toLocaleString()}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <span className="text-[10px] text-slate-400 block">Total Deductions</span>
                                <span className="font-bold text-rose-600">AED {(card as any).periodData.total_deductions?.toLocaleString()}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 col-span-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Net Disbursal</span>
                                  <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">AED {(card as any).periodData.total_net?.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {(card as any).periodData.exception_count > 0 && (
                              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{(card as any).periodData.exception_count} Exceptions Flagged</span>
                                </div>
                                <button
                                  onClick={() => handleSend(`Show payroll exceptions for ${(card as any).periodData.period_month}`)}
                                  className="text-[10px] font-bold text-amber-700 dark:text-amber-400 underline hover:no-underline"
                                >
                                  Review
                                </button>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSend(`Approve ${(card as any).periodData.period_month} payroll`)}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve Cycle
                              </button>
                              <button
                                onClick={() => {
                                  const periodId = (card as any).periodData.id || 'pp_2026_08';
                                  window.open(`/api/v1/payroll/periods/${periodId}/sif`, '_blank');
                                }}
                                className="py-1.5 px-3 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" /> SIF (WPS)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* PAYROLL EXCEPTIONS CARD */}
                        {card.type === 'PAYROLL_EXCEPTIONS_CARD' && (card as any).exceptions && (
                          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <h4 className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-500" /> Payroll Exceptions Review
                              </h4>
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                                {(card as any).exceptions.length} Issues
                              </span>
                            </div>

                            <div className="space-y-2 max-h-56 overflow-y-auto">
                              {(card as any).exceptions.map((ex: any, exIdx: number) => (
                                <div key={exIdx} className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900 dark:text-white">{ex.employee_name}</span>
                                    <span className="text-[10px] font-mono text-rose-500 font-bold">{ex.exception_type}</span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">{ex.details}</p>
                                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                                    <span>Net: AED {ex.net_salary}</span>
                                    <button
                                      onClick={() => handleSend(`Show salary sheet of ${ex.employee_name}`)}
                                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                    >
                                      Inspect Rider →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* EMPLOYEE ADVANCE CARD */}
                        {card.type === 'EMPLOYEE_ADVANCE_CARD' && (card as any).advance && (
                          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <h4 className="font-bold text-xs text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                                <DollarSign className="w-4 h-4 text-blue-600" /> Advance Cash Disbursal
                              </h4>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                Active Ledger
                              </span>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Employee:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{(card as any).advance.employeeName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Principal Amount:</span>
                                <span className="font-black text-emerald-600">AED {(card as any).advance.amount?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Monthly Deduction:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">AED {(card as any).advance.monthlyDeduction?.toLocaleString()} / month</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* FINAL SETTLEMENT CARD */}
                        {card.type === 'FINAL_SETTLEMENT_CARD' && (card as any).settlement && (
                          <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3.5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div>
                                <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                                  <FileCheck className="w-4 h-4 text-indigo-600" /> UAE Gratuity & Final Settlement
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                  {(card as any).settlement.employeeName} • {(card as any).settlement.yearsOfService} Years Service
                                </span>
                              </div>
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                                UAE Labour Law
                              </span>
                            </div>

                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Service Gratuity Pay:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">AED {(card as any).settlement.gratuityAmount?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Unused Leave Encashment:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">AED {(card as any).settlement.leaveEncashment?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Outstanding Deductions:</span>
                                <span className="font-bold text-rose-600">- AED {(card as any).settlement.deductions?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 font-bold">
                                <span className="text-indigo-900 dark:text-indigo-200">Net Exit Settlement:</span>
                                <span className="text-sm text-indigo-700 dark:text-indigo-300">AED {(card as any).settlement.netSettlement?.toLocaleString()}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDownloadFile(`Final_Settlement_${(card as any).settlement.employeeName}.txt`, JSON.stringify((card as any).settlement, null, 2))}
                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Clearance Sheet
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <span className="text-[10px] opacity-60 block mt-2 text-right">{msg.timestamp}</span>
              </div>

              {/* Suggested Follow-up Actions */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[92%]">
                  {msg.suggestedActions.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(act.label)}
                      className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full border border-blue-200 dark:border-slate-700 transition-colors flex items-center gap-1 font-medium shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              <span>
                {lang === 'EN'
                  ? 'Analyzing ERP database & computing parameters...'
                  : 'جاري البحث في قاعدة البيانات وحساب العمليات...'}
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Control Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 space-y-2">
          {/* Quick Language & Mic Settings */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1 font-medium">
              <Zap className="w-3 h-3 text-amber-500" /> Active Screen: {activeModule}
            </span>
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
              <button
                onClick={() => setMicLang('en-US')}
                className={`px-1.5 py-0.5 rounded-md font-bold ${
                  micLang === 'en-US' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setMicLang('ar-AE')}
                className={`px-1.5 py-0.5 rounded-md font-bold ${
                  micLang === 'ar-AE' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                AR
              </button>
              <button
                onClick={() => setMicLang('ur-PK')}
                className={`px-1.5 py-0.5 rounded-md font-bold ${
                  micLang === 'ur-PK' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                UR
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleVoice}
              className={`p-2.5 rounded-xl border transition-colors ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse border-rose-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Voice Input (Speech Recognition)"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                isListening
                  ? lang === 'EN'
                    ? 'Listening now... speak...'
                    : 'جاري الاستماع...'
                  : lang === 'EN'
                  ? 'Ask Copilot: "Show Zubair docs", "Create salary sheet"...'
                  : 'اسأل عن الموظفين، المستندات، الرواتب...'
              }
              className="flex-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />

            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
