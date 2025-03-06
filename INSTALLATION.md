# Guide d'Installation

Ce document décrit en détail la procédure d'installation de l'application de gestion d'interventions Securitas sur différents environnements.

## Table des matières

1. [Installation sur Proxmox](#installation-sur-proxmox)
2. [Installation sur un serveur Linux standard](#installation-sur-un-serveur-linux-standard)
3. [Installation avec Docker](#installation-avec-docker)
4. [Configuration de Nginx](#configuration-de-nginx)
5. [Configuration HTTPS avec Certbot](#configuration-https-avec-certbot)
6. [Configuration de l'application](#configuration-de-lapplication)
7. [Dépannage](#dépannage)

## Installation sur Proxmox

### 1. Création d'un conteneur LXC

```bash
# Télécharger le template Ubuntu 22.04
pveam update
pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst

# Créer un conteneur avec l'ID 100 (à adapter)
pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname securitas-app \
  --ostype ubuntu \
  --rootfs local-lvm:8 \
  --memory 2048 \
  --swap 512 \
  --cores 2 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --password VotreMotDePasse \
  --onboot 1

# Démarrer le conteneur
pct start 100

# Vérifier que le conteneur est démarré
pct status 100

# Obtenir l'adresse IP du conteneur
pct exec 100 -- ip a
```

### 2. Configuration initiale du conteneur

```bash
# Se connecter au conteneur
pct enter 100

# Mettre à jour le système
apt update && apt upgrade -y

# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Installer Nginx et autres dépendances
apt install -y git nginx certbot python3-certbot-nginx curl wget

# Vérifier les installations
node -v
npm -v
nginx -v
```

### 3. Déploiement de l'application

```bash
# Préparer le répertoire d'installation
mkdir -p /opt/securitas-app
cd /opt/securitas-app

# Cloner le dépôt Git
git clone https://github.com/votre-username/securitas-app.git .

# Installer les dépendances
npm install

# Créer les dossiers requis
mkdir -p temp logs public

# Créer le fichier de configuration
cp .env.example .env
nano .env  # Modifier selon vos besoins

# Définir les permissions
chown -R www-data:www-data /opt/securitas-app
chmod -R 755 /opt/securitas-app
```

### 4. Configuration du service systemd

```bash
# Créer un fichier service
cat > /etc/systemd/system/securitas-app.service << EOL
[Unit]
Description=Securitas Intervention Manager
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/securitas-app
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
EOL

# Activer et démarrer le service
systemctl daemon-reload
systemctl enable securitas-app
systemctl start securitas-app
systemctl status securitas-app
```

## Installation sur un serveur Linux standard

Suivez les mêmes étapes que pour Proxmox à partir de l'étape 2 (Configuration initiale) en adaptant au besoin.

## Installation avec Docker

### 1. Installer Docker

```bash
# Installer Docker sur Ubuntu
apt update
apt install -y docker.io docker-compose
systemctl enable --now docker
```

### 2. Créer un fichier docker-compose.yml

```bash
cat > docker-compose.yml << EOL
version: '3.8'

services:
  app:
    build: .
    container_name: securitas-intervention-manager
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SESSION_SECRET=votre_secret_ici
    volumes:
      - ./temp:/app/temp
      - ./logs:/app/logs
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
EOL
```

### 3. Créer un Dockerfile

```bash
cat > Dockerfile << EOL
FROM node:18-alpine

WORKDIR /app

# Installation des dépendances système
RUN apk add --no-cache tini

# Copie des fichiers du projet
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copie du reste des fichiers
COPY . .

# Configuration des volumes
VOLUME ["/app/temp", "/app/logs"]

# Exposition du port
EXPOSE 3000

# Utilisation de tini comme point d'entrée
ENTRYPOINT ["/sbin/tini", "--"]

# Démarrage de l'application
CMD ["node", "server.js"]
EOL
```

### 4. Démarrer avec Docker Compose

```bash
docker-compose up -d
```

## Configuration de Nginx

### 1. Créer un fichier de configuration pour le site

```bash
cat > /etc/nginx/sites-available/securitas-app << EOL
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

# Activer le site
ln -s /etc/nginx/sites-available/securitas-app /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## Configuration HTTPS avec Certbot

```bash
# Installer Certbot
apt install -y certbot python3-certbot-nginx

# Obtenir un certificat SSL et configurer Nginx
certbot --nginx -d votre-domaine.com

# Vérifier le renouvellement automatique
certbot renew --dry-run
```

## Configuration de l'application

### 1. Éditer le fichier .env

```bash
nano .env
```

Définissez les paramètres suivants:

```
PORT=3000
NODE_ENV=production
SESSION_SECRET=une_chaine_aleatoire_tres_longue_et_securisee
TEMP_FOLDER=./temp
LOG_LEVEL=info
```

### 2. Démarrer l'application

```bash
# Démarrer l'application directement (développement)
npm start

# Ou avec le service systemd (production)
systemctl restart securitas-app
```

## Dépannage

### Problèmes de connexion à Microsoft Exchange

Si vous rencontrez des difficultés à vous connecter à Microsoft Exchange:

1. Vérifiez que l'accès IMAP est activé sur le compte
2. Pour les comptes avec authentification à deux facteurs, utilisez un mot de passe d'application
3. Vérifiez que les ports IMAP (993) et SMTP (587) ne sont pas bloqués par un pare-feu

### Logs et débogage

Les logs de l'application sont disponibles dans le dossier `logs/`:

```bash
tail -f logs/combined.log  # Tous les logs
tail -f logs/error.log     # Logs d'erreur uniquement
```

Pour les logs du service systemd:

```bash
journalctl -u securitas-app -f
```
