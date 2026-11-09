-- Pixel Syntax delivery DEMO ONLY: align fields used by the verified atomic SIM handover RPCs.
ALTER TABLE public.sim_assignments ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(50);
ALTER TABLE public.sim_assignments ADD COLUMN IF NOT EXISTS provider VARCHAR(60);
ALTER TABLE public.sim_assignments ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);
ALTER TABLE public.sim_assignments ADD COLUMN IF NOT EXISTS employee_code VARCHAR(70);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS current_employee_name VARCHAR(255);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS current_employee_code VARCHAR(70);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS assigned_date DATE;
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(180);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS monthly_package_amount NUMERIC(12,2);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS updated_by VARCHAR(180);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_employee_id VARCHAR(64);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_employee_code VARCHAR(70);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_assignment_id VARCHAR(64);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_assigned_date DATE;
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_assigned_by VARCHAR(180);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_returned_date DATE;
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_returned_by VARCHAR(180);
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS last_return_reason TEXT;
ALTER TABLE public.sim_cards ADD COLUMN IF NOT EXISTS unassigned_date DATE;
CREATE OR REPLACE FUNCTION public.demo_normalize_sim_assignment_status()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.current_employee_id IS NOT NULL THEN NEW.assignment_status:='Assigned';
 ELSIF upper(coalesce(NEW.status,''))='LOST' THEN NEW.assignment_status:='Lost';
 ELSE NEW.assignment_status:='Unassigned';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.demo_normalize_sim_assignment_status() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_demo_sim_assignment_state ON public.sim_cards;
CREATE TRIGGER trg_demo_sim_assignment_state
 BEFORE INSERT OR UPDATE OF status,current_employee_id ON public.sim_cards
 FOR EACH ROW EXECUTE FUNCTION public.demo_normalize_sim_assignment_status();
UPDATE public.sim_cards
SET current_employee_name=(SELECT e.full_name FROM public.employees e WHERE e.id=sim_cards.current_employee_id AND e.tenant_id=sim_cards.tenant_id),
    current_employee_code=(SELECT e.employee_code FROM public.employees e WHERE e.id=sim_cards.current_employee_id AND e.tenant_id=sim_cards.tenant_id),
    assigned_date=COALESCE(assigned_date,(SELECT s.assigned_date FROM public.sim_assignments s
      WHERE s.tenant_id=sim_cards.tenant_id AND s.sim_card_id=sim_cards.id AND s.status='ACTIVE'
      ORDER BY s.assigned_at DESC LIMIT 1)),
    assigned_by=COALESCE(assigned_by,(SELECT s.assigned_by FROM public.sim_assignments s
      WHERE s.tenant_id=sim_cards.tenant_id AND s.sim_card_id=sim_cards.id AND s.status='ACTIVE'
      ORDER BY s.assigned_at DESC LIMIT 1)),
    monthly_package_amount=COALESCE(monthly_package_amount,monthly_cost,0)
WHERE tenant_id='company_pixel_syntax';
UPDATE public.sim_assignments sa
SET mobile_number=sc.mobile_number,provider=sc.provider,employee_name=e.full_name,employee_code=e.employee_code
FROM public.sim_cards sc,public.employees e
WHERE sa.sim_card_id=sc.id AND sa.employee_id=e.id
 AND sa.tenant_id=sc.tenant_id AND sa.tenant_id=e.tenant_id
 AND sa.tenant_id='company_pixel_syntax';