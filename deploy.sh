#!/usr/bin/env bash
# deploy.sh — vive DENTRO del repo (raíz). Se auto-actualiza en cada git pull.
# Uso: ./deploy.sh [git-ref]   (ej: ./deploy.sh v1.2.0  o  ./deploy.sh main)
#
# Requiere que el repo ya haya sido clonado una vez con bootstrap.sh.
set -euo pipefail

# Se ubica a sí mismo — ya no depende de una ruta hardcodeada
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF="${1:-main}"

cd "$APP_DIR"

echo "==> Desplegando ref: $REF (en $APP_DIR)"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: falta $APP_DIR/.env — corre bootstrap.sh primero o cópialo manualmente."
  exit 1
fi

PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")
echo "==> Commit anterior: $PREV_COMMIT"

git fetch --all --tags
git checkout "$REF"
git pull origin "$REF" --ff-only || true

echo "==> Instalando dependencias (npm ci, respeta el lockfile)"
npm ci

echo "==> Compilando TypeScript"
npm run build

echo "==> Recargando con pm2"
if pm2 describe tytv-ddex-generator > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "==> Verificando health check"
sleep 2
if curl -sf http://localhost:4000/health > /dev/null; then
  echo "==> OK. Deploy exitoso ($PREV_COMMIT -> $(git rev-parse HEAD))"
else
  echo "!!! Health check falló. Para rollback:"
  echo "    git checkout $PREV_COMMIT && npm ci && npm run build && pm2 reload ecosystem.config.js"
  exit 1
fi
