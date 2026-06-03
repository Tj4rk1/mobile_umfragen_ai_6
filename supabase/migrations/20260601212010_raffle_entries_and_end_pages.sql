create table if not exists public.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.participants(id) on delete cascade,
  condition_id text not null references public.conditions(id),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.raffle_entries enable row level security;

drop policy if exists "Authenticated read raffle entries" on public.raffle_entries;
create policy "Authenticated read raffle entries"
on public.raffle_entries for select
to authenticated
using (true);

drop policy if exists "Public insert raffle entries" on public.raffle_entries;
create policy "Public insert raffle entries"
on public.raffle_entries for insert
with check (true);

insert into public.app_settings (id, settings)
values (
  'public',
  '{
    "disclaimerTitle": "Aufklärung zum Experiment",
    "disclaimerBody": "Vielen Dank für Ihre Teilnahme an dieser Umfrage.\n\nBei dieser Studie handelte es sich um ein Experiment zur Wirkung von Werbeanzeigen auf die Markenwahrnehmung. Ziel war es zu untersuchen, ob sich die Wahrnehmung einer Marke und ihrer Werbung unterscheidet, wenn eine Anzeige als mithilfe generativer künstlicher Intelligenz erstellt beschrieben wird oder wenn sie als mithilfe einer Werbeagentur erstellt beschrieben wird.\n\nDie zuvor gezeigte Marke Aurelis wurde im Rahmen dieses Experiments verwendet. Die Angaben zur Marke und zur Entstehung der Werbeanzeige dienten dazu, unterschiedliche Bedingungen innerhalb der Studie zu vergleichen.\n\nIhre Antworten helfen dabei, besser zu verstehen, welche Rolle die wahrgenommene Entstehung von Werbematerialien für die Bewertung von Marken, Produkten und Werbung spielt.\n\nNochmals vielen Dank für Ihre Teilnahme.",
    "raffleTitle": "Am Gewinnspiel teilnehmen",
    "raffleBody": "Wenn Sie am Gewinnspiel teilnehmen möchten, können Sie hier freiwillig Ihre E-Mail-Adresse angeben. Die E-Mail-Adresse wird getrennt von Ihren Antworten gespeichert.",
    "rafflePlaceholder": "E-Mail-Adresse eingeben"
  }'::jsonb
)
on conflict (id) do update set
  settings = public.app_settings.settings || excluded.settings,
  updated_at = now();

insert into public.app_settings_drafts (id, settings)
select id, settings
from public.app_settings
on conflict (id) do update set
  settings = public.app_settings_drafts.settings || excluded.settings,
  updated_at = now();
