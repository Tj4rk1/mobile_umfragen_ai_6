alter table public.treatments
  add column if not exists intro_chip text,
  add column if not exists intro_headline text,
  add column if not exists intro_body text,
  add column if not exists intro_privacy text,
  add column if not exists intro_notice text,
  add column if not exists stimulus_title text,
  add column if not exists stimulus_text text,
  add column if not exists completion_title text,
  add column if not exists completion_text text;

alter table public.treatment_drafts
  add column if not exists intro_chip text,
  add column if not exists intro_headline text,
  add column if not exists intro_body text,
  add column if not exists intro_privacy text,
  add column if not exists intro_notice text,
  add column if not exists stimulus_title text,
  add column if not exists stimulus_text text,
  add column if not exists completion_title text,
  add column if not exists completion_text text;

update public.treatments
set
  intro_chip = coalesce(intro_chip, public.app_settings.settings->>'introChip', '5 Minuten · anonym · intuitiv'),
  intro_headline = coalesce(intro_headline, public.app_settings.settings->>'introHeadline', 'Ihre Einschätzung zählt.'),
  intro_body = coalesce(intro_body, public.app_settings.settings->>'introBody', ''),
  intro_privacy = coalesce(intro_privacy, public.app_settings.settings->>'introPrivacy', ''),
  intro_notice = coalesce(intro_notice, public.app_settings.settings->>'introNotice', ''),
  stimulus_title = coalesce(stimulus_title, public.app_settings.settings->>'stimulusTitle', 'Bitte betrachten Sie diesen Inhalt'),
  stimulus_text = coalesce(stimulus_text, public.app_settings.settings->>'stimulusText', ''),
  completion_title = coalesce(completion_title, public.app_settings.settings->>'completionTitle', 'Danke, Ihre Antworten wurden erfasst.'),
  completion_text = coalesce(completion_text, public.app_settings.settings->>'completionText', '')
from public.app_settings
where public.app_settings.id = 'public';

update public.treatment_drafts
set
  intro_chip = coalesce(intro_chip, public.app_settings.settings->>'introChip', '5 Minuten · anonym · intuitiv'),
  intro_headline = coalesce(intro_headline, public.app_settings.settings->>'introHeadline', 'Ihre Einschätzung zählt.'),
  intro_body = coalesce(intro_body, public.app_settings.settings->>'introBody', ''),
  intro_privacy = coalesce(intro_privacy, public.app_settings.settings->>'introPrivacy', ''),
  intro_notice = coalesce(intro_notice, public.app_settings.settings->>'introNotice', ''),
  stimulus_title = coalesce(stimulus_title, public.app_settings.settings->>'stimulusTitle', 'Bitte betrachten Sie diesen Inhalt'),
  stimulus_text = coalesce(stimulus_text, public.app_settings.settings->>'stimulusText', ''),
  completion_title = coalesce(completion_title, public.app_settings.settings->>'completionTitle', 'Danke, Ihre Antworten wurden erfasst.'),
  completion_text = coalesce(completion_text, public.app_settings.settings->>'completionText', '')
from public.app_settings
where public.app_settings.id = 'public';

create or replace function public.save_treatment_draft(
  p_condition_id text,
  p_brand_name text,
  p_brand_type_label text,
  p_headline text,
  p_body text,
  p_ai_notice text,
  p_intro_chip text,
  p_intro_headline text,
  p_intro_body text,
  p_intro_privacy text,
  p_intro_notice text,
  p_stimulus_title text,
  p_stimulus_text text,
  p_completion_title text,
  p_completion_text text,
  p_image_path text,
  p_image_url text
)
returns public.treatment_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.treatment_drafts;
begin
  if auth.uid() is null then
    raise exception 'Only authenticated users can save treatment drafts.';
  end if;

  insert into public.treatment_drafts (
    condition_id,
    brand_name,
    brand_type_label,
    headline,
    body,
    ai_notice,
    intro_chip,
    intro_headline,
    intro_body,
    intro_privacy,
    intro_notice,
    stimulus_title,
    stimulus_text,
    completion_title,
    completion_text,
    image_path,
    image_url,
    updated_by,
    updated_at
  )
  values (
    p_condition_id,
    p_brand_name,
    p_brand_type_label,
    p_headline,
    p_body,
    p_ai_notice,
    p_intro_chip,
    p_intro_headline,
    p_intro_body,
    p_intro_privacy,
    p_intro_notice,
    p_stimulus_title,
    p_stimulus_text,
    p_completion_title,
    p_completion_text,
    nullif(p_image_path, ''),
    nullif(p_image_url, ''),
    auth.uid(),
    now()
  )
  on conflict (condition_id) do update set
    brand_name = excluded.brand_name,
    brand_type_label = excluded.brand_type_label,
    headline = excluded.headline,
    body = excluded.body,
    ai_notice = excluded.ai_notice,
    intro_chip = excluded.intro_chip,
    intro_headline = excluded.intro_headline,
    intro_body = excluded.intro_body,
    intro_privacy = excluded.intro_privacy,
    intro_notice = excluded.intro_notice,
    stimulus_title = excluded.stimulus_title,
    stimulus_text = excluded.stimulus_text,
    completion_title = excluded.completion_title,
    completion_text = excluded.completion_text,
    image_path = excluded.image_path,
    image_url = excluded.image_url,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning *
  into saved;

  return saved;
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
  if auth.uid() is null then
    raise exception 'Only authenticated users can publish treatment drafts.';
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
    intro_chip,
    intro_headline,
    intro_body,
    intro_privacy,
    intro_notice,
    stimulus_title,
    stimulus_text,
    completion_title,
    completion_text,
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
    draft.intro_chip,
    draft.intro_headline,
    draft.intro_body,
    draft.intro_privacy,
    draft.intro_notice,
    draft.stimulus_title,
    draft.stimulus_text,
    draft.completion_title,
    draft.completion_text,
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
    intro_chip = excluded.intro_chip,
    intro_headline = excluded.intro_headline,
    intro_body = excluded.intro_body,
    intro_privacy = excluded.intro_privacy,
    intro_notice = excluded.intro_notice,
    stimulus_title = excluded.stimulus_title,
    stimulus_text = excluded.stimulus_text,
    completion_title = excluded.completion_title,
    completion_text = excluded.completion_text,
    image_path = excluded.image_path,
    image_url = excluded.image_url,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at
  returning *
  into published;

  return published;
end;
$$;

grant execute on function public.save_treatment_draft(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.publish_treatment_draft(text) to authenticated;
