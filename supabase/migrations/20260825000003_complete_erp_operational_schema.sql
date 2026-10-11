-- ==============================================================================
-- STEP 3 MIGRATION: Complete ERP Operational & Financial Engine
-- Covers: Fines, Salik, Loans, Physical Passports, Documents, Payroll, and Legal Forms
-- ==============================================================================

-- 1. PROJECT RIDER / COURIER MAPPINGS
CREATE TABLE IF NOT EXISTS project_rider_mappings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_rider_id VARCHAR(100) NOT NULL, -- e.g. Noon NIM ID, Keeta Courier ID, Talabat ID
    rider_name VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. COMPLIANCE DOCUMENTS VAULT
CREATE TABLE IF NOT EXISTS document_types (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'EMPLOYEE', 'VEHICLE', 'COMPANY'
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_documents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'EMPLOYEE', 'VEHICLE'
    entity_id VARCHAR(64) NOT NULL,
    document_type_id VARCHAR(64) NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_files (
    id VARCHAR(64) PRIMARY KEY,
    entity_document_id VARCHAR(64) NOT NULL REFERENCES entity_documents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'SUPABASE',
    checksum VARCHAR(100),
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PHYSICAL PASSPORT CUSTODY & VAULT
CREATE TABLE IF NOT EXISTS passport_custody (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    passport_number VARCHAR(100) NOT NULL,
    nationality VARCHAR(100),
    current_status VARCHAR(50) NOT NULL DEFAULT 'IN_SAFE', -- 'IN_SAFE', 'RELEASED_TEMPORARY', 'RELEASED_PERMANENT'
    vault_location VARCHAR(150) NOT NULL DEFAULT 'Main Office Fireproof Safe - Compartment A',
    safe_box_number VARCHAR(50),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    handed_by VARCHAR(150),
    received_by VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passport_custody_history (
    id VARCHAR(64) PRIMARY KEY,
    custody_id VARCHAR(64) NOT NULL REFERENCES passport_custody(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'CHECK_IN', 'TEMPORARY_RELEASE', 'RETURN_TO_SAFE', 'FINAL_EXIT_RELEASE'
    actor_name VARCHAR(150) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_return_date DATE,
    actual_return_date DATE,
    reason TEXT,
    remarks TEXT
);

-- 4. TRAFFIC FINES & DEDUCTIONS
CREATE TABLE IF NOT EXISTS traffic_fines (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fine_number VARCHAR(100) NOT NULL,
    plate_number VARCHAR(50) NOT NULL,
    plate_category VARCHAR(50) DEFAULT 'DXB_BIKE',
    violation_date TIMESTAMPTZ NOT NULL,
    violation_charge TEXT NOT NULL,
    fine_source VARCHAR(50) NOT NULL, -- 'DUBAI_POLICE', 'ABU_DHABI_POLICE', 'RTA', 'SHARJAH_POLICE'
    amount NUMERIC(10, 2) NOT NULL,
    driver_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    driver_name VARCHAR(150),
    allocation_status VARCHAR(50) NOT NULL DEFAULT 'UNALLOCATED', -- 'UNALLOCATED', 'ALLOCATED_TO_RIDER', 'COMPANY_LIABILITY', 'DISPUTED'
    payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID', -- 'UNPAID', 'PAID_BY_COMPANY', 'RECOVERED_FROM_RIDER'
    payroll_deduction_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SALIK TOLL CHARGES
CREATE TABLE IF NOT EXISTS salik_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) NOT NULL,
    toll_gate VARCHAR(100) NOT NULL, -- 'Al Garhoud', 'Al Barsha', 'Al Safa', etc.
    plate_number VARCHAR(50) NOT NULL,
    pass_date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 4.00,
    driver_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    driver_name VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. EMPLOYEE LOANS & SALARY ADVANCES
CREATE TABLE IF NOT EXISTS employee_loans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_type VARCHAR(50) NOT NULL DEFAULT 'PERSONAL_LOAN', -- 'EMERGENCY_ADVANCE', 'VISA_INSTALLMENT', 'PERSONAL_LOAN'
    principal_amount NUMERIC(10, 2) NOT NULL,
    monthly_installment NUMERIC(10, 2) NOT NULL,
    remaining_balance NUMERIC(10, 2) NOT NULL,
    start_month VARCHAR(20) NOT NULL, -- '2026-03'
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'COMPLETED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PAYROLL PROFILES & SALARY STRUCTURES
CREATE TABLE IF NOT EXISTS project_import_profiles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    profile_name VARCHAR(150) NOT NULL,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_name VARCHAR(150) NOT NULL,
    salary_group VARCHAR(50) NOT NULL, -- 'LABOUR', 'KEETA', 'NOON', 'ALLIED_PARTNER', 'FIXED'
    source_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LEGAL FORM TEMPLATES & GENERATED UNDERTAKINGS
CREATE TABLE IF NOT EXISTS form_templates (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    html_template TEXT NOT NULL,
    token_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_forms (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id VARCHAR(64) NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    form_title VARCHAR(150) NOT NULL,
    rendered_html TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'GENERATED', 'SIGNED', 'ARCHIVED'
    signature_data TEXT,
    signed_at TIMESTAMPTZ,
    signed_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE project_rider_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_custody_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE salik_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_import_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_project_rider_mappings ON project_rider_mappings
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_traffic_fines ON traffic_fines
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_salik_records ON salik_records
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_employee_loans ON employee_loans
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_passport_custody ON passport_custody
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_entity_documents ON entity_documents
    USING (tenant_id = current_setting('app.current_tenant_id', true));
