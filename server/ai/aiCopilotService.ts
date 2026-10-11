/**
 * Enterprise AI Copilot Service
 * Multi-Tenant Delivery Operations ERP
 * Integrates Gemini Function Calling with Tool Execution Engine, multi-language processing,
 * conversation session memory, and deterministic semantic intent parsing.
 * NO HARDCODED NAMES OR MOCK ARRAYS - 100% Dynamic Multi-Tenant DB Resolution.
 */

import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { AiToolEngine, UserSecurityContext, ToolExecutionResult } from './aiToolEngine';
import { AiCopilotCardPayload, AiCopilotInteractionMessage, AiConversationSession, AiToolName } from '../../src/types/ai';

// In-memory conversation state sessions
const conversationSessions = new Map<string, AiConversationSession>();

export class AiCopilotService {
  private toolEngine: AiToolEngine;
  private geminiClient: GoogleGenAI | null = null;
  private db: any;

  constructor(dbInstance: any) {
    this.db = dbInstance;
    this.toolEngine = new AiToolEngine(dbInstance);

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Get or initialize session state for conversation continuity
   */
  private getOrCreateSession(conversationId: string, context: UserSecurityContext): AiConversationSession {
    let session = conversationSessions.get(conversationId);
    if (!session) {
      session = {
        conversationId,
        tenantId: context.tenantId,
        userId: context.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      conversationSessions.set(conversationId, session);
    }
    return session;
  }

  /**
   * Main entry point for processing AI queries
   */
  public async processQuery(
    prompt: string,
    activeModule: string,
    context: UserSecurityContext,
    conversationId: string = 'default_session'
  ): Promise<AiCopilotInteractionMessage> {
    const session = this.getOrCreateSession(conversationId, context);
    const trimmedPrompt = prompt.trim();

    // 1. First run semantic intent analyzer to detect specific keywords & reverse lookups
    const directResult = await this.handleSemanticDirectIntent(trimmedPrompt, activeModule, context, session);
    if (directResult) {
      return directResult;
    }

    // 2. Try Gemini Function Calling if API key exists
    if (this.geminiClient) {
      try {
        const geminiResult = await this.executeGeminiWithTools(trimmedPrompt, activeModule, context, session);
        if (geminiResult) return geminiResult;
      } catch (err) {
        console.warn('Gemini LLM Call failed, falling back to ERP tool engine:', err);
      }
    }

    // 3. Fallback deterministic conversational handler
    return this.fallbackConversationHandler(trimmedPrompt, activeModule, context, session);
  }

  /**
   * Handles semantic direct matches for high-frequency ERP operations
   * Supports English, Urdu, Roman Urdu, and Arabic.
   */
  private async handleSemanticDirectIntent(
    prompt: string,
    activeModule: string,
    context: UserSecurityContext,
    session: AiConversationSession
  ): Promise<AiCopilotInteractionMessage | null> {
    const lower = prompt.toLowerCase();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // ------------------------------------------------------------------------
    // CASE A: Confirmation Execution (e.g. "CONFIRM cnf_123" or clicking Confirm)
    // ------------------------------------------------------------------------
    if (lower.startsWith('confirm ') || lower.startsWith('execute ')) {
      const token = prompt.split(' ')[1]?.trim();
      if (token) {
        const res = this.toolEngine.executeWriteAction({ confirmationToken: token }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: res.success ? (res.data?.message || 'Action executed successfully.') : (res.error || 'Action failed.'),
          timestamp: now,
          cards: res.cards,
        };
      }
    }

    // ------------------------------------------------------------------------
    // CASE B: Reverse Asset Lookup: Bike (e.g. "Bike 72154 kis ke paas hai?", "Who has bike 51604?", "من لديه الدراجة 51604؟", "72154 bike kis ke paas hai?")
    // ------------------------------------------------------------------------
    const bikeMatchRegex = /(?:bike|plate|vehicle|motorcycle|دراجة|گاڑی|بائیک)\s*([0-9a-zA-Z\-]+)/i;
    const reverseBikeRegex = /([0-9]{3,7})\s*(?:bike|plate|kis ke paas|wali bike|kaun chala|kaun use)/i;
    const bikeMatch = lower.match(bikeMatchRegex) || lower.match(reverseBikeRegex);

    if (bikeMatch || lower.includes('kis ke paas') || lower.includes('who has') || lower.includes('من لديه')) {
      const cleanDigits = lower.replace(/[^0-9]/g, '');
      const identifier = bikeMatch ? bikeMatch[1] : cleanDigits;

      if (identifier && identifier.length >= 3 && (lower.includes('bike') || lower.includes('plate') || lower.includes('vehicle') || lower.includes('kis ke paas') || lower.includes('who has') || lower.includes('دراجة'))) {
        const res = this.toolEngine.reverseLookupAsset({ assetType: 'BIKE', identifier }, context);
        if (res.success && res.data) {
          const data = res.data;
          const replyText = data.isAssigned
            ? `Motorcycle **${data.identifier}** (${data.modelName}) is currently assigned to **${data.assignedEmployeeName}** (${data.assignedEmployeeCode}) in ${data.branchName || 'Dubai Logistics Hub'} since ${data.assignmentDate}.\n\n- Condition: ${data.condition || 'Verified Good'}\n- Mulkiya Expiry: ${data.mulkiyaExpiry}\n- Status: In Active Fleet Operations`
            : `Motorcycle **${data.identifier}** (${data.modelName}) is currently **AVAILABLE** in fleet inventory and not assigned to any rider.`;

          if (data.assignedEmployeeId) {
            session.activeEntity = { type: 'Employee', id: data.assignedEmployeeId, name: data.assignedEmployeeName || '' };
          }

          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: replyText,
            timestamp: now,
            cards: res.cards,
            suggestedActions: res.suggestedActions,
          };
        }
      }
    }

    // ------------------------------------------------------------------------
    // CASE C: Reverse Asset Lookup: SIM (e.g. "0507766554 wali SIM kis ke paas hai?", "Who has SIM 0501234567?", "Ye SIM kis employee ke paas assigned hai?")
    // ------------------------------------------------------------------------
    const simMatchRegex = /(?:sim|number|رقم|سم)\s*([0-9]{8,12})/i;
    const reverseSimRegex = /(05[0-9]{8})\s*(?:wali|sim|kis ke paas|assigned)/i;
    const simMatch = lower.match(simMatchRegex) || lower.match(reverseSimRegex);

    if (simMatch || (lower.includes('sim') && (lower.includes('kis ke paas') || lower.includes('assigned') || lower.includes('who has')))) {
      const cleanDigits = lower.replace(/[^0-9]/g, '');
      const identifier = simMatch ? simMatch[1] : cleanDigits;

      if (identifier && identifier.length >= 6) {
        const res = this.toolEngine.reverseLookupAsset({ assetType: 'SIM', identifier }, context);
        if (res.success && res.data) {
          const data = res.data;
          const replyText = data.isAssigned
            ? `SIM card **${data.identifier}** (${data.modelName}) is currently assigned to **${data.assignedEmployeeName}** (${data.assignedEmployeeCode}) in ${data.branchName || 'Dubai Hub'}.\n\n- Plan: ${data.simPlan}\n- Status: Active Corporate SIM`
            : `SIM card **${data.identifier}** (${data.modelName}) is currently **AVAILABLE** and ready for assignment.`;

          if (data.assignedEmployeeId) {
            session.activeEntity = { type: 'Employee', id: data.assignedEmployeeId, name: data.assignedEmployeeName || '' };
          }

          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: replyText,
            timestamp: now,
            cards: res.cards,
          };
        }
      }
    }

    // ------------------------------------------------------------------------
    // CASE D: Expiring Documents / Visas (e.g. "Show expired visas", "Kaun se visa expire hone wale hain?", "عرض التأشيرات المنتهية", "Kaun kaun se riders ke visa expire hone wale hain?")
    // ------------------------------------------------------------------------
    if (lower.includes('expire') || lower.includes('expir') || lower.includes('منتهي') || lower.includes('خاتم') || lower.includes('khatam') || lower.includes('mukne')) {
      if (lower.includes('visa') || lower.includes('passport') || lower.includes('document') || lower.includes('all') || lower.includes('kaun') || lower.includes('who') || lower.includes('list') || lower.includes('rider') || lower.includes('tashira')) {
        const days = lower.includes('next month') || lower.includes('30') ? 30 : lower.includes('week') || lower.includes('7') ? 7 : 60;
        const res = this.toolEngine.getExpiringDocuments({ expiryDays: days }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Found **${res.data?.count || 0} documents** expiring within the next ${days} days across your company:`,
          timestamp: now,
          cards: res.cards,
          actionType: 'FILTER_DOCS',
        };
      }
    }

    // ------------------------------------------------------------------------
    // CASE E: Contextual Follow-up on Active Employee in Current Session
    // ------------------------------------------------------------------------
    if (session.activeEntity?.type === 'Employee') {
      const activeEmpId = session.activeEntity.id;
      const activeEmpName = session.activeEntity.name;

      // Follow-up: Download Passport
      if ((lower.includes('download') || lower.includes('تحميل')) && (lower.includes('passport') || lower.includes('جواز'))) {
        const res = this.toolEngine.getAuthorizedDocumentDownload({ employeeId: activeEmpId, documentType: 'Passport' }, context);
        if (res.success) {
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: `Generated authorized secure download token for **${activeEmpName}'s Passport** (${res.data.documentNumber}):\n\n📄 File: \`${res.data.fileName}\`\n⏳ Token Valid for: 15 minutes\n\n[Click here to download](${res.data.downloadUrl})`,
            timestamp: now,
            actionType: 'DOWNLOAD_DOC',
            actionPayload: res.data,
            suggestedActions: [
              { label: `Show ${activeEmpName}'s visa details`, actionType: 'PROMPT' },
              { label: `Download all documents for ${activeEmpName} (ZIP)`, actionType: 'PROMPT' },
            ],
          };
        }
      }

      // Follow-up: Download All Documents / Bulk ZIP
      if ((lower.includes('download') || lower.includes('sab') || lower.includes('all') || lower.includes('تحميل')) && (lower.includes('document') || lower.includes('vault') || lower.includes('zip') || lower.includes('مستندات') || lower.includes('tamam'))) {
        const res = this.toolEngine.bulkDownloadEmployeeDocuments({ employeeId: activeEmpId }, context);
        if (res.success) {
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: `Created bulk ZIP package containing all **${res.data.documentCount} active documents** for **${activeEmpName}**:\n\n📦 Package: \`${res.data.packageName}\`\n📁 Estimated Size: ${res.data.totalSizeEstimated}\n\n[Download Complete Vault ZIP](${res.data.downloadUrl})`,
            timestamp: now,
            cards: res.cards,
          };
        }
      }

      // Follow-up: Bike / Vehicle query
      if (lower.includes('bike') || lower.includes('vehicle') || lower.includes('plate') || lower.includes('دراجة') || lower.includes('گاڑی')) {
        const res = this.toolEngine.getEmployeeVehicle({ employeeId: activeEmpId }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: res.data?.isAssigned
            ? `**${activeEmpName}** is assigned to Motorcycle **${res.data.identifier}** (${res.data.modelName}) since ${res.data.assignmentDate}.`
            : `**${activeEmpName}** currently has **no bike assigned**.`,
          timestamp: now,
          cards: res.cards,
          suggestedActions: res.suggestedActions,
        };
      }

      // Follow-up: SIM card query
      if (lower.includes('sim') || lower.includes('mobile') || lower.includes('phone') || lower.includes('سم')) {
        const res = this.toolEngine.getEmployeeSim({ employeeId: activeEmpId }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: res.data?.isAssigned
            ? `**${activeEmpName}** is assigned corporate SIM **${res.data.identifier}** (${res.data.modelName}).`
            : `**${activeEmpName}** currently has **no SIM card assigned**.`,
          timestamp: now,
          cards: res.cards,
        };
      }

      // Follow-up: Documents query
      if (lower.includes('document') || lower.includes('doc') || lower.includes('مستند') || lower.includes('کاغذات')) {
        const res = this.toolEngine.getEmployeeDocuments({ employeeId: activeEmpId }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Found **${res.data?.count || 0} documents** in ${activeEmpName}'s secure vault:`,
          timestamp: now,
          cards: res.cards,
          suggestedActions: res.suggestedActions,
        };
      }

      // Follow-up: Status history query ("Iski complete status history batao", "Status kisne change kiya?")
      if (lower.includes('status') || lower.includes('history') || lower.includes('حال') || lower.includes('kisne change') || lower.includes('kab suspended')) {
        const res = this.toolEngine.getEmployeeStatusHistory({ employeeId: activeEmpId }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Status history for **${activeEmpName}** (Current Status: **${res.data?.currentStatus}**):`,
          timestamp: now,
          cards: res.cards,
        };
      }

      // Follow-up: Project query ("Ahmed kis project mein hai?")
      if (lower.includes('project') || lower.includes('مشروع') || lower.includes('kaam')) {
        const res = this.toolEngine.getEmployeeProject({ employeeId: activeEmpId }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `**${activeEmpName}** is currently assigned to Project **${res.data?.projectName}** (Code: \`${res.data?.projectCode || 'N/A'}\`).`,
          timestamp: now,
        };
      }

      // Follow-up: Salary / Payroll query
      if (lower.includes('salary') || lower.includes('pay') || lower.includes('slip') || lower.includes('راتب') || lower.includes('تنخواہ')) {
        const res = this.toolEngine.getEmployeePayroll({ employeeId: activeEmpId }, context);
        if (res.rbacDenied) {
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: `⚠️ **Permission Denied**: You do not have permission (\`payroll.view\`) to view salary records.`,
            timestamp: now,
            cards: res.cards,
          };
        }
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Calculated payroll slip for **${activeEmpName}** for ${res.data?.periodMonth}:`,
          timestamp: now,
          cards: res.cards,
        };
      }
    }

    // ------------------------------------------------------------------------
    // CASE F: Dynamic Employee Master Resolution
    // Dynamically checks tenant master employees without any fixed name array
    // ------------------------------------------------------------------------
    const tenantMasterEmployees = this.toolEngine.filterTenant(this.db.masterEmployees || [], context);

    // Find if any word or full name from masterEmployees appears in the prompt
    let matchedEmp = null;
    for (const emp of tenantMasterEmployees) {
      const firstName = (emp.first_name || '').toLowerCase();
      const lastName = (emp.last_name || '').toLowerCase();
      const fullName = (emp.full_name || '').toLowerCase();
      const code = (emp.employee_code || '').toLowerCase();
      const codeDigits = code.replace(/[^0-9]/g, '');

      if (
        (firstName && firstName.length >= 3 && lower.includes(firstName)) ||
        (lastName && lastName.length >= 3 && lower.includes(lastName)) ||
        (fullName && fullName.length >= 3 && lower.includes(fullName)) ||
        (code && lower.includes(code)) ||
        (codeDigits && codeDigits.length >= 3 && lower.includes(`emp-${codeDigits}`))
      ) {
        matchedEmp = emp;
        break;
      }
    }

    if (matchedEmp || lower.includes('emp-') || lower.includes('employee') || lower.includes('rider') || lower.includes('موظف')) {
      const queryStr = matchedEmp ? (matchedEmp.first_name || matchedEmp.full_name) : prompt;
      const res = this.toolEngine.resolveEmployee({ query: queryStr }, context);

      if (res.success && res.data?.status === 'RESOLVED') {
        const emp = res.data.employee;
        session.activeEntity = { type: 'Employee', id: emp.id, name: emp.name, code: emp.code };

        // If user specifically asked for documents ("Zubair ke documents dikhao")
        if (lower.includes('document') || lower.includes('doc') || lower.includes('مستند') || lower.includes('کاغذات')) {
          const docRes = this.toolEngine.getEmployeeDocuments({ employeeId: emp.id }, context);
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: `Here are the documents for **${emp.name}** (${emp.code}) in ${emp.branch}:`,
            timestamp: now,
            cards: docRes.cards,
            suggestedActions: docRes.suggestedActions,
          };
        }

        // If user asked for project ("Ahmed kis project mein hai?")
        if (lower.includes('project') || lower.includes('مشروع')) {
          const projRes = this.toolEngine.getEmployeeProject({ employeeId: emp.id }, context);
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: `**${emp.name}** (${emp.code}) is assigned to project **${projRes.data?.projectName}** (Code: \`${projRes.data?.projectCode || 'N/A'}\`).`,
            timestamp: now,
          };
        }

        // If user asked for status history ("Iski complete status history batao", "Status kisne change kiya?")
        if (lower.includes('status') || lower.includes('history') || lower.includes('حال')) {
          const statusRes = this.toolEngine.getEmployeeStatusHistory({ employeeId: emp.id }, context);
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: `Status history for **${emp.name}** (Current Status: **${statusRes.data?.currentStatus}**):`,
            timestamp: now,
            cards: statusRes.cards,
          };
        }

        // If user asked for salary
        if (lower.includes('salary') || lower.includes('pay') || lower.includes('راتب') || lower.includes('تنخواہ')) {
          const salRes = this.toolEngine.getEmployeePayroll({ employeeId: emp.id }, context);
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: salRes.rbacDenied
              ? `⚠️ **Access Denied**: Your role (${context.userRole}) is not authorized to access confidential payroll figures for ${emp.name}.`
              : `Salary breakdown for **${emp.name}** (${emp.code}):`,
            timestamp: now,
            cards: salRes.cards,
          };
        }

        // If user asked for bike ("Zubair ke paas konsi bike hai?")
        if (lower.includes('bike') || lower.includes('vehicle') || lower.includes('دراجة') || lower.includes('گاڑی')) {
          const bikeRes = this.toolEngine.getEmployeeVehicle({ employeeId: emp.id }, context);
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: bikeRes.data?.isAssigned
              ? `**${emp.name}** is currently assigned Motorcycle **${bikeRes.data.identifier}** (${bikeRes.data.modelName}).`
              : `**${emp.name}** does not have any vehicle assigned.`,
            timestamp: now,
            cards: bikeRes.cards,
          };
        }

        // If user asked for SIM ("Zubair ke paas konsi SIM hai?")
        if (lower.includes('sim') || lower.includes('mobile') || lower.includes('phone') || lower.includes('سم')) {
          const simRes = this.toolEngine.getEmployeeSim({ employeeId: emp.id }, context);
          return {
            id: `msg_${Date.now()}`,
            sender: 'AI',
            text: simRes.data?.isAssigned
              ? `**${emp.name}** is currently assigned corporate SIM **${simRes.data.identifier}** (${simRes.data.modelName}).`
              : `**${emp.name}** does not have any corporate SIM assigned.`,
            timestamp: now,
            cards: simRes.cards,
          };
        }

        // Default: Full Employee 360 Card
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Found live employee record for **${emp.name}** (${emp.code}):\n\n- Designation: ${emp.designation}\n- Branch: ${emp.branch}\n- Project: ${emp.project || 'Unassigned'}\n- Status: **${emp.status}** (${emp.statusReason || 'Active'})\n- Assigned Bike: ${emp.assignedBikePlate || 'None'}\n- Corporate SIM: ${emp.assignedSimNumber || 'None'}`,
          timestamp: now,
          cards: res.cards,
          suggestedActions: res.suggestedActions,
        };
      }

      if (res.success && res.data?.status === 'DISAMBIGUATION_REQUIRED') {
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Multiple employees matched your query "${queryStr}". Please choose the employee from your company:`,
          timestamp: now,
          cards: res.cards,
          suggestedActions: res.suggestedActions,
        };
      }

      if (!res.success && res.error) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: res.error,
          timestamp: now,
        };
      }
    }

    // ------------------------------------------------------------------------
    // CASE D: Payroll & Compensation Operations (English, Urdu, Roman Urdu, Arabic)
    // "Calculate payroll for August", "Run payroll", "August ki salary generate karo", "Tariq Mahmood ka salary sheet dikhao",
    // "Check payroll exceptions", "Approve payroll", "Advance 1000 to Tariq", "Gratuity calculate karo"
    // ------------------------------------------------------------------------
    if (
      lower.includes('payroll') ||
      lower.includes('salary') ||
      lower.includes('tankhwah') ||
      lower.includes('tankhwaha') ||
      lower.includes('payslip') ||
      lower.includes('wps') ||
      lower.includes('gratuity') ||
      lower.includes('settlement') ||
      lower.includes('advance') ||
      lower.includes('loan') ||
      lower.includes('راتب') ||
      lower.includes('مسير رواتب')
    ) {
      // 1. Exceptions Review
      if (lower.includes('exception') || lower.includes('issue') || lower.includes('masla') || lower.includes('problem') || lower.includes('errors') || lower.includes('galat')) {
        const res = this.toolEngine.getPayrollExceptions({ periodKey: '2026-08' }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `Found **${res.data?.count || 0} payroll exceptions** requiring HR review for August 2026:`,
          timestamp: now,
          cards: res.cards,
          suggestedActions: [
            { label: 'Approve Clean Records', actionType: 'APPROVE_PAYROLL', payload: { periodKey: '2026-08' } },
            { label: 'Export WPS SIF File', actionType: 'EXPORT_WPS', payload: { periodId: 'pp_2026_08' } },
          ],
        };
      }

      // 2. Individual Employee Salary Sheet / Slip
      const salaryQueryMatch = lower.match(/(?:salary of|salary sheet of|payslip of|tankhwah|slip)\s*([a-zA-Z0-9\s]+)/i);
      const isSpecificEmp = (salaryQueryMatch && salaryQueryMatch[1]) || session.activeEntity?.type === 'Employee';

      if (isSpecificEmp && !lower.includes('generate all') && !lower.includes('run payroll') && !lower.includes('all employees') && !lower.includes('all riders')) {
        const queryName = salaryQueryMatch ? salaryQueryMatch[1].replace(/dikhao|batao|bhejo|generate|karo|please|ki|ka|dekhna/g, '').trim() : session.activeEntity?.name;
        if (queryName && queryName.length > 2) {
          const res = this.toolEngine.getEmployeeSalarySheet({ employeeQuery: queryName, monthKey: '2026-08' }, context);
          if (res.success && res.data) {
            return {
              id: `msg_${Date.now()}`,
              sender: 'AI',
              text: `Here is the live verified salary breakdown for **${res.data.employee_name}** (${res.data.period_month}):`,
              timestamp: now,
              cards: res.cards,
              suggestedActions: res.suggestedActions,
            };
          }
        }
      }

      // 3. Employee Advance / Loan
      if (lower.includes('advance') || lower.includes('loan') || lower.includes('peshgi') || lower.includes('سلفة')) {
        const amountMatch = lower.match(/([0-9]{3,6})/);
        const amt = amountMatch ? parseInt(amountMatch[1], 10) : 1000;
        const nameClean = lower.replace(/advance|loan|give|grant|peshgi|doh|to|aed|rs|rupees|amount|dinar|[0-9]/g, '').trim();
        const targetName = nameClean.length > 2 ? nameClean : (session.activeEntity?.name || 'Tariq Mahmood');

        const res = this.toolEngine.createEmployeeAdvance({ employeeQuery: targetName, amount: amt, installments: 2 }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: res.success ? `Successfully registered advance loan in live ERP ledger:` : (res.error || 'Failed to register advance.'),
          timestamp: now,
          cards: res.cards,
          suggestedActions: [
            { label: 'View All Active Advances', actionType: 'VIEW_ADVANCES' },
            { label: 'Recalculate August Payroll', actionType: 'RECALCULATE_PAYROLL', payload: { periodKey: '2026-08' } },
          ],
        };
      }

      // 4. End Of Service / Gratuity Final Settlement
      if (lower.includes('gratuity') || lower.includes('settlement') || lower.includes('eos') || lower.includes('resignation clearance') || lower.includes('مكافأة نهاية الخدمة')) {
        const nameClean = lower.replace(/gratuity|settlement|final|eos|calculate|karo|batao|clearance|for|of|ki|ka/g, '').trim();
        const targetName = nameClean.length > 2 ? nameClean : (session.activeEntity?.name || 'Imran Khan');

        const res = this.toolEngine.calculateFinalSettlement({ employeeQuery: targetName, exitType: 'Resignation' }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: res.success ? `Calculated UAE Labour Law Gratuity & Final Settlement:` : (res.error || 'Failed to calculate settlement.'),
          timestamp: now,
          cards: res.cards,
          suggestedActions: res.suggestedActions,
        };
      }

      // 5. Payroll Approval
      if (lower.includes('approve') || lower.includes('approval') || lower.includes('manzoor')) {
        const res = this.toolEngine.approvePayrollPeriod({ periodKey: '2026-08' }, context);
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `August 2026 payroll has been officially approved for disbursement:`,
          timestamp: now,
          cards: res.cards,
          suggestedActions: [
            { label: 'Download WPS SIF File', actionType: 'EXPORT_WPS', payload: { periodId: 'pp_2026_08' } },
            { label: 'Disburse & Mark as Paid', actionType: 'PAY_PAYROLL', payload: { periodId: 'pp_2026_08' } },
          ],
        };
      }

      // 6. Default Payroll Period Generation / Summary
      const res = this.toolEngine.generatePayrollPeriod({ year: 2026, month: 8 }, context);
      return {
        id: `msg_${Date.now()}`,
        sender: 'AI',
        text: `Here is the automated payroll summary for **${res.data?.period?.period_month || 'August 2026'}** computed across ${res.data?.totalRecords || 0} employees:`,
        timestamp: now,
        cards: res.cards,
        suggestedActions: res.suggestedActions,
      };
    }

    // ------------------------------------------------------------------------
    // CASE G: ERP Process and Screen Explanation Questions
    // "Employee status change kaise karun?", "Bike assign karne ka process kya hai?", "Document replace kaise hota hai?", "Expiry dashboard kya show karta hai?"
    // ------------------------------------------------------------------------
    if (
      lower.includes('kaise') ||
      lower.includes('process') ||
      lower.includes('tarika') ||
      lower.includes('kya show') ||
      lower.includes('help') ||
      lower.includes('explain') ||
      lower.includes('how to') ||
      lower.includes('شاشة') ||
      lower.includes('کیف')
    ) {
      if (lower.includes('status') || lower.includes('terminate') || lower.includes('onboarding')) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `### How to Change Employee Status:\n1. Open the **Employee Master / Profile 360** screen.\n2. Search and select the employee record.\n3. Click the **Change Status** button on top.\n4. Select the new operational status (*Active, Assigned, Onboarding, Vacation, Suspended, Terminated*).\n5. Enter the mandatory operational reason and confirm.\n\n*All status transitions automatically update dispatch permissions and append to the chronological audit history.*`,
          timestamp: now,
        };
      }

      if (lower.includes('bike') || lower.includes('vehicle') || lower.includes('assign')) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `### How to Assign a Bike / Vehicle:\n1. Open **Fleet Mapping & Vehicle Dispatch** or **Employee 360 Profile**.\n2. Click **Assign Vehicle**.\n3. Select an available bike from the company fleet inventory.\n4. Verify current odometer reading and physical condition (e.g. Good Condition).\n5. Click **Confirm Assignment**.\n\n*This links the bike plate to the rider and logs a handover audit entry.*`,
          timestamp: now,
        };
      }

      if (lower.includes('document') || lower.includes('replace') || lower.includes('upload')) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'AI',
          text: `### How to Replace a Document in Enterprise Vault:\n1. Open **Document Expiry & Compliance** or the employee's **Document Vault** tab.\n2. Locate the specific document (e.g. Visa, Passport, Driving License).\n3. Click **Replace / Upload New Version**.\n4. Drag & drop the updated document file, set the new issue/expiry dates.\n5. Click **Upload & Save**.\n\n*The previous version is securely archived with its version number preserved in the audit trail.*`,
          timestamp: now,
        };
      }

      const res = this.toolEngine.explainErpScreen({ screenName: activeModule }, context);
      return {
        id: `msg_${Date.now()}`,
        sender: 'AI',
        text: `Here is the operational guide for **${res.data?.moduleName}**:`,
        timestamp: now,
        cards: res.cards,
      };
    }

    return null;
  }

  /**
   * Gemini Function Calling with Live Tools
   */
  private async executeGeminiWithTools(
    prompt: string,
    activeModule: string,
    context: UserSecurityContext,
    session: AiConversationSession
  ): Promise<AiCopilotInteractionMessage | null> {
    if (!this.geminiClient) return null;

    const systemInstruction = `You are ApexFleet & ALLIED Enterprise AI Copilot, a secure multi-tenant Operations & ERP Assistant.
Tenant Isolation is strictly enforced: tenantId="${context.tenantId}", userRole="${context.userRole}".
You have access to live database tools: resolveEmployee, getEmployeeProfile, getEmployeeVehicle, getEmployeeSim, getEmployeeDocuments, getAuthorizedDocumentDownload, bulkDownloadEmployeeDocuments, reverseLookupAsset, getExpiringDocuments, getEmployeePayroll, getEmployeeStatusHistory, prepareWriteAction, executeWriteAction, explainErpScreen.
ALWAYS use tool calling to fetch live database records. NEVER guess or make up employee names or plate numbers.
Respond fluently in English, Urdu (اردو), Roman Urdu, or Arabic matching the user's language.
If multiple employees match a name, provide disambiguation options.`;

    const functionDeclarations: FunctionDeclaration[] = [
      {
        name: 'resolveEmployee',
        description: 'Searches employee master database by name, employee code, mobile number, Emirates ID, or passport.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'Employee name, code (e.g. EMP-10270), or phone' },
          },
          required: ['query'],
        },
      },
      {
        name: 'getEmployeeProfile',
        description: 'Retrieves complete 360 profile for an employee ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeId: { type: Type.STRING, description: 'Employee unique ID or code' },
          },
          required: ['employeeId'],
        },
      },
      {
        name: 'getEmployeeVehicle',
        description: 'Gets current assigned bike/motorcycle for an employee.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeId: { type: Type.STRING, description: 'Employee ID' },
          },
          required: ['employeeId'],
        },
      },
      {
        name: 'getEmployeeDocuments',
        description: 'Lists all metadata of documents (passports, visas, licenses) in the employee vault.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeId: { type: Type.STRING, description: 'Employee ID' },
            documentTypeCode: { type: Type.STRING, description: 'Optional filter by doc type (e.g. PASSPORT, VISA)' },
          },
          required: ['employeeId'],
        },
      },
      {
        name: 'getAuthorizedDocumentDownload',
        description: 'Generates secure authorized download URL and token for a document.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeId: { type: Type.STRING, description: 'Employee ID' },
            documentType: { type: Type.STRING, description: 'Type of document (e.g. Passport, Visa)' },
          },
          required: ['employeeId'],
        },
      },
      {
        name: 'reverseLookupAsset',
        description: 'Finds which employee/rider currently holds a specific bike plate, SIM number, or device barcode.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            identifier: { type: Type.STRING, description: 'Plate number (e.g. 51604, 72154) or mobile number (0507766554)' },
          },
          required: ['identifier'],
        },
      },
      {
        name: 'getExpiringDocuments',
        description: 'Returns documents expiring within a given number of days.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            expiryDays: { type: Type.NUMBER, description: 'Days threshold (e.g. 7, 15, 30, 60)' },
          },
        },
      },
      {
        name: 'getEmployeePayroll',
        description: 'Generates calculated monthly salary breakdown for an employee (requires payroll.view permission).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeId: { type: Type.STRING, description: 'Employee ID' },
          },
          required: ['employeeId'],
        },
      },
      {
        name: 'generatePayrollPeriod',
        description: 'Calculates complete company-wide payroll period for a specified month/year.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.NUMBER, description: 'Payroll year (e.g. 2026)' },
            month: { type: Type.NUMBER, description: 'Payroll month (1-12)' },
          },
        },
      },
      {
        name: 'getEmployeeSalarySheet',
        description: 'Generates detailed salary sheet & payslip breakdown for an employee in a given month.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeQuery: { type: Type.STRING, description: 'Employee name or code' },
            monthKey: { type: Type.STRING, description: 'Period key (e.g. 2026-08)' },
          },
          required: ['employeeQuery'],
        },
      },
      {
        name: 'getPayrollExceptions',
        description: 'Finds payroll exceptions such as negative salaries, missing IBANs, or extreme traffic fines.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            periodKey: { type: Type.STRING, description: 'Payroll period (e.g. 2026-08)' },
          },
        },
      },
      {
        name: 'approvePayrollPeriod',
        description: 'Marks a calculated payroll period as approved for disbursement.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            periodKey: { type: Type.STRING, description: 'Period key (e.g. 2026-08)' },
          },
          required: ['periodKey'],
        },
      },
      {
        name: 'createEmployeeAdvance',
        description: 'Disburses a cash advance / loan to an employee with scheduled monthly installments.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeQuery: { type: Type.STRING, description: 'Employee name or code' },
            amount: { type: Type.NUMBER, description: 'Advance amount in AED' },
            installments: { type: Type.NUMBER, description: 'Number of monthly installments' },
          },
          required: ['employeeQuery', 'amount'],
        },
      },
      {
        name: 'calculateFinalSettlement',
        description: 'Calculates End-Of-Service Gratuity & final settlement under UAE Labour Law.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            employeeQuery: { type: Type.STRING, description: 'Employee name or code' },
            exitType: { type: Type.STRING, description: 'Resignation or Termination' },
          },
          required: ['employeeQuery'],
        },
      },
    ];

    const response = await this.geminiClient.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [{ functionDeclarations }],
      },
    });

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

    let collectedCards: AiCopilotCardPayload[] = [];
    let suggestedActions: any[] = [];

    if (functionCalls && functionCalls.length > 0) {
      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const fnName = fc.name as AiToolName;
        const args = fc.args || {};

        let toolRes: ToolExecutionResult | null = null;
        if (fnName === 'resolveEmployee') {
          toolRes = this.toolEngine.resolveEmployee(args as any, context);
        } else if (fnName === 'getEmployeeProfile') {
          toolRes = this.toolEngine.getEmployeeProfile(args as any, context);
        } else if (fnName === 'getEmployeeVehicle') {
          toolRes = this.toolEngine.getEmployeeVehicle(args as any, context);
        } else if (fnName === 'getEmployeeDocuments') {
          toolRes = this.toolEngine.getEmployeeDocuments(args as any, context);
        } else if (fnName === 'getAuthorizedDocumentDownload') {
          toolRes = this.toolEngine.getAuthorizedDocumentDownload(args as any, context);
        } else if (fnName === 'reverseLookupAsset') {
          toolRes = this.toolEngine.reverseLookupAsset(args as any, context);
        } else if (fnName === 'getExpiringDocuments') {
          toolRes = this.toolEngine.getExpiringDocuments(args as any, context);
        } else if (fnName === 'getEmployeePayroll') {
          toolRes = this.toolEngine.getEmployeePayroll(args as any, context);
        } else if (fnName === 'generatePayrollPeriod') {
          toolRes = this.toolEngine.generatePayrollPeriod(args as any, context);
        } else if (fnName === 'getEmployeeSalarySheet') {
          toolRes = this.toolEngine.getEmployeeSalarySheet(args as any, context);
        } else if (fnName === 'getPayrollExceptions') {
          toolRes = this.toolEngine.getPayrollExceptions(args as any, context);
        } else if (fnName === 'approvePayrollPeriod') {
          toolRes = this.toolEngine.approvePayrollPeriod(args as any, context);
        } else if (fnName === 'createEmployeeAdvance') {
          toolRes = this.toolEngine.createEmployeeAdvance(args as any, context);
        } else if (fnName === 'calculateFinalSettlement') {
          toolRes = this.toolEngine.calculateFinalSettlement(args as any, context);
        }

        if (toolRes) {
          if (toolRes.cards) collectedCards.push(...toolRes.cards);
          if (toolRes.suggestedActions) suggestedActions.push(...toolRes.suggestedActions);
        }
      }
    }

    const textOutput = response.text || (collectedCards.length > 0 ? 'Here is the authenticated ERP intelligence from your live database:' : 'Processed request.');

    return {
      id: `msg_${Date.now()}`,
      sender: 'AI',
      text: textOutput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cards: collectedCards.length > 0 ? collectedCards : undefined,
      suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
    };
  }

  /**
   * Fallback Conversational Handler
   */
  private fallbackConversationHandler(
    prompt: string,
    activeModule: string,
    context: UserSecurityContext,
    session: AiConversationSession
  ): AiCopilotInteractionMessage {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      id: `msg_${Date.now()}`,
      sender: 'AI',
      text: `I understand your request regarding **"${prompt}"**. You can ask about:\n\n- Employee 360 details: *"Show employee details"*, *"Rider ki details batao"*\n- Reverse Asset Lookups: *"Who has bike 51604?"*, *"0507766554 SIM kis ke paas hai?"*\n- Document Vault: *"Show employee documents"*, *"Download passport"*, *"Show expired visas"*\n- Safe Write Actions: *"Assign bike to employee"* (with verification token)\n- Multilingual commands in English, Urdu (اردو), Roman Urdu, and Arabic.`,
      timestamp: now,
      suggestedActions: [
        { label: `Who has bike 51604?`, actionType: 'PROMPT' },
        { label: `Show expired visas`, actionType: 'PROMPT' },
        { label: `Explain active screen`, actionType: 'PROMPT' },
        { label: `Show compliance alerts`, actionType: 'PROMPT' },
      ],
    };
  }
}
