update public.conditions
set label = case id
  when 'media_image_no_ai' then 'Medienart · Bild · Variante A'
  when 'media_image_ai' then 'Medienart · Bild · Variante B'
  when 'media_text_no_ai' then 'Medienart · Text · Variante A'
  when 'media_text_ai' then 'Medienart · Text · Variante B'
  when 'brand_fmcg_no_ai' then 'Markenart · FMCG · Variante A'
  when 'brand_fmcg_ai' then 'Markenart · FMCG · Variante B'
  when 'brand_premium_no_ai' then 'Markenart · Premium · Variante A'
  when 'brand_premium_ai' then 'Markenart · Premium · Variante B'
  when 'brand_luxury_no_ai' then 'Markenart · Luxus · Variante A'
  when 'brand_luxury_ai' then 'Markenart · Luxus · Variante B'
  else label
end
where id in (
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
