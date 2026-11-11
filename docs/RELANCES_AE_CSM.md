# Relances AE / CSM dans le Sales Cockpit

## Objectif

Un écran **Relances** (`/relances`), distinct de **Ma journée SDR** et de la liste générique **Tâches**, pour suivre les engagements commerciaux et clients :

- **AE** : devis, négociations, décisions en attente, validation de l'intégration.
- **CSM** : onboarding, activation, adoption, incidents, suivi de satisfaction, renouvellements.

Tous les utilisateurs du Cockpit peuvent le consulter, sans restriction au rôle SDR. Le responsable peut être un membre actif du Cockpit, qu'il soit AE, CSM ou autre rôle.

## Source des données

Chaque relance est une **tâche native HubSpot**, liée au contact ou à l'entreprise sélectionnée avec l'association HubSpot habituelle (contact 204, entreprise 192). Aucune base parallèle de relances n'est créée.

- Les relances créées depuis cet écran sont préfixées `[AE]` ou `[CSM]` dans le sujet HubSpot. Le titre présenté dans le Cockpit masque ce préfixe.
- L'affectation utilise les mécanismes existants de tâches HubSpot / `cockpit_task_assignee`; elle fonctionne même quand un membre n'a pas de propriétaire HubSpot correspondant.
- Les notes, dates, priorités et statuts sont conservés dans HubSpot.
- Les anciennes tâches sans préfixe restent accessibles via **Autres tâches HubSpot** (elles ne sont pas arbitrairement reclassées en AE/CSM).

## Utilisation

1. Ouvrir **CRM → Relances**, ou **Relance AE/CSM** depuis une fiche contact / entreprise.
2. Sélectionner AE ou CSM, rechercher la fiche HubSpot à associer si nécessaire.
3. Renseigner titre, contexte, échéance, canal, priorité et responsable ; enregistrer.
4. Filtrer par période, équipe, responsable ou recherche textuelle.
5. Marquer la relance terminée, la rouvrir, modifier son responsable ou la reporter : la modification est envoyée directement à HubSpot.

La page parcourt les tâches HubSpot par **pages de 100** et propose « Charger les suivantes ». Les compteurs en haut sont calculés sur les relances AE/CSM **déjà chargées** et ne constituent pas des indicateurs globaux indépendants des filtres.

La recherche de contact / entreprise reprend `/api/crm/search`, dont la source principale est le répertoire Cockpit. Une synchronisation HubSpot trop ancienne peut donc retarder l'apparition de certaines fiches dans le sélecteur.

## Vérification recommandée

- Créer une relance AE sur une entreprise et une relance CSM sur un contact.
- Vérifier que chacune apparaît dans les tâches HubSpot de la fiche correspondante.
- Réassigner à un utilisateur Cockpit distinct et contrôler l'affectation au rechargement.
- Reporter puis terminer une relance ; recharger la page et vérifier l'état.
- Contrôler les filtres **En retard**, **Aujourd'hui**, **À venir** et **Terminées**.
- Depuis une fiche entreprise ou contact, cliquer **Relance AE/CSM** et vérifier que la bonne fiche est pré-sélectionnée.

Aucun message ni email automatique n'est envoyé à un prospect lors de la création, du report ou de la clôture d'une relance : il s'agit d'un suivi de tâches et d'échéances.
