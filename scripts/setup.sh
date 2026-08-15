#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> SocmedInsight — Setup"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js belum terinstall. Download dari https://nodejs.org (versi 20+)"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo "Error: Node.js versi $NODE_VER terlalu lama. Butuh minimal versi 20."
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "==> Generate .env.local"
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cp .env.example .env.local
  # Replace placeholders
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env.local
  else
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env.local
  fi
  echo "   .env.local dibuat. Buka file dan ganti ADMIN_EMAIL + ADMIN_PASSWORD sebelum lanjut."
  read -p "   Tekan Enter kalau sudah edit .env.local..."
fi

echo "==> Install dependencies"
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

echo "==> Build aplikasi (production)"
npm run build

echo "==> Init database + buat admin"
npm run db:init

echo
echo "==> Setup selesai!"
echo "Jalankan aplikasi: ./scripts/start.sh"
