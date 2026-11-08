# RL Location — correction redevances (8 novembre 2026)

## Cause confirmée

La route `/api/kpi/partner-remuneration` interrogeait les dépôts du miroir `gando_source_records` sans pagination. PostgREST limitait le résultat aux 1 000 premières lignes ordonnées par `source_id`, alors que le miroir `deposits` contient plus de 50 000 cautions. Les comptes du partenaire RL n'y étaient donc représentés que partiellement.

Le compte **RL Location** (`actor_key='rl'`, cashback fixe) et le compte **LR LOCATION** (`actor_key='lr'`, pourcentage du montant) sont deux entités **distinctes**. Ne pas mélanger les comptes ni modifier les deux barèmes simultanément.

## Correction technique

- Migration `20261108101500_kpi_partner_relevant_deposits.sql` : RPC en lecture, invoker, uniquement `service_role`, qui sélectionne l'ensemble des cautions des comptes partenaires configurés et les cautions éligibles du réseau Fleetee. Les marqueurs Fleetee `return_url` sont conservés pour calculer la liste des comptes associés.
- Pagination déterministe de l'ensemble des appels au miroir (`range` par 500 lignes), y compris le résultat de la RPC et les opérations de frais.
- Rapprochement frais/cautions limité aux **cautions activées** et à la proximité de la date de création / activation, pas `updated_at` (qui peut correspondre à une clôture plus tardive).
- Contrôle d'accès identique à celui des pages KPI : utilisateurs commerciaux exclus.
- Affichage dédié à **RL Location** dans KPI → Redevances : barème dynamique, cautions source, cautions activées, exclusions, totaux mensuels et détail de chaque caution rémunérée.
- Le mois de la redevance repose sur la date du paiement du frais, en fuseau `Europe/Paris`.

## Données contrôlées le 8 novembre 2026 (snapshot, non codées en dur)

- 239 cautions source pour le compte RL, dont 150 avec date réelle d'activation.
- 147 cautions remplissent le barème des statuts éligibles et des montants : 145 × 5,60 € + 2 × 8,33 € = **828,66 € HT**.
- 89 cautions pas encore activées.
- 2 cautions déjà activées mais avec statuts exclus par la règle (1 `capture_issue`, 1 `cancelled`).
- 1 caution de 700 € hors barème.
- Les 147 cautions éligibles ont une opération de frais rapprochable en ±14 jours, avec 147 opérations distinctes retrouvées dans le miroir.

Ventilation par **mois d'encaissement du frais** :
- Août 2026 : 34 cautions, 190,40 € HT.
- Septembre 2026 : 33 cautions, 184,80 € HT.
- Octobre 2026 : 62 cautions, 349,93 € HT.
- Novembre 2026 (partiel) : 18 cautions, 103,53 € HT.

Le barème RL est lu depuis `kpi_partner_remuneration_rules`, pas du code : aucune modification de commission ni paiement automatique n'est effectuée.

## Vérification / non-régression

1. Vérifier que la RPC rapporte **toutes** les cautions RL, indépendamment de leur position dans le miroir; en date de snapshot, 239 RL sur 689 cautions partenaires retournées.
2. Vérifier que le calcul ne compte **aucune** caution `pending` / `incomplete` sans activation, aucune caution `cancelled`, et aucune caution hors barème.
3. Vérifier les totaux des mois et que le total des lignes `depositDetails` est égal à `eligibleDeposits`.
4. S'assurer que Fleetee garde son filtrage `created_via='partner_api'` et son exclusion des garanties; ne pas modifier le calcul Fleetee par cette correction.
5. Contrôler les privilèges de la RPC : `anon=false`, `authenticated=false`, `service_role=true`.
6. Si le barème change, modifier uniquement la règle correspondante dans `kpi_partner_remuneration_rules` après validation commerciale; **ne pas** figer ces montants dans la page.
