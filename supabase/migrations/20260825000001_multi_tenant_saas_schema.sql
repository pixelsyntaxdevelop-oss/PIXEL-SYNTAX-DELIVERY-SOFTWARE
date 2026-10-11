-- ==============================================================================
-- Multi-Tenant SaaS ERP Foundation Schema with PostgreSQL & Row Level Security
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANTS & PLANS
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    max_users INT NOT NULL DEFAULT 10,
    max_riders INT NOT NULL DEFAULT 50,
    max_vehicles INT NOT NULL DEFAULT 40,
    max_branches INT NOT NULL DEFAULT 2,
    max_storage_gb NUMERIC(10, 2) NOT NULL DEFAULT 20.0,
    ai_requests_monthly INT NOT NULL DEFAULT 5000,
    monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'company_pixel_syntax', 'company_swift'
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade_license_number VARCHAR(100),
    tax_registration_number VARCHAR(100),
    domain VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'PENDING'
    plan_id VARCHAR(50) REFERENCES plans(id) DEFAULT 'ENTERPRISE_PRO',
    subscription_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subscription_expiry TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    company_admin_email VARCHAR(255) NOT NULL,
    company_admin_name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'United Arab Emirates',
    city VARCHAR(100) NOT NULL DEFAULT 'Dubai',
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    logo_url TEXT,
    primary_color VARCHAR(50) DEFAULT '#2563eb',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled_modules JSONB NOT NULL DEFAULT '["fleet_dashboard", "attendance_daily", "recruitment", "doc_expiry_listing", "vehicles_fleet", "riders_drivers"]'::jsonb,
    limits JSONB NOT NULL DEFAULT '{"maxUsers": 100, "maxRiders": 500, "maxVehicles": 300, "maxBranches": 10, "maxStorageGB": 100, "aiRequestsMonthly": 50000}'::jsonb,
    usage JSONB NOT NULL DEFAULT '{"activeUsers": 1, "activeRiders": 0, "activeVehicles": 0, "usedBranches": 1, "usedStorageGB": 0.5, "aiRequestsUsed": 0}'::jsonb,
    custom_branding JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BRANCHES & DEPARTMENTS
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'UAE',
    is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PROFILES & USERS
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- Supabase Auth User ID
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    designation VARCHAR(150),
    avatar_url TEXT,
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
    primary_branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    primary_department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    allowed_modules JSONB NOT NULL DEFAULT '["ALL"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 4. ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system-wide default roles
    role_key VARCHAR(64) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(100) PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'delete', 'archive', 'download', 'upload', 'export', 'approve', 'reject', 'assign', 'manage', 'use_ai'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_branch_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    has_full_access BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS user_department_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, department_id)
);

-- 5. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL DEFAULT 'UPDATE',
    module VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    details TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CORE ERP OPERATIONAL TABLES (All with tenant_id isolation)

CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
    designation VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(50),
    joining_date DATE NOT NULL,
    salary_base NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    attendance_rate NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    leave_balance_days INT NOT NULL DEFAULT 30,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    contract_end_date DATE,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plate_number VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    make VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'MOTORCYCLE',
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    current_rider_id VARCHAR(64),
    odometer_km NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fuel_level_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    mulkiya_number VARCHAR(100),
    mulkiya_expiry DATE,
    insurance_company VARCHAR(150),
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    last_service_date DATE,
    next_service_km NUMERIC(10, 2),
    tire_condition_percent NUMERIC(5, 2) DEFAULT 90.0,
    oil_condition_percent NUMERIC(5, 2) DEFAULT 90.0,
    fuel_cost_this_month NUMERIC(10, 2) DEFAULT 0.00,
    maintenance_cost_this_month NUMERIC(10, 2) DEFAULT 0.00,
    accident_count INT DEFAULT 0,
    gps_device_id VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS riders (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    role_type VARCHAR(50) NOT NULL DEFAULT 'RIDER',
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE',
    avatar_url TEXT,
    deliveries_completed INT NOT NULL DEFAULT 0,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    on_time_rate NUMERIC(5, 2) NOT NULL DEFAULT 98.00,
    cancellation_rate NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    passport_number VARCHAR(100),
    passport_expiry DATE,
    visa_number VARCHAR(100),
    visa_expiry DATE,
    emirates_id VARCHAR(100),
    emirates_id_expiry DATE,
    license_number VARCHAR(100),
    license_expiry DATE,
    contract_type VARCHAR(50) DEFAULT 'FULL_TIME',
    joining_date DATE,
    base_salary NUMERIC(10, 2) DEFAULT 0.00,
    incentives_month NUMERIC(10, 2) DEFAULT 0.00,
    penalties_month NUMERIC(10, 2) DEFAULT 0.00,
    assigned_vehicle_id VARCHAR(64) REFERENCES vehicles(id) ON DELETE SET NULL,
    equipment_assigned JSONB DEFAULT '{"uniform": true, "helmet": true, "deliveryBag": true, "gpsTrackerDevice": true, "mobilePhone": true}'::jsonb,
    current_location JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    candidate_id VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    unique_id VARCHAR(100) NOT NULL,
    cnic_passport VARCHAR(100) NOT NULL,
    mobile VARCHAR(50) NOT NULL,
    created_date DATE NOT NULL,
    interview VARCHAR(50) NOT NULL DEFAULT 'Pending',
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    license_package_type VARCHAR(100) DEFAULT 'Visa Only',
    total_package NUMERIC(10, 2) DEFAULT 6000.00,
    advance NUMERIC(10, 2) DEFAULT 0.00,
    balance NUMERIC(10, 2) DEFAULT 6000.00,
    per_month_deduction NUMERIC(10, 2) DEFAULT 500.00,
    current_stage VARCHAR(100) DEFAULT 'Stage 1 — Initial Process',
    current_stage_code VARCHAR(50) DEFAULT 'STAGE_1',
    stage_status VARCHAR(50) DEFAULT 'Open',
    stage1_status VARCHAR(50) DEFAULT 'Open',
    stage2_status VARCHAR(50) DEFAULT 'Not Started',
    stage3_status VARCHAR(50) DEFAULT 'Not Started',
    stage4_status VARCHAR(50) DEFAULT 'Not Started',
    stage5_status VARCHAR(50) DEFAULT 'Not Started',
    stage6_status VARCHAR(50) DEFAULT 'Not Started',
    visa_process JSONB DEFAULT '{"current": "Offer Letter", "completed": "None", "elapsed": "0 days", "next": "Labor Insurance"}'::jsonb,
    dl_process JSONB DEFAULT '{"current": "Eye Test", "completed": "None", "elapsed": "0 days", "next": "RTA File Opening"}'::jsonb,
    stage_data JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'RIDER', 'VEHICLE', 'EMPLOYEE', 'CANDIDATE', 'COMPANY'
    entity_id VARCHAR(64) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    expiry_date DATE NOT NULL,
    file_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    severity VARCHAR(50) DEFAULT 'INFO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT',
    location VARCHAR(150),
    shift_name VARCHAR(100),
    overtime_hours NUMERIC(4, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_month VARCHAR(50) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    incentives NUMERIC(12, 2) DEFAULT 0.00,
    overtime_hours NUMERIC(6, 2) DEFAULT 0.00,
    overtime_pay NUMERIC(12, 2) DEFAULT 0.00,
    penalties NUMERIC(12, 2) DEFAULT 0.00,
    tax_deductions NUMERIC(12, 2) DEFAULT 0.00,
    net_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    payment_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim_cards (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sim_number VARCHAR(100) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'DU',
    plan_name VARCHAR(100) NOT NULL,
    monthly_bill_aed NUMERIC(10, 2) DEFAULT 0.00,
    data_usage_gb NUMERIC(6, 2) DEFAULT 0.00,
    data_limit_gb NUMERIC(6, 2) DEFAULT 20.00,
    assigned_rider_id VARCHAR(64) REFERENCES riders(id) ON DELETE SET NULL,
    assigned_rider_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all business tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_department_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_cards ENABLE ROW LEVEL SECURITY;

-- Helper function to extract user's tenant_id from auth.jwt()
CREATE OR REPLACE FUNCTION current_user_tenant_id()
RETURNS VARCHAR AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claim.tenant_id', true),
        (SELECT tenant_id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if current user is platform super admin
CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claim.is_super_admin', true))::BOOLEAN,
        (SELECT is_super_admin FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1),
        FALSE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- TENANTS POLICIES
CREATE POLICY tenants_isolation_policy ON tenants
    FOR ALL
    USING (is_platform_super_admin() OR id = current_user_tenant_id());

-- TENANT SETTINGS POLICIES
CREATE POLICY tenant_settings_isolation_policy ON tenant_settings
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- BRANCHES POLICIES
CREATE POLICY branches_isolation_policy ON branches
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- DEPARTMENTS POLICIES
CREATE POLICY departments_isolation_policy ON departments
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- PROFILES POLICIES
CREATE POLICY profiles_isolation_policy ON profiles
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- EMPLOYEES POLICIES
CREATE POLICY employees_isolation_policy ON employees
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- VEHICLES POLICIES
CREATE POLICY vehicles_isolation_policy ON vehicles
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- RIDERS POLICIES
CREATE POLICY riders_isolation_policy ON riders
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- CANDIDATES POLICIES
CREATE POLICY candidates_isolation_policy ON candidates
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- DOCUMENTS POLICIES
CREATE POLICY documents_isolation_policy ON documents
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- ATTENDANCE POLICIES
CREATE POLICY attendance_isolation_policy ON attendance_records
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- PAYROLL POLICIES
CREATE POLICY payroll_isolation_policy ON payroll_records
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- SIM CARDS POLICIES
CREATE POLICY sim_cards_isolation_policy ON sim_cards
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

-- AUDIT LOGS POLICIES
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());
