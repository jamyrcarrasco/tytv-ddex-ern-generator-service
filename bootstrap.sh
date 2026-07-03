#!/usr/bin/env bash
# bootstrap.sh — SOLO se ejecuta UNA VEZ, manualmente, para el primer clone.
# A partir de ahí, todos los deploys usan deploy.sh (que ya vive dentro del repo).
#
# Uso (como root o con sudo):
#   ./bootstrap.sh
set -euo pipefail

REPO_URL="git@github.com:jamyrcarrasco/tytv-ddex-ern-generator-service.git"
APP_DIR="/opt/tytv-ddex-generator"
SYS_USER="tytv-ddex"

echo "==> Creando usuario de sistema dedicado (si no existe)"
if ! id "$SYS_USER" &>/dev/null; then
  adduser --system --group --home "$APP_DIR" --shell /usr/sbin/nologin "$SYS_USER"
fi

echo "==> Clonando repo en $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$SYS_USER" git clone "$REPO_URL" "$APP_DIR"
else
  echo "    Ya existe, se omite el clone."
fi

cd "$APP_DIR"

echo "==> Copiando template de .env (edítalo con los valores reales antes de desplegar)"
if [ ! -f .env ]; then
  sudo -u "$SYS_USER" cp .env.production.example .env
  chmod 600 .env
  chown "$SYS_USER:$SYS_USER" .env
  echo "    -> Edita $APP_DIR/.env con: nano $APP_DIR/.env"
fi

echo "==> Instalando pm2 globalmente (si no existe)"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

echo ""
echo "==> Listo. Próximos pasos manuales:"
echo "    1. nano $APP_DIR/.env          (llenar DB, AWS, API_KEYS reales)"
echo "    2. cd $APP_DIR && sudo -u $SYS_USER ./deploy.sh main"
echo "    3. pm2 startup systemd -u $SYS_USER --hp $APP_DIR   (y correr el comando que imprime)"
echo "    4. pm2 save"
echo "    Ver DEPLOY-SETUP.md para el resto (firewall, logrotate, nginx opcional)."
