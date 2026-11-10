
-- 50 synthetic demo employees: 10 primary riders in each of Talabat, Keeta,
-- Noon Minutes, Deliveroo, Careem Food. Ten riders have a Sep 1-15 ->
-- Sep 16-30 cross-project transfer, with no overlapping work dates.
-- IDs and phones explicitly say DEMO; NOT UAE government-issued identifiers.
BEGIN;
DO $$
DECLARE
 ids text[]:=ARRAY['demo_prj_talabat','demo_prj_keeta','demo_prj_noon_minutes','demo_prj_deliveroo','demo_prj_careem'];
 names text[]:=ARRAY['Talabat Food','Keeta','Noon Minutes','Deliveroo','Careem Food'];
 codes text[]:=ARRAY['TLB','KTA','NMIN','DLV','CRMF'];
 i integer;
 j integer;
 grp integer;
 prior integer;
 d integer;
 own_project text;
 prior_project text;
 own_name text;
 own_code text;
 own_emp_id text;
 own_emp_code text;
 main_asg text;
 old_asg text;
 primary_start date;
 work_project text;
 work_asg text;
 current_asset_date date;
 prior_holder text;
 original_project_name text;
 original_project_code text;
BEGIN
 FOR i IN 1..50 LOOP
  grp:=((i-1)/10)+1;
  prior:=CASE WHEN grp=1 THEN 5 ELSE grp-1 END;
  own_project:=ids[grp];
  prior_project:=ids[prior];
  own_name:='Demo '||names[grp]||' Rider '||lpad(((i-1)%10+1)::text,2,'0');
  own_code:='PX-DEMO-'||lpad(i::text,4,'0');
  own_emp_id:='px_demo_emp_'||lpad(i::text,4,'0');
  main_asg:='px_demo_asg_main_'||lpad(i::text,4,'0');
  old_asg:='px_demo_asg_prior_'||lpad(i::text,4,'0');
  primary_start:=CASE WHEN (i-1)%10<2 THEN DATE '2026-09-16' ELSE DATE '2026-09-01' END;

  INSERT INTO public.employees
  (id,tenant_id,employee_code,employee_id,first_name,last_name,full_name,
   department,department_id,branch_id,designation,job_title,joining_date,salary_base,basic_salary,
   salary_type,current_status,status,is_active,is_archived,emirates_id_number,emirates_id_expiry,
   visa_expiry,passport_expiry,driving_license_expiry,
   project_id,project_name,project_code,created_by,notes)
  VALUES
  (own_emp_id,'company_pixel_syntax',own_code,own_code,'Demo',names[grp]||' Rider '||lpad(((i-1)%10+1)::text,2,'0'),
   own_name,'OPERATIONS','demo_ops','demo_dxb','Delivery Rider','Delivery Rider','2026-09-01',
   3000,3000,'MONTHLY','Assigned / Active','ACTIVE',true,false,
   'DEMO-EID-'||lpad(i::text,5,'0'),
   CASE WHEN i%5=0 THEN DATE '2026-10-20'
        WHEN i%5=1 THEN DATE '2026-11-25'
        ELSE DATE '2027-06-30' END,
   CASE WHEN i%7=0 THEN DATE '2026-11-20' ELSE DATE '2027-08-20' END,
   DATE '2028-03-30',DATE '2027-05-30',
   own_project,names[grp],codes[grp],'Pixel Syntax Demo Seeder',
   'FICTIONAL DEMO RIDER — government ID is placeholder; NOT actual payroll')
  ON CONFLICT(id) DO NOTHING;

  IF primary_start>DATE '2026-09-01' THEN
   INSERT INTO public.employee_project_assignments
   (id,tenant_id,employee_id,project_id,branch_id,
    employee_name,employee_code,project_name,project_code,external_rider_id,external_id_type,
    assignment_start_date,assignment_end_date,status,is_primary,end_reason,ended_at,assigned_by,created_by)
   VALUES
   (old_asg,'company_pixel_syntax',own_emp_id,prior_project,'demo_dxb',
    own_name,own_code,names[prior],codes[prior],
    codes[prior]||'-DEMO-'||lpad(i::text,5,'0'),'Courier ID',
    '2026-09-01','2026-09-15','ENDED',false,'Project transfer for payroll split',
    '2026-09-15T23:59:00+04','Demo QA','Pixel Syntax Demo Seeder')
   ON CONFLICT(id) DO NOTHING;
  END IF;

  INSERT INTO public.employee_project_assignments
   (id,tenant_id,employee_id,project_id,branch_id,
    employee_name,employee_code,project_name,project_code,external_rider_id,external_id_type,
    assignment_start_date,assignment_end_date,status,is_primary,assigned_by,created_by)
  VALUES
   (main_asg,'company_pixel_syntax',own_emp_id,own_project,'demo_dxb',
    own_name,own_code,names[grp],codes[grp],
    codes[grp]||'-DEMO-'||lpad(i::text,5,'0'),'Courier ID',
    primary_start,NULL,'ACTIVE',true,'Demo QA','Pixel Syntax Demo Seeder')
  ON CONFLICT(id) DO NOTHING;

  FOR d IN 1..30 LOOP
   IF primary_start>DATE '2026-09-01' AND d<=15 THEN
    work_project:=prior_project;work_asg:=old_asg;
   ELSE
    work_project:=own_project;work_asg:=main_asg;
   END IF;
   INSERT INTO public.project_daily_earnings
    (id,tenant_id,employee_id,project_id,assignment_id,work_date,orders_count,
     tips_aed,incentives_aed,deductions_aed,source_type,source_reference,is_demo)
   VALUES
    ('px_demo_daily_'||lpad(i::text,4,'0')||'_'||lpad(d::text,2,'0'),
     'company_pixel_syntax',own_emp_id,work_project,work_asg,
     DATE '2026-09-01'+(d-1),
     6+((i+d)%10),
     CASE WHEN d%7=0 THEN 5 ELSE 0 END,
     CASE WHEN d%10=0 THEN 10 ELSE 0 END,
     CASE WHEN d%13=0 THEN 4 ELSE 0 END,
     'DEMO_SYNTHETIC','TEST-ONLY-NO-PROVIDER-IMPORT',true)
   ON CONFLICT(id) DO NOTHING;
  END LOOP;
 END LOOP;

 -- 50 unique fake bikes and SIM cards, one CURRENT holder each.
 -- Bikes/SIMs #11..20 first belonged to riders #1..10 (1-15 Sep);
 -- 16 Sep onwards they belonged to riders #11..20. The first ten riders
 -- received their own assets on 16 Sep.
 FOR i IN 1..50 LOOP
  own_emp_id:='px_demo_emp_'||lpad(i::text,4,'0');
  current_asset_date:=CASE WHEN i<=20 THEN DATE '2026-09-16' ELSE DATE '2026-09-01' END;

  INSERT INTO public.vehicles
  (id,tenant_id,plate_number,make,model,year,type,vehicle_type,status,current_status,
   branch_id,odometer_km,current_odometer,current_employee_id,current_employee_name,created_by)
  VALUES('px_demo_bike_'||lpad(i::text,4,'0'),'company_pixel_syntax',
    'DEMO-BK-'||lpad(i::text,4,'0'),'Honda','CB125F',2025,'MOTORCYCLE','Bike','ASSIGNED','Assigned',
    'demo_dxb',1000+i*50,1000+i*50,own_emp_id,
    (SELECT full_name FROM public.employees WHERE id=own_emp_id),'Pixel Syntax Demo Seeder')
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO public.sim_cards
   (id,tenant_id,sim_number,phone_number,mobile_number,sim_serial_number,iccid,
    provider,plan,plan_name,monthly_cost,monthly_bill_aed,
    status,assignment_status,service_status,branch_id,created_by,notes,current_employee_id,
    current_employee_name,current_employee_code,assigned_date,assigned_by)
  VALUES
   ('px_demo_sim_'||lpad(i::text,4,'0'),'company_pixel_syntax',
    'DEMO-ICCID-'||lpad(i::text,5,'0'),'DEMO-SIM-'||lpad(i::text,4,'0'),
    'DEMO-SIM-'||lpad(i::text,4,'0'),'DEMO-ICCID-'||lpad(i::text,5,'0'),
    'DEMO-ICCID-'||lpad(i::text,5,'0'),'DU','Demo Fleet 10GB','Demo Fleet 10GB',
    50,50,'ASSIGNED','Assigned','Active','demo_dxb','Pixel Syntax Demo Seeder',
    'NOT REAL TELECOM LINE',own_emp_id,
    (SELECT full_name FROM public.employees WHERE id=own_emp_id),
    (SELECT employee_code FROM public.employees WHERE id=own_emp_id),
    current_asset_date,'Demo QA')
  ON CONFLICT(id) DO NOTHING;

  UPDATE public.employees
  SET current_bike_id='px_demo_bike_'||lpad(i::text,4,'0'),
      current_bike_plate='DEMO-BK-'||lpad(i::text,4,'0'),
      current_sim_id='px_demo_sim_'||lpad(i::text,4,'0'),
      current_sim_number='DEMO-SIM-'||lpad(i::text,4,'0')
  WHERE id=own_emp_id AND tenant_id='company_pixel_syntax';

  IF i>=11 AND i<=20 THEN
    prior_holder:='px_demo_emp_'||lpad((i-10)::text,4,'0');
    INSERT INTO public.vehicle_assignments
    (id,tenant_id,vehicle_id,employee_id,assignment_date,assignment_time,return_date,return_time,
     assignment_status,starting_odometer,return_odometer,condition_on_assignment,
     condition_on_return,return_notes,assigned_by,returned_to)
    VALUES('px_demo_veh_old_'||lpad(i::text,4,'0'),'company_pixel_syntax',
     'px_demo_bike_'||lpad(i::text,4,'0'),prior_holder,
     '2026-09-01','08:00','2026-09-15','18:00','RETURNED',
     900+i*50,1000+i*50,'Good','Good','DEMO returned, reassigned to new rider',
     'Demo QA','Demo QA')
    ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.sim_assignments
    (id,tenant_id,sim_card_id,employee_id,assigned_at,returned_at,
     status,assignment_status,assigned_date,return_date,assigned_by,returned_by,return_reason,
     mobile_number,provider,employee_name,employee_code)
    VALUES('px_demo_sim_old_'||lpad(i::text,4,'0'),'company_pixel_syntax',
      'px_demo_sim_'||lpad(i::text,4,'0'),prior_holder,
      '2026-09-01T08:00:00+04','2026-09-15T18:00:00+04',
      'RETURNED','RETURNED','2026-09-01','2026-09-15','Demo QA','Demo QA',
      'DEMO transfer to new holder','DEMO-SIM-'||lpad(i::text,4,'0'),'DU',
      (SELECT full_name FROM public.employees WHERE id=prior_holder),
      (SELECT employee_code FROM public.employees WHERE id=prior_holder))
    ON CONFLICT(id) DO NOTHING;
  END IF;

  INSERT INTO public.vehicle_assignments
   (id,tenant_id,vehicle_id,employee_id,assignment_date,assignment_time,assignment_status,
    starting_odometer,condition_on_assignment,handover_notes,assigned_by)
  VALUES('px_demo_veh_current_'||lpad(i::text,4,'0'),'company_pixel_syntax',
   'px_demo_bike_'||lpad(i::text,4,'0'),own_emp_id,current_asset_date,'09:00','ACTIVE',
   1000+i*50,'Good','FICTIONAL demo bike handover','Demo QA')
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO public.sim_assignments
   (id,tenant_id,sim_card_id,employee_id,assigned_at,status,assignment_status,
    assigned_date,assigned_by,mobile_number,provider,employee_name,employee_code)
  VALUES('px_demo_sim_current_'||lpad(i::text,4,'0'),'company_pixel_syntax',
    'px_demo_sim_'||lpad(i::text,4,'0'),own_emp_id,
    current_asset_date::timestamptz + interval '09:00','ACTIVE','ACTIVE',
    current_asset_date,'Demo QA','DEMO-SIM-'||lpad(i::text,4,'0'),'DU',
    (SELECT full_name FROM public.employees WHERE id=own_emp_id),
    (SELECT employee_code FROM public.employees WHERE id=own_emp_id))
  ON CONFLICT(id) DO NOTHING;
 END LOOP;
END $$;
COMMIT;
