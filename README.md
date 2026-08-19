# Gando Sales Cockpit

Application Next.js 16 / TypeScript destinée au setter Gando. HubSpot reste la source de vérité pour les contacts, entreprises, statuts, rappels, tâches, appels et rendez-vous.

## Parcours disponibles

- **Prospection** : point d’entrée principal du Cockpit, organisé par entreprise avec segments, recherche, filtres, pipeline et fiches centralisées.
- **Démarrer la session** : construit une session à partir des filtres actuellement visibles dans Prospection. Les comptes sont classés par statut de prospection, puis par tâches HubSpot ouvertes (retard, aujourd’hui, prochaine échéance) et enfin par date de rappel.
- **Résultat d’appel** : mise à jour du contact et de l’entreprise associée afin d’alimenter les workflows HubSpot WF01–WF04.
- **Tâches** : périodes, types, recherche, création et synchronisation du statut terminé.
- **Agenda** : rendez-vous, tâches et rappels HubSpot dans une vue semaine ; Google Calendar reste optionnel.
- **Rendez-vous** : tous les rendez-vous rattachés à l’owner configuré, avec vues de suivi et actions commerciales.
- **Deal Room SD** : espace client versionné SD01 → SD05, avec SD01 manuel ou généré depuis les transcriptions Onoff, publication contrôlée, remarques du board et mesure des consultations.
- **Sourcing** : recherche de nouvelles entreprises, contrôle anti-doublon HubSpot puis import Company-first.
- **Stats** : appels, contacts travaillés, rendez-vous et conversion par période.

Le Cockpit ne possède plus de page ni de file séparée « Aujourd’hui ». L’ordre de travail opérationnel est dérivé directement de Prospection et de HubSpot.

Toutes les requêtes HubSpot passent par les Route Handlers côté serveur. Le navigateur ne reçoit jamais de token HubSpot.

## Configuration

Configuration OAuth recommandée :

```text
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/auth/hubspot/callback
SESSION_SECRET=une-valeur-longue-et-aleatoire
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

La Redirect URL doit être déclarée à l’identique dans l’application HubSpot. Le code demande les scopes CRM contacts, entreprises, deals, propriétaires et listes nécessaires au cockpit.

Pour du développement local uniquement, `HUBSPOT_PRIVATE_APP_TOKEN` permet de conserver le mode Private App existant. Cette valeur doit rester côté serveur et ne doit jamais être préfixée par `NEXT_PUBLIC_`.

Le sourcing utilise le backend d’enrichissement lorsqu’il est joignable. En secours, le Cockpit appelle OpenRouter directement côté serveur, sans passer par Vercel AI Gateway :

```text
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/auto
```

`OPENROUTER_API_KEY` doit être configurée uniquement côté serveur (Vercel Production/Preview selon l’environnement) et ne doit jamais être préfixée par `NEXT_PUBLIC_`.

L’agent SD01 utilise `OPENROUTER_SD01_MODEL` lorsqu’elle est définie, puis `OPENROUTER_MODEL`. Les rooms, versions, transcriptions sources, remarques et événements de consultation sont stockés dans Supabase. Le navigateur n’accède jamais directement à ces tables : `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` restent consommées par les routes serveur.

Depuis une War Room interne, ouvrir **Room SD client**. La création initialise les cinq étapes. Le SD01 peut être saisi manuellement ou généré depuis les appels Onoff liés au deal/à l’entreprise et une transcription collée. Une génération passe toujours au statut **À relire** ; seul le bouton **Publier** remplace la version visible par le client.

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

Ouvrir `http://localhost:3000`. Le point d’entrée applicatif est `/prospection`. En production OAuth, l’application redirige vers `/login` lorsque la session HubSpot est absente ; la Preview conserve son mode de test serveur.

Vérifications de qualité :

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

## Architecture

```text
Navigateur
  → Prospection / session filtrée
  → Next.js App Router / Route Handlers
  → session OAuth chiffrée ou Private App côté serveur
  → HubSpot CRM API 2026-03
  → Companies → Contacts → Deals → activités / tâches / meetings
```

La session de prospection récupère les tâches directement associées à l’entreprise ainsi que celles rattachées à tous ses contacts associés. Les états `Gagné` et `Perdu` sont exclus de la session active.

La session OAuth est chiffrée dans un cookie HttpOnly, `SameSite=Lax`, sécurisé en production. Le refresh token permet de renouveler automatiquement l’access token expiré. Les réponses `429` HubSpot sont retentées avec un délai borné.
