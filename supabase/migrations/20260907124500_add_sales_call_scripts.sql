create table if not exists public.sales_call_scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null default 'Loueurs indépendants',
  description text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  source_url text,
  introduction text not null,
  discovery_questions jsonb not null default '[]'::jsonb,
  value_proposition text not null,
  closing text not null,
  qualification_rules jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_call_scripts_name_key
  on public.sales_call_scripts (lower(name));

create unique index if not exists sales_call_scripts_single_default_idx
  on public.sales_call_scripts (is_default)
  where is_default = true;

alter table public.sales_call_scripts enable row level security;

alter table public.sales_call_sessions
  add column if not exists script_id uuid references public.sales_call_scripts(id) on delete set null;

alter table public.sales_call_sessions
  add column if not exists location_filter text;

insert into public.sales_call_scripts (
  name,
  segment,
  description,
  is_default,
  source_url,
  introduction,
  discovery_questions,
  value_proposition,
  closing,
  qualification_rules,
  objections
)
select
  'Loueurs indépendants — Gando',
  'Loueurs indépendants',
  'Script de qualification pour cold call loueurs : comprendre la gestion actuelle de la caution, identifier la friction puis proposer Gando.',
  true,
  'https://horn-passbook-159.notion.site/Script-commercial-loueurs-ind-pendants-2ca0602021b981ffb25ec2a912721188?source=copy_link',
  'Bonjour {{firstname}}, je vous appelle de Gando. On travaille avec des loueurs qui veulent sécuriser leurs cautions sans bloquer le montant sur la carte du locataire. Je voulais comprendre rapidement comment {{company}} gère cela aujourd’hui.',
  '["Comment gérez-vous aujourd’hui les cautions : préautorisation, empreinte, chèque, virement ou autre ?","Quel est le montant moyen de caution demandé à vos locataires ?","Quel volume de locations ou de cautions traitez-vous chaque mois ?","Est-ce que vous avez des refus de carte, des problèmes de plafond ou des clients gênés par les fonds bloqués ?","Que se passe-t-il lorsqu’il faut réellement encaisser une caution après un incident ?","Quel ERP et quelle solution de paiement utilisez-vous aujourd’hui ?","Qui décide sur ce sujet et quel serait le bon timing pour tester une autre approche ?"]'::jsonb,
  'D’après ce que vous me décrivez, Gando peut remplacer le blocage de fonds par une caution digitale sécurisée : le locataire ne bloque pas {{deposit_hint}}, le loueur reçoit une confirmation de sécurisation et garde un parcours d’encaissement en cas d’incident. L’objectif est de réduire la friction sans retirer la protection du loueur.',
  'Si cela répond au problème que vous venez de décrire, le plus simple est de vous montrer le parcours sur un cas réel. On peut faire une démo courte et voir si un premier test sur quelques locations a du sens pour {{company}}. Quel créneau vous conviendrait ?',
  '["RDV : besoin identifié + volume pertinent + décideur ou sponsor + timing concret","À relancer : besoin potentiel mais décideur ou timing absent","À recycler : profil compatible mais priorité faible aujourd’hui","Hors cible : pas de caution, volume très faible ou aucune friction pertinente"]'::jsonb,
  '["Déjà une solution : comparer blocage de fonds, durée, récupération et parcours d’encaissement avant de parler prix.","Le client ne paiera pas : revenir sur la valeur perçue pour éviter l’immobilisation de la caution et qualifier les montants concernés.","Nous n’avons pas de problème : vérifier refus de carte, plafonds, temps opérateur, incidents et abandon avant de conclure.","Trop cher : quantifier d’abord le coût d’une réservation perdue ou d’une friction opérationnelle."]'::jsonb
where not exists (
  select 1 from public.sales_call_scripts where lower(name) = lower('Loueurs indépendants — Gando')
);
