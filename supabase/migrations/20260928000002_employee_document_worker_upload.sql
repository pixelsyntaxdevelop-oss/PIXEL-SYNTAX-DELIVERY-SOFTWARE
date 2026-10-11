-- Atomic, tenant-scoped employee document metadata registration after R2 upload.
create or replace function public.allied_save_employee_document(
  p_tenant_id text,
  p_employee_id text,
  p_document_type_id text,
  p_existing_document_id text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_storage_path text,
  p_checksum text,
  p_actor text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_employee record;
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
    raise exception 'Invalid document upload metadata';
  end if;
  select id, full_name, employee_code into v_employee
  from public.employees where id = p_employee_id and tenant_id = p_tenant_id and is_archived = false;
  if not found then raise exception 'Employee not found in tenant'; end if;
  select id, name into v_type from public.document_types
  where id = p_document_type_id and tenant_id = p_tenant_id and is_active = true
    and (category in ('EMPLOYEE','OTHER') or id = 'dt_mulkiya');
  if not found then raise exception 'Document type unavailable in tenant'; end if;

  if nullif(p_existing_document_id, '') is not null then
    select * into v_doc from public.entity_documents
    where id = p_existing_document_id and tenant_id = p_tenant_id
      and entity_type = 'Employee' and entity_id = p_employee_id
      and document_type_id = p_document_type_id and is_archived = false
    for update;
    if not found then raise exception 'Existing document not found for employee'; end if;
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
      (v_document_id,p_tenant_id,'Employee',p_employee_id,coalesce(nullif(v_employee.full_name,''),v_employee.employee_code),
       p_document_type_id,v_type.name,v_doc_number,'NO_EXPIRY',1,p_actor,v_now,p_actor,v_now,false);
  end if;

  insert into public.document_versions
    (id,tenant_id,document_id,version_number,document_number,file_id,file_name,file_size,
     mime_type,storage_path,replacement_reason,is_current,uploaded_by,uploaded_at)
  values
    (v_version_id,p_tenant_id,v_document_id,v_number,v_doc_number,v_file_id,p_file_name,
     p_file_size::text,p_mime_type,p_storage_path,
     case when v_number = 1 then 'Initial upload' else 'New scan uploaded from employee document boxes' end,
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
end $$;
revoke all on function public.allied_save_employee_document(text,text,text,text,text,text,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.allied_save_employee_document(text,text,text,text,text,text,bigint,text,text,text) to service_role;
