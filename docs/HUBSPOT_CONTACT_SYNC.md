# Synchronisation HubSpot → Sales Cockpit

## Fonctionnement

- **Webhooks (temps réel)** : réception des événements `contact.creation`, `contact.propertyChange` et `contact.restore` sur `/api/hubspot/webhooks`; vérification obligatoire de la signature HubSpot v3 avant toute écriture.
- **Secours** : GitHub Actions essaie d'actualiser les contacts toutes les 5 minutes et conserve la synchronisation complète toutes les 30 minutes. La planification GitHub Actions peut être retardée : ne pas la considérer comme temps réel.
- **Lecture à la demande** : les fiches absentes dans Supabase sont récupérées depuis HubSpot dès l'ouverture du détail. Les recherches dans le répertoire consultent aussi HubSpot (sans altérer les fiches existantes).
- **Supervision** : `/api/sync/status` affiche la dernière exécution et les erreurs dans l'écran Contacts. Un retard supérieur à 15 minutes affiche une alerte.

## Activation côté HubSpot (nécessaire pour le temps réel)

Dans les paramètres de l'application développeur HubSpot connectée à Gando, activer les Webhooks, avec l'URL publique `https://gando-sales-cockpit-web.vercel.app/api/hubspot/webhooks` (ou la véritable URL de production utilisée par le Cockpit), puis ajouter les abonnements `contact.creation` et `contact.propertyChange` (et `contact.restore` si disponible).

L'application doit disposer de `HUBSPOT_CLIENT_SECRET` côté serveur. La validation v3 emploie ce secret, la méthode POST, l'URL publique exacte, le corps brut et l'horodatage. Si HubSpot envoie les événements sur une URL différente de l'URL vue par le serveur (reverse proxy, alias), définir `HUBSPOT_WEBHOOK_PUBLIC_URL` à l'URL **exacte** déclarée dans HubSpot. **Ne jamais mettre ce secret dans le code ou dans le navigateur.**

Après l'activation, créer puis modifier un contact test dans HubSpot, vérifier sa présence dans la table `contacts` et vérifier l'horodatage `hubspot_sync_state`. En cas d'erreur de signature, contrôler d'abord l'URL et l'horodatage reçus.

## Vérifications de recette

1. Rechercher par email un contact créé après la dernière tâche planifiée, depuis l'annuaire Contacts ou la recherche globale : le résultat HubSpot doit apparaître.
2. Ouvrir sa fiche : le contact doit être hydraté dans Supabase, sans écraser une fiche déjà existante.
3. Utiliser le bouton Synchroniser, puis vérifier l'indicateur de statut. Le bouton ne synchronise désormais que les contacts, évitant les mises à jour longues et inutiles.
4. Vérifier les exécutions GitHub du workflow `HubSpot Sync` et les délais réels (les déclenchements planifiés restent approximatifs).
5. Confirmer la réception d'un webhook signé en production.

Aucune inscription webhook n'est effectuée automatiquement : elle doit être activée dans l'application HubSpot connectée.
