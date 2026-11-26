create table if not exists public.pixel_visa_expenses (
id text primary key default gen_random_uuid()::text, tenant_id varchar(64) not null references public.tenants(id),
employee_id varchar(64) not null references public.employees(id), period_month varchar(7) not null check(period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
amount_aed numeric(12,2) not null check(amount_aed>0 and amount_aed<=100000), reference text not null check(length(trim(reference)) between 3 and 120), notes text,
created_by text not null, created_at timestamptz not null default now(), unique(tenant_id,reference)
);
alter table public.pixel_visa_expenses enable row level security;
revoke all on public.pixel_visa_expenses from public,anon,authenticated;
grant select,insert on public.pixel_visa_expenses to service_role;
create index if not exists idx_pixel_visa_expenses_period on public.pixel_visa_expenses(tenant_id,period_month,employee_id);
