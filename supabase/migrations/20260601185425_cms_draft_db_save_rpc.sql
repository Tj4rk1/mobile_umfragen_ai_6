create or replace function public.save_treatment_draft(
  p_condition_id text,
  p_brand_name text,
  p_brand_type_label text,
  p_headline text,
  p_body text,
  p_ai_notice text,
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
    raise exception 'Only authenticated admins can save treatment drafts.';
  end if;

  insert into public.treatment_drafts (
    condition_id,
    brand_name,
    brand_type_label,
    headline,
    body,
    ai_notice,
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
    raise exception 'Only authenticated admins can publish treatment drafts.';
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
