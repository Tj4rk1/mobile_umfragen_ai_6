-- Supabase schema for the final AI brand communication survey.
-- Run this in the Supabase SQL editor, then create the storage bucket
-- "treatment-assets" if it was not created automatically.

create extension if not exists pgcrypto;

create table if not exists public.conditions (
  id text primary key,
  label text not null,
  experiment_type text not null check (experiment_type in ('media', 'brand')),
  treatment_type text not null check (treatment_type in ('text', 'image', 'brand')),
  brand_type text check (brand_type in ('fmcg', 'premium', 'luxury')),
  ai_disclosure boolean not null default false,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  condition_id text not null references public.conditions(id) on delete cascade,
  brand_name text not null,
  brand_type_label text not null,
  headline text not null,
  body text not null,
  ai_notice text not null default 'Der gezeigte Inhalt wurde mithilfe generativer KI erstellt.',
  image_path text,
  image_url text,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (condition_id)
);

create table if not exists public.treatment_drafts (
  id uuid primary key default gen_random_uuid(),
  condition_id text not null references public.conditions(id) on delete cascade,
  brand_name text not null,
  brand_type_label text not null,
  headline text not null,
  body text not null,
  ai_notice text not null default 'Der gezeigte Inhalt wurde mithilfe generativer KI erstellt.',
  image_path text,
  image_url text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (condition_id)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null unique,
  condition_id text not null references public.conditions(id),
  status text not null default 'started' check (status in ('started', 'completed')),
  user_agent text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  condition_id text not null references public.conditions(id),
  question_key text not null,
  construct text not null,
  item_text text not null,
  value text not null,
  numeric_value numeric,
  created_at timestamptz not null default now(),
  unique (participant_id, question_key)
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'public',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 'public')
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.get_condition_counts()
returns table(condition_id text, participant_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, count(p.id)::bigint
  from public.conditions c
  left join public.participants p
    on p.condition_id = c.id
  where c.is_active = true
  group by c.id, c.sort_order
  order by c.sort_order;
$$;

create or replace function public.assign_participant(
  p_anonymous_id text,
  p_user_agent text default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_participant public.participants;
  chosen_condition text;
  created_participant public.participants;
begin
  select *
  into existing_participant
  from public.participants
  where anonymous_id = p_anonymous_id;

  if found then
    return existing_participant;
  end if;

  perform pg_advisory_xact_lock(424242);

  select condition_id
  into chosen_condition
  from (
    select c.id as condition_id, count(p.id) as participant_count
    from public.conditions c
    left join public.participants p
      on p.condition_id = c.id
    where c.is_active = true
    group by c.id
  ) counts
  order by participant_count asc, random()
  limit 1;

  if chosen_condition is null then
    raise exception 'No active survey conditions configured.';
  end if;

  insert into public.participants (anonymous_id, condition_id, user_agent)
  values (p_anonymous_id, chosen_condition, p_user_agent)
  returning *
  into created_participant;

  return created_participant;
end;
$$;

create or replace function public.publish_treatment_draft(p_condition_id text)
returns public.treatments
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.treatment_drafts;
  published public.treatments;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish treatment drafts.';
  end if;

  select *
  into draft
  from public.treatment_drafts
  where condition_id = p_condition_id;

  if not found then
    raise exception 'No draft found for condition %', p_condition_id;
  end if;

  insert into public.treatments (
    condition_id,
    brand_name,
    brand_type_label,
    headline,
    body,
    ai_notice,
    image_path,
    image_url,
    published_at,
    updated_at
  )
  values (
    draft.condition_id,
    draft.brand_name,
    draft.brand_type_label,
    draft.headline,
    draft.body,
    draft.ai_notice,
    draft.image_path,
    draft.image_url,
    now(),
    now()
  )
  on conflict (condition_id) do update set
    brand_name = excluded.brand_name,
    brand_type_label = excluded.brand_type_label,
    headline = excluded.headline,
    body = excluded.body,
    ai_notice = excluded.ai_notice,
    image_path = excluded.image_path,
    image_url = excluded.image_url,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at
  returning *
  into published;

  return published;
end;
$$;

alter table public.conditions enable row level security;
alter table public.treatments enable row level security;
alter table public.treatment_drafts enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;
alter table public.admins enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Public can read active conditions" on public.conditions;
create policy "Public can read active conditions"
on public.conditions for select
using (is_active = true or public.is_admin());

drop policy if exists "Admins manage conditions" on public.conditions;
create policy "Admins manage conditions"
on public.conditions for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published treatments" on public.treatments;
create policy "Public can read published treatments"
on public.treatments for select
using (true);

drop policy if exists "Admins manage published treatments" on public.treatments;
create policy "Admins manage published treatments"
on public.treatments for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read app settings" on public.app_settings;
create policy "Public can read app settings"
on public.app_settings for select
using (id = 'public');

drop policy if exists "Admins manage app settings" on public.app_settings;
create policy "Admins manage app settings"
on public.app_settings for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage treatment drafts" on public.treatment_drafts;
create policy "Admins manage treatment drafts"
on public.treatment_drafts for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can create participants" on public.participants;
create policy "Public can create participants"
on public.participants for insert
with check (true);

drop policy if exists "Public can read own participants by anonymous id through RPC only" on public.participants;
create policy "Public can read own participants by anonymous id through RPC only"
on public.participants for select
using (public.is_admin());

drop policy if exists "Public can mark participant completed" on public.participants;
create policy "Public can mark participant completed"
on public.participants for update
using (true)
with check (true);

drop policy if exists "Admins read participants" on public.participants;
create policy "Admins read participants"
on public.participants for select
using (public.is_admin());

drop policy if exists "Public can submit responses" on public.responses;
create policy "Public can submit responses"
on public.responses for insert
with check (true);

drop policy if exists "Public can update submitted responses" on public.responses;
create policy "Public can update submitted responses"
on public.responses for update
using (true)
with check (true);

drop policy if exists "Admins read responses" on public.responses;
create policy "Admins read responses"
on public.responses for select
using (public.is_admin());

drop policy if exists "Admins manage admins" on public.admins;
create policy "Admins manage admins"
on public.admins for all
using (public.is_admin())
with check (public.is_admin());

insert into public.conditions (id, label, experiment_type, treatment_type, brand_type, ai_disclosure, sort_order)
values
  ('media_image_no_ai', 'Medienart · Bild · Variante A', 'media', 'image', null, false, 1),
  ('media_image_ai', 'Medienart · Bild · Variante B', 'media', 'image', null, true, 2),
  ('media_text_no_ai', 'Medienart · Text · Variante A', 'media', 'text', null, false, 3),
  ('media_text_ai', 'Medienart · Text · Variante B', 'media', 'text', null, true, 4),
  ('brand_fmcg_no_ai', 'Markenart · FMCG · Variante A', 'brand', 'brand', 'fmcg', false, 5),
  ('brand_fmcg_ai', 'Markenart · FMCG · Variante B', 'brand', 'brand', 'fmcg', true, 6),
  ('brand_premium_no_ai', 'Markenart · Premium · Variante A', 'brand', 'brand', 'premium', false, 7),
  ('brand_premium_ai', 'Markenart · Premium · Variante B', 'brand', 'brand', 'premium', true, 8),
  ('brand_luxury_no_ai', 'Markenart · Luxus · Variante A', 'brand', 'brand', 'luxury', false, 9),
  ('brand_luxury_ai', 'Markenart · Luxus · Variante B', 'brand', 'brand', 'luxury', true, 10)
on conflict (id) do update set
  label = excluded.label,
  experiment_type = excluded.experiment_type,
  treatment_type = excluded.treatment_type,
  brand_type = excluded.brand_type,
  ai_disclosure = excluded.ai_disclosure,
  sort_order = excluded.sort_order;

insert into public.treatments (condition_id, brand_name, brand_type_label, headline, body, image_path, image_url)
values
  ('media_image_no_ai', 'Aurelis', 'Premiummarke', 'Mehr Ruhe fuer deine Haut.', 'Bildmotiv der Markenkommunikation.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('media_image_ai', 'Aurelis', 'Premiummarke', 'Mehr Ruhe fuer deine Haut.', 'Bildmotiv der Markenkommunikation.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('media_text_no_ai', 'Aurelis', 'DOOH Kampagne', 'Mehr Ruhe fuer deine Haut.', 'DOOH-Motiv der Markenkommunikation.', null, 'aurelis_dooh_campaign.png'),
  ('media_text_ai', 'Aurelis', 'DOOH Kampagne', 'Mehr Ruhe fuer deine Haut.', 'DOOH-Motiv der Markenkommunikation.', null, 'aurelis_dooh_campaign.png'),
  ('brand_fmcg_no_ai', 'Aurelis Daily', 'FMCG / Alltagsmarke', 'Pflege, die jeden Tag einfach funktioniert.', 'Aurelis Daily bietet unkomplizierte Hautpflege fuer die taegliche Routine. Leicht verstaendlich, angenehm in der Anwendung und gemacht fuer ein frisches Hautgefuehl im Alltag.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('brand_fmcg_ai', 'Aurelis Daily', 'FMCG / Alltagsmarke', 'Pflege, die jeden Tag einfach funktioniert.', 'Aurelis Daily bietet unkomplizierte Hautpflege fuer die taegliche Routine. Leicht verstaendlich, angenehm in der Anwendung und gemacht fuer ein frisches Hautgefuehl im Alltag.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('brand_premium_no_ai', 'Aurelis', 'Premiummarke', 'Mehr Ruhe fuer deine Haut.', 'Aurelis verbindet hochwertige Formulierungen mit einer Pflegeroutine, die sich bewusst und angenehm anfuehlt. Fuer Haut, die gepflegter, ausgeglichener und frischer wirken soll.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('brand_premium_ai', 'Aurelis', 'Premiummarke', 'Mehr Ruhe fuer deine Haut.', 'Aurelis verbindet hochwertige Formulierungen mit einer Pflegeroutine, die sich bewusst und angenehm anfuehlt. Fuer Haut, die gepflegter, ausgeglichener und frischer wirken soll.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('brand_luxury_no_ai', 'Aurelis Maison', 'Luxusmarke', 'Rituale fuer Hautpflege mit besonderem Anspruch.', 'Aurelis Maison inszeniert Pflege als exklusives Ritual. Edle Formulierungen, ausgewaehlte Inhaltsstoffe und eine reduzierte Markenwelt schaffen ein Gefuehl von Wertigkeit, Ruhe und Besonderheit.', null, 'mobile_umfragen_ai_6/aurelis_premium.png'),
  ('brand_luxury_ai', 'Aurelis Maison', 'Luxusmarke', 'Rituale fuer Hautpflege mit besonderem Anspruch.', 'Aurelis Maison inszeniert Pflege als exklusives Ritual. Edle Formulierungen, ausgewaehlte Inhaltsstoffe und eine reduzierte Markenwelt schaffen ein Gefuehl von Wertigkeit, Ruhe und Besonderheit.', null, 'mobile_umfragen_ai_6/aurelis_premium.png')
on conflict (condition_id) do nothing;

insert into public.treatment_drafts (condition_id, brand_name, brand_type_label, headline, body, ai_notice, image_path, image_url)
select condition_id, brand_name, brand_type_label, headline, body, ai_notice, image_path, image_url
from public.treatments
on conflict (condition_id) do nothing;

insert into public.app_settings (id, settings)
values (
  'public',
  '{
    "publicTitle": "Markenkommunikation",
    "introChip": "5 Minuten · anonym · intuitiv",
    "introHeadline": "Ihre Einschätzung zählt.",
    "introBody": "Im Folgenden sehen Sie einen Inhalt aus der Markenkommunikation einer fiktiven Marke. Bitte betrachten Sie den Inhalt aufmerksam und beantworten Sie die Fragen spontan nach Ihrem persönlichen Eindruck.",
    "introPrivacy": "Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden anonymisiert ausgewertet.",
    "introNotice": "Inhalt ansehen, kurze Slider-Fragen beantworten, fertig. Sie müssen nicht lange nachdenken, der erste Eindruck ist genau richtig.",
    "stimulusTitle": "Bitte betrachten Sie diesen Inhalt",
    "stimulusText": "Für diese Seite ist keine Antwort erforderlich. Die folgenden Fragen beziehen sich auf den gezeigten Inhalt.",
    "completionTitle": "Danke, Ihre Antworten wurden erfasst.",
    "completionText": "Sie können das Fenster nun schließen."
  }'::jsonb
)
on conflict (id) do nothing;

-- Storage policies for the bucket. Create the bucket in the Supabase UI if needed.
insert into storage.buckets (id, name, public)
values ('treatment-assets', 'treatment-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public reads treatment assets" on storage.objects;
create policy "Public reads treatment assets"
on storage.objects for select
using (bucket_id = 'treatment-assets');

drop policy if exists "Admins upload treatment assets" on storage.objects;
create policy "Admins upload treatment assets"
on storage.objects for insert
with check (bucket_id = 'treatment-assets' and public.is_admin());

drop policy if exists "Admins update treatment assets" on storage.objects;
create policy "Admins update treatment assets"
on storage.objects for update
using (bucket_id = 'treatment-assets' and public.is_admin())
with check (bucket_id = 'treatment-assets' and public.is_admin());

drop policy if exists "Admins delete treatment assets" on storage.objects;
create policy "Admins delete treatment assets"
on storage.objects for delete
using (bucket_id = 'treatment-assets' and public.is_admin());
