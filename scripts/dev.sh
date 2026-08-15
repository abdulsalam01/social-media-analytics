#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || cp .env.example .env.local
npm run db:init || true
node --env-file=.env.local node_modules/next/dist/bin/next dev
