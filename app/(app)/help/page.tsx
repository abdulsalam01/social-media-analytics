import { BookOpen, PlayCircle, ShieldCheck, Download, LifeBuoy, Lightbulb } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panduan Pemakaian</h1>
        <p className="text-sm text-slate-500">Step by step buat mulai pakai SocmedInsight.</p>
      </div>

      <Section icon={<PlayCircle className="w-5 h-5" />} title="1. Mulai Cepat">
        <Steps items={[
          "Login pakai akun yang dikasih admin.",
          "Buka menu Akun Sosmed, klik Tambah Akun.",
          "Pilih platform (Instagram atau TikTok), isi nama brand + handle.",
          "Buka menu Input Data. Pilih tab Data Profil Harian, catat followers/visit/reach dari Insight aplikasi sosmed.",
          "Pindah ke tab Data Konten, input tiap post yang dipublish minggu itu.",
          "Kembali ke Dashboard untuk lihat grafik dan metrik otomatis terhitung.",
        ]} />
      </Section>

      <Section icon={<BookOpen className="w-5 h-5" />} title="2. Ambil Data Sosmed dari Mana?">
        <div className="text-sm text-slate-600 space-y-3">
          <div>
            <div className="font-semibold text-slate-900">Instagram</div>
            <p>Buka Instagram app → Profile → menu ≡ → Insights. Lihat tab Overview + Content untuk ambil angka.</p>
          </div>
          <div>
            <div className="font-semibold text-slate-900">TikTok</div>
            <p>Buka TikTok app → Profile → menu ≡ → Creator Tools → Analytics. Ambil dari Overview + Content.</p>
          </div>
        </div>
      </Section>

      <Section icon={<Download className="w-5 h-5" />} title="3. Bikin Laporan PDF">
        <Steps items={[
          "Buka menu Laporan.",
          "Pilih akun + minggu yang mau dilaporkan.",
          "Klik Cetak / Simpan PDF.",
          "Di dialog printer, pilih Save as PDF, klik Save.",
        ]} />
      </Section>

      <Section icon={<Lightbulb className="w-5 h-5" />} title="4. Riset & Ide Konten AI">
        <Steps items={[
          "Buka Ide Konten AI lalu pilih akun Instagram atau TikTok.",
          "Isi Account Goals: goal utama, target audiens, brand voice, pilar konten, keyword, dan kemampuan produksi tim.",
          "Masukkan jam aktif audiens dari Instagram Insights atau TikTok Business Suite agar rekomendasi waktu lebih personal.",
          "Klik Buat Ide. Sistem mengumpulkan referensi terbaru, Gemini menyusun ide Bahasa Indonesia, lalu scheduler memilih slot tanpa bentrok.",
          "Buka bukti sumber sebelum produksi, lalu ubah status ide dari Ide sampai Sudah terbit.",
        ]} />
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
          Trend score dan output AI membantu prioritas, bukan jaminan viral. Tim tetap wajib memeriksa konteks, fakta, klaim, dan hak cipta dari sumber yang ditautkan.
        </p>
      </Section>

      <Section icon={<ShieldCheck className="w-5 h-5" />} title="5. Keamanan Data">
        <Steps items={[
          "Ganti password default admin setelah instalasi.",
          "Backup database rutin dari menu Pengaturan → Backup.",
          "Kasih akses Viewer buat orang yang cuma perlu lihat.",
          "Deploy di server internal + HTTPS untuk produksi.",
        ]} />
      </Section>

      <Section icon={<LifeBuoy className="w-5 h-5" />} title="6. Kalau Ada Masalah">
        <p className="text-sm text-slate-600">
          Cek dulu apakah data sudah lengkap diinput. Kalau angka masih 0, kemungkinan
          data belum masuk atau tanggal salah. Hubungi admin kalau butuh reset password
          atau ubah role.
        </p>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="flex items-center gap-2">
          <span className="text-brand-600">{icon}</span>
          <span className="font-semibold text-slate-900">{title}</span>
        </div>
      </div>
      <div className="card-bd">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-700">
          <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold shrink-0">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
