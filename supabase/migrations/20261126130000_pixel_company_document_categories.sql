CREATE OR REPLACE FUNCTION public.pixel_save_company_document(p_tenant_id text, p_company_id text, p_document_type_id text, p_existing_document_id text, p_file_name text, p_mime_type text, p_file_size bigint, p_storage_path text, p_checksum text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company record;
  v_type record;
  v_doc public.entity_documents%rowtype;
  v_document_id text;
  v_version_id text := 'ver_' || replace(gen_random_uuid()::text, '-', '');
  v_file_id text := 'file_' || replace(gen_random_uuid()::text, '-', '');
  v_number integer;
  v_doc_number text;
  v_now timestamptz := now();
begin
  if nullif(trim(p_actor), '') is null or nullif(trim(p_storage_path), '') is null
     or p_file_size <= 0 or p_file_size > 10485760
     or p_mime_type not in ('application/pdf','image/jpeg','image/png') then
    raise exception 'Invalid company document metadata';
  end if;
  select id, name into v_company from public.tenants
  where id = p_company_id and id = p_tenant_id;
  if not found then raise exception 'Company not found in tenant'; end if;
  select id, name into v_type from public.document_types
  where id = p_document_type_id and tenant_id = p_tenant_id and is_active = true
    and category = 'COMPANY';
  if not found then raise exception 'Company document type unavailable in tenant'; end if;

  if nullif(p_existing_document_id, '') is not null then
    select * into v_doc from public.entity_documents
    where id = p_existing_document_id and tenant_id = p_tenant_id
      and entity_type = 'Company' and entity_id = p_company_id
      and document_type_id = p_document_type_id and is_archived = false
    for update;
    if not found then raise exception 'Existing document not found for company'; end if;
    v_document_id := v_doc.id;
    v_number := v_doc.current_version_number + 1;
    v_doc_number := v_doc.document_number;
    update public.document_versions set is_current = false
    where tenant_id = p_tenant_id and document_id = v_document_id and is_current = true;
    update public.entity_documents set current_version_number = v_number,
      updated_by = p_actor, updated_at = v_now where id = v_document_id;
  else
    v_document_id := 'doc_' || replace(gen_random_uuid()::text, '-', '');
    v_number := 1;
    v_doc_number := 'DOC-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.entity_documents
      (id,tenant_id,entity_type,entity_id,entity_name,document_type_id,document_type_name,
       document_number,status,current_version_number,created_by,created_at,updated_by,updated_at,is_archived)
    values
      (v_document_id,p_tenant_id,'Company',p_company_id,
       v_company.name,
       p_document_type_id,v_type.name,v_doc_number,'NO_EXPIRY',1,p_actor,v_now,p_actor,v_now,false);
  end if;

  insert into public.document_versions
    (id,tenant_id,document_id,version_number,document_number,file_id,file_name,file_size,
     mime_type,storage_path,replacement_reason,is_current,uploaded_by,uploaded_at)
  values
    (v_version_id,p_tenant_id,v_document_id,v_number,v_doc_number,v_file_id,p_file_name,
     p_file_size::text,p_mime_type,p_storage_path,
     case when v_number = 1 then 'Initial upload' else 'New scan uploaded from company document boxes' end,
     true,p_actor,v_now);
  insert into public.document_files
    (id,tenant_id,document_id,version_id,file_name,original_file_name,mime_type,file_size,
     storage_path,storage_provider,checksum,uploaded_by,uploaded_at)
  values
    (v_file_id,p_tenant_id,v_document_id,v_version_id,p_file_name,p_file_name,p_mime_type,
     p_file_size,p_storage_path,'CLOUDFLARE_R2',p_checksum,p_actor,v_now);
  return (select to_jsonb(d) || jsonb_build_object('current_file_name',p_file_name,
    'current_file_id',v_file_id,'current_version_id',v_version_id,'current_mime_type',p_mime_type)
    from public.entity_documents d where d.id = v_document_id);
end $function$;
REVOKE ALL ON FUNCTION public.pixel_save_company_document(text,text,text,text,text,text,bigint,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pixel_save_company_document(text,text,text,text,text,text,bigint,text,text,text) TO service_role;
INSERT INTO public.document_types(id,tenant_id,code,name,entity_type,category,is_mandatory,is_active) VALUES
('dt_company_agreement','company_pixel_syntax','AGREEMENT','Client / Service Agreement','COMPANY','COMPANY',false,true),
('dt_company_corporate_tax','company_pixel_syntax','CT_CERT','Corporate Tax Registration Certificate','COMPANY','COMPANY',false,true),
('dt_company_establishment','company_pixel_syntax','EST_CARD','Establishment Card','COMPANY','COMPANY',false,true),
('dt_company_insurance','company_pixel_syntax','COMPANY_INS','Company Insurance','COMPANY','COMPANY',false,true),
('dt_company_lease','company_pixel_syntax','LEASE','Office Lease / Tenancy Contract','COMPANY','COMPANY',false,true),
('dt_company_moa','company_pixel_syntax','MOA','Memorandum of Association','COMPANY','COMPANY',false,true),
('dt_company_other','company_pixel_syntax','COMPANY_OTHER','Other Company Document','COMPANY','COMPANY',false,true),
('dt_company_trade_license','company_pixel_syntax','TRADE_LICENSE','Trade License','COMPANY','COMPANY',false,true),
('dt_company_vat','company_pixel_syntax','VAT_CERT','VAT Registration Certificate','COMPANY','COMPANY',false,true),
('dt_company_workmen','company_pixel_syntax','WORKMEN_COMP','Workmen Compensation Insurance','COMPANY','COMPANY',false,true),
('dt_employee_contract','company_pixel_syntax','EMP_CONTRACT','Employment Contract','EMPLOYEE','EMPLOYEE',false,true),
('dt_employee_insurance','company_pixel_syntax','EMP_INSURANCE','Health Insurance','EMPLOYEE','EMPLOYEE',false,true),
('dt_labor','company_pixel_syntax','LABOUR_CARD','Labour Card / Work Permit','EMPLOYEE','EMPLOYEE',false,true),
('dt_vehicle_inspection','company_pixel_syntax','VEHICLE_INSPECT','Vehicle Inspection Certificate','VEHICLE','VEHICLE',false,true),
('dt_vehicle_insurance','company_pixel_syntax','VEHICLE_INS','Vehicle Insurance','VEHICLE','VEHICLE',false,true),
('dt_vehicle_lease','company_pixel_syntax','VEHICLE_LEASE','Vehicle Lease Agreement','VEHICLE','VEHICLE',false,true),
('dt_vehicle_other','company_pixel_syntax','VEHICLE_OTHER','Other Vehicle Document','VEHICLE','VEHICLE',false,true)
ON CONFLICT(id) DO NOTHING;
