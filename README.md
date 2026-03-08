# LinkUp 💬 — Chat Privé en Temps Réel

Application de messagerie privée avec WebSocket (Socket.io), WebRTC pour les appels, et Node.js.

## ✨ Fonctionnalités

- 🔐 **Inscription / Connexion** avec JWT + bcrypt
- 💬 **Messagerie en temps réel** via WebSocket (Socket.io)
- 📷 **Envoi de photos** (upload côté serveur)
- ✍️ **Indicateur de frappe** (typing indicator)
- 🟢 **Statut en ligne / hors ligne** en temps réel
- 📞 **Appels vocaux** via WebRTC
- 📹 **Appels vidéo** via WebRTC
- 💾 **Données sauvegardées** en JSON sur le serveur

---

## 🚀 Installation locale

### 1. Prérequis
- [Node.js](https://nodejs.org/) v18 ou plus récent

### 2. Installer les dépendances
```bash
cd linkup
npm install
```

### 3. Configurer l'environnement
```bash
cp .env.example .env
# Modifie JWT_SECRET dans le fichier .env
```

### 4. Lancer le serveur
```bash
npm start
# ou en mode développement (rechargement automatique) :
npm run dev
```

### 5. Ouvrir l'app
Ouvre **http://localhost:3000** dans ton navigateur.

Pour tester avec un ami sur le même réseau local :
- Trouve ton IP locale : `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
- Ton ami ouvre `http://TON_IP:3000`

---

## ☁️ Hébergement en ligne (gratuit)

### Option A — Railway (recommandé, très simple)
1. Crée un compte sur [railway.app](https://railway.app)
2. New Project → Deploy from GitHub (pousse ton code sur GitHub d'abord)
3. Ajoute la variable d'environnement `JWT_SECRET` dans les settings
4. Railway génère une URL publique automatiquement ✅

### Option B — Render
1. Crée un compte sur [render.com](https://render.com)
2. New Web Service → connecte ton repo GitHub
3. Start command : `npm start`
4. Ajoute `JWT_SECRET` dans Environment Variables

### Option C — VPS (DigitalOcean, OVH, etc.)
```bash
# Sur ton serveur
git clone <ton-repo>
cd linkup
npm install
# Installer PM2 pour garder le serveur actif
npm install -g pm2
pm2 start server.js --name linkup
pm2 save
pm2 startup
```

---

## 📁 Structure du projet

```
linkup/
├── server.js          # Serveur Node.js + Socket.io + API REST
├── package.json
├── .env.example       # Variables d'environnement
├── .gitignore
├── public/
│   ├── index.html     # Interface utilisateur complète
│   └── uploads/       # Photos envoyées (créé automatiquement)
└── data/
    ├── users.json     # Comptes utilisateurs (créé automatiquement)
    └── messages.json  # Historique des messages (créé automatiquement)
```

---

## 🔒 Sécurité en production

- Change `JWT_SECRET` par une valeur longue et aléatoire
- Active HTTPS (Railway et Render le font automatiquement)
- Pour les appels WebRTC entre réseaux différents, ajoute un serveur TURN :
  ```js
  // Dans server.js, remplace RTC_CONFIG côté client par :
  { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:ton-serveur-turn', username: '...', credential: '...' }
  ]}
  ```
  Service TURN gratuit : [Metered](https://www.metered.ca/tools/openrelay/)

---

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Serveur | Node.js + Express |
| Temps réel | Socket.io (WebSocket) |
| Appels | WebRTC (navigateur natif) |
| Auth | JWT + bcrypt |
| Stockage | Fichiers JSON locaux |
| Frontend | HTML/CSS/JS vanilla |
