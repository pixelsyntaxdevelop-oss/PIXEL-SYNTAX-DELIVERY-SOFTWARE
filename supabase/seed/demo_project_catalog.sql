
-- Fictional project catalog. Names reflect platform categories, NOT partner contracts.
INSERT INTO public.projects
(id,tenant_id,name,code,client_name,branch_id,status,external_id_label,rate_per_order)
VALUES
('demo_prj_talabat','company_pixel_syntax','Talabat Food','TALABAT','Talabat (Demo)','demo_dxb','ACTIVE','Rider ID',9),
('demo_prj_keeta','company_pixel_syntax','Keeta','KEETA','Keeta (Demo)','demo_dxb','ACTIVE','Courier ID',10),
('demo_prj_noon_minutes','company_pixel_syntax','Noon Minutes','NOON_MIN','Noon Minutes (Demo)','demo_dxb','ACTIVE','NIM ID',0),
('demo_prj_deliveroo','company_pixel_syntax','Deliveroo','DELIVEROO','Deliveroo (Demo)','demo_dxb','ACTIVE','Rider ID',11),
('demo_prj_careem','company_pixel_syntax','Careem Food','CAREEM','Careem Food (Demo)','demo_dxb','ACTIVE','Captain ID',10),
('demo_prj_noon_food','company_pixel_syntax','Noon Food','NOON_FOOD','Noon Food (Demo)','demo_dxb','ACTIVE','Courier ID',9),
('demo_prj_smiles','company_pixel_syntax','Smiles Food','SMILES','Smiles (Demo)','demo_dxb','ACTIVE','Rider ID',9),
('demo_prj_instashop','company_pixel_syntax','InstaShop','INSTASHOP','InstaShop (Demo)','demo_dxb','ACTIVE','Shopper ID',9),
('demo_prj_talabat_mart','company_pixel_syntax','Talabat Mart','TALABAT_MART','Talabat Mart (Demo)','demo_dxb','ACTIVE','Rider ID',9),
('demo_prj_local_delivery','company_pixel_syntax','Other Local Delivery / Custom Client','CUSTOM_LASTMILE','Custom Last-mile (Demo)','demo_dxb','ACTIVE','External ID',0)
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.project_salary_settings
(id,tenant_id,project_id,pay_model,rate_aed,effective_from,is_demo,rate_source)
VALUES
('demo_rate_talabat','company_pixel_syntax','demo_prj_talabat','PER_ORDER',9,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_keeta','company_pixel_syntax','demo_prj_keeta','PER_ORDER',10,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_noon_minutes','company_pixel_syntax','demo_prj_noon_minutes','FIXED_MONTHLY',3000,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_deliveroo','company_pixel_syntax','demo_prj_deliveroo','PER_ORDER',11,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_careem','company_pixel_syntax','demo_prj_careem','PER_ORDER',10,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_noon_food','company_pixel_syntax','demo_prj_noon_food','PER_ORDER',9,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_smiles','company_pixel_syntax','demo_prj_smiles','PER_ORDER',9,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_instashop','company_pixel_syntax','demo_prj_instashop','PER_ORDER',9,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_talabat_mart','company_pixel_syntax','demo_prj_talabat_mart','PER_ORDER',9,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL'),
('demo_rate_custom','company_pixel_syntax','demo_prj_local_delivery','DAILY_RATE',120,'2026-01-01',true,'SAMPLE_DEMO_NOT_OFFICIAL')
ON CONFLICT(id) DO NOTHING;
