# Deploy ke Vercel + Turso (Step-by-Step)

Panduan deploy SocmedInsight ke Vercel dengan database Turso (libSQL — SQLite hosted).

## Kenapa Turso?

- SQLite fork hosted, HTTP API — works di serverless Vercel
- Free tier: 500 database, 9 GB storage, 1 miliar row read/bulan
- Zero cold-start (edge replicas)
- Query syntax sama persis dengan SQLite → no code rewrite

## Prasyarat

- Akun GitHub (repo push ke sini)
- Akun Vercel (signup free di vercel.com)
- Akun Turso (signup free di turso.tech)
- Node.js 20+ di mesin lokal
- CLI: `npm install -g vercel` dan Turso CLI (`curl -sSfL https://get.tur.so/install.sh | bash`)

## Cara Cepat (Automated)

```bash
./scripts/deploy-vercel-setup.sh
```

Script bakal:
1. Bikin Turso database
2. Generate auth token
3. Tulis `.env.local`
4. Run migrations + admin seed di Turso
5. Set env vars di Vercel (production)
6. Deploy

## Cara Manual (Step by Step)

### 1. Setup Turso

```bash
# Install CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Buat database (pilih region terdekat, contoh: sin (Singapore) buat Indonesia)
turso db create socmed-insight-prod --group default --location sin

# Dapetin credentials
turso db show socmed-insight-prod --url        # → libsql://xxx.turso.io
turso db tokens create socmed-insight-prod     # → eyJ...
```

### 2. Init Schema + Admin di Turso

```bash
# Salin credentials ke .env.local
cat > .env.local <<EOF
TURSO_DATABASE_URL=libsql://xxx.turso.io
TURSO_AUTH_TOKEN=eyJ...
ADMIN_EMAIL=admin@perusahaan.com
ADMIN_PASSWORD=UbahPasswordKuat123!
SESSION_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
EOF

# Run migration + admin
npm run db:init
npm run db:admin
npm run db:verify

# Optional: seed demo data
npm run db:seed
```

### 3. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial SocmedInsight"
gh repo create socmed-insight --private --source=. --push
```

### 4. Setup Vercel

Di [vercel.com/new](https://vercel.com/new):
1. Import GitHub repo
2. Framework Preset: Next.js (auto-detect)
3. Build Command: `next build` (default)
4. Output Directory: `.next` (default)
5. **Environment Variables** — tambahkan semua. Tandai token, secret, dan password
   sebagai sensitive values di Vercel:

| Key                   | Value                            | Env      |
|-----------------------|----------------------------------|----------|
| `TURSO_DATABASE_URL`  | `libsql://xxx.turso.io`          | All      |
| `TURSO_AUTH_TOKEN`    | `eyJ...`                         | All      |
| `SESSION_SECRET`      | (hasil `openssl rand -hex 32`)   | All      |
| `CRON_SECRET`         | (hasil `openssl rand -hex 32`)   | All      |
| `ADMIN_EMAIL`         | admin@perusahaan.com             | All      |
| `ADMIN_PASSWORD`      | (password kuat)                  | All      |

6. Klik **Deploy**.

Atau lewat CLI:

```bash
vercel link
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add SESSION_SECRET production
vercel env add CRON_SECRET production
vercel --prod
```

### 5. Verifikasi

Buka URL Vercel yang keluar, login pake `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

## Perbedaan Perilaku Lokal vs Vercel

| Fitur                       | Lokal (file)         | Vercel (Turso)                     |
|-----------------------------|----------------------|-------------------------------------|
| Backup (menu Pengaturan)    | Download `.db` file  | Download `.json` dump (schema only) |
| Reset Data + VACUUM         | VACUUM otomatis      | VACUUM skip (Turso auto-manage)     |
| Latency                     | <1ms                 | 20-100ms (tergantung region)        |
| Concurrent writes           | Serialized (WAL)     | Turso native concurrent             |
| Full binary backup Turso    | N/A                  | Pakai `turso db dump <name>`        |

## Region Recommendation

Buat user Indonesia:
- **Turso**: `--location sin` (Singapore) atau `--location hkg` (Hong Kong)
- **Vercel**: sudah di-set `sin1` di `vercel.json`

## Custom Domain

Di Vercel dashboard → Project → Settings → Domains → tambah domain, ikutin DNS instruksi.

## Update / Redeploy

Push commit ke `main` → Vercel auto-deploy.

Kalau ubah schema:
1. Edit `lib/schema.sql`
2. Push
3. Setelah deploy sukses, run migration ulang:
   ```bash
   npm run db:init  # dengan .env.local pointing ke Turso
   ```

## Backup Rutin (Turso)

```bash
# Manual dump ke file
turso db shell socmed-insight-prod ".dump" > backup-$(date +%F).sql

# Otomatis via GitHub Actions — bikin .github/workflows/backup.yml
```

## Troubleshooting

**Error: "TURSO_AUTH_TOKEN required"** → Env var belum di-set di Vercel. Re-check.

**Error: "SESSION_SECRET wajib diisi"** → Sama, cek env var.

**Halaman kosong / 500** → Cek Vercel logs (`vercel logs <url>`). Biasanya env var missing atau schema belum di-init.

**Login gagal terus** → Admin belum di-create. Run `npm run db:init` dari lokal dengan env pointing ke Turso.

**Data hilang setelah deploy** → Kalau sebelumnya pakai SQLite lokal, data di file itu — Turso beda DB. Migrasi manual dulu.

## Migrasi Data Lokal → Turso

```bash
# Dari mesin lokal yang punya data.db
sqlite3 data/data.db ".dump" > local-dump.sql

# Push ke Turso
turso db shell socmed-insight-prod < local-dump.sql
```

## Cost Estimate (Free Tier)

- Turso free: cukup buat ~100 rb konten + ~1M row reads/bulan
- Vercel Hobby: gratis buat personal (100 GB bandwidth/bulan)

Kalau lewat batas, upgrade Turso Scaler ($29/bulan) atau Vercel Pro ($20/bulan/user).
