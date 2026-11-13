# KPI — Frais de sécurisation, garanties et reste dû par loueur

## Où consulter

**KPI → Loueurs & garanties** (`/kpi/loueurs`).

Tableau filtrable par loueur et période (cumul depuis le lancement ou mois civil à Paris), avec les colonnes :

- **Cautions activées** et volume total.
- **Frais de sécurisation générés** : somme des opérations `client_operations.type=fee` rapprochées d'une caution activée.
- **Garanties acceptées** : dossiers `guarantee_activations.status=accepted` reliés par `capture_id` aux captures et au loueur ; le montant est celui de la capture.
- **Écart brut frais – garanties** : simple indicateur d'exposition, **ni marge nette, ni dette du loueur**.
- **Reste dû confirmé** : somme des créances contractuellement validées, moins les paiements du loueur renseignés. Si toutes les garanties ne sont pas qualifiées, le tableau précise que ce solde est partiel.

## Montant réellement dû

Une garantie acceptée ne crée **pas automatiquement** de créance sur le loueur. Il faut distinguer le sinistre pris en charge, les éventuelles franchises ou pénalités contractuelles et la dette exigible.

Un administrateur peut ouvrir les détails d'une garantie et renseigner :

1. **Montant dû (€)** : montant confirmé contractuellement ou par une facture/décision.
2. **Déjà réglé (€)** : somme effectivement payée par le loueur sur cette créance.
3. **Justification / référence** : identifiant de contrat, facture ou note de décision.

Les informations sont conservées par `capture_id` dans `kpi_loueur_guarantee_receivables`, avec horodatage et auteur de la modification. Elles n'activent pas un prélèvement ou une facture.

Laisser une garantie sans créance renseignée signifie **à qualifier** ; enregistrer `0 €` signifie que le dossier a été examiné et qu'aucun montant n'est mis à la charge du loueur.

## Définitions et limites

- Une caution est **activée** lorsque `start_at` existe, quel que soit son statut final. Le volume utilise `amount_cents`. Les cautions archivées sont exclues.
- Les frais de sécurisation sont des **frais encaissés côté locataire**, rapprochés par client et proximité de date sur **14 jours**, à raison d'une seule opération par caution. Ce rapprochement reste approximatif ; une caution sans opération rapprochée apparaît avec 0 € de frais et un avertissement de qualité.
- Le mois des cautions est celui de `start_at` ; le mois des garanties est celui de l'activation de garantie ou de la date de revue si elle manque. Le solde de créance inclut les paiements connus à date, même lorsque le filtre est mensuel.
- La somme des captures de garantie n'est **pas** une somme nécessairement versée ni une perte nette, et les frais de sécurisation ne sont pas la marge Gando.
- Le modèle de malus proposé (2 %, 4 %, 6 % ou plafonnement à 10 %) n'est **pas activé automatiquement** : ses conditions peuvent varier par contrat. La créance n'existe ici qu'après validation.
- Les utilisateurs disposant de l'accès KPI peuvent consulter le rapport. **Seuls les administrateurs** peuvent confirmer ou mettre à jour les créances.
- L'accès direct depuis le navigateur à la table Supabase est désactivé par RLS et révocation des droits publics. Les écritures passent exclusivement par l'API Cockpit authentifiée.

## Vérifications

- Comparer les frais cumulés d'un loueur avec la valeur déjà affichée dans `/kpi/activated-renters` pour identifier d'éventuels écarts de périmètre.
- Vérifier qu'une garantie refusée n'est jamais comptée comme acceptée.
- Vérifier qu'une garantie acceptée sans créance confirmée affiche « À qualifier », pas « 0 € de dette ».
- Renseigner une créance test sur un environnement non productif : montant confirmé = 400 €, déjà réglé = 100 €, reste dû = 300 € ; recharger et vérifier.
- Un utilisateur non-administrateur doit recevoir `403` sur `POST` ; le serveur vérifie que `capture_id` correspond à une garantie acceptée appartenant au loueur.
- Vérifier la séparation entre les totaux cumulés et les totaux mensuels, ainsi que la qualité du rapprochement des frais.

## Migration

`supabase/migrations/20261113093000_kpi_loueur_guarantee_receivables.sql`. La table a été créée directement dans le projet Supabase Gando et vérifiée vide au déploiement de cette fonctionnalité.
