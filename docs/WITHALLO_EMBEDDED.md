# Allo intégré dans Gando — composeur officiel

## Objectif

Reproduire le parcours « Appeler » de l'intégration Allo ↔ HubSpot dans le Sales Cockpit Gando.

## Déjà implémenté

- `GlobalPhoneDialer` monte une unique iframe Allo persistante (`https://web.withallo.com?variant=dialer`) dans le Cockpit.
- Les boutons `WithAlloCallButton` transmettent les numéros depuis la fiche contact, entreprise ou session de prospection par `gando:open-dialer`.
- Le parent envoie `{ source: "allo-host", type: "dial", payload: { phone_number } }` à `https://web.withallo.com` seulement après réception de `ready`; les clics précédents sont mis en attente.
- L'écouteur `message` vérifie l'origine **et la fenêtre émettrice**, ainsi que la source `allo-dialer`.
- Événements traités : `ready`, `login`, `incoming_call`, `outgoing_call`, `call_answered`, `call_ended`.
- La navigation conserve le dialer monté, évitant la déconnexion et la perte d'une conversation.
- Les conversations terminées relancent la lecture de l'historique Allo après 7 s et 35 s (le résumé IA peut être différé).
- Dans les sessions de prospection, la fenêtre d'appels rend le panneau global interactif pendant sa visibilité.

## Condition EXTERNE indispensable

Allo active l'**embedded dialer** pour chaque domaine autorisé. Il ne suffit pas d'avoir `WITHALLO_API_KEY`.

Demander au support Allo d'autoriser :
- `https://room.gando.pro`

Si Allo souhaite autoriser les aperçus Vercel, leur transmettre aussi les **domaines exacts** des prévisualisations utilisées ; ne pas présumer d'une prise en charge wildcard.

Documentation officielle : https://help.withallo.com/en/integrations/dialer/embedded-dialer

Chaque commercial se connecte ensuite **dans l'iframe** avec son compte Allo ; le navigateur doit autoriser l'accès au microphone.

## Test réel après activation du domaine

1. Se connecter à https://room.gando.pro avec un commercial disposant de son compte Allo.
2. Ouvrir une fiche contact avec un numéro valide puis cliquer **Appeler avec Allo**.
3. Vérifier que le dialer apparaît et reçoit `ready`, puis que le numéro est prérempli.
4. Se connecter à Allo dans le dialer, autoriser le microphone, déclencher un appel test (avec accord du destinataire).
5. Vérifier les événements d'appel dans la mini-interface, puis l'appel, la durée et le résumé dans l'historique et la fiche CRM.
6. Vérifier que la connexion native Allo ↔ HubSpot du compte Gando est active. Elle assure, indépendamment du composeur, la journalisation HubSpot des appels et des résumés. Sans cette connexion, la nouvelle iframe ne crée pas automatiquement de journaux d'appels HubSpot.

## Notes et limites

- La clé `WITHALLO_API_KEY` demeure uniquement côté serveur pour l'historique, les lignes et la file Power Dialer ; elle n'est **jamais** envoyée au navigateur par la nouvelle intégration.
- Aucune fausse API d'appel n'est utilisée. Le véritable appel part depuis le dialer Allo avec la session du commercial.
- Le `call_ended` navigateur n'est pas la preuve que l'appel a été correctement enregistré dans HubSpot. Les résumés passent par l'intégration Allo ↔ HubSpot existante ou par un futur webhook Allo signé.
- Un écran vide ou l'absence de `ready` après chargement demande d'abord de vérifier l'autorisation du domaine, la session Allo et les restrictions navigateur.
