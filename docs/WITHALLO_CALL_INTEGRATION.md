# POC — Allo dans le Gando Sales Cockpit

> Statut : architecture de test. Documentation publique Allo vérifiée le 8 septembre 2026. Avant de brancher la production, valider les schémas exacts dans l'OpenAPI Allo courant.

## Objectif

Le Cockpit doit rester le cerveau commercial : il décide **qui appeler, pourquoi, dans quel ordre et à quel moment**. Allo devient la couche téléphonie : **Power Dialer, appel, enregistrement, transcription et résumé**.

La règle de timing Gando est simple : un prospect n'entre dans une session appelable que s'il est entre **08:00 et 19:00 dans son propre fuseau horaire**, du lundi au vendredi. Si le fuseau est inconnu, le contact n'est pas placé dans la file d'appel.

## Responsabilités

### Gando Cockpit

- source la liste depuis HubSpot / Supabase ;
- applique owner, filtres, score et priorités ;
- résout le fuseau du prospect ;
- bloque les appels hors 08:00–19:00 heure locale ;
- construit la session commerciale ;
- conserve le statut de la session et le résultat commercial ;
- pousse uniquement les numéros éligibles vers Allo.

### Allo

- exécute la file Power Dialer ;
- passe les appels ;
- enregistre et transcrit les conversations selon la configuration du workspace ;
- produit les résumés IA ;
- renvoie les événements d'appel au Cockpit via webhook.

### HubSpot

HubSpot reste la source de vérité CRM. Une intégration Allo ne doit pas créer un deuxième pipeline commercial parallèle.

## Flux cible

```text
Prospection Gando
  -> filtres / owner / score
  -> contrôle du fuseau du prospect
  -> autorisé uniquement entre 08:00 et 19:00 localement
  -> création de la session Gando
  -> push des numéros vers la file Power Dialer Allo
  -> appels dans Allo
  -> webhook Allo call.triggered / call.answered / call.completed
  -> rapprochement avec le contact + l'item de session Gando
  -> résultat, durée, résumé, transcription, recording URL
  -> mise à jour Cockpit / HubSpot
```

## API Allo à tester

La documentation publique Allo expose notamment :

- authentification par clé API côté serveur ;
- `GET /v2/api/me` pour vérifier la clé, les scopes et les limites ;
- les conversations et données d'appels ;
- les webhooks temps réel ;
- les files d'appel du Power Dialer, avec lecture de la file courante, ajout de numéros et lecture d'une session ;
- les événements `call.triggered`, `call.answered` et `call.completed` ;
- sur `call.completed`, les données de fin d'appel peuvent inclure résumé, transcription et enregistrement.

Références :

- https://www.withallo.com/fr/api
- https://help.withallo.com/en/v2/api-reference/introduction
- https://help.withallo.com/en/integrations/webhooks
- https://help.withallo.com/en/features/power-dialer

> Attention : certaines pages publiques Allo ne présentent pas exactement le même préfixe de route pour les webhooks. Ne pas figer un endpoint à partir d'un exemple marketing : utiliser l'OpenAPI du workspace/API courant comme référence avant l'implémentation.

## Variables serveur prévues

```text
ALLO_API_KEY=...
ALLO_WEBHOOK_SECRET=...
ALLO_BASE_URL=https://api.withallo.com
```

`ALLO_API_KEY` et `ALLO_WEBHOOK_SECRET` doivent rester exclusivement côté serveur et ne jamais être préfixées par `NEXT_PUBLIC_`.

## POC recommandé

### Étape 1 — Connexion en lecture seule

1. Ajouter une route serveur de statut.
2. Appeler `GET /v2/api/me`.
3. Afficher dans Paramètres : `Allo connecté`, scopes disponibles et erreur éventuelle.

Critère de succès : le Cockpit peut vérifier la connexion sans exposer la clé au navigateur.

### Étape 2 — Envoyer une session vers le Power Dialer

Depuis une session Gando :

1. garder uniquement les contacts `callNow=true` ;
2. normaliser les téléphones en E.164 ;
3. pousser la file vers le Power Dialer Allo ;
4. conserver côté Gando la correspondance entre session, contact et numéro ;
5. afficher un état `Prêt dans Allo` plutôt qu'un simple lien téléphonique.

Le Cockpit doit rester maître de l'ordre de priorité. Allo ne doit recevoir que la file déjà qualifiée par Gando.

### Étape 3 — Webhook de retour

Créer un endpoint serveur du type :

```text
POST /api/integrations/allo/webhook
```

Traitement minimum :

- vérifier la signature avec le secret webhook et le body brut ;
- dédupliquer les événements, car Allo documente une livraison au moins une fois ;
- répondre rapidement en `200` puis traiter la persistance ;
- sur `call.triggered` : passer l'item en cours ;
- sur `call.answered` : mémoriser qu'il y a eu connexion ;
- sur `call.completed` : marquer l'appel terminé et stocker les données utiles ;
- rapprocher le contact par identifiant connu ou numéro E.164, jamais par nom seul.

### Étape 4 — Boucle commerciale

Une fois `call.completed` reçu :

- préremplir le résultat d'appel dans le Cockpit ;
- rendre le résumé et la transcription consultables depuis la fiche ;
- proposer la prochaine action : rendez-vous, rappel, email, qualification ou sortie ;
- synchroniser le résultat utile vers HubSpot ;
- passer automatiquement au prochain prospect encore dans la fenêtre locale 08:00–19:00.

## Comportement attendu lorsque l'heure change

Le contrôle du fuseau ne doit pas être fait uniquement au moment de créer la session. Avant de lancer le prospect suivant, le Cockpit doit recalculer `callNow` avec l'heure courante.

Exemple : une file contient un prospect à Tahiti et un en métropole. Chacun est appelable uniquement lorsque **son heure locale** est comprise entre 08:00 inclus et 19:00 exclu. Un prospect qui passe à 19:00 pendant la session doit sortir de la file active et rester disponible pour une session ultérieure.

## Ce que le premier POC ne doit pas faire

- remplacer HubSpot comme CRM ;
- exposer la clé Allo côté client ;
- importer tous les contacts Gando dans Allo sans besoin ;
- appeler automatiquement un prospect hors créneau ;
- considérer un webhook comme livré une seule fois ;
- construire une seconde logique de scoring dans Allo.

## Décision d'architecture

La cible est donc :

**Gando = orchestration commerciale et intelligence de priorité.**  
**Allo = moteur téléphonique et données de conversation.**  
**HubSpot = source de vérité CRM.**

Cela permet d'obtenir une vraie logique d'appel intégrée au Cockpit sans transformer Gando en dialer téléphonique à maintenir en interne.
