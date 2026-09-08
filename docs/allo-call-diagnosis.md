# Diagnostic Allo — appels depuis le Cockpit

Le Cockpit utilise l’API Allo v2 côté serveur.

## Ce que l’API publique expose

- `GET /v2/api/me` : scopes et endpoints disponibles pour la clé.
- `GET /v2/api/users` : membres du workspace.
- `GET /v2/api/dialing-queues/current` : file Power Dialer courante.
- `POST /v2/api/dialing-queues/current/numbers` : ajout de prospects à la file.

Le Cockpit appelle désormais `/me` en diagnostic et ne suppose plus qu’une clé API donne accès à un endpoint d’initiation d’appel. `directCallReady` n’est vrai que si Allo retourne explicitement un endpoint d’appel sortant dans `data.endpoints`.

## Résolution du membre Allo

1. `WITHALLO_QUEUE_EMAIL` si configuré.
2. Email du membre Cockpit si un utilisateur Allo actif correspond.
3. Si le workspace Allo n’a qu’un seul utilisateur actif, ce membre est ciblé automatiquement.
4. Sinon la file du propriétaire de la clé API est utilisée.

Cette résolution évite `ASSIGNEE_NOT_FOUND` lorsque l’email Cockpit diffère de l’email du membre Allo.

## UX

La page `/today` sert de vue Dialer Gando : elle trie les prospects joignables maintenant selon leur priorité, leur attribution Cockpit et leur heure locale (08:00–19:00). Le bouton « Appeler avec Allo » ajoute le prospect à la file Power Dialer puis ouvre le client web Allo. Tant qu’Allo n’expose pas à la clé un endpoint d’initiation d’appel, le média vocal est lancé côté client Allo.
