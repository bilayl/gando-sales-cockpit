# Enregistrements Allo dans Gando

## Fonctionnement

- Allo réalise l'enregistrement **dans son infrastructure**, pour les appels éligibles passés ou reçus avec Allo et avec les réglages d'enregistrement du compte.
- Après la fin de l'appel et le traitement Allo (quelques secondes / dizaines de secondes), `GET /v2/api/conversations/items/{id}` affiche les métadonnées, le résumé, la transcription et la présence éventuelle de l'audio.
- Pour lire ou télécharger, Gando utilise `GET /v2/api/conversations/items/{id}/recording` afin d'obtenir un **lien de téléchargement temporaire valable 60 minutes**.
- Les fichiers ne passent **jamais directement via un lien signé dans le navigateur** : la route `/api/withallo/recordings/[id]` vérifie la session Gando, confirme l'identité de l'agent Allo (sauf administrateur), récupère un lien frais côté serveur, puis diffuse le flux audio au navigateur.
- Le lecteur HTML5 est affiché dans **Appels / Historique** et l'onglet **Appels d'une fiche CRM**, via `WithAlloHistoryView`. Les requêtes audio `Range` sont transmises pour permettre la lecture et l'avance dans le fichier.
- Le bouton **Télécharger MP3** fait appel à la même route sécurisée avec `?download=1`.
- Les liens de stockage signés ne sont pas consignés dans les logs, ne sont pas retournés par les endpoints JSON et ne sont pas persistés dans Gando.
- Le navigateur peut rafraîchir le lecteur après un appel terminé ; Gando réactualise les éléments 7 s et 35 s après réception d'un `call_ended` depuis l'iframe.

## Sécurité et accès

- Nécessite `WITHALLO_API_KEY` côté serveur avec scope `CONVERSATIONS_READ`.
- Les commerciaux ne peuvent écouter que leurs appels : l'email du compte Gando doit correspondre à `call.user.email` ou `call.user_email`; un champ manquant est refusé.
- Les administrateurs Gando voient les appels auxquels la clé d'API Allo a accès. **Les permissions propres à Allo sont maintenues** : son API peut refuser un accès à l'audio.
- Seules les URLs HTTPS sur `storage.withallo.com/object/sign/recordings/` sont acceptées côté serveur ; les redirections sont rejetées, tout comme les types inattendus.
- Les réponses audio sont privées et non mises en cache. Si le compte est soumis à une restriction HIPAA ou à l'absence d'enregistrement, l'API Allo peut refuser le téléchargement.
- Les enregistrements restent hébergés chez Allo ; ce lot **ne crée pas de copie dans Supabase ni d'archive indépendante**. Les durées de conservation dépendent donc des réglages et politiques Allo.

## Test manuel sur le compte Gando

1. Vérifier que l'enregistrement des appels est activé dans Allo et que les utilisateurs sont informés conformément au droit applicable.
2. Effectuer un appel test à partir du **composeur Allo** (pas du numéroteur natif du téléphone), avec un interlocuteur averti.
3. Terminer l'appel, puis ouvrir **room.gando.pro/phone** (ou la fiche contact, onglet Appels).
4. Actualiser et vérifier que l'appel apparaît, avec la synthèse / transcription si disponibles.
5. Cliquer sur **Écouter l'enregistrement** : le lecteur doit se charger sans ouvrir de domaine externe.
6. Vérifier la lecture, l'avance dans la piste et le téléchargement.
7. Vérifier qu'un commercial distinct obtient un refus d'accès, et qu'un appel non enregistré montre « aucun enregistrement ».

## Documentation officielle

- https://help.withallo.com/en/features/call-recordings
- https://help.withallo.com/en/v2/api-reference/conversations/get-item
- https://help.withallo.com/en/v2/api-reference/conversations/get-item-recording

## Points de vigilance

- L'API retourne des liens temporaires ; la route serveur demande un nouveau lien à chaque requête, y compris pour la lecture partielle et le téléchargement.
- L'enregistrement n'est pas activé par Gando : l'utilisateur configure la politique d'enregistrement dans Allo.
- L'archivage indépendant à long terme, s'il est demandé, nécessite un compartiment Supabase **privé**, une politique explicite de conservation/suppression et une autorisation juridique adaptée, et devrait être traité comme une fonctionnalité distincte.
