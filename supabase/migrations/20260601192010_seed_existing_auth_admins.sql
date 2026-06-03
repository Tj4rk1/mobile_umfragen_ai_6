insert into public.admins (user_id, email)
select id, email
from auth.users
where email is not null
on conflict (user_id) do update set email = excluded.email;
