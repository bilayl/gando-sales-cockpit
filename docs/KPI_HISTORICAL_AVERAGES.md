# KPI — « Données » : moyennes historiques depuis le début

## Page

- Accès : \`/kpi/data\` → section **Moyennes depuis le début** puis **Historique mensuel — tous les indicateurs**.
- Source : les mêmes \`/api/kpi\` / \`kpi_monthly_metrics\` et \`getGandoMonthlySourceMetrics\` que le reste du Cockpit.
- Une valeur \`null\` est absente ; un vrai zéro est pris en compte dans les moyennes de volumes.
- Les mois futurs déjà configurés dans les tableaux financiers sont exclus, même si leur ligne contient une valeur.
- Le compteur « n / x mois exploitables » exprime la couverture de chaque indicateur. Si les mois nécessaires ne sont pas renseignés, l'interface affiche « — ».

## Définition des huit indicateurs

1. **MAU moyen** : somme des MAU mensuels / nombre de mois dont le MAU est renseigné. Le MAU est le nombre de loueurs actifs **du mois**, pas une base de loueurs distincts sur toute la vie de Gando.
2. **Cautions / MAU** : somme des cautions activées / somme des MAU, sur les mois comportant les deux mesures avec MAU strictement positif.
3. **ARPU** : somme du CA / somme des MAU, sur ces mêmes types de mois appariés. C'est un ARPU mensuel pondéré.
4. **Caution moyenne** : somme du TDV / somme des cautions activées, pour les mois où les deux mesures existent et le nombre de cautions est positif.
5. **Take rate** : somme du CA / somme du TDV sur les mois comparables dont le TDV est positif.
6. **Taux d'encaissement** : somme des \`deposit_cashouts\` / somme des cautions activées sur les mois appariés. **Attention :** dans la source actuelle, \`deposit_cashouts\` représente des captures marquées \`paid\`, qui ne sont pas dédupliquées par identifiant de caution. Le taux est un ratio opérationnel, **pas** un taux de cautions distinctes ayant subi un encaissement. Il peut aussi varier en raison du décalage de mois entre activation et capture.
7. **Taux de garantie** : somme des \`advanced_guarantee_amount\` / somme des \`cashout_amount\` des mêmes mois, où le montant encaissé est positif. Il s'agit d'une **part des avances garanties en montant**, pas du taux de cautions éligibles à une assurance ou couvertes par un contrat. Les décalages de dates peuvent affecter ce ratio.
8. **Montant moyen encaissé** : somme des \`cashout_amount\` / somme des \`deposit_cashouts\` des mêmes mois avec nombre d'opérations positif.

La moyenne des taux mensuels n'est jamais utilisée pour les taux pondérés : les montants et volumes sont agrégés avant division. Aucune donnée de risque manquante n'est remplacée artificiellement par zéro.

## Table et export

La rubrique « Données » expose les **14 colonnes** de valeurs mensuelles sources et dérivées (CA, TDV, cautions, MAU, cautions/MAU, ARPU, montant moyen, take rate, captures, montant encaissé, taux d'encaissement, encaissement moyen, avances garanties, taux de garantie). Le CSV exporte les taux sous forme numérique en points de pourcentage.

Les statistiques historiques ont vocation à être recalculées à chaque actualisation de la source. Aucune valeur constante n'est codée en dur dans le tableau de bord.

## Contrôles à réaliser

- Les mois antérieurs avec certains champs absents doivent s'afficher avec des tirets, sans être traités comme des zéros.
- Un mois futur saisi à l'avance ne doit pas compter.
- ARPU, cautions/MAU, caution moyenne, take rate et ratios de risque n'utilisent que les mois avec numérateur et dénominateur présents.
- Un MAU à zéro, sans cautions, peut contribuer à une moyenne mensuelle du MAU, mais pas à un ratio cautions/MAU.
- Si l'encaissement est présent sur un mois mais pas le nombre de captures, le montant moyen encaissé n'est pas calculé pour ce mois.
