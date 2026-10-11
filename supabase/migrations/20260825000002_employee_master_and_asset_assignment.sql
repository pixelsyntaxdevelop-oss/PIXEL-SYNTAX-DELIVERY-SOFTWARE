-- ==============================================================================
-- STEP 2 MIGRATION: Complete Employee Master Profile & Asset Assignment System
-- ==============================================================================

-- 1. PROJECTS & CLIENTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    client_name VARCHAR(150) NOT NULL, -- 'Talabat', 'Deliveroo', 'Noon', 'Amazon', 'Careem', 'Custom Client'
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    rate_per_order NUMERIC(10, 2) DEFAULT 12.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. EMPLOYEE MASTER PROFILE TABLE (Comprehensive 360 Operational Profile)
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(64) PRIMARY KEY,
    employee_id VARCHAR(64),
    employee_code VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    photo TEXT,
    nationality VARCHAR(100) DEFAULT 'Pakistan',
    date_of_birth DATE,
    gender VARCHAR(20) DEFAULT 'Male',
    personal_mobile VARCHAR(50),
    company_mobile VARCHAR(50),
    email VARCHAR(255),
    passport_number VARCHAR(100),
    passport_expiry DATE,
    passport_status VARCHAR(50) DEFAULT 'With Company', -- 'With Company', 'With Rider', 'In Office'
    passport_handler VARCHAR(150),
    passport_location VARCHAR(150),
    passport_receive_date DATE,
    emirates_id_number VARCHAR(100),
    emirates_id_expiry DATE,
    visa_number VARCHAR(100),
    visa_expiry DATE,
    driving_license_number VARCHAR(100),
    driving_license_expiry DATE,
    joining_date DATE NOT NULL,
    employment_type VARCHAR(50) DEFAULT 'FULL_TIME',
    job_title VARCHAR(150),
    designation VARCHAR(150) DEFAULT 'Bike Rider',
    contractor_id VARCHAR(100) DEFAULT 'Own',
    contractor VARCHAR(100) DEFAULT 'Own',
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
    project_name VARCHAR(150),
    project_code VARCHAR(50),
    supervisor_id VARCHAR(64),
    team_leader_id VARCHAR(64),
    manager_id VARCHAR(64),
    manager_name VARCHAR(150),
    current_status VARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Inactive, Onboarding, Waiting for Visa, Waiting for License, Ready to Deploy, Assigned, Unassigned, On Leave, Suspended, Absconding, Terminated, Resigned, Cancelled, Vacation, Medical Leave, Other
    status_reason TEXT,
    status_effective_date DATE,
    salary_type VARCHAR(50) DEFAULT 'MONTHLY',
    basic_salary NUMERIC(12, 2) DEFAULT 3500.00,
    allowances NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    current_bike_id VARCHAR(64),
    current_bike_plate VARCHAR(100),
    current_sim_id VARCHAR(64),
    current_sim_number VARCHAR(100),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- 3. EMPLOYEE STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS employee_status_history (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    reason TEXT,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    notes TEXT,
    changed_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EMPLOYEE PROJECT ASSIGNMENTS HISTORY TABLE
CREATE TABLE IF NOT EXISTS employee_project_assignments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    assignment_start_date DATE NOT NULL,
    assignment_end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'CANCELLED'
    employee_code_on_project VARCHAR(50),
    notes TEXT,
    assigned_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. VEHICLE / BIKE MASTER TABLE
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(64) PRIMARY KEY,
    vehicle_id VARCHAR(64),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Bike', -- 'Bike', 'Car', 'Van', 'Truck', 'Other'
    plate_number VARCHAR(50) NOT NULL,
    plate_code VARCHAR(20),
    plate_emirate VARCHAR(50) DEFAULT 'Dubai',
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INT NOT NULL DEFAULT 2025,
    color VARCHAR(50) DEFAULT 'Black',
    chassis_number VARCHAR(100),
    engine_number VARCHAR(100),
    registration_number VARCHAR(100),
    registration_expiry DATE,
    insurance_number VARCHAR(100),
    insurance_expiry DATE,
    ownership_type VARCHAR(50) DEFAULT 'OWNED', -- 'OWNED', 'LEASED', 'RENTED'
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE'
    current_odometer NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- 6. VEHICLE ASSIGNMENTS HISTORY TABLE
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    assignment_time TIME NOT NULL DEFAULT '08:00:00',
    return_date DATE,
    return_time TIME,
    assignment_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RETURNED', 'REPLACED'
    starting_odometer NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    return_odometer NUMERIC(10, 2),
    condition_on_assignment TEXT DEFAULT 'Good Condition',
    condition_on_return TEXT,
    handover_notes TEXT,
    return_notes TEXT,
    assigned_by VARCHAR(100),
    returned_to VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SIM CARD MASTER TABLE
CREATE TABLE IF NOT EXISTS sim_cards (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mobile_number VARCHAR(50) NOT NULL,
    sim_serial_number VARCHAR(100) NOT NULL,
    iccid VARCHAR(100),
    provider VARCHAR(50) NOT NULL DEFAULT 'DU', -- 'DU', 'ETISALAT', 'VIRGIN', 'STC', 'OTHER'
    plan VARCHAR(100) NOT NULL DEFAULT 'Enterprise 25GB',
    monthly_cost NUMERIC(10, 2) NOT NULL DEFAULT 125.00,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'TERMINATED'
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    activation_date DATE,
    expiry_date DATE,
    current_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SIM ASSIGNMENTS HISTORY TABLE
CREATE TABLE IF NOT EXISTS sim_assignments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sim_card_id VARCHAR(64) NOT NULL REFERENCES sim_cards(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RETURNED', 'REPLACED'
    assigned_by VARCHAR(100),
    returned_to VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. GENERIC ASSET MASTER & ASSET ASSIGNMENT ARCHITECTURE
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL, -- 'Phone', 'Helmet', 'Uniform', 'Delivery Box', 'Power Bank', 'Bag', 'Other'
    asset_name VARCHAR(150) NOT NULL,
    serial_number VARCHAR(100),
    barcode VARCHAR(100),
    brand VARCHAR(100),
    model VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED'
    condition VARCHAR(50) DEFAULT 'NEW',
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    cost NUMERIC(10, 2) DEFAULT 0.00,
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS asset_assignments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id VARCHAR(64) NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RETURNED', 'DAMAGED'
    condition_on_assignment VARCHAR(100) DEFAULT 'GOOD',
    condition_on_return VARCHAR(100),
    assigned_by VARCHAR(100),
    returned_to VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. UNIFIED EMPLOYEE TIMELINE EVENTS TABLE
CREATE TABLE IF NOT EXISTS employee_timeline_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL, -- 'STATUS', 'PROJECT', 'BIKE', 'SIM', 'ASSET', 'DOCUMENT', 'SALARY', 'SYSTEM'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    performed_by VARCHAR(150),
    performed_by_role VARCHAR(100),
    related_entity_type VARCHAR(50),
    related_entity_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES FOR NEW TABLES
-- ==============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_isolation_policy ON projects
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY employee_status_history_isolation_policy ON employee_status_history
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY employee_project_assignments_isolation_policy ON employee_project_assignments
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY vehicle_assignments_isolation_policy ON vehicle_assignments
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY sim_assignments_isolation_policy ON sim_assignments
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY assets_isolation_policy ON assets
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY asset_assignments_isolation_policy ON asset_assignments
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());

CREATE POLICY employee_timeline_events_isolation_policy ON employee_timeline_events
    FOR ALL
    USING (is_platform_super_admin() OR tenant_id = current_user_tenant_id());
