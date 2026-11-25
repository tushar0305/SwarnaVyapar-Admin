-- Saved map+keyword presets + WhatsApp script persistence for discovery CRM.
-- Applied remotely via Supabase migration admin_discovery_saved_searches_and_whatsapp_script.

create table if not exists public.admin_discovery_saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lon double precision not null,
  radius_km numeric not null check (radius_km >= 3 and radius_km <= 100),
  label text not null,
  city_label text not null,
  display_name text,
  zoom integer,
  keywords text not null default 'jewellery shops',
  max_pages integer not null default 2 check (max_pages >= 1 and max_pages <= 3),
  contact_filter text not null default 'all' check (contact_filter in ('all', 'phone', 'website')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists admin_discovery_saved_searches_updated_idx
  on public.admin_discovery_saved_searches (updated_at desc);

alter table public.admin_discovery_saved_searches enable row level security;

alter table public.admin_discovered_leads
  add column if not exists whatsapp_script text;
