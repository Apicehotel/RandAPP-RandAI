-- Copia i numeri di telefono dei profili già copiati dalla vecchia app (schema public) in randapp.profiles.phone.
-- Solo cifre con prefisso +. Ripetibile. Eseguire dopo la migrazione 0017. Il trigger collega da solo le segnalazioni WhatsApp.
update randapp.profiles p
   set phone = regexp_replace(o.phone, '[^0-9+]', '', 'g')
  from public.profiles o
 where o.auth_user_id = p.auth_user_id and p.phone is null
   and regexp_replace(coalesce(o.phone, ''), '[^0-9+]', '', 'g') ~ '^\+[0-9]{8,15}$';
