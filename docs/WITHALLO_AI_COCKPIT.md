# IA Allo dans le Sales Cockpit

## Fonctionnalités

### CRM → Fiche contact / entreprise

Un panneau de synthèse Allo apparaît dans l'onglet **Vue d'ensemble** et un onglet complet **IA Allo** est ajouté à la fiche.

- Résumé Allo, transcription et suggestions d'actions, avec lien vers l'appel complet.
- Recherche textuelle dans les analyses des appels affichés.
- Association d'un appel par **numéro externe exact au format E.164**, jamais par le numéro de ligne Gando.
- Sur les entreprises, les numéros sont pris sur l'entreprise et sur les contacts liés dans le miroir Supabase.
- Réactualisation après un appel terminé (8 s puis 35 s), pour laisser Allo produire le résumé.
- Pour une action identifiée, bouton **Préparer une relance** qui ouvre le formulaire AE/CSM, sans créer la tâche automatiquement.

### Téléphonie → Appels

Un outil **Recherche dans l'IA Allo** interroge l'API officielle de recherche des conversations pour retrouver des appels par expressions présentes dans les résumés et transcriptions. Il retourne les appels autorisés et les extraits disponibles.

**Important :** ce n'est pas un chatbot génératif ; les résultats et les suggestions proviennent réellement d'Allo. Le Cockpit ne déduit pas de réponses à partir de faits absents de l'appel.

### Relances → Validation humaine

Le lien depuis une recommandation Allo transmet uniquement l'ID de l'appel, son index d'action, la fiche CRM cible et la catégorie AE/CSM. Aucune transcription ni résumé ne passe dans l'URL.

La page Relances récupère alors le détail de l'appel depuis l'API Cockpit sécurisée, préremplit l'objet et le contexte, puis laisse l'utilisateur **vérifier, corriger, fixer une échéance, choisir le responsable et valider la création** de la tâche HubSpot. Aucun message n'est envoyé aux prospects automatiquement.

## Permissions et limites

- Les routes exigent une session Cockpit.
- Pour les utilisateurs non administrateurs, **seuls les appels appartenant à leur compte Allo** peuvent être affichés. L'autorisation sur le détail est revérifiée côté serveur via `getAuthorizedAlloCall`.
- La clé `WITHALLO_API_KEY` reste sur le serveur. Il faut au minimum la lecture des conversations (`CONVERSATIONS_READ`).
- Les résultats de la fiche CRM sont limités aux **100 derniers appels** accessibles dans l'historique Allo existant et aux 8 plus récents correspondant au numéro. Les comptes à fort volume peuvent ne pas y trouver les anciens échanges.
- Les numéros invalides ou absents n'ouvrent jamais l'historique général des appels depuis une fiche CRM.
- Une correspondance téléphonique ne prouve pas à elle seule l'identité : vérifier la fiche et l'action avant de créer une relance.
- L'API Allo peut ajouter ou modifier le résumé après la fin de l'appel ; recharger l'onglet pour voir la dernière version.

## Scénarios de recette

1. Depuis une fiche contact disposant d'un numéro connu, ouvrir **IA Allo**, vérifier le dernier appel et son résumé.
2. Depuis une fiche entreprise avec plusieurs contacts, vérifier que les appels visibles correspondent aux numéros liés.
3. Sur un appel appartenant à un autre utilisateur, vérifier que le résumé, la transcription et l'enregistrement ne sont pas accessibles en tant que commercial.
4. Choisir une action Allo → **Préparer une relance** ; vérifier que le formulaire AE/CSM possède le bon contact ou la bonne entreprise, l'action, le contexte et l'échéance, puis **ne créer que sur validation**.
5. Sur une fiche sans numéro, vérifier qu'aucun appel de l'équipe n'est affiché.
6. Dans **Téléphonie → Appels**, chercher une expression réellement prononcée dans une transcription et ouvrir l'appel associé.
7. Vérifier l'état d'erreur en cas de clé Allo absente ou de scope insuffisant.

Documentation Allo : https://www.withallo.com/fr/api et https://www.withallo.com/integrations/custom-crm
