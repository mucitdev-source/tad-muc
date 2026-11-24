# Perangkat Uji Keamanan Tad – Build Internal MUC

Folder ini berisi alat untuk memverifikasi hardening keamanan Tad (lihat `MUC-HARDENING.md` di root repositori).
Jalankan seluruh pengujian ini setiap kali build baru akan didistribusikan, termasuk setelah upgrade Electron atau DuckDB.

| Berkas | Fungsi |
|---|---|
| `validator-test.js` | Uji regresi otomatis validator query `reltab` (10 bentuk query sah wajib lolos; 11 payload query dan 1 nama tabel berbahaya wajib ditolak). |
| `make-tad-fixtures.js` | Membuat `fixtures/legit-pivot.tad` dan `fixtures/malicious-aggmap.tad` dengan path absolut sesuai komputer penguji. |
| `fixtures/payload-xss.csv` | CSV berisi payload XSS/RCE (`calc`) dan URL berskema berbahaya (`smb://`, `file://`). |
| `fixtures/sample.csv` | Data contoh bersih untuk uji pivot dan filter. |

> **Perhatian:** `payload-xss.csv` dan `malicious-aggmap.tad` adalah materi uji serangan. Pada Tad versi **upstream**, membuka `payload-xss.csv` akan langsung membuka Kalkulator Windows (bukti eksekusi kode). Simpan berkas ini hanya di repositori ini dan jangan diedarkan ke pengguna.

## 1. Uji Otomatis Validator Query

Setelah paket `reltab` di-build:

```
node tools/muc-security/validator-test.js
```

Hasil yang diharapkan: semua baris `PASS` dan `RESULT: PASS` (exit code 0).

## 2. Uji Manual Aplikasi di Windows

1. Instal build internal (per-machine, `C:\Program Files\Tad\`).
2. Buat fixture `.tad`: `node tools/muc-security/make-tad-fixtures.js`
3. Lakukan pengujian berikut dan catat hasilnya pada formulir uji perubahan:

| No | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Buka `fixtures\payload-xss.csv` | 5 baris tampil sebagai teks biasa. Kalkulator **tidak** terbuka. |
| 2 | Pada kolom `situs`, aktifkan *URLs as hyperlinks*, lalu klik URL baris 1 | Browser terbuka ke `https://example.com/profil?id=1`. |
| 3 | Klik sel baris 2–5 kolom `situs` | Tidak terjadi apa pun: tidak ada link, tidak ada program atau share jaringan yang terbuka. |
| 4 | Buka `fixtures\legit-pivot.tad` | Pivot per kota tampil (Bandung 4.200.000; Jakarta 4.250.000; Surabaya 980.000). |
| 5 | Buka `fixtures\malicious-aggmap.tad` | Data tidak tampil (query ditolak). Berkas `%TEMP%\tad-pwned-tad.csv` **tidak** terbentuk. |
| 6 | Buka sebuah berkas `.duckdb` dan `.parquet` | Tabel tampil. Berkas `.duckdb` tidak berubah (cek `Get-FileHash` sebelum dan sesudah). |
| 7 | Export data terfilter ke CSV melalui tombol *Browse* | Berkas tersimpan tanpa dialog konfirmasi tambahan. |
| 8 | Export dengan mengetik path secara manual | Muncul dialog konfirmasi bawaan Windows sebelum berkas ditulis. |
| 9 | PowerShell: `$env:ELECTRON_RUN_AS_NODE=1; & "C:\Program Files\Tad\Tad.exe" -e "require('fs').writeFileSync('C:/Users/Public/x.txt','x')"` | `C:\Users\Public\x.txt` **tidak** terbentuk (fuse RunAsNode nonaktif). Tutup jendela Tad yang mungkin terbuka, lalu jalankan `Remove-Item Env:ELECTRON_RUN_AS_NODE`. |
| 10 | Pantau koneksi Tad.exe (Resource Monitor → Network, atau log Windows Defender Firewall) selama langkah 1–8 | Tidak ada koneksi keluar dari Tad.exe. |
