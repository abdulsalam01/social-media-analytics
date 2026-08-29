#!/usr/bin/env bash
# Push env ke Vercel + deploy prod.
# Usage: ./scripts/deploy-vercel.sh
# Prereq: vercel CLI + login (vercel login)

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Error: .env.local wajib ada. Isi TURSO_*, SESSION_SECRET, CRON_SECRET, ADMIN_*."
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI belum terinstall. Jalankan: npm install -g vercel"
  exit 1
fi

# Load env
set -a; source .env.local; set +a

# Link ke project (interactive kalau pertama kali)
if [ ! -d .vercel ]; then
  echo "==> Link Vercel project (pilih atau buat baru)"
  vercel link
fi

# Kunci env yang dibutuhkan
REQUIRED=(TURSO_DATABASE_URL TURSO_AUTH_TOKEN SESSION_SECRET CRON_SECRET ADMIN_EMAIL ADMIN_PASSWORD)
for k in "${REQUIRED[@]}"; do
  if [ -z "${!k:-}" ]; then
    echo "Error: $k belum ada di .env.local"
    exit 1
  fi
done

echo "==> Sync 6 env vars ke Vercel (production + preview + development)"
for k in "${REQUIRED[@]}"; do
  # Remove existing if any (idempotent)
  vercel env rm "$k" production --yes >/dev/null 2>&1 || true
  vercel env rm "$k" preview --yes >/dev/null 2>&1 || true
  vercel env rm "$k" development --yes >/dev/null 2>&1 || true
  printf '%s' "${!k}" | vercel env add "$k" production >/dev/null
  printf '%s' "${!k}" | vercel env add "$k" preview >/dev/null
  printf '%s' "${!k}" | vercel env add "$k" development >/dev/null
  echo "  ✓ $k"
done

echo
echo "==> Deploy production"
vercel --prod
