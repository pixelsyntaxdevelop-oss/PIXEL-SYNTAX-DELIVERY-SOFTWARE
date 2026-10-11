import { DbBranch, DbVisaContractorType, DbContractCategory } from '../types/database';

export const AUTHORITATIVE_BRANCHES: DbBranch[] = [];
export const AUTHORITATIVE_BRANCH_NAMES = ['Main Branch'] as const;
export type AuthoritativeBranchName = string;
export function mapToAuthoritativeBranch(rawBranch?: string | null): AuthoritativeBranchName { return rawBranch?.trim() || 'Main Branch'; }
export function mapBranchIdToName(branchId?: string | null): AuthoritativeBranchName { return branchId?.trim() || 'Main Branch'; }
export function mapBranchNameToId(branchName?: string | null): string { return branchName?.trim() ? 'branch_main' : 'branch_main'; }
export const AUTHORITATIVE_CONTRACTOR_CATEGORIES = ['Own', 'Contractor'] as const;
export type AuthoritativeContractorCategory = typeof AUTHORITATIVE_CONTRACTOR_CATEGORIES[number];
export const AUTHORITATIVE_VISA_CONTRACTOR_TYPES: DbVisaContractorType[] = [
 { id: 'vct_own', code: 'OWN', name: 'Own', description: 'Own visa', category: 'CONTRACTOR', requires_vendor_company: false, is_active: true },
 { id: 'vct_contractor', code: 'CONTRACTOR', name: 'Contractor', description: 'Contractor', category: 'CONTRACTOR', requires_vendor_company: true, is_active: true },
];
export const AUTHORITATIVE_CONTRACT_CATEGORIES: DbContractCategory[] = [
 { id: 'cat_own', name: 'Own', description: 'Own visa' },
 { id: 'cat_contractor', name: 'Contractor', description: 'Contractor' },
];
export function getAuthoritativeContractorOptions(existingValue?: string | null): string[] {
 const base = [...AUTHORITATIVE_CONTRACTOR_CATEGORIES] as string[];
 if (existingValue?.trim() && !base.includes(existingValue.trim())) return [...base, existingValue.trim()];
 return base;
}
