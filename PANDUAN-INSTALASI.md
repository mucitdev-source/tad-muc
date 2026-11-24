# Panduan Instalasi Tad – Build Internal MUC

Panduan ini menjelaskan cara mengunduh, memverifikasi, memasang, dan memastikan bahwa Tad yang terpasang adalah **build internal MUC yang telah di-hardening**, bukan rilis resmi Tad. Ikuti langkah-langkah secara berurutan.

| | |
|---|---|
| Sistem operasi | Windows 10 atau Windows 11, 64-bit |
| Hak akses | Akun dengan hak Administrator (untuk instalasi dan aturan firewall) |
| Akun GitHub | Akun yang memiliki akses ke repositori ini (untuk mengunduh installer) |
| Perkiraan waktu | 10–15 menit |

> **Penting:** Jangan pernah memasang Tad dari situs resmi (`tadviewer.com`) atau dari halaman rilis proyek aslinya untuk keperluan kerja MUC. Versi resmi memiliki celah keamanan yang memungkinkan berkas data berbahaya menjalankan program di komputer Anda (lihat [`MUC-HARDENING.md`](MUC-HARDENING.md)).

---

## Langkah 1 – Mengunduh Installer

1. Masuk (login) ke GitHub, lalu buka tab **Actions** pada repositori ini.
2. Di daftar sebelah kiri, pilih workflow **Build Tad MUC (Windows)**.
3. Pilih run **teratas yang bertanda centang hijau** (✓) pada branch `muc-hardening`.
4. Gulir ke bagian **Artifacts** di bawah halaman, lalu klik `tad-muc-windows-<kode-commit>` untuk mengunduh berkas ZIP (sekitar 142 MB).
5. Klik kanan berkas ZIP → **Extract All…** Hasil ekstrak berisi dua berkas:
   - `Tad-MUC-Setup-<versi>.exe` – installer aplikasi
   - `SHA256SUMS.txt` – sidik jari (hash) resmi installer

> Artifact disimpan GitHub selama 30 hari. Jika artifact sudah tidak tersedia, hubungi IT Support agar workflow dijalankan ulang.

## Langkah 2 – Memverifikasi Keaslian Installer

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

## Langkah 3 – Menghapus Tad Versi Resmi (Jika Ada)

1. Buka **Settings → Apps → Installed apps**.
2. Cari **Tad**. Jika ada Tad yang **bukan** build MUC (versinya tidak mengandung `muc`, misalnya `0.14.0`), pilih **⋯ → Uninstall**.

Jika yang terpasang sudah build MUC versi lama (misalnya `0.14.0-muc.1`), langkah ini dapat dilewati; installer baru akan memperbaruinya.

## Langkah 4 – Memasang Tad

1. Klik dua kali `Tad-MUC-Setup-<versi>.exe`.
2. Windows menampilkan layar biru **"Windows protected your PC"** karena installer belum ditandatangani secara digital. Klik **More info**, pastikan nama berkasnya `Tad-MUC-Setup-…`, lalu klik **Run anyway**.
3. Pada pilihan mode instalasi, pilih **"Anyone who uses this computer (all users)"**, lalu klik **Next**. Setujui permintaan izin Administrator (UAC) yang muncul.
4. Biarkan lokasi instalasi bawaan **`C:\Program Files\Tad\`**, klik **Install**, lalu **Finish**.

> Jika tombol **Run anyway** tidak tersedia, kebijakan keamanan perangkat Anda memblokir aplikasi yang belum ditandatangani. Jangan mencoba melewatinya; hubungi IT Support.

## Langkah 5 – Memasang Aturan Firewall

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

## Langkah 6 – Memastikan yang Terpasang adalah Build MUC

1. Buka **Tad** dari Start menu. Pada pembukaan pertama akan muncul jendela **Quick Start**; ini normal dan dapat ditutup.
2. Klik menu **Help**. Build MUC hanya berisi:
   - **Quick Start Guide**
   - **Report an Issue to IT Support (it-support.mucsystem.net)**

   Tidak boleh ada menu **Check for Updates**.
3. Di **Settings → Apps → Installed apps**, versi Tad harus mengandung `muc` (misalnya `0.14.0-muc.3`).

## Langkah 7 – Menggunakan Tad

- Buka data melalui menu **File → Open…** (`Ctrl+O`), lalu pilih berkas **CSV**, **Parquet**, atau **DuckDB** (`.duckdb`).
- Tad hanya **membaca** data. Berkas `.duckdb` dibuka dalam mode baca saja sehingga tidak dapat berubah.
- Hasil **Export** simpan hanya ke penyimpanan perusahaan (OneDrive/SharePoint Microsoft 365), bukan ke flashdisk atau folder pribadi. Jika Anda mengetik lokasi export secara manual, Tad akan meminta konfirmasi terlebih dahulu.
- Jangan membuka berkas workspace `.tad` yang diterima dari pihak di luar MUC.

## Langkah 8 – Uji Keamanan Singkat (Disarankan)

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

## Memperbarui Tad

Unduh dan verifikasi installer terbaru (Langkah 1–2), lalu jalankan installer tersebut (Langkah 4). Tidak perlu menghapus versi lama terlebih dahulu, dan aturan firewall (Langkah 5) tetap berlaku.

## Menghapus Tad

1. **Settings → Apps → Installed apps → Tad → ⋯ → Uninstall.**
2. Hapus aturan firewall melalui PowerShell (Admin):

```powershell
Remove-NetFirewallRule -DisplayName "MUC - Blokir Tad Outbound", "MUC - Blokir Tad Inbound"
```

## Pemecahan Masalah

| Gejala | Penyebab dan tindakan |
|---|---|
| Hasil verifikasi **TIDAK COCOK** | Berkas rusak atau telah diubah. Jangan dipasang; unduh ulang dan laporkan ke IT Support. |
| Tombol **Run anyway** tidak muncul | Kebijakan keamanan perangkat memblokir aplikasi tanpa tanda tangan digital. Hubungi IT Support. |
| Bagian **Artifacts** kosong atau artifact kedaluwarsa | Minta IT Support menjalankan ulang workflow *Build Tad MUC (Windows)*. |
| Jendela Tad kosong setelah membuka berkas dengan klik dua kali | Pastikan versi minimal `0.14.0-muc.3` (versi sebelumnya memiliki masalah ini). Sementara itu gunakan **File → Open…** |
| Menu Help masih berisi **Check for Updates** | Yang terpasang adalah Tad versi resmi. Uninstall, lalu pasang build MUC. |
| Masalah lain | Laporkan melalui **Help → Report an Issue to IT Support** atau `https://it-support.mucsystem.net/`. |
