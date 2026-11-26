create or replace function public.pixel_sync_sim_assignment_state() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$ begin new.assignment_status:=new.status;return new;end $$;
drop trigger if exists trg_pixel_sync_sim_assignment_state on public.sim_assignments;
create trigger trg_pixel_sync_sim_assignment_state before insert or update of status on public.sim_assignments for each row execute function public.pixel_sync_sim_assignment_state();
update public.sim_assignments set assignment_status=status where tenant_id='company_pixel_syntax' and assignment_status is distinct from status;
revoke all on function public.pixel_sync_sim_assignment_state() from public,anon,authenticated;