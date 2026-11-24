# Catatan Hardening Keamanan Tad – PT Multi Utama Consultindo

| | |
|---|---|
| Branch | `muc-hardening` |
| Basis upstream | `antonycourtney/tad` commit `272ffa0` (5 Maret 2025, versi 0.14.0) |
| Versi build MUC | `0.14.0-muc.2` (installer `Tad-MUC-Setup-0.14.0-muc.2.exe`) |
| Repositori | `https://github.com/mucitdev-source/tad-muc` |
| Tanggal | 24 November 2026 |
| Penyusun | IT Support – Penyusun dan Koordinator Kebijakan Keamanan Informasi |
| Status | Siap uji fungsional di Windows (lihat bagian 6) |

Dokumen ini mencatat seluruh perubahan keamanan pada fork internal Tad sebelum aplikasi digunakan oleh konsultan MUC untuk membuka data kerja (CSV, Parquet, DuckDB). Tujuannya: (1) membuka berkas dari pihak luar tidak dapat menjalankan kode di laptop pengguna, (2) aplikasi tidak melakukan koneksi jaringan keluar, dan (3) data klien tidak dapat diubah atau dibocorkan melalui aplikasi ini.

## 1. Ringkasan Temuan pada Versi Upstream

| Temuan | Dampak | Bukti |
|---|---|---|
| Sel CSV yang dikenali sebagai URL dirender ke HTML tanpa escaping, di jendela dengan `nodeIntegration: true` dan `contextIsolation: false` | **Eksekusi kode jarak jauh (RCE)** hanya dengan *membuka* CSV, tanpa klik | Uji runtime: CSV berisi `https://example.com/<img/src/onerror=require(\`child_process\`).execSync(...)>` menjalankan perintah sistem pada Tad upstream |
| Path berkas disisipkan langsung ke SQL DuckDB | Injeksi SQL melalui nama berkas (mis. menulis berkas lewat `COPY ... TO`) | Uji: nama berkas berisi `') ; COPY ... TO 'pwned.txt'` membuat DuckDB menulis berkas |
| `reltab` menyusun SQL dengan interpolasi tanpa quote (nama tabel, fungsi agregat, operator, tipe `CAST`, operator boolean filter) | Workspace `.tad` (melalui `aggMap` dan `filterExp`) atau renderer yang disusupi dapat menyisipkan SQL | Uji: payload nama tabel dan tipe `CAST` berhasil menulis berkas; payload `.tad` terbukti masuk mentah ke SQL (terlihat pada pesan parser DuckDB) |
| DuckDB mengunduh ekstensi `httpfs` dari internet di setiap koneksi | Koneksi keluar, pemuatan kode dari internet, akses `http(s)://` / `s3://` | Kode `INSTALL 'httpfs'; LOAD 'httpfs'` |
| Electron 31.0.1 | Tidak lagi menerima patch keamanan Chromium | — |
| `window.open` dan navigasi tidak dibatasi; tanpa CSP | Jendela Tad dapat diarahkan ke situs luar dengan akses Node.js aktif | Uji runtime: navigasi ke `https://` berhasil; Electron menampilkan *Security Warning* |
| Spell checker Chromium aktif | Mengunduh kamus dari `redirector.gvt1.com` saat aplikasi dibuka | Tertangkap melalui proxy pencatat |
| `ELECTRON_RUN_AS_NODE` aktif | `Tad.exe` dapat dipakai sebagai interpreter Node.js (*living-off-the-land binary*) | Uji: `ELECTRON_RUN_AS_NODE=1 tad -e "..."` menjalankan kode |

> **Koreksi atas versi awal dokumen ini:** berkas `.tad` tidak menyimpan query SQL mentah. Berkas tersebut menyimpan `dsPath` dan `viewParams`; jalur injeksinya adalah nama fungsi agregat (`aggMap`) dan operator boolean filter (`filterExp.op`), yang sebelumnya disisipkan ke SQL tanpa pemeriksaan. Keduanya kini ditolak oleh validator (H8).

## 2. Daftar Perubahan

### Tahap 1 – Celah utama (commit `014ce6d`)

| # | Perubahan | Berkas |
|---|---|---|
| H1 | URL di sel di-escape (`he.encode`); hanya `http`/`https` tanpa karakter terlarang RFC 3986 yang diterima; fitur hyperlink dimatikan secara bawaan | `packages/tadviewer/src/TextFormatOptions.ts` |
| H2 | Validasi skema sebelum membuka URL eksternal | `packages/tad-app/src/electronRenderMain.tsx` |
| H3 | Content Security Policy ketat pada jendela utama (tanpa `'unsafe-inline'`/`'unsafe-eval'` untuk script) | `packages/tad-app/html/index.html` |
| H4 | Navigasi renderer, `window.open`, `<webview>`, dan seluruh permintaan izin (kamera, mikrofon, lokasi, dsb.) diblokir | `packages/tad-app/app/main.ts` |
| H5 | Unduhan dan pemuatan otomatis ekstensi DuckDB dimatikan | `packages/reltab-duckdb/src/reltab-duckdb.ts` |
| H6 | Path berkas di-escape sebagai string literal SQL | `packages/reltab-duckdb/src/csvimport.ts` |
| H7 | Helper deteksi lingkungan tanpa `new Function` (kompatibel dengan CSP) | `packages/reltab/src/util/environ.ts` |

### Tahap 2 – Validasi query dan data (commit `7603dcb`)

| # | Perubahan | Berkas |
|---|---|---|
| H8 | Validator query: operator `sql` mentah ditolak; nama tabel, fungsi agregat, operator aritmetika/unary/window, tipe `CAST`, operator filter dan boolean, tipe join, serta tipe konstanta di-whitelist. Berlaku untuk query dari renderer, workspace `.tad`, dan permintaan export | `packages/reltab/src/queryValidation.ts`, `QueryExp.ts` |
| H9 | Validasi nama tabel pada RPC `getTableSchema` | `packages/reltab/src/remote/server.ts` |
| H10 | Berkas `.duckdb` dibuka **read-only**; database in-memory untuk impor CSV/Parquet tetap dapat ditulis | `packages/reltab-duckdb/src/reltab-duckdb.ts` |
| H11 | Export: format dan kompresi Parquet di-whitelist, path di-escape, wajib path absolut dengan ekstensi sesuai, dan path yang diketik manual wajib dikonfirmasi melalui dialog bawaan sistem operasi | `packages/tad-app/app/appWindow.ts`, `fileExport.ts` |
| H12 | Provider BigQuery dilepas dari aplikasi desktop | `packages/tad-app/app/main.ts`, `package.json` |

### Tahap 3 – Platform (commit `067f1f3`)

| # | Perubahan | Berkas |
|---|---|---|
| H13 | Upgrade Electron 31.0.1 → **45.4.1** (rilis 19 November 2026); penyesuaian API menu (`BaseWindow`) | `packages/tad-app/package.json`, `app/appMenu.ts` |
| H14 | `electron-updater` dan menu *Check for Updates* dihapus; pembaruan hanya didistribusikan oleh IT | `app/appMenu.ts`, `app/updater.ts` (dihapus) |
| H15 | Menu *Help* mengarahkan pelaporan masalah ke `https://it-support.mucsystem.net/` | `app/appMenu.ts` |
| H16 | Inisialisasi S3 dinonaktifkan: kredensial AWS dari environment tidak lagi disalin ke DuckDB, dan aplikasi tidak gagal start bila variabel `AWS_*` ada | `packages/reltab-duckdb/src/s3utils.ts` |

### Tahap 4 – Isolasi proses renderer (commit `a495afc`)

| # | Perubahan | Berkas |
|---|---|---|
| H17 | Jendela utama dan Quick Start: `nodeIntegration: false`, `contextIsolation: true`, **`sandbox: true`**. Renderer tidak lagi memiliki `require`/`process` | `app/appWindow.ts`, `app/quickStart.ts` |
| H18 | Preload dengan API sempit `window.tadApi`; kanal `invoke`/`send`/`on` di-allowlist; listener tidak menerima objek event IPC | `app/preload.js`, `app/quickstartPreload.js` |
| H19 | Setiap handler IPC di proses utama memeriksa bahwa pengirim adalah halaman bawaan Tad | `app/ipcSecurity.ts`, `main.ts`, `appWindow.ts`, `quickStart.ts` |
| H20 | Clipboard dan pembukaan URL eksternal dipindahkan ke proses utama dengan validasi | `app/ipcSecurity.ts`, `src/electronRenderMain.tsx`, `src/tadApi.ts` |
| H21 | Halaman Quick Start: script inline dan atribut `onclick` dipindahkan ke berkas eksternal, CSP ditambahkan, tautan email upstream diganti portal IT Support | `html/userdocs/quickstart.html`, `html/userdocs/js/quickstart.js` |
| H22 | Bundle renderer dibangun dengan target `web`: kode renderer yang mencoba memakai modul Node akan gagal saat build | `webpack.config.js` |

### Tahap 5 – Packaging dan jaringan (commit `a3027cc`, `81af86d`)

| # | Perubahan | Berkas |
|---|---|---|
| H23 | Electron Fuses pada executable: `RunAsNode` nonaktif, `NODE_OPTIONS` dan `--inspect` diabaikan, `OnlyLoadAppFromAsar` aktif | `tools/afterPack.js` (`@electron/fuses` 1.8.0) |
| H24 | Spell checker dimatikan sehingga tidak ada unduhan kamus. Hasil: **nol koneksi keluar** | `app/main.ts`, `app/appWindow.ts`, `app/quickStart.ts` |
| H25 | `"publish": null` (tidak ada `app-update.yml` yang mengarah ke GitHub upstream); output packaging ke `release/` | `package.json` |
| H26 | Binary DuckDB N-API bawaan dipaketkan tanpa rebuild (`"npmRebuild": false`), sehingga build di Windows tidak membutuhkan compiler C++ | `package.json` |
| H27 | Identitas build dipisahkan dari rilis resmi: versi `0.14.0-muc.x`, `appId` `net.mucsystem.tad`, publisher "PT Multi Utama Consultindo - IT Support" (penulis asli dicantumkan sebagai kontributor), nama installer `Tad-MUC-Setup-<versi>.exe`, homepage ke repositori MUC; pipeline CI upstream (`azure-pipelines.yml`) dihapus | `packages/tad-app/package.json`, `README.md` |

## 3. Bukti Pengujian

Lingkungan uji terisolasi: Ubuntu 24.04, Node 22.23, Xvfb, Electron dikendalikan melalui Chrome DevTools Protocol. Pembanding: build upstream asli (`272ffa0`, Electron 31.0.1) dengan data uji yang sama.

### 3.1 Runtime: upstream vs build MUC

| Pemeriksaan | Upstream | Build MUC |
|---|---|---|
| Membuka CSV berisi payload `<img/src/onerror=...>` | Perintah sistem **tereksekusi** | Payload tampil sebagai teks; tidak ada eksekusi |
| Elemen HTML dari isi sel masuk ke DOM | 2 elemen (`svg`, `img`) | 0 |
| `typeof require` di renderer | `function` | `undefined` |
| Script inline yang disisipkan ke halaman | Berjalan | Diblokir CSP |
| `window.open('https://...')` | Terbuka | Ditolak |
| Navigasi jendela ke situs luar | Berhasil | Diblokir |
| Membuka `.tad` dengan payload di `aggMap`/`filterExp` | Payload masuk ke SQL | Ditolak validator (`QueryValidationError`); tidak ada berkas tertulis |
| Memanggil kanal IPC di luar allowlist dari halaman | (tidak relevan: akses penuh) | Ditolak preload |
| Mengirim query `sql` mentah melalui API data | (tidak ada validasi) | Ditolak proses utama |

### 3.2 Fungsional build MUC

- CSV, Parquet, dan `.duckdb` terbuka normal. Berkas `.duckdb` tidak berubah setelah dibuka (hash SHA-256 identik).
- Workspace `.tad` dengan pivot per kota, agregasi `sum`, dan filter `jumlah > 100` menghasilkan angka yang benar.
- Halaman Quick Start berjalan di bawah CSP tanpa pelanggaran; tautan dan tombol contoh berfungsi.
- Uji regresi validator (`tools/muc-security/validator-test.js`): 10 bentuk query sah lolos dan menghasilkan SQL valid yang dieksekusi di DuckDB; 11 payload query dan 1 nama tabel berbahaya ditolak, sementara 2 nama tabel sah diterima.

### 3.3 Packaging

- Alur build resmi dari checkout bersih berhasil: `npm install` → `lerna bootstrap` (6 paket) → `npm run build` → `npm run dist`.
- Status fuse terverifikasi: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` nonaktif; `OnlyLoadAppFromAsar` aktif.
- `ELECTRON_RUN_AS_NODE=1` tidak lagi menjalankan kode Node.
- Aplikasi hasil packaging dijalankan sebagai pengguna non-root dengan sandbox Chromium aktif. Seluruh lalu lintas diarahkan ke proxy pencatat: **tidak ada satu pun permintaan keluar**.

> **Belum diuji:** build dan pengoperasian di Windows. Uji fungsional pada bagian 6 wajib dilakukan sebelum distribusi.

## 4. Panduan Build Windows

Prasyarat: Windows 10/11 x64, Node.js 22 LTS, Git. Compiler C++ tidak diperlukan. Perintah berikut dijalankan di **Command Prompt** (`cmd.exe`).

```
git clone <repositori-internal> tad
cd tad
git checkout muc-hardening
npm install
npx lerna bootstrap --no-ci --hoist --force-local --ignore-prepublish --ignore tadweb-app --ignore tadweb-server --ignore reltab-sqlite --ignore reltab-bigquery --ignore reltab-snowflake --ignore reltab-aws-athena
for %p in (reltab aggtree reltab-duckdb reltab-fs tadviewer) do (cd packages\%p && npm run build && cd ..\..)
cd packages\tad-app
npm run build-prod
npm run dist
```

Hasil installer berada di `packages\tad-app\release\`.

**Build otomatis (GitHub Actions).** Workflow `.github/workflows/build-windows.yml` menjalankan langkah yang sama di runner Windows setiap kali ada push ke branch `muc-hardening` (atau melalui *Actions → Build Tad MUC (Windows) → Run workflow*). Selain build, workflow juga menjalankan uji regresi validator, memeriksa Electron Fuses (`tools/muc-security/check-fuses.js`), memastikan `app-update.yml` tidak ikut terpaket dan modul DuckDB tersedia, lalu menerbitkan installer beserta `SHA256SUMS.txt` sebagai artifact (disimpan 30 hari). Action pihak ketiga dikunci ke commit SHA, workflow hanya memiliki izin baca, dan tidak memakai secret.

Sebelum distribusi:

1. Catat hash SHA-256 installer (`Get-FileHash`) pada formulir perubahan.
2. Tanda tangani `Tad.exe` dan installer dengan sertifikat code signing perusahaan bila tersedia.
3. Terapkan aturan Windows Defender Firewall yang memblokir `C:\Program Files\Tad\Tad.exe` (inbound dan outbound).

`tadweb-server` dan `tadweb-app` **tidak boleh** dibangun maupun dijalankan (server port 9000 tanpa autentikasi).

## 5. Risiko yang Masih Tersisa

| Risiko | Penanganan yang disarankan |
|---|---|
| Electron 45 menerima patch keamanan hingga sekitar rilis Electron 48 (perkiraan April 2027) | Jadwalkan upgrade Electron minimal setiap 6 bulan, dan segera bila ada advisory kritis Chromium |
| Paket Node `duckdb` 1.4.2 (klien lama) sudah digantikan oleh `@duckdb/node-api` | Rencanakan migrasi driver; pantau advisory DuckDB |
| Fuse `GrantFileProtocolExtraPrivileges` masih aktif dan validasi integritas ASAR belum diaktifkan | Pindahkan pemuatan UI dari `file://` ke custom protocol dan upgrade `electron-builder` (≥ 25) agar integritas ASAR dapat diaktifkan |
| Executable dan installer belum ditandatangani (code signing) | Gunakan sertifikat code signing perusahaan; prasyarat bila menerapkan AppLocker/WDAC |
| Dependensi UI lama (React 18, Blueprint 4, `slickgrid-es6`, jQuery 2 di halaman dokumentasi) | Siklus pembaruan dependensi dan `npm audit` sebelum setiap rilis |
| Hasil export CSV/Parquet berupa berkas tanpa enkripsi | Diatur melalui SOP: export hanya ke penyimpanan Microsoft 365 perusahaan (OneDrive/SharePoint), bukan media lepas |

## 6. Uji Fungsional dan Keamanan Sebelum Distribusi

Ikuti `tools/muc-security/README.md`. Ringkasnya:

- [ ] `node tools/muc-security/validator-test.js` → `RESULT: PASS`
- [ ] Buka `payload-xss.csv` → Kalkulator tidak terbuka; URL berbahaya tidak dapat diklik
- [ ] Buka `legit-pivot.tad` → pivot dan filter benar; buka `malicious-aggmap.tad` → ditolak, tidak ada berkas tertulis
- [ ] `.duckdb` dan `.parquet` terbuka; berkas `.duckdb` tidak berubah
- [ ] Export melalui *Browse* berhasil; export path manual meminta konfirmasi
- [ ] `node tools/muc-security/check-fuses.js "C:\Program Files\Tad\Tad.exe"` → `RESULT: PASS`
- [ ] `ELECTRON_RUN_AS_NODE` tidak menjalankan kode
- [ ] Tidak ada koneksi keluar dari `Tad.exe`

## 7. Pemetaan Kontrol

ISO/IEC 27001:2022 Annex A:
A.8.7 (Protection against malware), A.8.8 (Management of technical vulnerabilities), A.8.9 (Configuration management),
A.8.19 (Installation of software on operational systems), A.8.20 (Network security), A.8.25 (Secure development life cycle),
A.8.28 (Secure coding), A.8.29 (Security testing in development and acceptance), A.8.32 (Change management).

UU No. 27 Tahun 2022 (UU PDP): mencegah kebocoran dan perubahan data wajib pajak klien melalui eksekusi kode, injeksi SQL, atau koneksi keluar dari aplikasi penampil data.
