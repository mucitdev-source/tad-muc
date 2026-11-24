# Tad – Build Internal MUC (Hardened)

Repositori ini berisi **build internal Tad** untuk PT Multi Utama Consultindo (MUC): aplikasi desktop untuk melihat dan menganalisis data tabular (CSV, Parquet, dan berkas database DuckDB) dengan mesin [DuckDB](https://duckdb.org/) yang berjalan sepenuhnya di komputer pengguna.

> **Ini bukan rilis resmi Tad.** Kode ini adalah fork dari proyek open source [Tad](https://github.com/antonycourtney/tad) karya Antony Courtney (versi 0.14.0, commit `272ffa0`), yang telah dimodifikasi dan di-hardening oleh IT Support MUC. Jangan gunakan installer dari situs resmi Tad untuk keperluan kerja MUC; gunakan hanya installer dari repositori ini.

## Perbedaan dengan Tad Upstream

Ringkasan perubahan keamanan (rincian, bukti pengujian, dan risiko yang tersisa ada di [`MUC-HARDENING.md`](MUC-HARDENING.md)):

- Membuka berkas data dari pihak luar tidak dapat menjalankan kode di komputer pengguna: isi sel di-escape, Content Security Policy ketat, dan jendela aplikasi berjalan dalam sandbox Chromium tanpa akses Node.js.
- Query ke DuckDB divalidasi sehingga workspace `.tad` atau nama berkas tidak dapat menyisipkan perintah SQL; berkas `.duckdb` dibuka read-only.
- Tidak ada koneksi jaringan keluar: ekstensi DuckDB `httpfs`, auto-updater, provider BigQuery, dukungan S3, dan unduhan kamus spell checker dinonaktifkan.
- Electron diperbarui ke 45.4.1 dengan Electron Fuses (executable tidak dapat dipakai sebagai interpreter Node.js).
- Pelaporan masalah diarahkan ke IT Support melalui `https://it-support.mucsystem.net/`.

## Instalasi

**Ikuti [Panduan Instalasi](PANDUAN-INSTALASI.md)** – langkah lengkap untuk mengunduh installer dari GitHub Actions, memverifikasi keasliannya (SHA-256), memasang, menerapkan aturan firewall, memastikan yang terpasang adalah build MUC, serta uji keamanan singkat.

Ringkasnya: unduh artifact `tad-muc-windows-<commit>` dari run terbaru yang sukses pada workflow **Build Tad MUC (Windows)**, cocokkan hash `Tad-MUC-Setup-<versi>.exe` dengan `SHA256SUMS.txt`, lalu instal untuk semua pengguna (`C:\Program Files\Tad\`).

## Membangun dan Menguji

- Panduan build Windows: `MUC-HARDENING.md` bagian 4.
- Uji keamanan sebelum distribusi: [`tools/muc-security/README.md`](tools/muc-security/README.md).
- Komponen `tadweb-server` dan `tadweb-app` tidak dibangun dan tidak boleh dijalankan.

## Lisensi dan Kredit

Tad dikembangkan oleh Antony Courtney dan para kontributornya, dan dirilis di bawah [Lisensi MIT](LICENSE). Pemberitahuan hak cipta asli dipertahankan sesuai ketentuan lisensi tersebut. Modifikasi pada repositori ini dibuat oleh IT Support PT Multi Utama Consultindo untuk penggunaan internal.

Dokumentasi pengembangan dari proyek asli tetap tersedia di folder [`doc/`](doc/).
