update public.treatments
set
  intro_headline = 'Ihre Einschätzung zählt.',
  intro_body = 'Im Folgenden sehen Sie einen Inhalt aus der Markenkommunikation einer fiktiven Marke. Bitte betrachten Sie den Inhalt aufmerksam und beantworten Sie die Fragen spontan nach Ihrem persönlichen Eindruck.',
  intro_privacy = 'Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden anonymisiert ausgewertet.',
  intro_notice = 'Inhalt ansehen, kurze Fragen beantworten, fertig. Sie müssen nicht lange nachdenken, der erste Eindruck ist genau richtig.'
where condition_id in (
  'media_image_no_ai',
  'media_image_ai',
  'media_text_no_ai',
  'media_text_ai',
  'brand_fmcg_no_ai',
  'brand_fmcg_ai',
  'brand_premium_no_ai',
  'brand_premium_ai',
  'brand_luxury_no_ai',
  'brand_luxury_ai'
);

update public.treatment_drafts
set
  intro_headline = 'Ihre Einschätzung zählt.',
  intro_body = 'Im Folgenden sehen Sie einen Inhalt aus der Markenkommunikation einer fiktiven Marke. Bitte betrachten Sie den Inhalt aufmerksam und beantworten Sie die Fragen spontan nach Ihrem persönlichen Eindruck.',
  intro_privacy = 'Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden anonymisiert ausgewertet.',
  intro_notice = 'Inhalt ansehen, kurze Fragen beantworten, fertig. Sie müssen nicht lange nachdenken, der erste Eindruck ist genau richtig.'
where condition_id in (
  'media_image_no_ai',
  'media_image_ai',
  'media_text_no_ai',
  'media_text_ai',
  'brand_fmcg_no_ai',
  'brand_fmcg_ai',
  'brand_premium_no_ai',
  'brand_premium_ai',
  'brand_luxury_no_ai',
  'brand_luxury_ai'
);
