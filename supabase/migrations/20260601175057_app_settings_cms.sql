create table if not exists public.app_settings (
  id text primary key default 'public',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 'public')
);

alter table public.app_settings enable row level security;

drop policy if exists "Public can read app settings" on public.app_settings;
create policy "Public can read app settings"
on public.app_settings for select
using (id = 'public');

drop policy if exists "Admins manage app settings" on public.app_settings;
create policy "Admins manage app settings"
on public.app_settings for all
using (public.is_admin())
with check (public.is_admin());

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
