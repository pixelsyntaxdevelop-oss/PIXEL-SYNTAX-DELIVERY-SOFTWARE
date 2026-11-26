create or replace function public.pixel_renew_document(p_tenant_id text,p_entity_type text,p_entity_id text,p_document_type_id text,p_existing_document_id text,p_file_name text,p_mime_type text,p_file_size bigint,p_storage_path text,p_checksum text,p_actor text,p_metadata jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $fn$
declare result jsonb; d public.entity_documents%rowtype; v_number text; v_issue date; v_expiry date; v_reason text;
begin
 if nullif(p_existing_document_id,'') is null then raise exception 'Existing document required'; end if;
 select * into d from public.entity_documents where id=p_existing_document_id and tenant_id=p_tenant_id and entity_type=p_entity_type and entity_id=p_entity_id and document_type_id=p_document_type_id and not is_archived for update;
 if not found then raise exception 'Document not found'; end if;
 v_number:=case when p_metadata ? 'document_number' then nullif(trim(p_metadata->>'document_number'),'') else d.document_number end;
 v_issue:=case when p_metadata ? 'issue_date' then nullif(p_metadata->>'issue_date','')::date else d.issue_date end;
 v_expiry:=case when p_metadata ? 'expiry_date' then nullif(p_metadata->>'expiry_date','')::date else d.expiry_date end;
 v_reason:=nullif(trim(p_metadata->>'replacement_reason'),'');
 if v_number is null or v_reason is null or (v_issue is not null and v_expiry is not null and v_issue>v_expiry) then raise exception 'Invalid renewal details'; end if;
 case p_entity_type
 when 'Company' then result:=public.pixel_save_company_document(p_tenant_id,p_entity_id,p_document_type_id,p_existing_document_id,p_file_name,p_mime_type,p_file_size,p_storage_path,p_checksum,p_actor);
 when 'Employee' then result:=public.allied_save_employee_document(p_tenant_id,p_entity_id,p_document_type_id,p_existing_document_id,p_file_name,p_mime_type,p_file_size,p_storage_path,p_checksum,p_actor);
 when 'Vehicle' then result:=public.allied_save_vehicle_document(p_tenant_id,p_entity_id,p_document_type_id,p_existing_document_id,p_file_name,p_mime_type,p_file_size,p_storage_path,p_checksum,p_actor);
 else raise exception 'Unsupported document category'; end case;
 update public.entity_documents set document_number=v_number,issue_date=v_issue,expiry_date=v_expiry,status=case when v_expiry is null then 'NO_EXPIRY' when v_expiry < (now() at time zone 'Asia/Dubai')::date then 'EXPIRED' else 'VALID' end where id=d.id and tenant_id=p_tenant_id returning * into d;
 update public.document_versions set document_number=v_number,replacement_reason=v_reason where id=result->>'current_version_id' and tenant_id=p_tenant_id and document_id=d.id;
 return result||to_jsonb(d);
end $fn$;
revoke all on function public.pixel_renew_document(text,text,text,text,text,text,text,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.pixel_renew_document(text,text,text,text,text,text,text,bigint,text,text,text,jsonb) to service_role;