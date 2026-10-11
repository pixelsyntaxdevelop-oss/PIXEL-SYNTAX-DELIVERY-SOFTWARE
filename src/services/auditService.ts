/**
 * Central Enterprise Audit Logging Service
 * Tracks operational actions, security events, assignments, salary changes, permissions
 */

import { apiClient } from './apiClient';
import { SystemAuditLog, SystemUserAccount } from '../types/erp';
import { DbAuditLog } from '../types/database';

class AuditService {
  public async getLogs(filters?: {
    module?: string;
    userId?: string;
    actionType?: string;
    search?: string;
  }): Promise<SystemAuditLog[]> {
    const params = new URLSearchParams();
    if (filters?.module && filters.module !== 'ALL') params.append('module', filters.module);
    if (filters?.userId && filters.userId !== 'ALL') params.append('userId', filters.userId);
    if (filters?.actionType && filters.actionType !== 'ALL') params.append('actionType', filters.actionType);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<SystemAuditLog[]>(`/api/audit/logs${query}`);
    return res.data || [];
  }

  public async logEvent(
    actor: SystemUserAccount | null,
    module: string,
    action: string,
    details: string,
    metadata?: {
      actionType?: SystemAuditLog['actionType'];
      targetEntityId?: string;
      entityType?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      status?: 'SUCCESS' | 'WARNING' | 'FAILED';
    }
  ): Promise<SystemAuditLog> {
    const payload: Partial<SystemAuditLog> = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId: actor?.id || 'anonymous',
      userName: actor ? `${actor.fullName} (${actor.designation || actor.role})` : 'System Automated Agent',
      userRole: actor?.role || 'SYSTEM',
      actorName: actor?.fullName || 'System',
      actorRole: actor?.role || 'SYSTEM',
      action,
      actionType: metadata?.actionType || 'UPDATE',
      module,
      details,
      targetEntityId: metadata?.targetEntityId,
      status: metadata?.status || 'SUCCESS',
      ipAddress: '192.168.1.10',
    };

    const res = await apiClient.post<SystemAuditLog>('/api/audit/logs', {
      ...payload,
      old_values: metadata?.oldValues,
      new_values: metadata?.newValues,
      entity_type: metadata?.entityType,
      entity_id: metadata?.targetEntityId,
    });

    if (res.data) {
      return res.data;
    }

    return {
      id: `log_${Date.now()}`,
      ...payload,
    } as SystemAuditLog;
  }
}

export const auditService = new AuditService();
