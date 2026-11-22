-- Kolsetu interview study (Nov 2026).
-- Reuses the survey shell (participants / responses / raffle_entries) for a
-- single-condition, mostly open-ended interview questionnaire with a website test.

-- 1) Allow the new study type on conditions --------------------------------
alter table public.conditions drop constraint if exists conditions_experiment_type_check;
alter table public.conditions add constraint conditions_experiment_type_check
  check (experiment_type in ('media', 'brand', 'interview'));

alter table public.conditions drop constraint if exists conditions_treatment_type_check;
alter table public.conditions add constraint conditions_treatment_type_check
  check (treatment_type in ('text', 'image', 'brand', 'website'));

update public.conditions set is_active = false where id <> 'kolsetu_website';

insert into public.conditions (id, label, experiment_type, treatment_type, brand_type, ai_disclosure, sort_order, is_active)
values ('kolsetu_website', 'Kolsetu · Website-Test', 'interview', 'website', null, false, 1, true)
on conflict (id) do update set
  label = excluded.label,
  experiment_type = excluded.experiment_type,
  treatment_type = excluded.treatment_type,
  is_active = true;

-- 2) Session metadata (viewport, website mode, timings) ---------------------
alter table public.participants add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.participants add column if not exists last_seen_at timestamptz;

-- 3) Progress saving: answers are stored after every step, so a participant
--    who drops out halfway still leaves usable data. The anonymous id acts as
--    the participant's secret; completed sessions are locked.
create or replace function public.save_interview_progress(
  p_participant_id uuid,
  p_anonymous_id text,
  p_responses jsonb,
  p_meta jsonb default '{}'::jsonb,
  p_complete boolean default false,
  p_contact text default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_row public.participants;
begin
  select *
  into participant_row
  from public.participants
  where id = p_participant_id
    and anonymous_id = p_anonymous_id;

  if not found then
    raise exception 'Participant not found.';
  end if;

  if participant_row.status = 'completed' then
    return participant_row;
  end if;

  insert into public.responses (
    participant_id, condition_id, question_key, construct, item_text, value, numeric_value
  )
  select
    p_participant_id,
    participant_row.condition_id,
    item->>'question_key',
    coalesce(item->>'construct', ''),
    coalesce(item->>'item_text', ''),
    coalesce(item->>'value', ''),
    nullif(item->>'numeric_value', '')::numeric
  from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb)) as item
  where coalesce(item->>'question_key', '') <> ''
  on conflict (participant_id, question_key) do update set
    construct = excluded.construct,
    item_text = excluded.item_text,
    value = excluded.value,
    numeric_value = excluded.numeric_value,
    created_at = now();

  if nullif(trim(coalesce(p_contact, '')), '') is not null then
    insert into public.raffle_entries (participant_id, condition_id, email)
    values (p_participant_id, participant_row.condition_id, left(trim(p_contact), 320))
    on conflict (participant_id) do update set email = excluded.email;
  end if;

  update public.participants
  set meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb),
      last_seen_at = now(),
      status = case when p_complete then 'completed' else status end,
      completed_at = case when p_complete then now() else completed_at end
  where id = p_participant_id
  returning *
  into participant_row;

  return participant_row;
end;
$$;

grant execute on function public.save_interview_progress(uuid, text, jsonb, jsonb, boolean, text) to anon, authenticated;

-- 4) Lock down direct writes. All public writes now go through the
--    security-definer RPCs assign_participant / save_interview_progress.
--    Before this, anyone with the anon key could update any participant or response.
drop policy if exists "Public can create participants" on public.participants;
drop policy if exists "Public can mark participant completed" on public.participants;
drop policy if exists "Public can submit responses" on public.responses;
drop policy if exists "Public can update submitted responses" on public.responses;
drop policy if exists "Public insert raffle entries" on public.raffle_entries;
