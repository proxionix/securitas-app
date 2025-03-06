# Application de Gestion d'Interventions Securitas

Application web permettant de gérer les fichiers Excel d'interventions reçus par email. Cette application permet aux techniciens de terrain de recevoir, traiter et renvoyer les fichiers d'intervention sans avoir à ouvrir manuellement les fichiers Excel.

## Fonctionnalités

- **Gestion des emails**
  - Connexion à un compte Microsoft Exchange (avec support 2FA via mot de passe d'application)
  - Recherche automatique d'emails non lus contenant des pièces jointes Excel commençant par "WS-"
  - Téléchargement et prévisualisation des pièces jointes

- **Traitement des fichiers Excel**
  - Édition des champs spécifiques sans ouvrir le fichier Excel:
    - SinoffCode (cellule Y3)
    - Date et heure de début d'intervention (K8, M8, P8, R8)
    - Date et heure de fin d'intervention (T8, V8, X8, AA8)
    - Détails de l'intervention (A40)
    - Explications et solutions (P40)
  - Boutons pour remplir automatiquement l'heure actuelle

- **Envoi automatisé**
  - Envoi du fichier complété par email à l'adresse configurée
  - Marquage automatique des emails traités comme "lus"

- **Interface intuitive**
  - Design responsive adapté aux mobiles et tablettes
  - Navigation par onglets pour une utilisation simplifiée
  - Alertes et notifications pour guider l'utilisateur

## Prérequis

- Node.js 16.x ou supérieur
- Compte Microsoft Exchange avec accès IMAP/SMTP
- Serveur web (recommandé: Nginx) pour le déploiement en production

## Installation

Voir les instructions détaillées dans le fichier [INSTALLATION.md](INSTALLATION.md).

## Configuration

L'application est configurable via le fichier `.env` :

```
PORT=3000
NODE_ENV=production
SESSION_SECRET=votre_clé_secrète
TEMP_FOLDER=./temp
LOG_LEVEL=info
```

Les paramètres de connexion email et les préférences utilisateur sont stockés dans le navigateur.

## Utilisation

1. Connectez-vous à votre compte email
2. Consultez les emails contenant des fichiers d'intervention
3. Acceptez une intervention pour la traiter
4. Remplissez les détails (SinoffCode, dates/heures, commentaires)
5. Envoyez le fichier complété

## Sécurité

- Les identifiants email sont stockés uniquement dans la session du navigateur
- Les fichiers temporaires sont automatiquement supprimés après une heure
- Toutes les communications avec le serveur sont chiffrées (HTTPS recommandé en production)

## Licence

Tous droits réservés © 2025
