# Gando Sales Cockpit → Allo (Withallo) : contacts et entreprises

## Objectif

Le répertoire Supabase du Cockpit (alimenté par HubSpot) est la source des personnes et entreprises à synchroniser dans le CRM Allo pour identifier les appelants et présenter le contexte dans Allo.

Les champs transmis sont limités à :

- **Personne** : prénom, nom, fonction, téléphone/mobile au format E.164, email, identifiant Allo de l’entreprise associée.
- **Entreprise** : nom, domaine/site Web et secteur si fourni.

Les notes internes, documents, analyses de solvabilité et scores de risque ne sont **pas** transférés à Allo.

## API Allo

- `POST /v2/api/crm/people/search` avec `filters.phone_number` pour trouver une personne ; `POST /v2/api/crm/people` et `PUT /v2/api/crm/people/{id}` pour créer/mettre à jour.
- `POST /v2/api/crm/companies/search` avec `filters.name` ; `POST /v2/api/crm/companies` et `PUT /v2/api/crm/companies/{id}`.
- La clé privée `WITHALLO_API_KEY` doit disposer de `CRM_WRITE` (vérifiée via `GET /v2/api/me`).

Référence publique : https://www.withallo.com/integrations/custom-crm

## Protection des données et dédoublonnage

- Recherche par **numéro complet normalisé**, jamais par les 9 derniers chiffres seuls pour décider d'un rattachement dans Allo.
- Si le numéro existe déjà, mettre à jour uniquement lorsque le prénom/nom ou l'email correspond ; sinon laisser le contact Allo intact et consigner le conflit.
- Si plusieurs fiches utilisent le même numéro, suspendre le rapprochement automatique.
- Les entreprises sont rapprochées par nom exact normalisé et, si disponible, domaine Internet ; en cas d’ambiguïté, ne pas écraser une société existante.
- Les mappings CRM → Allo sont conservés dans `hubspot_sync_state` (`withallo:contact:<hubspotId>`, `withallo:company:<hubspotId>`). Ne jamais remplacer un mapping par une simple correspondance floue.
- Les numéros invalides ou absents ne sont pas créés : Allo exige au moins un numéro E.164.

## Mise en service

1. Vérifier dans Allo que la clé serveur `WITHALLO_API_KEY` possède le scope `CRM_WRITE`. Le compte sans ce scope continue à utiliser la téléphonie mais ne peut pas écrire les fiches CRM.
2. Ouvrir **Téléphonie → Appels** dans le Cockpit. Les administrateurs ont un bouton **Synchroniser 40 fiches** pour tester puis lancer la reprise initiale par lots.
3. Après validation des correspondances et absence de doublons, activer `WITHALLO_CRM_SYNC_ENABLED=true` dans l'environnement **Production** du projet Vercel du Cockpit. Cette variable est volontairement désactivée par défaut pour éviter un transfert massif non testé.
4. Le workflow GitHub Actions `Allo CRM Sync` tente de synchroniser 40 fiches toutes les 5 minutes, en reprenant son curseur entre les exécutions. Les exécutions GitHub planifiées peuvent être décalées.
5. Les boutons **Appeler avec Allo** tentent également une synchronisation ciblée du numéro ; l'appel ne dépend jamais de la réussite de cette opération.
6. Contrôler le statut, les compteurs et les erreurs dans **Téléphonie → Appels**. Les conflits sont conservés en erreur et seront réessayés au prochain passage du répertoire.

## Recette

- Créer une entreprise HubSpot et lui rattacher un contact avec numéro E.164 ; lancer la synchronisation : vérifier le nom et la société dans Allo.
- Relancer la même synchronisation : aucune nouvelle fiche en doublon ne doit apparaître.
- Modifier la fonction ou le nom du contact dans HubSpot : après miroir Cockpit, la mise à jour doit remonter dans Allo.
- Tester deux contacts partageant un même numéro : la collision doit être signalée, sans écrasement de l'autre contact.
- Tester un contact sans téléphone et un numéro DOM : aucune conversion hasardeuse ; le second est transmis avec l'indicatif adéquat.

Cette intégration est **Cockpit → Allo**. Les informations saisies directement dans Allo ne sont pas réinjectées dans HubSpot par ce mécanisme ; la connexion native Allo ↔ HubSpot, si utilisée, reste un flux indépendant.
