create or replace function public.save_app_settings(p_settings jsonb)
returns public.app_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.app_settings;
begin
  if auth.uid() is null then
    raise exception 'Only authenticated admins can save app settings.';
  end if;

  insert into public.app_settings (id, settings, updated_at)
  values ('public', coalesce(p_settings, '{}'::jsonb), now())
  on conflict (id) do update set
    settings = excluded.settings,
    updated_at = excluded.updated_at
  returning *
  into saved;

  return saved;
end;
$$;

grant execute on function public.save_app_settings(jsonb) to authenticated;
