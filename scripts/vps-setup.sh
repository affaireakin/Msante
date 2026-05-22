#!/bin/bash
# M-Santé — Script de configuration initiale du VPS Hostinger
# Exécuter UNE SEULE FOIS en tant que root ou sudo
# Usage: bash vps-setup.sh ton-domaine.com

set -e
DOMAIN=${1:-"ton-domaine.com"}
REPO="https://github.com/maxfreeman82/M-sant-.git"
APP_DIR="/var/www/m-sante"
APP_USER="www-data"

echo "======================================"
echo " M-Santé VPS Setup"
echo " Domain: $DOMAIN"
echo "======================================"

# ── 1. Mise à jour système ─────────────────────────────────────────────────
echo ""
echo "→ [1/8] Mise à jour du système..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 20 LTS ─────────────────────────────────────────────────────
echo ""
echo "→ [2/8] Installation Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# ── 3. PM2 ────────────────────────────────────────────────────────────────
echo ""
echo "→ [3/8] Installation PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ── 4. Nginx ──────────────────────────────────────────────────────────────
echo ""
echo "→ [4/8] Installation Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ── 5. Certbot (SSL Let's Encrypt) ────────────────────────────────────────
echo ""
echo "→ [5/8] Installation Certbot..."
apt-get install -y certbot python3-certbot-nginx

# ── 6. Clone du repo ──────────────────────────────────────────────────────
echo ""
echo "→ [6/8] Clone du repository..."
mkdir -p $APP_DIR
git clone $REPO $APP_DIR
cd $APP_DIR

# ── 7. Environnement de production ────────────────────────────────────────
echo ""
echo "→ [7/8] Configuration des variables d'environnement..."
cat > $APP_DIR/apps/web/.env.production << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://jilpynvkpkepusvwcqch.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbHB5bnZrcGtlcHVzdndjcWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY2NzAsImV4cCI6MjA5MzEzMjY3MH0.R97YE0Xs6cpX7dnOvznGnbPGnkL2aO5x9YoCPvgF3MI
NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL=https://jilpynvkpkepusvwcqch.supabase.co/functions/v1
ENVEOF

echo ""
echo "  ⚠️  Vérifie les valeurs dans $APP_DIR/apps/web/.env.production"

# ── 8. Build & lancement ──────────────────────────────────────────────────
echo ""
echo "→ [8/8] Build Next.js..."
cd $APP_DIR/apps/web
npm ci
npm run build

echo ""
echo "→ Lancement avec PM2..."
pm2 start npm --name m-sante-web -- start
pm2 save

# ── Nginx config ──────────────────────────────────────────────────────────
echo ""
echo "→ Configuration Nginx..."
cp $APP_DIR/scripts/nginx-m-sante.conf /etc/nginx/sites-available/m-sante
sed -i "s/ton-domaine.com/$DOMAIN/g" /etc/nginx/sites-available/m-sante
ln -sf /etc/nginx/sites-available/m-sante /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── SSL ────────────────────────────────────────────────────────────────────
echo ""
echo "→ Génération certificat SSL..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

echo ""
echo "======================================"
echo " ✅ Setup terminé !"
echo ""
echo " URL : https://$DOMAIN"
echo " PM2 : pm2 status"
echo " Logs: pm2 logs m-sante-web"
echo ""
echo " Pour redéployer manuellement:"
echo "   cd $APP_DIR && git pull && cd apps/web && npm ci && npm run build && pm2 restart m-sante-web"
echo "======================================"
