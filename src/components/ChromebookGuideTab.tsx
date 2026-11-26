import { useState } from 'react';
import { Laptop, KeyRound, ShieldCheck, Copy, Check } from 'lucide-react';

export function ChromebookGuideTab() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const copyPortalUrl = () => {
    if (!currentOrigin) return;
    navigator.clipboard.writeText(currentOrigin).catch(() => {});
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Panduan Kunci Chromebook & Token Kirim 1 Jam
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Agar siswa Kelas 5D benar-benar tidak bisa keluar dari halaman CBT di Chromebook dan baru
          bisa mengirim Google Form setelah 1 jam, ikuti dua langkah praktis di bawah ini.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Card 1: 1-Hour Google Form Submit Lock */}
        <section className="rounded-xl border border-slate-200 bg-white p-7">
          <div className="flex items-center gap-2.5 text-sky-700">
            <KeyRound className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-900">
              01. Cara Memastikan Anak Baru Bisa Klik Kirim Setelah 1 Jam
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Selain tombol selesai di portal ini terkunci selama 60 menit, Anda bisa mengunci tombol{' '}
            <strong className="font-semibold text-slate-900">Kirim (Submit)</strong> di dalam
            Google Form itu sendiri menggunakan fitur <strong className="font-semibold text-slate-900">Token Kirim Otomatis</strong>:
          </p>

          <ol className="mt-5 space-y-3.5 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-sky-700 pt-0.5">1.</span>
              <span>
                Di Google Form Anda, tambahkan 1 pertanyaan wajib di bagian{' '}
                <strong>paling bawah</strong> dengan tipe <strong>Jawaban Singkat</strong>, beri
                judul: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Token Kirim Ujian</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-sky-700 pt-0.5">2.</span>
              <span>
                Klik menu titik tiga di pertanyaan tersebut, aktifkan{' '}
                <strong>Validasi Respons</strong> &rarr; pilih{' '}
                <strong>Teks &rarr; Berisi</strong> &rarr; isi dengan kode misalnya{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">KIRIM5D</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-sky-700 pt-0.5">3.</span>
              <span>
                Masukkan kode yang sama pada kolom <strong>Token Kirim</strong> di{' '}
                <strong>Panel Guru</strong> portal ini. Portal akan menyembunyikan token tersebut
                dan baru menampilkannya di layar anak-anak tepat setelah <strong>60 menit</strong>!
              </span>
            </li>
          </ol>
        </section>

        {/* Card 2: Chromebook Kiosk Lock */}
        <section className="rounded-xl border border-slate-200 bg-white p-7">
          <div className="flex items-center gap-2.5 text-sky-700">
            <Laptop className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-900">
              02. Cara Mengunci Chromebook Sekolah Secara Penuh
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Di portal ini, browser sudah mengaktifkan mode layar penuh terkunci, blokir klik kanan,
            blokir pintasan keyboard, dan deteksi pindah tab otomatis. Jika memakai Chromebook sekolah
            (akun <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">belajar.id</code>),
            aktifkan juga kunci tingkat perangkat:
          </p>

          <ol className="mt-5 space-y-3.5 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-sky-700 pt-0.5">1.</span>
              <span>
                <strong>Jika tanpa Admin Console (Langsung di Kelas):</strong> Buka Chrome di
                Chromebook siswa, buka URL portal ini, lalu klik tombol <strong>Mulai Ujian</strong>.
                Jika anak keluar fullscreen atau tekan tombol pencarian/pindah tab, layar soal langsung
                terblokir dan tercatat pelanggaran.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-bold text-sky-700 pt-0.5">2.</span>
              <span>
                <strong>Jika punya akses Admin Sekolah (100% Terkunci OS):</strong> Di Google Admin
                Console &rarr; <em>Perangkat &rarr; Chrome &rarr; Aplikasi & Ekstensi &rarr; Kios</em>,
                tambahkan URL portal ini sebagai <strong>Situs Web Kios</strong> agar Chromebook
                langsung booting ke portal ini tanpa tombol navigasi Chrome sama sekali.
              </span>
            </li>
          </ol>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="block text-xs font-medium text-slate-500">URL Portal CBT Kelas 5D</span>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-xs text-slate-800">{currentOrigin}</code>
              <button
                type="button"
                onClick={copyPortalUrl}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Disalin
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Salin URL
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Checklist Bar */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Tips Tambahan Pengaturan Google Form
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Pastikan di Google Form Anda pengaturan{' '}
              <strong>&ldquo;Kumpulkan alamat email&rdquo;</strong> disesuaikan dengan kebutuhan sekolah,
              dan opsi <strong>&ldquo;Batasi ke 1 tanggapan&rdquo;</strong> tidak menyulitkan jika
              Chromebook dipakai bergantian atau tidak login akun Google.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
