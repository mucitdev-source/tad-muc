# Catatan Hardening Keamanan Tad – PT Multi Utama Consultindo

Branch: `muc-hardening` (basis upstream `antonycourtney/tad` commit `272ffa0`, 5 Maret 2025)
Tanggal: 24 November 2026
Penyusun: IT Support (Penyusun Kebijakan Keamanan Informasi)

Dokumen ini mencatat perubahan keamanan yang diterapkan pada fork internal Tad
sebelum aplikasi digunakan oleh konsultan MUC untuk membuka data kerja dengan DuckDB.

## 1. Ringkasan Perubahan

| # | Temuan | Risiko | Perubahan | File |
|---|---|---|---|---|
| H1 | Sel yang dikenali sebagai URL dirender ke HTML tanpa escaping. Dengan `nodeIntegration: true` dan `contextIsolation: false`, CSV berbahaya dapat menjalankan kode di komputer pengguna | Tinggi | URL di-escape dengan `he.encode`, hanya skema `http`/`https` yang diterima, karakter yang tidak sah menurut RFC 3986 (`<`, `>`, `"`, backtick, spasi, dst.) ditolak, dan fitur hyperlink dimatikan secara bawaan | `packages/tadviewer/src/TextFormatOptions.ts` |
| H2 | Klik sel URL meneruskan skema apa pun (`file://`, `smb://`) ke `shell.openExternal` | Sedang | Validasi ulang skema `http`/`https` sebelum `openExternal` | `packages/tad-app/src/electronRenderMain.tsx` |
| H3 | Jendela utama tanpa Content Security Policy | Sedang | CSP ketat: `script-src 'self'` tanpa `'unsafe-inline'`/`'unsafe-eval'`, `object-src`/`frame-src`/`base-uri`/`form-action` diblokir | `packages/tad-app/html/index.html` |
| H4 | Tidak ada pembatasan navigasi, popup, webview, atau permintaan izin | Sedang | Navigasi dari renderer diblokir, `window.open` ditolak, `<webview>` ditolak, seluruh permintaan izin (kamera, mikrofon, lokasi, dll.) ditolak | `packages/tad-app/app/main.ts` |
| H5 | DuckDB mengunduh dan memuat ekstensi `httpfs` dari internet setiap kali koneksi dibuka | Sedang | `INSTALL/LOAD httpfs` dihapus, diganti `SET autoinstall_known_extensions = false; SET autoload_known_extensions = false;`. Pembacaan `http(s)://` dan `s3://` tidak lagi tersedia | `packages/reltab-duckdb/src/reltab-duckdb.ts` |
| H6 | Path file disisipkan langsung ke SQL (`read_csv_auto('${filePath}')`), sehingga nama file berisi tanda kutip dapat menyisipkan perintah DuckDB (misalnya `COPY ... TO` untuk menulis file) | Tinggi | Path di-render sebagai string literal SQL dengan escaping tanda kutip (`sqlStringLiteral`) | `packages/reltab-duckdb/src/csvimport.ts` |
| H7 | Helper deteksi lingkungan memakai `new Function(...)`, yang akan diblokir CSP pada H3 dan memutus render kolom BLOB | Pendukung | Diganti dengan pengecekan `globalThis` yang setara tanpa eval | `packages/reltab/src/util/environ.ts` |

## 2. Bukti Pengujian (lingkungan uji terisolasi, 24 Nov 2026)

**Formatter sel (H1).** Diuji dengan DOM (jsdom) terhadap payload berikut:
`<svg/onload=...>`, `<img/src=x/onerror=...>`, `<script>`, `" onmouseover="`, `file://`, `smb://`.
- Upstream: payload `<svg/onload=require(\`child_process\`).exec(...)>` menghasilkan elemen SVG dengan handler `onload` aktif. `smb://` dan URL berisi markup diteruskan ke `openURL`.
- Setelah patch (bawaan maupun dengan hyperlink diaktifkan): tidak ada markup atau handler yang tersisip. Hanya URL `https://` yang sah yang menjadi link dan dapat dibuka.

**DuckDB (H5, H6).** Diuji dengan DuckDB 2.0.1:
- Upstream: file bernama `x.csv') ; COPY (SELECT 42 AS hacked) TO 'pwned.txt' ; --.csv` berhasil membuat DuckDB menulis `pwned.txt`. File sah bernama `Q1'25 laporan.csv` gagal dibuka (parser error).
- Setelah patch: nama file berbahaya diperlakukan sebagai nama file biasa dan tidak ada file yang ditulis. `Q1'25 laporan.csv` terbuka normal. `parquet_scan` lokal berfungsi. Pembacaan `https://` ditolak karena `httpfs` tidak dimuat.

**Kompilasi.** `tsc` lolos untuk `reltab`, `aggtree`, `reltab-duckdb`, `reltab-fs`, `reltab-sqlite`, `reltab-bigquery`, `reltab-snowflake`, `reltab-aws-athena`, dan `tadviewer`. `tsc --noEmit` lolos untuk `tad-app`. `webpack --mode production` untuk `tad-app` berhasil.

**Kompatibilitas CSP.** Bundle renderer hanya menyisakan `new Function` di DataView SlickGrid (filter/grouping terkompilasi) dan `eval` di helper debug SlickGrid. Keduanya tidak dipakai Tad, yang menggunakan `Slick.Grid` dengan `PagedDataView` sendiri.

> Belum diuji: menjalankan aplikasi Electron hasil build di Windows. Uji fungsional manual wajib dilakukan sebelum distribusi (lihat bagian 4).

## 3. Risiko yang Belum Ditangani (Tahap Berikutnya)

1. **File workspace `.tad` dapat membawa query SQL mentah.** Isi `.tad` dideserialisasi menjadi `QueryExp`, dan operator `sql` dijalankan apa adanya oleh DuckDB (termasuk `COPY ... TO`, pembacaan file lokal lain, dan `INSTALL`). Sampai diperbaiki: **jangan membuka file `.tad` yang berasal dari luar MUC.**
2. **Electron 31.0.1** sudah tidak menerima patch keamanan Chromium. Perlu upgrade ke versi major yang masih didukung.
3. **`nodeIntegration: true` / `contextIsolation: false`** masih aktif di jendela utama dan Quick Start. Perlu refactor ke preload + IPC (`electronClient.ts`, `electronRenderMain.tsx`, `PivotRequester.ts`).
4. **`electron-updater`** masih mengarah ke GitHub Releases upstream. Untuk build internal, menu *Check for Updates* sebaiknya dinonaktifkan agar pengguna tidak tertimpa build upstream yang belum di-hardening.
5. **`tadweb-server`** (port 9000, tanpa autentikasi) tidak boleh dibangun maupun dijalankan.

## 4. Checklist Uji Fungsional di Windows Sebelum Distribusi

- [ ] Build `tad-app` dari branch ini, instal per-machine (`C:\Program Files\Tad\`).
- [ ] Buka CSV contoh, Parquet, file `.duckdb`, dan `.sqlite`. Pastikan grid, pivot, filter, histogram, dan export berfungsi.
- [ ] Buka DevTools (Ctrl+Shift+I), lalu pastikan tidak ada pelanggaran CSP selain akibat atribut `onclick` pada link sel.
- [ ] Aktifkan *URLs as hyperlinks* pada sebuah kolom, klik URL `https://` (harus terbuka di browser), lalu uji sel `smb://` dan `file://` (harus diabaikan).
- [ ] Buka CSV uji berisi `https://example.com/<svg/onload=alert(1)>`. Tidak boleh muncul dialog alert.
- [ ] Terapkan aturan Windows Defender Firewall untuk memblokir `Tad.exe` (inbound dan outbound), lalu pastikan aplikasi tetap berfungsi normal.

## 5. Pemetaan Kontrol

ISO/IEC 27001:2022 Annex A: A.8.7 (Protection against malware), A.8.8 (Management of technical vulnerabilities),
A.8.19 (Installation of software on operational systems), A.8.20 (Network security), A.8.28 (Secure coding).
UU No. 27 Tahun 2022 (UU PDP): mencegah kebocoran data wajib pajak klien melalui eksekusi kode atau koneksi keluar dari aplikasi penampil data.
