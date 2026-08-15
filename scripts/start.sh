#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
export NODE_ENV=production

if [ ! -f .env.local ]; then
  echo "Error: .env.local belum ada. Jalanin ./scripts/setup.sh dulu."
  exit 1
fi

echo "==> SocmedInsight jalan di http://localhost:$PORT"
echo "    (tekan Ctrl+C untuk stop)"
echo
node --env-file=.env.local node_modules/next/dist/bin/next start -p "$PORT"
