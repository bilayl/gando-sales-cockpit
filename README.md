# Gando Sales Cockpit — Vercel V1

Application web autonome inspirée de l'ergonomie Minari, avec **HubSpot comme source de vérité**.

## Ce que contient la V1

- Connexion / première inscription via OAuth HubSpot.
- Session chiffrée en cookie HttpOnly ; access token et refresh token ne sont jamais exposés au JavaScript du navigateur.
- Rafraîchissement automatique du token HubSpot.
- Prospection : onglets de segments HubSpot, filtres, recherche, tableau compact, téléphone cliquable, drawer contact.
- Fiche prospect : entreprise associée, propriétés Gando, notes, appels, meetings.
- Modification des statuts de prospection/appel directement dans HubSpot.
- Segments : liste des segments HubSpot + création d'un segment MANUAL Contacts/Entreprises.
- Agenda : meetings HubSpot.
- Analytics / Historique : structure UI prête pour la V2.
- Design Tailwind + composants façon shadcn/ui + Radix + TanStack Table installé.

## 1. Créer / configurer l'app OAuth HubSpot

Dans HubSpot Developer, crée une app OAuth (pas une UI Extension). Ajoute comme Redirect URL :

```text
http://localhost:3000/api/auth/hubspot/callback
```

En production :

```text
https://sales.gando.app/api/auth/hubspot/callback
```

Scopes demandés par le code :

```text
oauth
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.companies.write
crm.objects.deals.read
crm.objects.deals.write
crm.objects.owners.read
crm.lists.read
crm.lists.write
```

> Les activités (notes, calls, tasks, meetings) peuvent être lues/gérées avec les scopes contacts correspondants selon les endpoints HubSpot actuels.

## 2. Installer

```powershell
npm install
Copy-Item .env.example .env.local
```

Renseigne **toi-même** les variables dans `.env.local`. Ne partage jamais le Client Secret ou les tokens dans un chat.

```text
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/auth/hubspot/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=une-longue-valeur-aleatoire
```

Optionnel pour forcer le portail Gando au moment de l'autorisation :

```text
HUBSPOT_ACCOUNT_ID=147957432
```

## 3. Lancer en local

```powershell
npm run dev
```

Puis ouvre `http://localhost:3000/login` et clique **Continuer avec HubSpot**.

## 4. Déployer sur Vercel

```powershell
vercel link
vercel env add HUBSPOT_CLIENT_ID production
vercel env add HUBSPOT_CLIENT_SECRET production
vercel env add HUBSPOT_REDIRECT_URI production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add SESSION_SECRET production
vercel deploy --prod
```

Pour `sales.gando.app`, configure :

```text
HUBSPOT_REDIRECT_URI=https://sales.gando.app/api/auth/hubspot/callback
NEXT_PUBLIC_APP_URL=https://sales.gando.app
```

et ajoute exactement cette Redirect URL dans l'app OAuth HubSpot.

## Architecture

```text
Navigateur
   ↓
sales.gando.app (Next.js / Vercel)
   ↓ API Routes serveur
HubSpot OAuth + HubSpot CRM API
   ↓
Contacts / Entreprises / Segments / Notes / Calls / Tasks / Meetings
```

Le navigateur ne parle jamais directement à `api.hubapi.com` et ne voit jamais le token HubSpot.

## Important

Cette V1 ne dépend plus de `hubspot.fetch()` ni de `X-HubSpot-Signature-v3`. Le problème HMAC de l'ancienne UI Extension n'existe donc plus dans cette architecture.

## Suite recommandée V2

- vraie DataTable TanStack avec colonnes masquables et vues sauvegardées ;
- appels Onoff / dialer ;
- scorecards setter et dashboard manager ;
- tâches / rappels depuis le drawer ;
- notes de call Windmill structurées ;
- webhooks HubSpot ;
- multi-utilisateurs avec rôles manager/setter ;
- domaine `sales.gando.app`.
