# Diagnostic Allo — appels depuis le Cockpit

Le Cockpit utilise deux mécanismes Allo différents. Ils ne doivent plus être confondus.

## 1. API Allo v2 — données et Power Dialer

L’API serveur du Cockpit utilise notamment :

- `GET /v2/api/me` : scopes et endpoints disponibles pour la clé ;
- `GET /v2/api/users` : membres du workspace ;
- `GET /v2/api/dialing-queues/current` : file Power Dialer courante ;
- `POST /v2/api/dialing-queues/current/numbers` : ajout de prospects à la file.

Cette API sert à synchroniser les files, les données d’appel, les conversations et les webhooks. La documentation publique actuelle ne décrit pas un endpoint REST général permettant au Cockpit de créer la session média d’un appel sortant et d’y attacher le micro du navigateur.

Le précédent comportement du Cockpit était donc trompeur : il ajoutait bien le prospect à la file Power Dialer puis ouvrait une interface Gando, mais aucune commande ne déclenchait réellement la téléphonie.

## 2. Allo Click-to-Call — déclenchement réel depuis une page web

Allo publie une extension Chrome officielle « Allo - Click to Call ». Elle détecte les numéros sur n’importe quelle page web et permet de lancer l’appel via le compte/numéro Allo de l’utilisateur. Allo permet aussi d’être configuré comme application d’appel par défaut sur desktop.

Le Cockpit s’aligne maintenant sur ce mécanisme :

1. les numéros sont exposés sous forme de liens `tel:` compatibles click-to-call ;
2. le bouton « Appeler avec Allo » utilise le handler `tel:` du navigateur/système ;
3. en parallèle, le prospect est ajouté au Power Dialer via l’API lorsque cette capacité est disponible ;
4. le lancement de l’appel n’est plus bloqué par l’état de la clé API Power Dialer.

Extension officielle :
`https://chromewebstore.google.com/detail/allo-click-to-call/bjjbpnjndjmamflhendfjfefdbpleclk`

## Ce que cela résout

Avec l’extension Allo ou Allo défini comme application d’appel par défaut, le commercial peut déclencher l’appel depuis `/today`, `/prospects` ou une fiche contenant un lien téléphone, sans que Gando affiche une fausse session audio.

L’audio reste pris en charge par le client Allo choisi par l’utilisateur (desktop/mobile/web selon les capacités Allo). Le Cockpit reste l’espace de travail commercial et l’API Allo reste la couche de synchronisation.

## Résolution du membre Allo

1. `WITHALLO_QUEUE_EMAIL` si configuré.
2. Email du membre Cockpit si un utilisateur Allo actif correspond.
3. Si le workspace Allo n’a qu’un seul utilisateur actif, ce membre est ciblé automatiquement.
4. Sinon la file du propriétaire de la clé API est utilisée.

Cette résolution évite `ASSIGNEE_NOT_FOUND` lorsque l’email Cockpit diffère de l’email du membre Allo.

## UX cible

La page `/today` reste le dialer Gando : elle trie les prospects joignables maintenant selon leur priorité, leur attribution Cockpit et leur heure locale (08:00–19:00). Le click-to-call déclenche la téléphonie réelle ; l’API Power Dialer et les futurs webhooks gèrent la synchronisation avant/après appel.
