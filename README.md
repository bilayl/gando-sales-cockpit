# Gando Cockpit

Le Cockpit regroupe les outils internes Gando (CRM, Dealroom, KPI et Design) dans une même application Next.js.

## Développement

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Cockpit

La page `/` est le lanceur d’applications. Les URLs des produits peuvent être configurées avec :

- `GANDO_CRM_URL`
- `GANDO_DEALROOM_URL`
- `GANDO_KPI_URL`
- `GANDO_DESIGN_URL`

En l’absence de configuration, les routes locales du monorepo sont utilisées.

## KPI

`/kpi` est l’espace de pilotage business. Les données mensuelles sont persistées dans Supabase et alimentent un simulateur basé sur les moyennes historiques.

## Design & Brand Book

- `/design` : espace Design authentifié du Cockpit.
- `/design/brand` : Brand Book interne.
- `/brand` : Brand Book public, sans authentification, destiné aux partenaires avec téléchargement des variantes SVG et palette officielle.

La future URL publique du Brand Book peut être fournie via `GANDO_BRAND_URL` (par exemple un sous-domaine dédié). Sans configuration, le partage utilise `/brand` sur le domaine courant.
