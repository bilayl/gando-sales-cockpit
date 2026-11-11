# Chat IA Allo — Assistant conversationnel du Cockpit Gando

## Objectif

Cette fonctionnalité répond à une demande différente de la recherche existante dans les résumés Allo : **une conversation en langage naturel, multi-tours, de type ChatGPT**.

- Nouvelle entrée de sidebar **Assistant IA** et page `/assistant-ia`.
- Accès depuis **Téléphonie → Appels** et depuis une fiche contact ou entreprise (**Discuter avec l'IA**) pour limiter la recherche à cette fiche.
- Questions sur les objections, discussions, engagements et relances à partir des **résumés, transcriptions et actions réelles produits par Allo**.
- Chaque réponse renvoie des références numérotées `[1]` etc. avec des liens vers les appels correspondants ; les citations doivent pouvoir être vérifiées.
- Contexte de conversation maintenu pendant l'utilisation de la page ; **pas de conservation serveur ni de mémoire intersession**.
- Ce moteur est **OpenRouter (IA Gando)**, il n'est **pas l'IA conversationnelle native d'Allo**. Allo fournit les sources factuelles.

## Fonctionnement

1. `GET /api/withallo/ai/chat` retourne la disponibilité du modèle existant (sans révéler la clé).
2. `POST /api/withallo/ai/chat` reçoit jusqu'à 12 tours bornés et éventuellement `scope: {kind:'contact'|'company', id:'...'}`.
3. La route exige une session Cockpit. Sans scope, elle lit les 100 derniers appels accessibles via Allo, ne conserve pour un commercial que ses appels dont le propriétaire est vérifié, et vérifie l'autorisation sur chaque détail d'appel avant d'utiliser les transcriptions.
4. Les appels les plus pertinents sont retenus selon les expressions de la question et, si une entreprise du répertoire CRM est nommée, les numéros de ses contacts associés. Avec un scope, le moteur exploite directement les appels de cette fiche.
5. Un maximum de neuf appels alimente le modèle. Les contenus de transcription sont extraits et bornés ; ils sont transmis comme **preuves non fiables, jamais comme instructions**.
6. OpenRouter formule une réponse, avec l'instruction de ne citer que les sources fournies et d'indiquer explicitement lorsqu'une réponse ne peut pas être établie.
7. Le navigateur affiche la réponse et les liens sources. Aucune tâche, email ou modification CRM n'est déclenché par le chat.

## Configuration

- `WITHALLO_API_KEY` avec lecture des conversations et transcriptions, comme pour la Téléphonie existante.
- `OPENROUTER_API_KEY`, déjà utilisée par IA Sales, depuis Vercel ou Supabase Vault.
- `OPENROUTER_MODEL` optionnel, identique à IA Sales.
- La requête OpenRouter ajoute `provider.data_collection = deny` et `provider.zdr = true` lorsque `OPENROUTER_ZDR=true`. Vérifier les conditions de traitement des données confidentielles des fournisseurs choisis avant diffusion de comptes rendus d'appels.

## Limites affichées

- Les résultats globalement recherchés proviennent des **100 derniers appels**, pas de tout l'historique Allo.
- Le moteur utilise au plus **neuf** appels par réponse, et des **extraits** de transcription. Il peut manquer des informations présentes dans d'autres appels.
- Si Allo n'a pas produit de résumé / transcription, le moteur ne peut pas inventer ce qui a été dit.
- La mémoire est locale au composant React : rafraîchir la page démarre une nouvelle conversation.
- L'IA produit une synthèse pouvant être inexacte : les citations d'appel permettent une vérification.
- Les données de résumé / transcription sélectionnées sont envoyées au fournisseur OpenRouter côté serveur. Elles ne sont pas publiées dans le navigateur d'autres utilisateurs.
- Pour les non-admins, aucune correspondance d'adresse email d'agent ne donne accès aux appels des collègues.

## Tests de réception

1. Connexion admin : question sur le dernier appel d'un compte connu, réponse sourcée.
2. Puis question courte de suivi « Et quand doivent-ils être rappelés ? » : réponse contextualisée ou incertitude signalée.
3. Depuis une fiche contact avec numéro, ouvrir le chat : la portée doit rester sur ce contact.
4. Sous un autre compte commercial, ne jamais obtenir la transcription d'un appel qui appartient à un collègue.
5. Cliquer une référence `[1]` : l'appel s'ouvre dans Téléphonie.
6. Faire une question dont la réponse est absente des sources : réponse honnête sans invention.
7. Retirer la clé OpenRouter dans l'environnement de test : écran non configuré, sans réponse fictive.
