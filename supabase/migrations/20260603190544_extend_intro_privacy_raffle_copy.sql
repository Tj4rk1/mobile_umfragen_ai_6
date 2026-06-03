update public.treatments
set intro_privacy = 'Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden anonymisiert ausgewertet. Optional können Sie am Ende der Befragung an einem Gewinnspiel teilnehmen, bei dem ein Gutschein im Wert von 25 € verlost wird. Ihre E-Mail-Adresse wird dafür getrennt von Ihren Antworten erhoben und ausschließlich zur Gewinnbenachrichtigung genutzt. Ihre Antworten bleiben anonym.'
where intro_privacy is null
   or intro_privacy = ''
   or intro_privacy not ilike '%Gutschein im Wert von 25%';

update public.treatment_drafts
set intro_privacy = 'Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden anonymisiert ausgewertet. Optional können Sie am Ende der Befragung an einem Gewinnspiel teilnehmen, bei dem ein Gutschein im Wert von 25 € verlost wird. Ihre E-Mail-Adresse wird dafür getrennt von Ihren Antworten erhoben und ausschließlich zur Gewinnbenachrichtigung genutzt. Ihre Antworten bleiben anonym.'
where intro_privacy is null
   or intro_privacy = ''
   or intro_privacy not ilike '%Gutschein im Wert von 25%';
