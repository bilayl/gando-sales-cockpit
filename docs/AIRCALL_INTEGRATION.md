# Aircall — intégration native du CRM Gando

## Fonctionnement

- Gando authentifie chaque commercial puis cherche **son propre compte Aircall** par adresse e-mail.
- Le composeur embarqué Aircall Everywhere SDK v2 permet d'afficher Workspace et de préremplir le numéro depuis une fiche.
- Le bouton « Appeler maintenant » appelle `POST /api/aircall/dial`, qui envoie une vraie requête `POST /v1/users/:id/calls` à Aircall. L'API démarre l'appel côté agent, sous réserve de sa disponibilité.
- Après l'appel, le webhook Aircall écrit les détails dans `aircall_calls` (idempotent via `call_id`) ; l'historique du Cockpit lit cette table.
- Les clés API sont exclusivement côté serveur. Aucune clé dans React, ni dans GitHub.

## Activation

1. Dans Aircall Dashboard > Integrations / API Keys, générer un **API ID** et un **API token** (compte Gando uniquement).
2. Dans Vercel, configurer `AIRCALL_API_ID` et `AIRCALL_API_TOKEN` comme variables chiffrées serveur.
3. Associer une adresse e-mail Aircall à chaque utilisateur du Cockpit. Le contrôle du serveur empêche un utilisateur de déclencher un appel sur le compte Aircall d'un collègue.
4. Dans Aircall Dashboard, créer un webhook vers `https://room.gando.pro/api/aircall/webhook`, événements `call.ended`, `call.tagged`, `call.commented`, `call.comm_assets_generated`. Copier son **token** dans `AIRCALL_WEBHOOK_TOKEN` sur Vercel.
5. Appliquer la migration `20261104130000_add_aircall_calls.sql` à Supabase ; vérifier les RLS et l'accès `service_role`.
6. Vérifier `/settings/integrations` puis passer un appel réel depuis une fiche CRM, contrôler le résultat et l'historique après `call.ended`.

## Notes

- Pour appeler un contact, son numéro doit être au format **E.164** (ex. +336..., +590690...). Ne pas convertir automatiquement les 06/07 : les DOM ne partagent pas l'indicatif +33.
- Si plusieurs numéros Aircall sont attribués à l'agent, choisir explicitement la ligne dans le composeur.
- Ne pas déduire un « appel réussi » à partir du succès de l'API : seule la notification Aircall peut confirmer sa fin.
- Les anciennes données de téléphonie sont conservées dans Supabase pour éviter une suppression irréversible de données d'historique ; leurs routes et composants Gando ne sont plus utilisés.
