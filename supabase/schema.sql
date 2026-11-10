-- =====================================================================
-- Estate Security Register - database schema, security rules (RLS) and
-- public functions.  Run this ONCE in Supabase: SQL Editor -> New query.
-- Safe to re-run: it drops and re-creates the app's tables.
-- =====================================================================

drop table if exists audit_log, change_requests, payments, properties, streets, settings, admins cascade;

-- ---------- tables ----------
create table settings (
  id int primary key default 1 check (id = 1),
  year int not null default 2026,
  landlord_rate int not null default 2000,
  tenant_rate int not null default 1000,
  establishment_rate int not null default 2000,
  show_payments_publicly boolean not null default true
);
insert into settings (id) values (1);

create table streets (
  name text primary key,
  sort_order int not null default 100
);

create table properties (
  id text primary key default gen_random_uuid()::text,
  category text not null check (category in ('LANDLORD','LANDLORD_TENANTS','TENANTS_ONLY','ESTABLISHMENT')),
  name text not null,
  house_no text not null default '—',
  street text not null default 'Unspecified / Verify',
  phone text not null default '—',
  tenant_count int not null default 0 check (tenant_count >= 0),
  establishment_type text,
  monthly_due int check (monthly_due is null or monthly_due >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one row per PAID month (an unpaid month simply has no row)
create table payments (
  property_id text not null references properties(id) on delete cascade,
  line text not null check (line in ('LANDLORD','TENANTS','ESTABLISHMENT')),
  year int not null,
  month smallint not null check (month between 1 and 12),
  amount int not null check (amount > 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (property_id, line, year, month)
);

create table change_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('NEW','UPDATE')),
  property_id text references properties(id) on delete set null,
  submitted_by text not null check (char_length(submitted_by) between 2 and 120),
  submitter_phone text not null default '' check (char_length(submitter_phone) <= 40),
  reason text not null default '' check (char_length(reason) <= 500),
  proposed jsonb not null check (octet_length(proposed::text) < 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);

-- who may log in to /admin.  role 'admin' = everything, 'collector' = may only record payments
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role in ('admin','collector'))
);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  table_name text not null,
  row_key text,
  action text not null,
  old_row jsonb,
  new_row jsonb
);

-- ---------- helper functions ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function is_full_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and role = 'admin');
$$;

create or replace function mask_phone(t text) returns text
language sql immutable as $$
  select coalesce(
    string_agg(case when length(trim(x)) >= 7 then left(trim(x),4) || '***' || right(trim(x),3) else trim(x) end, ' / '),
    '—')
  from unnest(string_to_array(coalesce(t,''), '/')) as x
  where length(trim(x)) > 0;
$$;

-- ---------- audit trail + housekeeping triggers ----------
create or replace function log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(user_id, table_name, row_key, action, old_row, new_row)
  values (
    auth.uid(), tg_table_name,
    coalesce((to_jsonb(coalesce(new, old))->>'id'),
             (to_jsonb(coalesce(new, old))->>'property_id') || '|' || (to_jsonb(coalesce(new, old))->>'line') || '|' || (to_jsonb(coalesce(new, old))->>'month')),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_properties after insert or update or delete on properties for each row execute function log_change();
create trigger audit_payments   after insert or update or delete on payments   for each row execute function log_change();
create trigger audit_requests   after update on change_requests               for each row execute function log_change();

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger touch_properties before update on properties for each row execute function touch_updated_at();
create trigger touch_payments   before update on payments   for each row execute function touch_updated_at();

-- basic spam guard: no more than 300 unreviewed public requests at a time
create or replace function limit_pending_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from change_requests where status = 'pending') >= 300 then
    raise exception 'Too many pending requests, please try again later';
  end if;
  return new;
end $$;
create trigger limit_requests before insert on change_requests for each row execute function limit_pending_requests();

-- ---------- Row Level Security: the REAL wall between residents and admins ----------
alter table settings        enable row level security;
alter table streets         enable row level security;
alter table properties      enable row level security;
alter table payments        enable row level security;
alter table change_requests enable row level security;
alter table admins          enable row level security;
alter table audit_log       enable row level security;

-- residents (anon) can read street names only
create policy streets_read   on streets for select to anon, authenticated using (true);
create policy streets_write  on streets for all    to authenticated using (is_full_admin()) with check (is_full_admin());

create policy settings_read  on settings for select to authenticated using (is_admin());
create policy settings_write on settings for update to authenticated using (is_full_admin()) with check (is_full_admin());

create policy properties_read  on properties for select to authenticated using (is_admin());
create policy properties_write on properties for all    to authenticated using (is_full_admin()) with check (is_full_admin());

create policy payments_all on payments for all to authenticated using (is_admin()) with check (is_admin());

-- residents may ONLY insert a pending request - they cannot read, change or delete anything
create policy requests_insert on change_requests for insert to anon, authenticated
  with check (status = 'pending' and resolved_by is null and resolved_at is null);
create policy requests_read   on change_requests for select to authenticated using (is_full_admin());
create policy requests_update on change_requests for update to authenticated using (is_full_admin()) with check (is_full_admin());

create policy admins_self on admins for select to authenticated using (user_id = auth.uid());
create policy audit_read  on audit_log for select to authenticated using (is_full_admin());

-- ---------- what residents can see (masked phones, no notes, no money unless allowed) ----------
create or replace function public_register()
returns table (
  id text, category text, name text, house_no text, street text, phone_masked text, phone_ok boolean,
  tenant_count int, establishment_type text, paid_months int[]
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.category, p.name, p.house_no, p.street,
    mask_phone(p.phone),
    p.phone ~ '^0[0-9]{10}(\s*/\s*0[0-9]{10})*$',
    p.tenant_count, p.establishment_type,
    case when s.show_payments_publicly then coalesce((
      select array_agg(x.month::int order by x.month)
      from (
        select pay.month
        from payments pay
        where pay.property_id = p.id and pay.year = s.year
        group by pay.month
        having count(*) >= (case when p.category = 'LANDLORD_TENANTS' then 2 else 1 end)
      ) x
    ), '{}') else '{}'::int[] end
  from properties p cross join settings s
  order by p.street, p.house_no;
$$;

create or replace function public_settings()
returns table (year int, landlord_rate int, tenant_rate int, establishment_rate int, show_payments_publicly boolean)
language sql stable security definer set search_path = public as $$
  select year, landlord_rate, tenant_rate, establishment_rate, show_payments_publicly from settings where id = 1;
$$;

revoke all on function public_register(), public_settings() from public;
grant execute on function public_register(), public_settings() to anon, authenticated;

-- ---------- default streets (re-ordered / extended later from the admin Settings tab) ----------
insert into streets (name, sort_order) values
  ('Idi Tunga Close', 1), ('Idi Tunga Street', 2), ('Dominic Close', 3), ('Joel Bala Close', 4),
  ('Nuhu Dogo', 5), ('Makama', 6), ('Atteh Oyibo Close', 7), ('Dan''awo Close', 8);
