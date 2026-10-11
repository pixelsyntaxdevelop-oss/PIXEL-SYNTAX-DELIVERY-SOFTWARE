/**
 * Enterprise ERP Master Data Service
 * Provides database queries for Documents, SIMs, Tickets, Orders, Attendance, Inventory
 */

import { apiClient } from './apiClient';
import {
  ExpiringDocumentAlert,
  SimCardRecord,
  DriverTicket,
  OrderDispatch,
  AttendanceRecord,
  InventoryItem,
  PartnerPerformanceRecord,
  PassportRecord,
} from '../types/erp';

class ErpDataService {
  public async getExpiringDocumentAlerts(): Promise<ExpiringDocumentAlert[]> {
    const res = await apiClient.get<ExpiringDocumentAlert[]>('/api/erp/documents/expiring');
    return res.data || [];
  }

  public async getSimCards(): Promise<SimCardRecord[]> {
    const res = await apiClient.get<SimCardRecord[]>('/api/erp/sim-cards');
    return res.data || [];
  }

  public async assignSimCard(simId: string, riderId: string, riderName: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/erp/sim-cards/${simId}/assign`, { riderId, riderName });
    return { success: !res.error, error: res.error };
  }

  public async getDriverTickets(): Promise<DriverTicket[]> {
    const res = await apiClient.get<DriverTicket[]>('/api/erp/driver-tickets');
    return res.data || [];
  }

  public async getOrders(): Promise<OrderDispatch[]> {
    const res = await apiClient.get<OrderDispatch[]>('/api/erp/orders');
    return res.data || [];
  }

  public async assignRiderToOrder(orderId: string, riderId: string, riderName: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/erp/orders/${orderId}/assign`, { riderId, riderName });
    return { success: !res.error, error: res.error };
  }

  public async getDailyAttendance(): Promise<AttendanceRecord[]> {
    const res = await apiClient.get<AttendanceRecord[]>('/api/erp/attendance');
    return res.data || [];
  }

  public async getInventoryItems(): Promise<InventoryItem[]> {
    const res = await apiClient.get<InventoryItem[]>('/api/erp/inventory');
    return res.data || [];
  }

  public async getPartnerPerformance(): Promise<PartnerPerformanceRecord[]> {
    const res = await apiClient.get<PartnerPerformanceRecord[]>('/api/erp/partner-performance');
    return res.data || [];
  }

  public async getPassports(): Promise<PassportRecord[]> {
    const res = await apiClient.get<PassportRecord[]>('/api/erp/passports');
    return res.data || [];
  }
}

export const erpDataService = new ErpDataService();
