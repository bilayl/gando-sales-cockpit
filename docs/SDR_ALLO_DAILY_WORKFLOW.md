# Parcours quotidien SDR — Gando × Allo × HubSpot

## 1. Ma journée SDR

Accès depuis la sidebar : `/sdr`.

- Charge les tâches HubSpot non terminées, en retard ou dues aujourd'hui.
- Les tâches sont triées par échéance ; statut, priorité, contact, société et numéro sont repris du CRM.
- Le SDR peut appeler depuis la tâche avec le composeur Allo, ouvrir la fiche CRM ou la marquer terminée.
- Le bouton de complétion est protégé côté serveur : seuls l'assigné du Cockpit / le propriétaire HubSpot reconnu et les administrateurs sont autorisés.
- Les administrateurs peuvent basculer de « Mes tâches » à « L’équipe ».
- La prospection existante (file prioritaire de sociétés, « prospect suivant ») reste disponible et est liée depuis cette page.

**Limites :** le tableau du jour consulte jusqu'à 400 tâches HubSpot par actualisation ; si des pages restent, l'affichage signale qu'il peut être partiel. Une tâche n'est pas créée par le simple fait qu'un appel se termine.

## 2. Après un appel Allo

Accès : `/phone`, choisir une conversation.

- Résumé, transcription complète (via `GET /v2/api/conversations/items/{id}?extend=transcript`), enregistrement sécurisé et actions détectées.
- L'onglet Actions présente les suggestions explicitement présentes dans la réponse Allo ou dans une rubrique « Actions / Prochaines étapes » du résumé.
- Le SDR choisit une action Allo, une échéance et un type de tâche (rappel, e-mail, RDV, autre). Il confirme pour créer la tâche dans HubSpot.
- Si Allo n'a détecté aucune action explicite, une saisie manuelle est possible. Gando n'invente pas d'actions IA.
- L'assignation reprend l'adresse e-mail du SDR connecté. Lorsque le téléphone correspond à un seul contact dans HubSpot, la tâche lui est associée ; en cas d'ambiguïté, elle reste non associée et l'interface le signale.
- Les tâches sont enregistrées dans HubSpot et l'idempotence est contrôlée par une table Supabase (`sdr_allo_action_tasks`). Cette table est RLS, accessible uniquement par rôle serveur ; aucun accès public.
- **Aucun e-mail n'est envoyé automatiquement**. Le widget d'e-mails post-appel existant reste distinct et demande confirmation avant envoi.

## 3. Appels répondus et transcriptions dans les statistiques

Accès : `/phone/stats`.

- Les quatre métriques d'équipe officielles Allo restent calculées par son API Analytics.
- Une section complémentaire compte les appels avec résultat `ANSWERED` ou `TRANSFERRED`, les appels explicitement non répondus / en messagerie, ceux avec transcription et ceux dont le compte rendu contient une ou plusieurs actions.
- Les résultats inconnus sont comptés séparément, pas attribués artificiellement aux non-répondus.
- Pour les historiques HubSpot, le statut « répondu » repose sur une disposition explicitement connectée ; les transcriptions sont comptées depuis la propriété CRM correspondante. Les actions non disponibles côté HubSpot sont affichées comme indisponibles.
- La lecture détaillée Allo est plafonnée à **400 appels par période** pour maîtriser les appels API. Si l'historique est plus long, le tableau marque le comptage comme partiel. Réduire la période.
- Les deux sources Allo / HubSpot ne sont jamais additionnées, afin d'éviter les doubles comptes.

## 4. Test opérationnel

1. Ouvrir `/sdr` : vérifier les tâches du jour et les droits d'un commercial.
2. Terminer une tâche test via le bouton de l'interface : vérifier le statut HubSpot et la disparition dans la file du jour.
3. Passer un appel consenti avec Allo, terminer la conversation et ouvrir `/phone`.
4. Vérifier que l'appel apparaît sous « Répondu », et que la transcription est affichée si Allo l'a générée.
5. Ouvrir Actions et confirmer une suggestion, avec échéance demain ; vérifier sa création dans HubSpot.
6. Essayer de recréer exactement la même action : Gando doit refuser le doublon.
7. Choisir une période courte dans `/phone/stats` ; comparer le nombre d'appels répondus et la disponibilité des transcriptions avec le compte Allo.
8. Tester les permissions avec deux comptes SDR distincts.

## Configuration

- Allo : clé `WITHALLO_API_KEY` côté Vercel avec permission `CONVERSATIONS_READ` et accès Analytics ; l'Embedded Dialer peut demander une autorisation de domaine par Allo.
- HubSpot : jeton/OAuth valide avec lecture des contacts/tâches et écriture des tâches.
- Supabase : migration `20261105113000_add_sdr_allo_action_tasks.sql` appliquée, table RLS réservée au rôle service.
