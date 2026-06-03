update public.treatments
set brand_name = 'Aurelis',
    brand_type_label = 'DOOH Kampagne',
    headline = 'Mehr Ruhe für deine Haut.',
    body = 'DOOH-Motiv der Markenkommunikation.',
    image_path = null,
    image_url = 'aurelis_dooh_campaign.png',
    updated_at = now()
where condition_id in ('media_text_no_ai', 'media_text_ai');

update public.treatment_drafts
set brand_name = 'Aurelis',
    brand_type_label = 'DOOH Kampagne',
    headline = 'Mehr Ruhe für deine Haut.',
    body = 'DOOH-Motiv der Markenkommunikation.',
    image_path = null,
    image_url = 'aurelis_dooh_campaign.png',
    updated_at = now()
where condition_id in ('media_text_no_ai', 'media_text_ai');
