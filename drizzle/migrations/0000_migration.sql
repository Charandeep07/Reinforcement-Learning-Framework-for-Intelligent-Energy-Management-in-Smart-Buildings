
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  tariff text not null default 'tou',
  flat_price numeric not null default 8,
  comfort_min numeric not null default 22,
  comfort_max numeric not null default 26,
  notify_alerts boolean not null default true,
  units text not null default 'metric',
  timezone text not null default 'Asia/Kolkata',
  sim_seed integer not null default 42,
  demo_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_upd before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  location text not null default '',
  area_m2 numeric not null default 1000,
  floors integer not null default 1,
  building_type text not null default 'office',
  open_hour integer not null default 8,
  close_hour integer not null default 18,
  energy_target_kwh numeric not null default 400,
  comfort_min numeric not null default 22,
  comfort_max numeric not null default 26,
  weather_profile text not null default 'hot',
  battery_kwh numeric not null default 50,
  battery_kw numeric not null default 15,
  solar_kw numeric not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.buildings(user_id);
create trigger buildings_upd before update on public.buildings for each row execute function public.set_updated_at();

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  kind text not null,
  name text not null,
  rated_kw numeric not null default 10,
  is_on boolean not null default true,
  setpoint numeric,
  level numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.equipment(building_id);
create trigger equipment_upd before update on public.equipment for each row execute function public.set_updated_at();

create table public.energy_readings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  ts timestamptz not null,
  source text not null default 'live',
  total_kw numeric not null,
  hvac_kw numeric not null,
  lighting_kw numeric not null,
  appliance_kw numeric not null,
  solar_kw numeric not null default 0,
  battery_kw numeric not null default 0,
  grid_kw numeric not null,
  price numeric not null,
  cost numeric not null,
  soc numeric not null,
  created_at timestamptz not null default now()
);
create index on public.energy_readings(building_id, ts desc);

create table public.environmental_readings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  ts timestamptz not null,
  indoor_c numeric not null,
  outdoor_c numeric not null,
  occupancy numeric not null,
  setpoint numeric not null,
  created_at timestamptz not null default now()
);
create index on public.environmental_readings(building_id, ts desc);

create table public.energy_prices (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  tariff text not null,
  hour integer not null,
  price numeric not null,
  created_at timestamptz not null default now()
);
create index on public.energy_prices(user_id);

create table public.rl_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  building_id uuid references public.buildings(id) on delete set null,
  name text not null,
  algorithm text not null,
  config jsonb not null default '{}',
  metrics jsonb not null default '{}',
  curve jsonb not null default '[]',
  status text not null default 'completed',
  train_seconds numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.rl_experiments(user_id);
create trigger rl_exp_upd before update on public.rl_experiments for each row execute function public.set_updated_at();

create table public.model_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  experiment_id uuid references public.rl_experiments(id) on delete cascade,
  name text not null,
  algorithm text not null,
  weights jsonb not null,
  config jsonb not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.model_artifacts(user_id);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  source text not null,
  current_state jsonb not null,
  recommended jsonb not null,
  predicted jsonb not null default '{}',
  applied boolean not null default false,
  applied_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);
create index on public.recommendations(building_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  equipment text,
  rule text not null,
  severity text not null,
  message text not null,
  ts timestamptz not null default now(),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.alerts(user_id, ts desc);
create trigger alerts_upd before update on public.alerts for each row execute function public.set_updated_at();

create table public.whatif_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  building_id uuid references public.buildings(id) on delete cascade,
  name text not null,
  params jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.whatif_scenarios(user_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs(user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['buildings','equipment','energy_readings','environmental_readings','energy_prices','rl_experiments','model_artifacts','recommendations','alerts','whatif_scenarios','audit_logs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

alter publication supabase_realtime add table public.energy_readings;
alter publication supabase_realtime add table public.alerts;
