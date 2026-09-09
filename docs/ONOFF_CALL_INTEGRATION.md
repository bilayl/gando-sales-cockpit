# Intégration téléphonie Onoff — Gando Cockpit

## Architecture cible

Gando orchestre la prospection et Onoff exécute la téléphonie.

1. Le Cockpit sélectionne les prospects joignables selon leur fuseau horaire.
2. L'appel est lancé via le webphone Onoff embarqué ou Onoff Click2Call.
3. Onoff envoie les événements CDR / RECORDING vers `/v1/onoff/cdr`.
4. Gando vérifie le `call_id` auprès de l'API Onoff avant de modifier une session commerciale.
5. Le prospect correspondant passe de `QUEUED` à `CALLED` avec le résultat de l'appel.
6. Les enregistrements et transcriptions poursuivent le pipeline de résumé et de synchronisation HubSpot.

## API Onoff directe

La clé Onoff reste exclusivement côté serveur dans Supabase Vault.

Le module `lib/onoff.ts` centralise les appels directs à `https://public-apigateway.onoffapp.net/api/v1` avec l'en-tête `X-API-Key`.

Le premier usage activé dans le Cockpit est la récupération directe des métadonnées d'un appel via :

`GET /api/v1/calls/:callId/logs`

Le statut interne `/api/onoff/status` vérifie la configuration et, lorsqu'un call ID existe, confirme que Gando peut relire cet appel directement auprès d'Onoff.

## Appel sortant

L'API publique Onoff utilisée par Gando sert actuellement à la gestion et à la lecture des données téléphoniques, notamment des call logs et métadonnées. Le Cockpit ne suppose donc pas l'existence d'un endpoint public de démarrage d'appel.

Le média de l'appel reste assuré par :

- le webphone Onoff dans `/phone` lorsque l'iframe est autorisée ;
- Onoff Click2Call / le gestionnaire `tel:` en fallback.

Si Onoff fournit ultérieurement un SDK ou endpoint privé permettant d'initier et transporter l'appel dans une application tierce, il devra être ajouté côté serveur sans exposer la clé API au navigateur.

## Sécurité

- jamais de clé Onoff dans le client React ;
- vérification du call ID par l'API avant mise à jour commerciale ;
- webhook utilisé comme signal temps réel, pas comme source de confiance unique ;
- HubSpot reste le CRM de référence.
