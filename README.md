# SocmedInsight

Dashboard analytics sosial media buat Instagram & TikTok. Ganti kerjaan manual di Excel dengan sistem yang otomatis hitung, gampang diinput, dan siap kirim laporan mingguan ke klien/atasan.

**Deploy ke Vercel + Turso:** lihat [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)

## Fitur

- Login aman (bcrypt + session cookie httpOnly + rate-limit brute-force)
- Multi-akun (kelola banyak brand Instagram + TikTok sekaligus)
- Input data mingguan lewat form ramah non-teknis
- Dashboard grafik: pertumbuhan followers, engagement, top konten, ER by reach/followers/play
- Laporan mingguan siap cetak / Save as PDF
- Backup 1-klik (download file database)
- Role-based access: Admin, Editor, Viewer
- Audit log aktivitas
- Panduan pemakaian bawaan di dalam aplikasi

## Kebutuhan

- Node.js versi 20 atau lebih baru
- OS: Windows, macOS, atau Linux
- (Opsional) Caddy/Nginx buat HTTPS di production

Tanpa Docker. Tanpa database server terpisah. Data disimpan di file SQLite tunggal.

## Instalasi Cepat

```bash
# 1. Ekstrak folder aplikasi
cd socmed-insight

# 2. Salin config
cp .env.example .env.local
# Buka .env.local, ganti ADMIN_EMAIL dan ADMIN_PASSWORD.
# SESSION_SECRET auto-generate di langkah berikutnya kalau kosong.

# 3. Jalankan setup (install deps + build + init database + buat admin)
./scripts/setup.sh

# 4. Start aplikasi
./scripts/start.sh
```

Buka `http://localhost:3000` di browser. Login pakai email + password admin.

### Windows tanpa bash

```powershell
cp .env.example .env.local   # edit dulu
npm install
npm run build
npm run db:init
npm start
```

## Struktur Folder

```
socmed-insight/
├── app/                # Halaman + API (Next.js App Router)
├── components/         # Komponen UI reusable
├── lib/                # Database, auth, kalkulasi, util
├── scripts/            # setup.sh, start.sh, init-db, seed-demo
├── data/data.db        # File database SQLite (auto-generate)
└── .env.local          # Config lokal (jangan commit)
```

## Peran Pengguna

| Role | Bisa |
|------|------|
| Admin | Semua akses + kelola pengguna + backup |
| Editor | Input & ubah data, lihat dashboard |
| Viewer | Hanya lihat dashboard & laporan |

## Backup Data

- **Manual**: Menu Pengaturan → Download Backup Sekarang
- **Terjadwal (Linux/macOS)**: tambah di `crontab -e`:

```
0 2 * * * cp /path/socmed-insight/data/data.db /path/backup/data-$(date +\%F).db
```

## Deploy Production

1. Reverse proxy pakai Caddy atau Nginx buat HTTPS.
2. Jalankan `./scripts/start.sh` di belakang process manager (PM2 disarankan):

```bash
npm i -g pm2
pm2 start "./scripts/start.sh" --name socmed-insight
pm2 startup
pm2 save
```

## Data Demo

Buat lihat dashboard hidup dengan data contoh:

```bash
npm run db:seed
```

Login lalu buka Dashboard.

## Keamanan

- Password disimpan bcrypt (cost 12)
- Session cookie httpOnly + sameSite=lax + secure (production)
- CSRF terlindungi via Next.js Server Actions
- Rate-limit login: 5 percobaan gagal / menit per email/IP
- SQL injection tidak mungkin (prepared statements)
- Validasi input via zod

## Bahasa

UI campur Indonesia-Inggris (bahasa gado-gado) yang natural buat pengguna operasional. Contoh: "Followers", "Engagement", "Dashboard" — dipertahankan bahasa Inggris karena umum dipakai, sementara instruksi + label pakai bahasa Indonesia.

## Support

Report bug atau minta fitur ke admin/developer perusahaan Anda.
