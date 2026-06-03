create or replace function public.fix_survey_umlauts(input text)
returns text
language sql
immutable
as $$
  select replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(coalesce(input, ''),
      'fuer', 'für'),
      'Fuer', 'Für'),
      'taeglich', 'täglich'),
      'Taeglich', 'Täglich'),
      'verstaendlich', 'verständlich'),
      'Verstaendlich', 'Verständlich'),
      'ausgewaehlte', 'ausgewählte'),
      'Ausgewaehlte', 'Ausgewählte'),
      'Gefuehl', 'Gefühl'),
      'gefuehl', 'gefühl'
    );
$$;

update public.treatments
set
  headline = public.fix_survey_umlauts(headline),
  body = public.fix_survey_umlauts(body),
  ai_notice = public.fix_survey_umlauts(ai_notice),
  intro_headline = public.fix_survey_umlauts(intro_headline),
  intro_body = public.fix_survey_umlauts(intro_body),
  intro_privacy = public.fix_survey_umlauts(intro_privacy),
  intro_notice = public.fix_survey_umlauts(intro_notice),
  stimulus_title = public.fix_survey_umlauts(stimulus_title),
  stimulus_text = public.fix_survey_umlauts(stimulus_text),
  completion_title = public.fix_survey_umlauts(completion_title),
  completion_text = public.fix_survey_umlauts(completion_text),
  updated_at = now();

update public.treatment_drafts
set
  headline = public.fix_survey_umlauts(headline),
  body = public.fix_survey_umlauts(body),
  ai_notice = public.fix_survey_umlauts(ai_notice),
  intro_headline = public.fix_survey_umlauts(intro_headline),
  intro_body = public.fix_survey_umlauts(intro_body),
  intro_privacy = public.fix_survey_umlauts(intro_privacy),
  intro_notice = public.fix_survey_umlauts(intro_notice),
  stimulus_title = public.fix_survey_umlauts(stimulus_title),
  stimulus_text = public.fix_survey_umlauts(stimulus_text),
  completion_title = public.fix_survey_umlauts(completion_title),
  completion_text = public.fix_survey_umlauts(completion_text),
  updated_at = now();

drop function public.fix_survey_umlauts(text);
