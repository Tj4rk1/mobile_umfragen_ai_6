create table if not exists public.app_settings_drafts (
  id text primary key default 'public',
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint app_settings_drafts_singleton check (id = 'public')
);

alter table public.app_settings_drafts enable row level security;

insert into public.app_settings_drafts (id, settings)
select id, settings
from public.app_settings
on conflict (id) do nothing;

drop policy if exists "Authenticated read app settings drafts" on public.app_settings_drafts;
create policy "Authenticated read app settings drafts"
on public.app_settings_drafts for select
to authenticated
using (id = 'public');

drop policy if exists "Authenticated manage app settings drafts" on public.app_settings_drafts;
create policy "Authenticated manage app settings drafts"
on public.app_settings_drafts for all
to authenticated
using (id = 'public')
with check (id = 'public');

drop policy if exists "Admins manage app settings" on public.app_settings;
create policy "Authenticated manage app settings"
on public.app_settings for all
to authenticated
using (id = 'public')
with check (id = 'public');

drop policy if exists "Admins manage published treatments" on public.treatments;
create policy "Authenticated manage published treatments"
on public.treatments for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins manage treatment drafts" on public.treatment_drafts;
create policy "Authenticated manage treatment drafts"
on public.treatment_drafts for all
to authenticated
using (true)
with check (true);

drop policy if exists "Admins read participants" on public.participants;
create policy "Authenticated read participants"
on public.participants for select
to authenticated
using (true);

drop policy if exists "Admins read responses" on public.responses;
create policy "Authenticated read responses"
on public.responses for select
to authenticated
using (true);

drop policy if exists "Admins manage conditions" on public.conditions;
create policy "Authenticated manage conditions"
on public.conditions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active conditions" on public.conditions;
create policy "Public can read active conditions"
on public.conditions for select
using (is_active = true or auth.uid() is not null);

drop policy if exists "Admins upload treatment assets" on storage.objects;
create policy "Authenticated upload treatment assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'treatment-assets');

drop policy if exists "Admins update treatment assets" on storage.objects;
create policy "Authenticated update treatment assets"
on storage.objects for update
to authenticated
using (bucket_id = 'treatment-assets')
with check (bucket_id = 'treatment-assets');

drop policy if exists "Admins delete treatment assets" on storage.objects;
create policy "Authenticated delete treatment assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'treatment-assets');

create or replace function public.save_app_settings_draft(p_settings jsonb)
returns public.app_settings_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.app_settings_drafts;
begin
  if auth.uid() is null then
    raise exception 'Only authenticated users can save app settings drafts.';
  end if;

  insert into public.app_settings_drafts (id, settings, updated_by, updated_at)
  values ('public', coalesce(p_settings, '{}'::jsonb), auth.uid(), now())
  on conflict (id) do update set
    settings = excluded.settings,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning *
  into saved;

  return saved;
end;
$$;

create or replace function public.publish_app_settings_draft()
returns public.app_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.app_settings_drafts;
  published public.app_settings;
begin
  if auth.uid() is null then
    raise exception 'Only authenticated users can publish app settings drafts.';
  end if;

  select *
  into draft
  from public.app_settings_drafts
  where id = 'public';

  if not found then
    raise exception 'No app settings draft found.';
  end if;

  insert into public.app_settings (id, settings, updated_at)
  values ('public', draft.settings, now())
  on conflict (id) do update set
    settings = excluded.settings,
    updated_at = excluded.updated_at
  returning *
  into published;

  return published;
end;
$$;

grant execute on function public.save_app_settings_draft(jsonb) to authenticated;
grant execute on function public.publish_app_settings_draft() to authenticated;
