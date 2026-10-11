-- ==============================================================================
-- SIM MANAGEMENT PROFESSIONALIZATION V1 + TRUE DATABASE TRANSACTION HARDENING
-- ==============================================================================

-- 1. Ensure Columns in sim_cards
ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS normalized_mobile_number VARCHAR(50);
ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) NOT NULL DEFAULT 'Unassigned';
ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS service_status VARCHAR(50) NOT NULL DEFAULT 'Active';

-- Populate normalized_mobile_number where missing
UPDATE sim_cards 
SET normalized_mobile_number = REGEXP_REPLACE(mobile_number, '[^0-9]', '', 'g')
WHERE normalized_mobile_number IS NULL;

-- 2. Ensure Columns in sim_assignments
ALTER TABLE sim_assignments ADD COLUMN IF NOT EXISTS return_date DATE;
ALTER TABLE sim_assignments ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE sim_assignments ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- 3. Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_sim_cards_tenant_id ON sim_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_norm_mobile ON sim_cards(tenant_id, normalized_mobile_number);
CREATE INDEX IF NOT EXISTS idx_sim_cards_iccid ON sim_cards(tenant_id, iccid);
CREATE INDEX IF NOT EXISTS idx_sim_cards_asgn_status ON sim_cards(tenant_id, assignment_status);
CREATE INDEX IF NOT EXISTS idx_sim_cards_srv_status ON sim_cards(tenant_id, service_status);
CREATE INDEX IF NOT EXISTS idx_sim_cards_current_emp ON sim_cards(tenant_id, current_employee_id);

CREATE INDEX IF NOT EXISTS idx_sim_asgn_tenant_sim ON sim_assignments(tenant_id, sim_card_id);
CREATE INDEX IF NOT EXISTS idx_sim_asgn_tenant_emp ON sim_assignments(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_sim_asgn_dates ON sim_assignments(tenant_id, assigned_at, returned_at);
CREATE INDEX IF NOT EXISTS idx_sim_asgn_status ON sim_assignments(tenant_id, status);

-- 4. Assignment Safety: Partial Unique Indexes (DB-Level Overlap & Duplicate Prevention)
-- Enforce strict uniqueness per tenant: UNIQUE(tenant_id, normalized_mobile_number) and UNIQUE(tenant_id, iccid)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_cards_tenant_norm_phone 
ON sim_cards(tenant_id, normalized_mobile_number)
WHERE normalized_mobile_number IS NOT NULL AND normalized_mobile_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_cards_tenant_iccid 
ON sim_cards(tenant_id, iccid) 
WHERE iccid IS NOT NULL AND iccid <> '';

-- One SIM cannot have overlapping active assignments to multiple employees
CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_active_assignment 
ON sim_assignments(tenant_id, sim_card_id) 
WHERE status = 'ACTIVE';

-- One employee cannot have multiple current primary SIM assignments
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_active_sim_assignment 
ON sim_assignments(tenant_id, employee_id) 
WHERE status = 'ACTIVE';


-- ==============================================================================
-- 5. RPC 1: VEHICLE SWAP — TRUE POSTGRESQL ATOMIC TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION rpc_swap_vehicle(
    p_tenant_id VARCHAR,
    p_employee_id VARCHAR,
    p_old_vehicle_id VARCHAR,
    p_new_vehicle_id VARCHAR,
    p_return_odometer NUMERIC,
    p_condition_on_return TEXT,
    p_return_notes TEXT,
    p_new_starting_odometer NUMERIC,
    p_new_condition TEXT,
    p_replacement_reason TEXT,
    p_assigned_by VARCHAR,
    p_user_id VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_old_veh RECORD;
  v_new_veh RECORD;
  v_emp RECORD;
  v_old_asgn RECORD;
  v_new_asgn_id VARCHAR;
  v_today DATE := CURRENT_DATE;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  -- 1. Validate employee
  SELECT * INTO v_emp 
  FROM employees 
  WHERE id = p_employee_id AND tenant_id = p_tenant_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee % not found in tenant %', p_employee_id, p_tenant_id;
  END IF;

  -- 2. Validate replacement vehicle
  SELECT * INTO v_new_veh 
  FROM vehicles 
  WHERE id = p_new_vehicle_id AND tenant_id = p_tenant_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Replacement vehicle % not found in tenant %', p_new_vehicle_id, p_tenant_id;
  END IF;

  IF (v_new_veh.status = 'ASSIGNED' OR v_new_veh.current_employee_id IS NOT NULL) AND v_new_veh.current_employee_id <> p_employee_id THEN
    RAISE EXCEPTION 'Replacement vehicle % is already assigned to another employee', v_new_veh.plate_number;
  END IF;

  -- 3. Close old vehicle assignment if old vehicle provided
  IF p_old_vehicle_id IS NOT NULL AND p_old_vehicle_id <> '' THEN
    SELECT * INTO v_old_veh 
    FROM vehicles 
    WHERE id = p_old_vehicle_id AND tenant_id = p_tenant_id 
    FOR UPDATE;

    IF FOUND THEN
      -- Find and close active assignment
      UPDATE vehicle_assignments
      SET assignment_status = 'REPLACED',
          return_date = v_today,
          return_time = CURRENT_TIME,
          return_odometer = COALESCE(p_return_odometer, v_old_veh.current_odometer),
          condition_on_return = COALESCE(p_condition_on_return, 'GOOD'),
          return_notes = COALESCE(p_return_notes, 'Replaced with ' || v_new_veh.plate_number || ': ' || p_replacement_reason),
          returned_to = p_assigned_by
      WHERE vehicle_id = p_old_vehicle_id 
        AND employee_id = p_employee_id 
        AND assignment_status = 'ACTIVE' 
        AND tenant_id = p_tenant_id;

      -- Reset old vehicle to Available
      UPDATE vehicles
      SET status = 'AVAILABLE',
          current_employee_id = NULL,
          current_employee_name = NULL,
          current_odometer = COALESCE(p_return_odometer, v_old_veh.current_odometer),
          updated_at = v_now,
          updated_by = p_assigned_by
      WHERE id = p_old_vehicle_id;
    END IF;
  END IF;

  -- 4. Create replacement vehicle assignment
  v_new_asgn_id := 'v_asgn_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4);

  INSERT INTO vehicle_assignments (
    id,
    tenant_id,
    vehicle_id,
    vehicle_plate,
    vehicle_model,
    employee_id,
    employee_name,
    assignment_date,
    assignment_time,
    assignment_status,
    starting_odometer,
    condition_on_assignment,
    handover_notes,
    assigned_by,
    created_at
  ) VALUES (
    v_new_asgn_id,
    p_tenant_id,
    v_new_veh.id,
    v_new_veh.plate_number,
    COALESCE(v_new_veh.make || ' ' || v_new_veh.model, 'Vehicle'),
    v_emp.id,
    v_emp.full_name,
    v_today,
    CURRENT_TIME,
    'ACTIVE',
    COALESCE(p_new_starting_odometer, v_new_veh.current_odometer, 0),
    COALESCE(p_new_condition, 'EXCELLENT'),
    'Replacement handover. Reason: ' || COALESCE(p_replacement_reason, 'Fleet swap'),
    p_assigned_by,
    v_now
  );

  -- 5. Set replacement vehicle status to ASSIGNED
  UPDATE vehicles
  SET status = 'ASSIGNED',
      current_employee_id = v_emp.id,
      current_employee_name = v_emp.full_name,
      current_odometer = COALESCE(p_new_starting_odometer, v_new_veh.current_odometer, 0),
      updated_at = v_now,
      updated_by = p_assigned_by
  WHERE id = v_new_veh.id;

  -- 6. Update employee current_bike_id / current_bike_plate
  UPDATE employees
  SET current_bike_id = v_new_veh.id,
      current_bike_plate = v_new_veh.plate_number,
      updated_at = v_now,
      updated_by = p_assigned_by
  WHERE id = v_emp.id;

  -- 7. Write audit log
  INSERT INTO audit_logs (
    id,
    tenant_id,
    user_id,
    actor_name,
    actor_role,
    action,
    action_type,
    module,
    entity_type,
    entity_id,
    reason,
    details,
    created_at
  ) VALUES (
    'aud_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4),
    p_tenant_id,
    COALESCE(p_user_id, 'system'),
    p_assigned_by,
    'FLEET_MANAGER',
    'REPLACE_VEHICLE',
    'REPLACE',
    'VEHICLE_MANAGEMENT',
    'FLEET_VEHICLE',
    v_new_veh.id,
    p_replacement_reason,
    'Atomic Swap: Replaced old vehicle ' || COALESCE(p_old_vehicle_id, 'none') || ' with ' || v_new_veh.plate_number || ' for employee ' || v_emp.full_name,
    v_now
  );

  v_result := jsonb_build_object(
    'success', true,
    'assignment_id', v_new_asgn_id,
    'new_vehicle_id', v_new_veh.id,
    'new_vehicle_plate', v_new_veh.plate_number,
    'employee_id', v_emp.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 6. RPC 2: ASSIGN SIM — ATOMIC POSTGRESQL TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION rpc_assign_sim(
    p_tenant_id VARCHAR,
    p_sim_id VARCHAR,
    p_employee_id VARCHAR,
    p_assigned_date DATE,
    p_notes TEXT,
    p_assigned_by VARCHAR,
    p_user_id VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sim RECORD;
  v_emp RECORD;
  v_asgn_id VARCHAR;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  -- 1. Validate employee
  SELECT * INTO v_emp 
  FROM employees 
  WHERE id = p_employee_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee % not found in tenant %', p_employee_id, p_tenant_id;
  END IF;

  -- 2. Validate employee does not already have an active SIM
  IF EXISTS (
    SELECT 1 FROM sim_assignments 
    WHERE employee_id = p_employee_id AND status = 'ACTIVE' AND tenant_id = p_tenant_id
  ) OR (v_emp.current_sim_id IS NOT NULL AND v_emp.current_sim_id <> '') THEN
    RAISE EXCEPTION 'EMPLOYEE_ALREADY_HAS_SIM: Employee % already has an active primary SIM assignment. Use Replace SIM or return existing SIM first.', v_emp.full_name;
  END IF;

  -- 3. Validate SIM
  SELECT * INTO v_sim 
  FROM sim_cards 
  WHERE id = p_sim_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SIM card % not found in tenant %', p_sim_id, p_tenant_id;
  END IF;

  IF v_sim.assignment_status = 'Assigned' OR v_sim.current_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'SIM_ALREADY_ASSIGNED: SIM % is already assigned to employee %', v_sim.mobile_number, COALESCE(v_sim.current_employee_name, v_sim.current_employee_id);
  END IF;

  -- 4. Create new assignment
  v_asgn_id := 's_asgn_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4);

  INSERT INTO sim_assignments (
    id,
    tenant_id,
    sim_card_id,
    mobile_number,
    provider,
    employee_id,
    employee_name,
    assigned_at,
    status,
    assigned_by,
    notes,
    created_at
  ) VALUES (
    v_asgn_id,
    p_tenant_id,
    v_sim.id,
    v_sim.mobile_number,
    v_sim.provider,
    v_emp.id,
    v_emp.full_name,
    COALESCE(p_assigned_date, CURRENT_DATE),
    'ACTIVE',
    p_assigned_by,
    p_notes,
    v_now
  );

  -- 5. Update SIM card record
  UPDATE sim_cards
  SET assignment_status = 'Assigned',
      status = 'Assigned',
      current_employee_id = v_emp.id,
      current_employee_name = v_emp.full_name,
      current_employee_code = v_emp.employee_code,
      assigned_date = COALESCE(p_assigned_date, CURRENT_DATE),
      assigned_by = p_assigned_by,
      updated_at = v_now,
      updated_by = p_assigned_by
  WHERE id = v_sim.id;

  -- 6. Update employee current SIM pointer (PRESERVES employee status, project, vehicle, external id)
  UPDATE employees
  SET current_sim_id = v_sim.id,
      current_sim_number = v_sim.mobile_number,
      updated_at = v_now,
      updated_by = p_assigned_by
  WHERE id = v_emp.id;

  -- 7. Write audit log
  INSERT INTO audit_logs (
    id,
    tenant_id,
    user_id,
    actor_name,
    actor_role,
    action,
    action_type,
    module,
    entity_type,
    entity_id,
    reason,
    details,
    created_at
  ) VALUES (
    'aud_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4),
    p_tenant_id,
    COALESCE(p_user_id, 'system'),
    p_assigned_by,
    'TELECOM_ADMIN',
    'ASSIGN_SIM',
    'ASSIGN',
    'SIM_MANAGEMENT',
    'SIM_CARD',
    v_sim.id,
    'SIM assigned to employee',
    'Assigned SIM ' || v_sim.mobile_number || ' to employee ' || v_emp.full_name || ' (' || v_emp.employee_code || ')',
    v_now
  );

  v_result := jsonb_build_object(
    'success', true,
    'assignment_id', v_asgn_id,
    'sim_id', v_sim.id,
    'mobile_number', v_sim.mobile_number,
    'employee_id', v_emp.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 7. RPC 3: RETURN SIM — ATOMIC POSTGRESQL TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION rpc_return_sim(
    p_tenant_id VARCHAR,
    p_sim_id VARCHAR,
    p_employee_id VARCHAR,
    p_return_date DATE,
    p_return_reason TEXT,
    p_notes TEXT,
    p_returned_to VARCHAR,
    p_user_id VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sim RECORD;
  v_emp RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  IF p_return_reason IS NULL OR TRIM(p_return_reason) = '' THEN
    RAISE EXCEPTION 'Return reason is mandatory for SIM return.';
  END IF;

  -- 1. Validate SIM
  SELECT * INTO v_sim 
  FROM sim_cards 
  WHERE id = p_sim_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SIM card % not found in tenant %', p_sim_id, p_tenant_id;
  END IF;

  -- 2. Validate employee
  SELECT * INTO v_emp 
  FROM employees 
  WHERE id = p_employee_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee % not found in tenant %', p_employee_id, p_tenant_id;
  END IF;

  -- 3. Close active assignment
  UPDATE sim_assignments
  SET status = 'RETURNED',
      returned_at = v_now,
      return_date = COALESCE(p_return_date, CURRENT_DATE),
      return_reason = p_return_reason,
      returned_to = p_returned_to,
      notes = CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN COALESCE(notes, '') || ' | Return notes: ' || p_notes ELSE notes END
  WHERE sim_card_id = p_sim_id 
    AND employee_id = p_employee_id 
    AND status = 'ACTIVE' 
    AND tenant_id = p_tenant_id;

  -- 4. Update SIM card record (PRESERVES service_status Active/Inactive!)
  UPDATE sim_cards
  SET assignment_status = 'Unassigned',
      status = 'Available',
      current_employee_id = NULL,
      current_employee_name = NULL,
      current_employee_code = NULL,
      assigned_date = NULL,
      assigned_by = NULL,
      updated_at = v_now,
      updated_by = p_returned_to
  WHERE id = v_sim.id;

  -- 5. Clear employee current SIM pointer (PRESERVES employee status, project, vehicle, external id)
  UPDATE employees
  SET current_sim_id = NULL,
      current_sim_number = NULL,
      updated_at = v_now,
      updated_by = p_returned_to
  WHERE id = v_emp.id;

  -- 6. Write audit log
  INSERT INTO audit_logs (
    id,
    tenant_id,
    user_id,
    actor_name,
    actor_role,
    action,
    action_type,
    module,
    entity_type,
    entity_id,
    reason,
    details,
    created_at
  ) VALUES (
    'aud_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4),
    p_tenant_id,
    COALESCE(p_user_id, 'system'),
    p_returned_to,
    'TELECOM_ADMIN',
    'RETURN_SIM',
    'RETURN',
    'SIM_MANAGEMENT',
    'SIM_CARD',
    v_sim.id,
    p_return_reason,
    'Returned SIM ' || v_sim.mobile_number || ' from employee ' || v_emp.full_name || ' (' || v_emp.employee_code || '). Reason: ' || p_return_reason,
    v_now
  );

  v_result := jsonb_build_object(
    'success', true,
    'sim_id', v_sim.id,
    'mobile_number', v_sim.mobile_number,
    'employee_id', v_emp.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 8. RPC 4: REPLACE SIM — TRUE POSTGRESQL ATOMIC TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION rpc_replace_sim(
    p_tenant_id VARCHAR,
    p_employee_id VARCHAR,
    p_old_sim_id VARCHAR,
    p_new_sim_id VARCHAR,
    p_swap_date DATE,
    p_swap_reason TEXT,
    p_notes TEXT,
    p_swapped_by VARCHAR,
    p_user_id VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_emp RECORD;
  v_old_sim RECORD;
  v_new_sim RECORD;
  v_new_asgn_id VARCHAR;
  v_today DATE := CURRENT_DATE;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  IF p_swap_reason IS NULL OR TRIM(p_swap_reason) = '' THEN
    RAISE EXCEPTION 'Swap reason is mandatory for SIM replacement.';
  END IF;

  -- 1. Validate employee
  SELECT * INTO v_emp 
  FROM employees 
  WHERE id = p_employee_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee % not found in tenant %', p_employee_id, p_tenant_id;
  END IF;

  -- 2. Validate replacement SIM
  SELECT * INTO v_new_sim 
  FROM sim_cards 
  WHERE id = p_new_sim_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Replacement SIM % not found in tenant %', p_new_sim_id, p_tenant_id;
  END IF;

  IF v_new_sim.assignment_status = 'Assigned' OR v_new_sim.current_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Replacement SIM % is already assigned to another employee', v_new_sim.mobile_number;
  END IF;

  -- 3. Close old SIM assignment if old SIM is provided
  IF p_old_sim_id IS NOT NULL AND p_old_sim_id <> '' THEN
    SELECT * INTO v_old_sim 
    FROM sim_cards 
    WHERE id = p_old_sim_id AND tenant_id = p_tenant_id 
    FOR UPDATE;

    IF FOUND THEN
      -- Close old assignment
      UPDATE sim_assignments
      SET status = 'REPLACED',
          returned_at = v_now,
          return_date = COALESCE(p_swap_date, v_today),
          return_reason = p_swap_reason,
          returned_to = p_swapped_by,
          notes = 'Replaced with ' || v_new_sim.mobile_number || '. Reason: ' || p_swap_reason || COALESCE(' | ' || p_notes, '')
      WHERE sim_card_id = p_old_sim_id 
        AND employee_id = p_employee_id 
        AND status = 'ACTIVE' 
        AND tenant_id = p_tenant_id;

      -- Reset old SIM to Unassigned (preserves service_status)
      UPDATE sim_cards
      SET assignment_status = 'Unassigned',
          status = 'Available',
          current_employee_id = NULL,
          current_employee_name = NULL,
          current_employee_code = NULL,
          assigned_date = NULL,
          assigned_by = NULL,
          updated_at = v_now,
          updated_by = p_swapped_by
      WHERE id = p_old_sim_id;
    END IF;
  END IF;

  -- 4. Create replacement assignment
  v_new_asgn_id := 's_asgn_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4);

  INSERT INTO sim_assignments (
    id,
    tenant_id,
    sim_card_id,
    mobile_number,
    provider,
    employee_id,
    employee_name,
    assigned_at,
    status,
    assigned_by,
    notes,
    created_at
  ) VALUES (
    v_new_asgn_id,
    p_tenant_id,
    v_new_sim.id,
    v_new_sim.mobile_number,
    v_new_sim.provider,
    v_emp.id,
    v_emp.full_name,
    COALESCE(p_swap_date, v_today),
    'ACTIVE',
    p_swapped_by,
    'Replacement for ' || COALESCE(v_old_sim.mobile_number, 'previous SIM') || '. Reason: ' || p_swap_reason || COALESCE(' | ' || p_notes, ''),
    v_now
  );

  -- 5. Mark replacement SIM as Assigned
  UPDATE sim_cards
  SET assignment_status = 'Assigned',
      status = 'Assigned',
      current_employee_id = v_emp.id,
      current_employee_name = v_emp.full_name,
      current_employee_code = v_emp.employee_code,
      assigned_date = COALESCE(p_swap_date, v_today),
      assigned_by = p_swapped_by,
      updated_at = v_now,
      updated_by = p_swapped_by
  WHERE id = v_new_sim.id;

  -- 6. Update employee current SIM pointer (PRESERVES employee status, project, vehicle, external id)
  UPDATE employees
  SET current_sim_id = v_new_sim.id,
      current_sim_number = v_new_sim.mobile_number,
      updated_at = v_now,
      updated_by = p_swapped_by
  WHERE id = v_emp.id;

  -- 7. Write audit log
  INSERT INTO audit_logs (
    id,
    tenant_id,
    user_id,
    actor_name,
    actor_role,
    action,
    action_type,
    module,
    entity_type,
    entity_id,
    reason,
    details,
    created_at
  ) VALUES (
    'aud_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4),
    p_tenant_id,
    COALESCE(p_user_id, 'system'),
    p_swapped_by,
    'TELECOM_ADMIN',
    'REPLACE_SIM',
    'REPLACE',
    'SIM_MANAGEMENT',
    'SIM_CARD',
    v_new_sim.id,
    p_swap_reason,
    'Atomic Swap: Replaced old SIM ' || COALESCE(v_old_sim.mobile_number, 'none') || ' with ' || v_new_sim.mobile_number || ' for employee ' || v_emp.full_name,
    v_now
  );

  v_result := jsonb_build_object(
    'success', true,
    'assignment_id', v_new_asgn_id,
    'new_sim_id', v_new_sim.id,
    'new_mobile_number', v_new_sim.mobile_number,
    'employee_id', v_emp.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 9. RPC 5: TRANSFER SIM BETWEEN EMPLOYEES — TRUE POSTGRESQL ATOMIC TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION rpc_transfer_sim(
    p_tenant_id VARCHAR,
    p_sim_id VARCHAR,
    p_source_employee_id VARCHAR,
    p_destination_employee_id VARCHAR,
    p_effective_date DATE,
    p_transfer_reason TEXT,
    p_notes TEXT,
    p_transferred_by VARCHAR,
    p_user_id VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sim RECORD;
  v_src_emp RECORD;
  v_dest_emp RECORD;
  v_new_asgn_id VARCHAR;
  v_today DATE := CURRENT_DATE;
  v_now TIMESTAMPTZ := NOW();
  v_result JSONB;
BEGIN
  IF p_transfer_reason IS NULL OR TRIM(p_transfer_reason) = '' THEN
    RAISE EXCEPTION 'Transfer reason is mandatory for SIM transfer.';
  END IF;

  -- 1. Validate source employee
  SELECT * INTO v_src_emp 
  FROM employees 
  WHERE id = p_source_employee_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source employee % not found in tenant %', p_source_employee_id, p_tenant_id;
  END IF;

  -- 2. Validate destination employee
  SELECT * INTO v_dest_emp 
  FROM employees 
  WHERE id = p_destination_employee_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination employee % not found in tenant %', p_destination_employee_id, p_tenant_id;
  END IF;

  -- 3. Validate destination employee DOES NOT already have another current SIM
  IF EXISTS (
    SELECT 1 FROM sim_assignments 
    WHERE employee_id = p_destination_employee_id AND status = 'ACTIVE' AND tenant_id = p_tenant_id
  ) OR (v_dest_emp.current_sim_id IS NOT NULL AND v_dest_emp.current_sim_id <> '') THEN
    RAISE EXCEPTION 'Destination employee % already holds an active SIM card. Please replace or return destination SIM first.', v_dest_emp.full_name;
  END IF;

  -- 4. Validate SIM
  SELECT * INTO v_sim 
  FROM sim_cards 
  WHERE id = p_sim_id AND tenant_id = p_tenant_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SIM card % not found in tenant %', p_sim_id, p_tenant_id;
  END IF;

  -- 5. Close active assignment for source employee (PRESERVES historical ownership)
  UPDATE sim_assignments
  SET status = 'TRANSFERRED',
      returned_at = v_now,
      return_date = COALESCE(p_effective_date, v_today),
      return_reason = p_transfer_reason,
      returned_to = p_transferred_by,
      notes = 'Transferred to ' || v_dest_emp.full_name || ' (' || v_dest_emp.employee_code || '). Reason: ' || p_transfer_reason || COALESCE(' | ' || p_notes, '')
  WHERE sim_card_id = p_sim_id 
    AND employee_id = p_source_employee_id 
    AND status = 'ACTIVE' 
    AND tenant_id = p_tenant_id;

  -- 6. Clear source employee current SIM pointer
  UPDATE employees
  SET current_sim_id = NULL,
      current_sim_number = NULL,
      updated_at = v_now,
      updated_by = p_transferred_by
  WHERE id = v_src_emp.id;

  -- 7. Create new assignment for destination employee
  v_new_asgn_id := 's_asgn_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4);

  INSERT INTO sim_assignments (
    id,
    tenant_id,
    sim_card_id,
    mobile_number,
    provider,
    employee_id,
    employee_name,
    assigned_at,
    status,
    assigned_by,
    notes,
    created_at
  ) VALUES (
    v_new_asgn_id,
    p_tenant_id,
    v_sim.id,
    v_sim.mobile_number,
    v_sim.provider,
    v_dest_emp.id,
    v_dest_emp.full_name,
    COALESCE(p_effective_date, v_today),
    'ACTIVE',
    p_transferred_by,
    'Transferred from ' || v_src_emp.full_name || ' (' || v_src_emp.employee_code || '). Reason: ' || p_transfer_reason || COALESCE(' | ' || p_notes, ''),
    v_now
  );

  -- 8. Update SIM record for destination employee
  UPDATE sim_cards
  SET assignment_status = 'Assigned',
      status = 'Assigned',
      current_employee_id = v_dest_emp.id,
      current_employee_name = v_dest_emp.full_name,
      current_employee_code = v_dest_emp.employee_code,
      assigned_date = COALESCE(p_effective_date, v_today),
      assigned_by = p_transferred_by,
      updated_at = v_now,
      updated_by = p_transferred_by
  WHERE id = v_sim.id;

  -- 9. Update destination employee current SIM pointer
  UPDATE employees
  SET current_sim_id = v_sim.id,
      current_sim_number = v_sim.mobile_number,
      updated_at = v_now,
      updated_by = p_transferred_by
  WHERE id = v_dest_emp.id;

  -- 10. Write audit log
  INSERT INTO audit_logs (
    id,
    tenant_id,
    user_id,
    actor_name,
    actor_role,
    action,
    action_type,
    module,
    entity_type,
    entity_id,
    reason,
    details,
    created_at
  ) VALUES (
    'aud_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4),
    p_tenant_id,
    COALESCE(p_user_id, 'system'),
    p_transferred_by,
    'TELECOM_ADMIN',
    'TRANSFER_SIM',
    'TRANSFER',
    'SIM_MANAGEMENT',
    'SIM_CARD',
    v_sim.id,
    p_transfer_reason,
    'Controlled Transfer: SIM ' || v_sim.mobile_number || ' from ' || v_src_emp.full_name || ' to ' || v_dest_emp.full_name || '. Reason: ' || p_transfer_reason,
    v_now
  );

  v_result := jsonb_build_object(
    'success', true,
    'assignment_id', v_new_asgn_id,
    'sim_id', v_sim.id,
    'source_employee_id', v_src_emp.id,
    'destination_employee_id', v_dest_emp.id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
