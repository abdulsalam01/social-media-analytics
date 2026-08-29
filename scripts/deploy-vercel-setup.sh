#!/usr/bin/env bash
# Setup script buat prep Vercel deploy. Jalanin dari mesin lokal.
# Butuh: Turso CLI + Vercel CLI

set -euo pipefail

echo "==> SocmedInsight — Vercel Deploy Setup"
echo

# --- Check prereqs ---
if ! command -v turso >/dev/null 2>&1; then
  echo "Turso CLI belum terinstall."
  echo "  Install: curl -sSfL https://get.tur.so/install.sh | bash"
  exit 1
fi
if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI belum terinstall."
  echo "  Install: npm i -g vercel"
  exit 1
fi

# --- Turso: create DB ---
read -p "Nama Turso database (contoh: socmed-insight-prod): " DB_NAME
turso auth login || true
turso db create "$DB_NAME" --group default || echo "(DB mungkin sudah ada, lanjut)"
URL=$(turso db show "$DB_NAME" --url)
TOKEN=$(turso db tokens create "$DB_NAME")

echo
echo "TURSO_DATABASE_URL=$URL"
echo "TURSO_AUTH_TOKEN=$TOKEN"
echo

# --- Local env for db:init against Turso ---
cat > .env.local.tmp <<EOF
TURSO_DATABASE_URL=$URL
TURSO_AUTH_TOKEN=$TOKEN
ADMIN_EMAIL=$(read -p "Admin email: " a && echo "$a")
ADMIN_PASSWORD=$(read -p "Admin password (min 8): " p && echo "$p")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
EOF
mv .env.local.tmp .env.local

echo "==> Run migrations + create admin di Turso"
npm run db:init
npm run db:admin
npm run db:verify

echo
echo "==> (Opsional) seed demo data"
read -p "Seed demo data ke Turso? (y/N): " YN
if [[ "$YN" =~ ^[Yy]$ ]]; then
  npm run db:seed
fi

echo
echo "==> Setup env di Vercel"
vercel link || true
vercel env add TURSO_DATABASE_URL production < <(echo "$URL")
vercel env add TURSO_AUTH_TOKEN production < <(echo "$TOKEN")
SESSION=$(grep '^SESSION_SECRET=' .env.local | cut -d= -f2)
vercel env add SESSION_SECRET production < <(echo "$SESSION")
CRON=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
vercel env add CRON_SECRET production < <(echo "$CRON")
vercel env add ADMIN_EMAIL production < <(grep '^ADMIN_EMAIL=' .env.local | cut -d= -f2)
vercel env add ADMIN_PASSWORD production < <(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2)

echo
echo "==> Deploy ke Vercel production"
vercel --prod

echo
echo "Selesai. Cek URL production di output di atas."
