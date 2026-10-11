import { TenantCompany } from '../types/erp';

export const INITIAL_TENANTS: TenantCompany[] = [];

export const loadTenants = (): TenantCompany[] => {
  return INITIAL_TENANTS;
};

export const saveTenants = async (tenants: TenantCompany[]) => {
  // Sync to database
};

