-- Profiles created before the email column existed.
update profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is null;
