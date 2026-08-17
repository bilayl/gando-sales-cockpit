# Gando Sales Cockpit

Application Next.js 16 / TypeScript destinée au setter Gando. HubSpot reste la source de vérité pour les contacts, statuts, rappels, tâches, appels et rendez-vous.

## Parcours disponibles

- **Aujourd’hui** : KPI du jour, file d’appels triée par score de priorité et mode session.
- **Résultat d’appel** : mise à jour du statut, incrément du compteur d’appels et programmation d’une relance.
- **Rappels** : création automatique d’une tâche HubSpot associée au contact et, si disponibles, à l’entreprise et au deal.
- **Prospection** : segments HubSpot, contacts/entreprises, recherche, filtres et fiches détaillées.
- **Tâches** : périodes, types, recherche, création et synchronisation du statut terminé.
- **Agenda** : rendez-vous, tâches et rappels HubSpot dans une vue semaine ; Google Calendar reste optionnel.
- **Rendez-vous** : tous les rendez-vous rattachés à l’owner `sales@gando.app` (qu’ils soient issus de Brevo ou saisis ailleurs), avec vues de suivi et actions commerciales.
- **Stats** : appels, contacts travaillés, rendez-vous et conversion par période.

Toutes les requêtes HubSpot passent par les Route Handlers côté serveur. Le navigateur ne reçoit jamais de token HubSpot.

## Configuration

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs localement :

```powershell
Copy-Item .env.example .env.local
```

Configuration OAuth recommandée :

```text
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/auth/hubspot/callback
SESSION_SECRET=une-valeur-longue-et-aleatoire
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

La Redirect URL doit être déclarée à l’identique dans l’application HubSpot. Le code demande les scopes CRM contacts, entreprises, deals, propriétaires et listes nécessaires au cockpit. Les endpoints d’activités HubSpot utilisés par l’application acceptent les scopes contacts correspondants.

Pour du développement local uniquement, `HUBSPOT_PRIVATE_APP_TOKEN` permet de conserver le mode Private App existant. Cette valeur doit rester côté serveur et ne doit jamais être préfixée par `NEXT_PUBLIC_`.

Tous les rendez-vous de l’owner HubSpot configuré sont affichés ; ceux réservés via Brevo sont marqués par le domaine `meet.brevo.com` (badge « Brevo »). La valeur par défaut de l’owner est `sales@gando.app` et peut être remplacée côté serveur avec `BREVO_OWNER_EMAIL`.

Google Calendar est facultatif :

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## Lancer et vérifier

```powershell
npm install
npm run dev
```

Ouvrir `http://localhost:3000`. En OAuth, l’application redirige vers `/login`; en mode Private App serveur, elle ouvre directement `/today`.

Vérifications de qualité :

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

## Architecture

```text
Navigateur
  → Next.js App Router / Route Handlers
  → session OAuth chiffrée ou Private App côté serveur
  → HubSpot CRM API 2026-03
  → contacts, entreprises, deals, listes, tâches, appels et meetings
```

La session OAuth est chiffrée dans un cookie HttpOnly, `SameSite=Lax`, sécurisé en production. Le refresh token permet de renouveler automatiquement l’access token expiré. Les réponses `429` HubSpot sont retentées avec un délai borné.

## Déploiement

Aucun déploiement n’est effectué automatiquement par ce projet. Avant une mise en production Vercel, définir les mêmes variables dans l’environnement de production et enregistrer la Redirect URL de production exacte dans HubSpot.
