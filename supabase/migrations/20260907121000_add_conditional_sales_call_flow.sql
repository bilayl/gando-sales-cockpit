alter table public.sales_call_scripts
  add column if not exists flow jsonb not null default '[]'::jsonb;

update public.sales_call_scripts
set flow = '[
  {"id":"intro","type":"message","title":"Introduction","text":"{{introduction}}","next_id":"deposit_method"},
  {"id":"deposit_method","type":"question","title":"Gestion actuelle de la caution","text":"Comment gérez-vous aujourd’hui la caution avec vos locataires ?","answers":[
    {"id":"preauth","label":"Préautorisation carte","next_id":"friction"},
    {"id":"card","label":"Empreinte carte / VAD","next_id":"friction"},
    {"id":"offline","label":"Chèque / virement / espèces","next_id":"friction"},
    {"id":"none","label":"Pas ou très peu de caution","next_id":"no_deposit"}
  ]},
  {"id":"friction","type":"question","title":"Pain point client","text":"Est-ce que le blocage de fonds, les plafonds ou les refus de carte vous font perdre des réservations ou créent des tensions avec les clients ?","answers":[
    {"id":"often","label":"Oui, régulièrement","next_id":"volume"},
    {"id":"sometimes","label":"Parfois","next_id":"volume"},
    {"id":"rarely","label":"Non / rarement","next_id":"incident"}
  ]},
  {"id":"incident","type":"question","title":"Pain point encaissement","text":"Lorsqu’il y a réellement un incident, l’encaissement de la caution est-il simple et fiable aujourd’hui ?","answers":[
    {"id":"hard","label":"Non, c’est compliqué","next_id":"volume"},
    {"id":"mixed","label":"Ça dépend des cas","next_id":"volume"},
    {"id":"easy","label":"Oui, plutôt simple","next_id":"volume"}
  ]},
  {"id":"volume","type":"question","title":"Volume","text":"Combien de locations environ traitez-vous par mois ?","answers":[
    {"id":"lt30","label":"Moins de 30","next_id":"deposit_amount"},
    {"id":"30_100","label":"30 à 100","next_id":"deposit_amount"},
    {"id":"100_300","label":"100 à 300","next_id":"deposit_amount"},
    {"id":"300plus","label":"300+","next_id":"deposit_amount"}
  ]},
  {"id":"deposit_amount","type":"question","title":"Montant de caution","text":"Quel est le montant moyen de caution demandé à un locataire ?","answers":[
    {"id":"lt500","label":"Moins de 500 €","next_id":"decision_maker"},
    {"id":"500_1000","label":"500 à 1 000 €","next_id":"decision_maker"},
    {"id":"1000_2500","label":"1 000 à 2 500 €","next_id":"decision_maker"},
    {"id":"2500plus","label":"Plus de 2 500 €","next_id":"decision_maker"}
  ]},
  {"id":"decision_maker","type":"question","title":"Décideur","text":"Est-ce vous qui décidez de la manière dont les cautions et paiements sont gérés ?","answers":[
    {"id":"yes","label":"Oui","next_id":"value"},
    {"id":"no","label":"Non","next_id":"stakeholder"}
  ]},
  {"id":"stakeholder","type":"question","title":"Identifier le décideur","text":"Qui doit être impliqué pour avancer sur ce sujet ?","answers":[
    {"id":"direction","label":"Direction / gérant","next_id":"value"},
    {"id":"ops","label":"Opérations","next_id":"value"},
    {"id":"finance","label":"Finance / paiement","next_id":"value"},
    {"id":"other","label":"Autre personne","next_id":"value"}
  ]},
  {"id":"value","type":"message","title":"Proposition adaptée","text":"{{value_proposition}}","next_id":"interest"},
  {"id":"interest","type":"question","title":"Tester l’intérêt","text":"Si vous pouviez sécuriser la caution sans bloquer les fonds du client, tout en gardant un parcours d’encaissement en cas d’incident, est-ce que cela mérite une démo de 15 minutes ?","answers":[
    {"id":"yes","label":"Oui","next_id":"close_demo"},
    {"id":"maybe","label":"Peut-être / j’ai une objection","next_id":"objection"},
    {"id":"no","label":"Non","next_id":"why_no"}
  ]},
  {"id":"objection","type":"question","title":"Traiter l’objection","text":"Qu’est-ce qui vous freine le plus aujourd’hui ?","answers":[
    {"id":"price","label":"Le prix","next_id":"price_response"},
    {"id":"existing","label":"On a déjà une solution","next_id":"existing_response"},
    {"id":"need","label":"On n’a pas vraiment de problème","next_id":"need_response"},
    {"id":"timing","label":"Ce n’est pas le bon moment","next_id":"timing_response"}
  ]},
  {"id":"price_response","type":"message","title":"Réponse — prix","text":"Je comprends. Avant de parler prix, je veux surtout mesurer ce que vous coûte aujourd’hui une réservation perdue, un refus de carte ou du temps opérationnel autour de la caution. L’idée est de vérifier si Gando crée plus de valeur qu’il n’en coûte.","next_id":"interest_after_objection"},
  {"id":"existing_response","type":"message","title":"Réponse — solution existante","text":"Très bien. L’objectif n’est pas de remplacer ce qui fonctionne. Je voudrais comparer trois points : fonds bloqués côté client, durée de sécurisation et capacité d’encaissement en cas d’incident.","next_id":"interest_after_objection"},
  {"id":"need_response","type":"message","title":"Réponse — pas de problème apparent","text":"Compris. Je veux simplement vérifier si vous voyez malgré tout des refus liés aux plafonds, des préautorisations à renouveler, du temps agent ou des clients qui hésitent à immobiliser leur caution.","next_id":"interest_after_objection"},
  {"id":"timing_response","type":"message","title":"Réponse — timing","text":"Pas de souci. L’important est d’identifier le bon moment : renouvellement de votre solution, saison haute, nouvelle agence ou changement de process.","next_id":"close_followup"},
  {"id":"interest_after_objection","type":"question","title":"Revalider l’intérêt","text":"Avec ce point clarifié, est-ce qu’une courte démo vaut le coup ?","answers":[
    {"id":"yes","label":"Oui","next_id":"close_demo"},
    {"id":"later","label":"Plus tard","next_id":"close_followup"},
    {"id":"no","label":"Non","next_id":"close_no"}
  ]},
  {"id":"why_no","type":"question","title":"Comprendre le non","text":"Pour que je ne vous relance pas inutilement : c’est plutôt l’absence de besoin, le modèle économique ou le timing ?","answers":[
    {"id":"need","label":"Pas de besoin","next_id":"close_no"},
    {"id":"economics","label":"Modèle économique","next_id":"price_response"},
    {"id":"timing","label":"Timing","next_id":"close_followup"}
  ]},
  {"id":"close_demo","type":"close","title":"Close — RDV","text":"{{closing}}","outcome":"RDV À BOOKER"},
  {"id":"close_followup","type":"close","title":"Close — relance","text":"Très bien. On fixe directement une date de rappel précise pour éviter de se perdre de vue.","outcome":"À RELANCER"},
  {"id":"close_no","type":"close","title":"Close — non qualifié","text":"Merci pour votre transparence. Je note le contexte pour ne pas vous relancer inutilement.","outcome":"À RECYCLER / NON QUALIFIÉ"},
  {"id":"no_deposit","type":"close","title":"Sortie — hors cible","text":"Merci. Si la caution n’est pas réellement utilisée dans votre modèle, Gando n’est probablement pas prioritaire aujourd’hui.","outcome":"HORS CIBLE"}
]'::jsonb,
updated_at = now()
where is_default = true
  and (flow is null or flow = '[]'::jsonb);
