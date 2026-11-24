# Tad – Build Internal MUC (Hardened)

Repositori ini berisi **build internal Tad** untuk PT Multi Utama Consultindo (MUC): aplikasi desktop untuk melihat dan menganalisis data tabular (CSV, Parquet, dan berkas database DuckDB) dengan mesin [DuckDB](https://duckdb.org/) yang berjalan sepenuhnya di komputer pengguna.

> **Ini bukan rilis resmi Tad.** Kode ini adalah fork dari proyek open source [Tad](https://github.com/antonycourtney/tad) karya Antony Courtney (versi 0.14.0, commit `272ffa0`) yang telah dimodifikasi dan di-hardening oleh IT Support MUC. **Jangan memasang Tad dari situs resmi (`tadviewer.com`) atau dari halaman rilis proyek aslinya untuk keperluan kerja MUC.** Versi resmi memiliki celah keamanan yang memungkinkan berkas data berbahaya menjalankan program di komputer pengguna (lihat [bagian 2](#2-perbedaan-tad-asli-dan-tad-muc)).

**Daftar isi**

1. [Panduan Instalasi](#1-panduan-instalasi)
2. [Perbedaan Tad Asli dan Tad MUC](#2-perbedaan-tad-asli-dan-tad-muc)
3. [Membangun dan Menguji](#3-membangun-dan-menguji)
4. [Lisensi dan Kredit](#4-lisensi-dan-kredit)

---

## 1. Panduan Instalasi

| | |
|---|---|
| Sistem operasi | Windows 10 atau Windows 11, 64-bit |
| Hak akses | Akun dengan hak Administrator (untuk instalasi dan aturan firewall) |
| Akun GitHub | Akun yang memiliki akses ke repositori ini (untuk mengunduh installer) |
| Perkiraan waktu | 10–15 menit |

Ikuti langkah-langkah berikut secara berurutan.

### Langkah 1 – Mengunduh installer

1. Masuk (login) ke GitHub, lalu buka tab **Actions** pada repositori ini.
2. Di daftar sebelah kiri, pilih workflow **Build Tad MUC (Windows)**.
3. Pilih run **teratas yang bertanda centang hijau** (✓) pada branch `muc-hardening`.
4. Gulir ke bagian **Artifacts** di bawah halaman, lalu klik `tad-muc-windows-<kode-commit>` untuk mengunduh berkas ZIP (sekitar 142 MB).
5. Klik kanan berkas ZIP → **Extract All…** Hasil ekstrak berisi dua berkas:
   - `Tad-MUC-Setup-<versi>.exe` – installer aplikasi
   - `SHA256SUMS.txt` – sidik jari (hash) resmi installer

> Artifact disimpan GitHub selama 30 hari. Jika artifact sudah tidak tersedia, hubungi IT Support agar workflow dijalankan ulang.

### Langkah 2 – Memverifikasi keaslian installer

Langkah ini memastikan installer tidak rusak atau diubah pihak lain.

1. Buka folder hasil ekstrak di File Explorer.
2. Klik address bar (kolom alamat folder), ketik `powershell`, lalu tekan **Enter**.
3. Salin dan jalankan perintah berikut di jendela PowerShell:

```powershell
$exe = Get-ChildItem .\Tad-MUC-Setup-*.exe | Select-Object -First 1
$hash = (Get-FileHash $exe.FullName -Algorithm SHA256).Hash.ToLower()
"Berkas : $($exe.Name)"
"SHA-256: $hash"
if (Select-String -Path .\SHA256SUMS.txt -Pattern $hash -SimpleMatch -Quiet) { "COCOK - installer aman dipasang" } else { "TIDAK COCOK - JANGAN dipasang, hubungi IT Support" }
```

4. Hasilnya harus **COCOK**.
5. Untuk pemeriksaan tambahan, bandingkan nilai `SHA-256` yang tampil dengan hash pada halaman **Summary** run GitHub Actions tempat Anda mengunduh (bagian *Tad MUC installer*). Keduanya harus sama persis.

Jika hasilnya **TIDAK COCOK**, hapus berkas tersebut dan laporkan ke IT Support.

### Langkah 3 – Menghapus Tad versi resmi (jika ada)

1. Buka **Settings → Apps → Installed apps**.
2. Cari **Tad**. Jika ada Tad yang **bukan** build MUC (versinya tidak mengandung `muc`, misalnya `0.14.0`), pilih **⋯ → Uninstall**.

Jika yang terpasang sudah build MUC versi lama (misalnya `0.14.0-muc.1`), langkah ini dapat dilewati; installer baru akan memperbaruinya.

### Langkah 4 – Memasang Tad

1. Klik dua kali `Tad-MUC-Setup-<versi>.exe`.
2. Windows menampilkan layar biru **"Windows protected your PC"** karena installer belum ditandatangani secara digital. Klik **More info**, pastikan nama berkasnya `Tad-MUC-Setup-…`, lalu klik **Run anyway**.
3. Pada pilihan mode instalasi, pilih **"Anyone who uses this computer (all users)"**, lalu klik **Next**. Setujui permintaan izin Administrator (UAC) yang muncul.
4. Biarkan lokasi instalasi bawaan **`C:\Program Files\Tad\`**, klik **Install**, lalu **Finish**.

> Jika tombol **Run anyway** tidak tersedia, kebijakan keamanan perangkat Anda memblokir aplikasi yang belum ditandatangani. Jangan mencoba melewatinya; hubungi IT Support.

### Langkah 5 – Memasang aturan firewall

Tad tidak memerlukan koneksi internet. Aturan berikut memblokir seluruh lalu lintas jaringan `Tad.exe` sebagai lapisan pengamanan tambahan.

1. Klik kanan tombol **Start** → **Terminal (Admin)** atau **Windows PowerShell (Admin)**.
2. Jalankan:

```powershell
$tad = "C:\Program Files\Tad\Tad.exe"
New-NetFirewallRule -DisplayName "MUC - Blokir Tad Outbound" -Direction Outbound -Program $tad -Action Block -Profile Any
New-NetFirewallRule -DisplayName "MUC - Blokir Tad Inbound" -Direction Inbound -Program $tad -Action Block -Profile Any
```

3. Pastikan kedua aturan aktif:

```powershell
Get-NetFirewallRule -DisplayName "MUC - Blokir Tad*" | Format-Table DisplayName, Enabled, Direction, Action
```

Kedua baris harus menunjukkan `Enabled = True` dan `Action = Block`. Langkah ini cukup dilakukan sekali per komputer; tidak perlu diulang saat memperbarui Tad.

### Langkah 6 – Memastikan yang terpasang adalah build MUC

1. Buka **Tad** dari Start menu. Pada pembukaan pertama akan muncul jendela **Quick Start**; ini normal dan dapat ditutup.
2. Klik menu **Help**. Build MUC hanya berisi:
   - **Quick Start Guide**
   - **Report an Issue to IT Support (it-support.mucsystem.net)**

   Tad versi resmi menampilkan **Send Feedback / Bug Reports** di menu ini; jika itu yang muncul, yang terpasang bukan build MUC.
3. Di **Settings → Apps → Installed apps**, versi Tad harus mengandung `muc` (misalnya `0.14.0-muc.3`).

### Langkah 7 – Menggunakan Tad

- Buka data melalui menu **File → Open…** (`Ctrl+O`), lalu pilih berkas **CSV**, **Parquet**, atau **DuckDB** (`.duckdb`).
- Tad hanya **membaca** data. Berkas `.duckdb` dibuka dalam mode baca saja sehingga tidak dapat berubah.
- Hasil **Export** simpan hanya ke penyimpanan perusahaan (OneDrive/SharePoint Microsoft 365), bukan ke flashdisk atau folder pribadi. Jika Anda mengetik lokasi export secara manual, Tad akan meminta konfirmasi terlebih dahulu.
- Jangan membuka berkas workspace `.tad` yang diterima dari pihak di luar MUC.

### Langkah 8 – Uji keamanan singkat (disarankan)

Uji ini membuktikan bahwa perlindungan terhadap berkas data berbahaya berfungsi di komputer Anda. **Lakukan di laptop uji, bukan laptop yang berisi data klien.**

1. Unduh berkas uji dari repositori ini: buka [`tools/muc-security/fixtures/payload-xss.csv`](tools/muc-security/fixtures/payload-xss.csv), lalu klik tombol **Download raw file**.
2. **Tutup aplikasi Kalkulator** apabila sedang terbuka, agar hasil pengujian tidak tertukar.
3. Di Tad, buka berkas tersebut melalui **File → Open…**
4. Hasil yang benar:
   - **6 baris** data tampil, dan kolom `situs` menampilkan teks panjang seperti `https://example.com/<img/src/onerror=require(…`
   - Aplikasi **Kalkulator tidak terbuka**
   - Tidak ada berkas `tad-pwned.txt` di folder `%TEMP%` (ketik `%TEMP%` di address bar File Explorer untuk memeriksa)

Berkas ini berisi kode yang, pada Tad versi resmi, langsung membuka Kalkulator (bukti bahwa program apa pun dapat dijalankan). Pada build MUC kode tersebut hanya tampil sebagai teks. **Jika Kalkulator terbuka atau `tad-pwned.txt` terbentuk, hentikan penggunaan Tad dan segera laporkan ke IT Support.**

Prosedur pengujian lengkap untuk tim IT tersedia di [`tools/muc-security/README.md`](tools/muc-security/README.md).

### Memperbarui Tad

Unduh dan verifikasi installer terbaru (Langkah 1–2), lalu jalankan installer tersebut (Langkah 4). Tidak perlu menghapus versi lama terlebih dahulu, dan aturan firewall (Langkah 5) tetap berlaku.

### Menghapus Tad

1. **Settings → Apps → Installed apps → Tad → ⋯ → Uninstall.**
2. Hapus aturan firewall melalui PowerShell (Admin):

```powershell
Remove-NetFirewallRule -DisplayName "MUC - Blokir Tad Outbound", "MUC - Blokir Tad Inbound"
```

### Pemecahan masalah

| Gejala | Penyebab dan tindakan |
|---|---|
| Hasil verifikasi **TIDAK COCOK** | Berkas rusak atau telah diubah. Jangan dipasang; unduh ulang dan laporkan ke IT Support. |
| Tombol **Run anyway** tidak muncul | Kebijakan keamanan perangkat memblokir aplikasi tanpa tanda tangan digital. Hubungi IT Support. |
| Bagian **Artifacts** kosong atau artifact kedaluwarsa | Minta IT Support menjalankan ulang workflow *Build Tad MUC (Windows)*. |
| Jendela Tad kosong setelah membuka berkas dengan klik dua kali | Pastikan versi minimal `0.14.0-muc.3` (versi sebelumnya memiliki masalah ini). Sementara itu gunakan **File → Open…** |
| Menu Help berisi **Send Feedback / Bug Reports** | Yang terpasang adalah Tad versi resmi. Uninstall, lalu pasang build MUC. |
| Masalah lain | Laporkan melalui **Help → Report an Issue to IT Support** atau `https://it-support.mucsystem.net/`. |

---

## 2. Perbedaan Tad Asli dan Tad MUC

Tampilan dan fungsi utama **tidak berubah**: tabel pivot bertingkat, filter, agregasi, pengurutan, pemilihan dan format kolom, histogram, serta dukungan CSV, Parquet, dan DuckDB tetap sama seperti Tad asli. Yang berubah adalah lapisan keamanan di bawahnya.

### 2.1 Ringkasan

| | Tad asli (0.14.0) | Tad MUC (0.14.0-muc.x) |
|---|---|---|
| Membuka CSV berbahaya | **Dapat menjalankan program** di komputer pengguna tanpa klik apa pun | Isi berkas hanya tampil sebagai teks |
| Koneksi internet | Mengunduh komponen dan memeriksa pembaruan ke internet | **Tidak ada koneksi keluar sama sekali** |
| Perubahan data | Berkas `.duckdb` dibuka dengan hak tulis | Berkas `.duckdb` dibuka **read-only** |
| Platform Electron | 31.0.1 (sudah tidak menerima patch keamanan) | 45.4.1 (masih didukung) |
| Distribusi | Auto-update dari GitHub proyek asli | Hanya dari repositori ini, diverifikasi SHA-256 |

### 2.2 Rincian perubahan keamanan

**Perlindungan dari berkas data berbahaya**

| Aspek | Tad asli | Tad MUC |
|---|---|---|
| Sel berisi URL | Dirender sebagai HTML **tanpa escaping**: teks seperti `<img onerror=…>` di dalam CSV menjadi kode aktif | Isi sel di-escape; hanya URL `http`/`https` yang valid yang dapat menjadi link; fitur link **nonaktif secara bawaan** (dapat diaktifkan per kolom) |
| Akses jendela aplikasi ke sistem | `nodeIntegration: true`, `contextIsolation: false`, tanpa sandbox: kode di halaman dapat memanggil `child_process` dan menjalankan program apa pun | `nodeIntegration: false`, `contextIsolation: true`, **`sandbox: true`**: halaman tidak memiliki akses ke Node.js maupun sistem operasi |
| Komunikasi halaman ↔ proses utama | Akses penuh ke `ipcRenderer`, `clipboard`, `shell` | Melalui jembatan `window.tadApi` dengan **daftar kanal yang diizinkan**; setiap pesan diperiksa asal pengirimnya |
| Content Security Policy | Tidak ada | CSP ketat: script inline dan event handler sisipan (`onerror=`, `onload=`) diblokir |
| Navigasi, popup, izin perangkat | Jendela dapat diarahkan ke situs luar; `window.open` diizinkan | Navigasi, popup, `<webview>`, serta permintaan izin (kamera, mikrofon, lokasi, dll.) diblokir |
| Klik URL di sel | Skema apa pun (`file://`, `smb://`) diteruskan ke Windows, dapat membuka program atau share jaringan | Hanya `http`/`https`, divalidasi dua kali (di halaman dan di proses utama) |

**Perlindungan query database (DuckDB)**

| Aspek | Tad asli | Tad MUC |
|---|---|---|
| Nama berkas di query | Disisipkan langsung: nama berkas berisi tanda kutip dapat **menyisipkan perintah SQL** (misalnya menulis berkas melalui `COPY … TO`) | Di-escape sebagai string literal SQL |
| Workspace `.tad` | Nama fungsi agregat, operator filter, dan query `sql` mentah masuk ke SQL **tanpa pemeriksaan** | Seluruh struktur query divalidasi dengan daftar putih (whitelist); query `sql` mentah ditolak |
| Berkas `.duckdb` | Dibuka dengan hak tulis; path sembarang dapat membuat berkas database baru | Dibuka **read-only**; berkas yang tidak ada tidak akan dibuat |
| Export | Path dan opsi kompresi tidak divalidasi | Format dan kompresi di-whitelist, path di-escape, ekstensi harus sesuai, path yang diketik manual wajib dikonfirmasi |

**Jaringan dan pembaruan**

| Aspek | Tad asli | Tad MUC |
|---|---|---|
| Ekstensi DuckDB `httpfs` | Diunduh dari internet lalu dimuat setiap kali koneksi database dibuka; memungkinkan baca/tulis `http(s)://` dan `s3://` | Tidak diunduh dan tidak dimuat |
| Kredensial AWS | Jika variabel `AWS_*` ada di komputer, disalin ke pengaturan DuckDB | Tidak pernah dibaca |
| Provider BigQuery | Disertakan (koneksi ke Google Cloud) | Dihapus |
| Auto-updater | `electron-updater` ke GitHub proyek asli (menu *Check for Updates* di macOS) | Dihapus; pembaruan hanya melalui IT Support |
| Spell checker Chromium | Mengunduh kamus dari `redirector.gvt1.com` | Dinonaktifkan |
| Hasil pengukuran | — | **Nol** permintaan jaringan keluar (diverifikasi dengan proxy pencatat) |

**Platform dan paket aplikasi**

| Aspek | Tad asli | Tad MUC |
|---|---|---|
| Versi Electron | 31.0.1 (end-of-life) | 45.4.1 |
| Electron Fuses | Bawaan: `Tad.exe` dapat dipakai sebagai interpreter Node.js (`ELECTRON_RUN_AS_NODE`) | `RunAsNode`, `NODE_OPTIONS`, dan `--inspect` dinonaktifkan; aplikasi hanya dimuat dari `app.asar` |
| Identitas aplikasi | `com.antonycourtney.tad`, publisher Antony Courtney, installer `Tad Setup 0.14.0.exe` | `net.mucsystem.tad`, publisher PT Multi Utama Consultindo - IT Support, installer `Tad-MUC-Setup-<versi>.exe` |
| Menu Help | *Send Feedback / Bug Reports* (email ke pembuat Tad) | *Report an Issue to IT Support* (`https://it-support.mucsystem.net/`) |
| Verifikasi build | Tidak ada | Setiap build otomatis menjalankan uji validator query, pemeriksaan fuse, dan uji runtime berkas berbahaya di Windows; installer disertai SHA-256 |

**Perbaikan bug tambahan**

- Berkas dengan tanda kutip tunggal pada namanya (misalnya `Q1'25 laporan.csv`) gagal dibuka di Tad asli; di build MUC dapat dibuka.
- Jendela Quick Start yang ditutup lalu dibuka kembali menimbulkan error di Tad asli; sudah diperbaiki.

### 2.3 Bukti pengujian di Windows

Setiap build menjalankan pengujian otomatis di mesin Windows GitHub Actions: berkas [`payload-xss.csv`](tools/muc-security/fixtures/payload-xss.csv) dibuka di build MUC dan, sebagai pembanding, di installer resmi Tad 0.14.0.

| Hasil | Tad MUC | Tad asli 0.14.0 |
|---|---|---|
| Berkas termuat dan tampil | Ya | Ya |
| Kolom `situs` | Tampil sebagai teks | Kosong (kode telah dieksekusi) |
| Jendela Kalkulator terbuka | 0 | 5 |
| Program lain dijalankan oleh Tad | Tidak ada | 5× `cmd.exe` |
| Berkas penanda di `%TEMP%` | Tidak terbentuk | Terbentuk |

Tangkapan layar setiap pengujian tersedia sebagai artifact `runtime-test-<commit>` pada run workflow yang sama.

### 2.4 Fungsi yang sengaja dinonaktifkan

| Fungsi | Alasan |
|---|---|
| Membuka berkas dari URL `http(s)://` atau `s3://` | Memerlukan ekstensi `httpfs` dan koneksi internet |
| Koneksi ke Google BigQuery | Tidak digunakan di MUC; membuka koneksi ke layanan cloud |
| Pembaruan otomatis | Pembaruan harus melalui build internal yang telah diverifikasi |
| Link otomatis pada sel URL | Nonaktif secara bawaan untuk mengurangi risiko; dapat diaktifkan per kolom melalui tab **Format** di panel *Additional Properties* |
| Spell checker | Tidak diperlukan dan mengunduh kamus dari internet |
| `tadweb-server` / `tadweb-app` | Server web tanpa autentikasi (port 9000); tidak dibangun dan tidak boleh dijalankan |

Rincian teknis seluruh perubahan (H1–H27), risiko yang masih tersisa, dan pemetaan ke ISO/IEC 27001:2022 serta UU PDP tersedia di [`MUC-HARDENING.md`](MUC-HARDENING.md).

---

## 3. Membangun dan Menguji

- **Build otomatis:** workflow [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml) berjalan setiap kali kode pada branch `muc-hardening` berubah, atau secara manual melalui *Actions → Build Tad MUC (Windows) → Run workflow*. Perubahan yang hanya menyentuh dokumentasi (`*.md`, `doc/`) tidak memicu build.
- **Build manual di Windows:** lihat `MUC-HARDENING.md` bagian 4.
- **Uji keamanan sebelum distribusi:** [`tools/muc-security/README.md`](tools/muc-security/README.md).

## 4. Lisensi dan Kredit

Tad dikembangkan oleh Antony Courtney dan para kontributornya, dan dirilis di bawah [Lisensi MIT](LICENSE). Pemberitahuan hak cipta asli dipertahankan sesuai ketentuan lisensi tersebut. Modifikasi pada repositori ini dibuat oleh IT Support PT Multi Utama Consultindo untuk penggunaan internal.

Dokumentasi pengembangan dari proyek asli tetap tersedia di folder [`doc/`](doc/).
