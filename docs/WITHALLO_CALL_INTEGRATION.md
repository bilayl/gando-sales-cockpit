# Allo dans le Gando Sales Cockpit

> Statut au 8 septembre 2026 : connexion API et envoi vers le Power Dialer implémentés sur la branche `codex/allo-sidebar-call-window`. Le retour par webhooks reste l'étape suivante.

## Principe

Le Cockpit reste le cerveau commercial : il décide **qui appeler, pourquoi, dans quel ordre et à quel moment**. Allo est la couche téléphonie : **Power Dialer, appels et données de conversation**. HubSpot reste la source de vérité CRM.

Un prospect n'entre dans une session appelable que s'il est entre **08:00 inclus et 19:00 exclu dans son propre fuseau horaire**, du lundi au vendredi. Si le fuseau est inconnu, le contact n'est pas envoyé dans la file d'appel.

## API Allo utilisée

Documentation officielle :

- `GET https://api.withallo.com/v2/api/me` : vérification de la clé, des scopes, du workspace et des limites ;
- `POST https://api.withallo.com/v2/api/dialing-queues/current/numbers` : ajout de numéros à la file Power Dialer courante ;
- authentification : `Authorization: Api-Key <clé>` ;
- scope nécessaire au Power Dialer : `DIALING_QUEUE_READ_WRITE`.

Références :

- https://help.withallo.com/en/v2/api-reference/introduction
- https://help.withallo.com/en/v2/api-reference/users/me
- https://help.withallo.com/en/v2/api-reference/dialing-queues/append-numbers
- https://help.withallo.com/en/v2/api-reference/guides/authentication

## Variables serveur

La variable recommandée dans Vercel est :

```text
WITHALLO_API_KEY=ak_live_...
```

Le client accepte également `ALLO_API_KEY` comme alias de compatibilité. La clé ne doit jamais être préfixée par `NEXT_PUBLIC_`.

Variables optionnelles :

```text
WITHALLO_QUEUE_EMAIL=commercial@entreprise.com
WITHALLO_BASE_URL=https://api.withallo.com
```

Sans `WITHALLO_QUEUE_EMAIL`, Allo ajoute les numéros à la file de l'utilisateur propriétaire de la clé API. Avec cette variable, le Cockpit cible la file du membre Allo correspondant à cet email.

## Ce qui est déjà implémenté

### 1. Client API serveur

`lib/withallo.ts` :

- lit la clé uniquement côté serveur ;
- utilise le format d'authentification officiel Allo ;
- vérifie la connexion avec `/v2/api/me` ;
- ajoute des numéros au Power Dialer ;
- déduplique les numéros ;
- envoie les grosses files par lots ;
- renvoie des erreurs nettoyées sans exposer la clé.

### 2. Vérification de connexion

`GET /api/allo/status` retourne uniquement des informations sûres :

- clé configurée ou non ;
- connexion valide ou non ;
- workspace Allo ;
- scopes disponibles ;
- disponibilité du Power Dialer, des conversations et des webhooks.

La page **Paramètres** effectue aussi cette vérification côté serveur et affiche l'état de l'intégration Allo.

### 3. Envoi manuel protégé

`POST /api/allo/dialing-queue` permet d'ajouter une liste de numéros à Allo depuis une route authentifiée du Cockpit.

### 4. Envoi automatique d'une session Gando

Lors de la création d'une session d'appels :

1. Gando filtre les prospects selon les règles commerciales ;
2. Gando recalcule leur heure locale ;
3. seuls les prospects `callNow=true`, donc entre 08:00 et 19:00 localement, sont retenus ;
4. la session est créée dans Supabase ;
5. les numéros et métadonnées utiles sont ajoutés à la file Power Dialer Allo ;
6. la création de la session Gando reste fonctionnelle même si Allo est momentanément indisponible ; la réponse contient alors un état `withAllo.queued=false` et une erreur sûre.

Métadonnées envoyées lorsqu'elles existent : prénom, nom, entreprise, poste, email et site web.

## Flux actuel

```text
Prospection Gando
  -> filtres / score / attribution
  -> contrôle du fuseau
  -> 08:00–19:00 heure locale uniquement
  -> création session Gando
  -> POST Allo Power Dialer
  -> appel depuis Allo
```

## Étape suivante : boucle de retour

La prochaine étape est de connecter les webhooks Allo afin que le Cockpit reçoive les événements d'appel et puisse :

- identifier l'appel terminé ;
- récupérer les données de conversation disponibles ;
- rapprocher l'appel de l'item de session Gando ;
- préremplir le résultat d'appel ;
- synchroniser l'information utile vers HubSpot ;
- passer au prochain prospect encore dans la fenêtre locale 08:00–19:00.

Avant de coder cette partie, les types d'événements et la vérification de signature doivent être repris directement depuis la documentation officielle Allo courante.

## Règle d'architecture

**Gando = orchestration commerciale et intelligence de priorité.**  
**Allo = moteur téléphonique et données de conversation.**  
**HubSpot = source de vérité CRM.**
