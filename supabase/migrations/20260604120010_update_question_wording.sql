with question_copy as (
  select '[
    {
      "key": "trust",
      "title": "Markenvertrauen",
      "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
      "items": [
        ["trust_reliable", "Markenvertrauen", "Durch die gezeigte Anzeige wirkt diese Marke für mich verlässlich."],
        ["trust_confidence", "Markenvertrauen", "Durch die gezeigte Anzeige könnte ich mir vorstellen, Vertrauen in diese Marke aufzubauen."],
        ["trust_promise", "Markenvertrauen", "Durch die gezeigte Anzeige wirkt es auf mich so, als würde diese Marke halten, was sie verspricht."],
        ["trust_expectations", "Markenvertrauen", "Durch die gezeigte Anzeige wirkt es auf mich so, als würde diese Marke die Erwartungen ihrer Kund:innen erfüllen."]
      ]
    },
    {
      "key": "innovation",
      "title": "Wahrgenommene Innovativität",
      "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
      "items": [
        ["innovation_innovative", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke innovativ ist."],
        ["innovation_creative", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke kreativ ist."],
        ["innovation_modern", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke modern und zukunftsorientiert ist."],
        ["innovation_solutions", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke neue und relevante Lösungen hervorbringen kann."]
      ]
    },
    {
      "key": "purchase",
      "title": "Kaufabsicht",
      "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
      "items": [
        ["purchase_after_impression", "Kaufabsicht", "Durch die gezeigte Anzeige könnte ich mir vorstellen, Produkte dieser Marke zu kaufen."],
        ["purchase_consideration", "Kaufabsicht", "Durch die gezeigte Anzeige ist die Wahrscheinlichkeit hoch, dass ich diese Marke in Betracht ziehen könnte."],
        ["purchase_products", "Kaufabsicht", "Durch die gezeigte Anzeige wird diese Marke für mich als Kaufoption interessanter."],
        ["purchase_prefer", "Kaufabsicht", "Durch die gezeigte Anzeige könnte ich diese Marke eher auswählen als vergleichbare Alternativen."]
      ]
    },
    {
      "key": "evaluation",
      "title": "Allgemeine Markenbewertung",
      "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
      "items": [
        ["evaluation_positive", "Markenbewertung", "Durch die gezeigte Anzeige hinterlässt diese Marke insgesamt einen positiven Eindruck bei mir."],
        ["evaluation_fit", "Markenbewertung", "Durch die gezeigte Anzeige wirkt die Markenkommunikation für mich passend zu dieser Marke."],
        ["evaluation_quality", "Markenbewertung", "Durch die gezeigte Anzeige wirkt diese Marke für mich hochwertig."]
      ]
    }
  ]'::jsonb as question_groups
)
insert into public.app_settings (id, settings)
select 'public', jsonb_build_object('questionGroups', question_groups)
from question_copy
on conflict (id) do update
set
  settings = jsonb_set(
    coalesce(public.app_settings.settings, '{}'::jsonb),
    '{questionGroups}',
    excluded.settings->'questionGroups',
    true
  ),
  updated_at = now();

do $$
begin
  if to_regclass('public.app_settings_drafts') is not null then
    with question_copy as (
      select '[
        {
          "key": "trust",
          "title": "Markenvertrauen",
          "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
          "items": [
            ["trust_reliable", "Markenvertrauen", "Durch die gezeigte Anzeige wirkt diese Marke für mich verlässlich."],
            ["trust_confidence", "Markenvertrauen", "Durch die gezeigte Anzeige könnte ich mir vorstellen, Vertrauen in diese Marke aufzubauen."],
            ["trust_promise", "Markenvertrauen", "Durch die gezeigte Anzeige wirkt es auf mich so, als würde diese Marke halten, was sie verspricht."],
            ["trust_expectations", "Markenvertrauen", "Durch die gezeigte Anzeige wirkt es auf mich so, als würde diese Marke die Erwartungen ihrer Kund:innen erfüllen."]
          ]
        },
        {
          "key": "innovation",
          "title": "Wahrgenommene Innovativität",
          "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
          "items": [
            ["innovation_innovative", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke innovativ ist."],
            ["innovation_creative", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke kreativ ist."],
            ["innovation_modern", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke modern und zukunftsorientiert ist."],
            ["innovation_solutions", "Markeninnovativität", "Durch die gezeigte Anzeige habe ich das Gefühl, dass diese Marke neue und relevante Lösungen hervorbringen kann."]
          ]
        },
        {
          "key": "purchase",
          "title": "Kaufabsicht",
          "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
          "items": [
            ["purchase_after_impression", "Kaufabsicht", "Durch die gezeigte Anzeige könnte ich mir vorstellen, Produkte dieser Marke zu kaufen."],
            ["purchase_consideration", "Kaufabsicht", "Durch die gezeigte Anzeige ist die Wahrscheinlichkeit hoch, dass ich diese Marke in Betracht ziehen könnte."],
            ["purchase_products", "Kaufabsicht", "Durch die gezeigte Anzeige wird diese Marke für mich als Kaufoption interessanter."],
            ["purchase_prefer", "Kaufabsicht", "Durch die gezeigte Anzeige könnte ich diese Marke eher auswählen als vergleichbare Alternativen."]
          ]
        },
        {
          "key": "evaluation",
          "title": "Allgemeine Markenbewertung",
          "intro": "Bitte geben Sie an, inwieweit Sie den folgenden Aussagen zustimmen.",
          "items": [
            ["evaluation_positive", "Markenbewertung", "Durch die gezeigte Anzeige hinterlässt diese Marke insgesamt einen positiven Eindruck bei mir."],
            ["evaluation_fit", "Markenbewertung", "Durch die gezeigte Anzeige wirkt die Markenkommunikation für mich passend zu dieser Marke."],
            ["evaluation_quality", "Markenbewertung", "Durch die gezeigte Anzeige wirkt diese Marke für mich hochwertig."]
          ]
        }
      ]'::jsonb as question_groups
    )
    insert into public.app_settings_drafts (id, settings)
    select 'public', jsonb_build_object('questionGroups', question_groups)
    from question_copy
    on conflict (id) do update
    set
      settings = jsonb_set(
        coalesce(public.app_settings_drafts.settings, '{}'::jsonb),
        '{questionGroups}',
        excluded.settings->'questionGroups',
        true
      ),
      updated_at = now();
  end if;
end $$;
