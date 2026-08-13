# Validation effectuée

- Structure Next.js App Router vérifiée.
- Contrôle TypeScript de syntaxe lancé avec `tsc`; aucune erreur de parsing TS/TSX détectée.
- `npm install` n'a pas pu être finalisé dans l'environnement de génération (accès réseau / délai), donc le build Next.js complet doit être exécuté après `npm install` sur la machine de déploiement.
- Aucun secret HubSpot n'est inclus dans le projet.
- OAuth utilise les endpoints HubSpot versionnés `/oauth/2026-03/*`.
- Les segments utilisent l'API HubSpot Lists `/crm/lists/2026-03/*`.
