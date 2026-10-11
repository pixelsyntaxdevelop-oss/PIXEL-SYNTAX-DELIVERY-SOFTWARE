export interface AuthoritativeUserRecord {
  password_hash: string;
  salt: string;
  fullName: string;
  email: string;
  designation: string;
  role?: string;
  employee_id?: string;
  employee_code?: string;
}

export const ORIGINAL_PERSISTENT_USERS: Record<string, AuthoritativeUserRecord> = {};
