# BL Mobile

Application React Native (Expo Router) pour la gestion de preparation des BL avec trois roles:

- Responsable des BL
- Preparateur de commandes
- Admin

## Fonctions implementees

1. Connexion par identifiants et role.
1. Responsable: charge les BL recents, selectionne les BL a preparer pour la date cible et enregistre la selection via API.
1. Preparateur: charge les BL selectionnes pour la date, ouvre un BL, met a jour chaque produit (available, not_available, partial + quantite preparee) puis envoie le rapport de preparation.
1. Admin: charge les rapports du jour (ou d'une date) et ouvre le detail dans un tableau clair directement dans l'app.

## API attendue

L'application consomme les endpoints suivants:

- POST /auth/login
- GET /auth/me
- POST /auth/logout
- GET /articles
- POST /selections
- GET /selections
- GET /preparation/bls
- GET /bl/{idbl}/produits
- POST /preparation/reports
- GET /admin/reports
- GET /admin/reports/{report_id}

## Configuration URL API

Configurer l'URL de l'API dans un fichier `.env` a la racine du projet mobile:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:8000
```

Si tu testes sur telephone physique, remplace l'URL par l'IP LAN de ton PC.
Exemple: `EXPO_PUBLIC_API_URL=http://192.168.1.50:8000`

## Demarrage

1. Demarrer l'API:

```bash
cd "BL API"
python main.py
```

1. Demarrer le mobile:

```bash
cd BlMobile
npm run start
```

## Comptes de test (seed API)

- Responsable: responsable.bl / RespBL123!
- Preparateur: preparateur.cmd / PrepCMD123!
- Admin: admin.bl / AdminBL123!
