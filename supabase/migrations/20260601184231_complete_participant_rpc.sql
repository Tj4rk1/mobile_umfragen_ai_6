create or replace function public.complete_participant(
  p_participant_id uuid,
  p_condition_id text,
  p_responses jsonb
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
    and condition_id = p_condition_id;

  if not found then
    raise exception 'Participant % for condition % not found.', p_participant_id, p_condition_id;
  end if;

  delete from public.responses
  where participant_id = p_participant_id;

  insert into public.responses (
    participant_id,
    condition_id,
    question_key,
    construct,
    item_text,
    value,
    numeric_value
  )
  select
    p_participant_id,
    p_condition_id,
    item->>'question_key',
    item->>'construct',
    item->>'item_text',
    coalesce(item->>'value', ''),
    nullif(item->>'numeric_value', '')::numeric
  from jsonb_array_elements(p_responses) as item;

  update public.participants
  set status = 'completed',
      completed_at = now()
  where id = p_participant_id
  returning *
  into participant_row;

  return participant_row;
end;
$$;
