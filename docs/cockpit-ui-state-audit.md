# Audit UI & state — Cockpit Gando

## Point de départ

Le Cockpit mélangeait plusieurs architectures d’interface :

- le CRM utilisait `app/(cockpit)/layout.tsx` avec `AppSidebar` ;
- le KPI recréait son propre `SidebarProvider` et une `KpiAppSidebar` ;
- la Deal Room vivait dans un layout autonome ;
- plusieurs écrans utilisaient leurs propres headers, largeurs et règles responsive ;
- une ancienne `SettingsSidebar` coexistait avec la sidebar CRM alors qu’elle n’était plus nécessaire.

Côté état, plusieurs composants combinaient dans le même fichier :

- état local d’interface ;
- données serveur chargées par `fetch` dans des `useEffect` ;
- filtres de vue stockés en `useState` ;
- cache client maison ;
- mutations suivies d’un rechargement global ou d’un refetch large.

Les zones les plus concernées étaient Prospection, Contacts, la session d’appels, Aujourd’hui et plusieurs widgets KPI.

## Règle cible

| Type d’état | Source de vérité |
| --- | --- |
| Données backend / HubSpot / Supabase / API | TanStack Query |
| Filtres, recherche, vue partageable | URL via nuqs |
| État UI global réellement transverse | Zustand |
| Formulaire/modal temporaire et interaction locale | React local |
| Authentification, permissions, logique métier serveur | inchangées |

## Architecture mise en place

### Layout

Un seul `DashboardLayout` pilote désormais les écrans principaux du Cockpit avec :

- une seule `AppSidebar` ;
- un seul `SidebarProvider` ;
- un header global ;
- un comportement responsive identique ;
- la conservation de l’état réduit/ouvert de la sidebar ;
- une transition légère entre pages.

Les routes KPI et Deal Room ont été déplacées dans le route group `(cockpit)` sans changer leurs URLs publiques.

### Navigation

Navigation principale :

- Accueil
- KPI
- Prospection
- Contacts
- Agenda
- Pipeline
- Paramètres

Les outils secondaires restent accessibles dans un groupe discret.

### TanStack Query

Fondation :

- `lib/query/query-client.ts`
- `lib/query/query-keys.ts`
- `components/providers/cockpit-providers.tsx`

Hooks introduits :

- `useCompanies()`
- `useContacts()`
- `useSegments()`
- `useOwners()`
- `useCurrentCockpitUser()`
- `useProspectionAssignments()`
- `useProspectionSessionData()`
- `useKpiScorecard()`
- `useKpiLiveBusiness()`
- `useKpiDecisionIntelligence()`
- `useTodayDashboard()`

Les mutations de synchronisation, attribution, résultat d’appel et clôture de tâche utilisent désormais TanStack Query sur les parcours migrés, avec invalidation ciblée et mise à jour de cache lorsque pertinente.

### Zustand

Stores spécialisés :

- `stores/ui-store.ts` : sidebar, menu de commande, modal globale ;
- `stores/prospection-store.ts` : session active, sélection, mode d’appel, index ;
- `stores/preferences-store.ts` : préférences d’affichage persistables.

Les données serveur ne sont pas persistées dans Zustand.

### nuqs

Les paramètres importants de Prospection et Contacts sont maintenant synchronisés avec l’URL :

- recherche ;
- segment ;
- vue table/pipeline ;
- file de travail ;
- propriétaire ;
- statut d’appel ;
- localisation ;
- statut de prospection ;
- taille de flotte.

Le sous-écran KPI est également représenté dans l’URL avec `?view=`.

## Effets supprimés ou simplifiés

Les chargements serveur par `useEffect + fetch + setState` ont été retirés des vues migrées :

- base Entreprises ;
- base Contacts ;
- préparation de session de prospection ;
- Today dashboard ;
- CEO scorecard ;
- croissance KPI ;
- tendances KPI.

Les effets conservés servent à des systèmes externes ou temporels : horloge d’évaluation, événements localStorage, rafraîchissement périodique.

## UI réutilisable

Composants ajoutés :

- `DashboardLayout`
- `DashboardHeader`
- `PageHeader`
- `Stat`
- `ChartContainer`
- `Section`
- `EmptyState`
- `DataTable`

La direction visuelle utilise une palette plus neutre, des séparateurs fins, moins de cartes, des ombres minimales et l’accent Gando de façon ponctuelle.

## Compatibilité préservée

La migration ne change pas :

- les routes API ;
- l’authentification ;
- les permissions ;
- les appels HubSpot côté serveur ;
- Supabase ;
- les calculs KPI ;
- les règles de prospection ;
- les données historiques.

## Migration restante recommandée

Cette PR constitue la fondation et migre les parcours à plus fort trafic. Les écrans métier plus spécialisés peuvent ensuite adopter progressivement les hooks Query et les primitives UI partagées, sans réécriture globale. En particulier : certains sous-modules KPI, Agenda, Sourcing, historique et écrans de détail conservent encore leur logique locale existante tant qu’elle n’est pas une source de duplication critique.
