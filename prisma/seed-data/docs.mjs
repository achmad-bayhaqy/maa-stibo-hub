/**
 * Documentation pages seed — STIBO Hub v2.0 Documentation Center.
 * Markdown-ish body: headings (#, ##, ###), lists, pipe tables, ``` code blocks, **bold**, `inline`.
 * Language: Bahasa Indonesia with standard English technical terms.
 */
export const DOCS = [
  {
    slug: "getting-started", title: "Panduan Memulai", category: "Guide", order: 10,
    summary: "Orientasi cepat: peran, alur kerja inti, dan langkah transformasi pertama Anda.",
    body: `# Panduan Memulai

STIBO Hub adalah portal integrasi master data yang menghubungkan brand-brand PT. MAP Aktif Adiperkasa Tbk (0888) dengan platform **Stibo STEP** MDM. Portal ini menstandarkan proses yang sebelumnya manual: menyiapkan file data artikel per brand, memetakan kolom ke atribut Stibo, memvalidasi, lalu mengirim ke IIEP endpoint yang tepat.

## Alur kerja inti

1. **Upload** — unggah file Excel (.xlsx/.xls/.csv) dengan nama file yang sesuai konvensi penamaan. Sistem otomatis mendeteksi brand, flow, gender, season, country, dan endpoint tujuan.
2. **Wizard metadata** — lengkapi/konfirmasi Country, SBU, Brand, Season. Sistem memvalidasi kombinasi tersebut terhadap tabel RNA (Brand Reporting Structure).
3. **Transform** — mesin pemetaan menerapkan 5.900+ aturan mapping (10 tipe) ke setiap baris. Anda melihat pratinjau hasil transformasi per kolom: nilai sumber, nilai hasil, tipe mapping, dan peringatan.
4. **Konfirmasi & kirim** — STEPXML dibangun sesuai skema PIM.xsd. Kirim dua langkah (2-phase confirm): MOCK (simulasi) atau LIVE (POST ke Stibo IIEP).

## Peran pengguna

| Peran | Hak akses |
| --- | --- |
| **ADMIN** | Semua akses + kelola pengguna + hapus data master + import data |
| **EDITOR** | CRUD master data, upload, transform, kirim |
| **VIEWER** | Lihat saja: dashboard, riwayat upload, dokumentasi, master data |

## Transformasi pertama Anda

1. Buka menu **Assistant** → tab **Pipeline** (atau klik tombol *New Transformation* di kanan atas).
2. Drag & drop file Excel Anda. Pastikan nama file mengikuti [Konvensi Penamaan](/doc/file-naming-convention).
3. Lengkapi wizard metadata yang muncul.
4. Tinjau hasil transformasi — kolom hijau berarti terpetakan otomatis, oranye berarti perlu perhatian (MANUAL/AI_ASSIST), merah berarti error.
5. Klik **Send to Stibo** dan konfirmasi pada dialog dua fase.

> **Tips**: Gunakan **Command Palette** (⌘K / Ctrl+K) untuk melompat ke halaman mana pun atau mencari brand, atribut, dan LOV tanpa navigasi manual.`,
  },
  {
    slug: "assistant-guide", title: "Panduan Assistant (Q&A)", category: "Guide", order: 20,
    summary: "Cara bertanya ke Assistant: intent yang dikenali, contoh pertanyaan, dan batasannya.",
    body: `# Panduan Assistant

Assistant memiliki dua mode yang dapat dipilih di bagian atas halaman:

- **Pipeline** — mode terpandu untuk upload → map → preview → kirim (alur kerja utama).
- **Q&A** — mode percakapan bebas: tanyakan apa saja tentang data master, aturan mapping, konvensi penamaan, status pipeline, dan dokumentasi.

## Yang bisa ditanyakan di mode Q&A

| Topik | Contoh pertanyaan |
| --- | --- |
| **Brand** | "brand apa saja di divisi SPORTS?", "detail brand ELL" |
| **Atribut** | "atribut AT_ apa saja yang required?", "cari atribut color" |
| **Mapping rules** | "rule mapping adidas untuk AT_BRAND?", "berapa rule bertipe MANUAL?" |
| **LOV** | "nilai LOV untuk season", "cari LOV size grid" |
| **Naming** | "bagaimana format nama file?", "endpoint untuk ELL recap sample?" |
| **RNA** | "SBU untuk brand lotto di Indonesia?", "comp code 0888" |
| **Status pipeline** | "upload terakhir saya apa saja?", "ada berapa send hari ini?" |
| **Dokumentasi** | "jelaskan tipe mapping SYSTEM_FORMULA", "apa itu IIEP?" |
| **Statistik** | "berapa total brand?", "ringkasan dashboard" |

## Cara kerja Q&A engine

1. Pertanyaan Anda diklasifikasikan ke **intent** (brand, attribute, lov, rule, naming, rna, upload, stats, docs, help).
2. Engine menjalankan **query langsung ke database master data** — jawaban selalu mencerminkan data terkini, bukan teks statis.
3. Hasil ditampilkan sebagai **data card** (tabel/badge) beserta **sumber informasi** dan tautan lanjutan.
4. Seluruh percakapan disimpan per pengguna dan dapat dihapus kapan saja.

## Batasan

- Q&A engine bersifat **deterministik** — ia membaca data internal, bukan internet. Pertanyaan di luar cakupan sistem akan diarahkan ke topik yang tersedia.
- Untuk perubahan data, gunakan halaman **Data Master** (butuh peran EDITOR/ADMIN); Assistant hanya membaca.
- Riwayat chat bersifat per pengguna dan tidak terlihat oleh pengguna lain.`,
  },
  {
    slug: "file-naming-convention", title: "Konvensi Penamaan File", category: "Reference", order: 30,
    summary: "Format nama file wajib, decoder tiap segmen, dan tabel routing 88 naming routes.",
    body: `# Konvensi Penamaan File

Nama file adalah **kontrak pertama** antara Anda dan mesin transformasi. Dari nama file saja sistem menentukan: brand, jenis data (flow), season, country, dan IIEP endpoint tujuan.

## Format

\`\`\`
{COMP}-{FLOW}-{GENDER}-{SEASON}-{COUNTRY}-{SEQ}.xlsx
\`\`\`

## Decoder segmen

| Segmen | Arti | Contoh | Keterangan |
| --- | --- | --- | --- |
| COMP | Company code | 0888 | Kode perusahaan MAP Aktif Adiperkasa |
| FLOW | Jenis data | RecapSample, EAN, ... | Menentukan endpoint IIEP |
| GENDER | Line gender | M, W, K, U | Men / Women / Kids / Unisex |
| SEASON | Season code | AU26, SP27 | Autumn 2026, Spring 2027 |
| COUNTRY | Country code | ID | Indonesia |
| SEQ | Nomor urut | 001 | Diisi nol (zero-padded) |

## Contoh valid

\`\`\`
0888-RecapSample-M-AU26-ID-001.xlsx   → ARTICLE_PLANNING
0888-EAN-U-SP27-ID-003.xlsx           → EAN_UPDATE
\`\`\`

## Routing endpoint

Sistem memelihara **88 naming routes** yang dapat dikelola di **Data Master → Naming Routes**. Route memetakan kombinasi \`(brand, flow, trigger)\` → endpoint:

| Flow umum | Endpoint | Kegunaan |
| --- | --- | --- |
| RecapSample | ARTICLE_PLANNING | Upload rencana artikel baru per season |
| EAN | EAN_UPDATE | Update barcode EAN artikel existing |
| Maintenance | ARTICLE_MAINTENANCE | Perubahan atribut artikel existing |

## Jika nama file tidak valid

- Wizard akan menandai \`filenameValid = false\` dan menampilkan isu per segmen.
- Anda tetap dapat melanjutkan dengan melengkapi metadata manual, namun praktik terbaik adalah memperbaiki nama file agar routing otomatis akurat.
- Dapatkan daftar brand code resmi dari **Data Master → Brands**.`,
  },
  {
    slug: "iiep-endpoints", title: "IIEP Endpoints & Routing", category: "Integration", order: 40,
    summary: "Tiga endpoint inbound Stibo STEP, perbedaan fungsinya, dan cara sistem memilihnya.",
    body: `# IIEP Endpoints & Routing

Stibo STEP menerima data inbound melalui **Inbound Integration Endpoints (IIEP)**. Sistem MAP mengenal tiga endpoint berikut:

## 1. ARTICLE_PLANNING

- **Kegunaan**: intake artikel baru pada fase perencanaan (pre-season).
- **Input umum**: Recap Sample per brand/gender/season.
- **Karakteristik**: volume terbesar; atribut planning inti (brand, division, category, gender, season, color, size grid).

## 2. EAN_UPDATE

- **Kegunaan**: pembaruan barcode EAN untuk artikel yang sudah ada di STEP.
- **Input umum**: file EAN per brand.
- **Karakteristik**: delta update; hanya mengubah \`AT_EAN\` dan atribut terkait barcode.

## 3. ARTICLE_MAINTENANCE

- **Kegunaan**: perawatan artikel — koreksi atribut, perubahan status, penyesuaian hierarki.
- **Karakteristik**: delta update terbatas; biasanya dipicu permintaan tim Brand/COE.

## Cara sistem memilih endpoint

1. Parser nama file mengekstrak segmen FLOW.
2. Mesin routing mencari kecocokan di tabel **Naming Routes** (brand + flow + trigger).
3. Bila tidak ada kecocokan eksak, dipakai default per flow (RecapSample → ARTICLE_PLANNING, EAN → EAN_UPDATE).
4. Endpoint final ditampilkan di wizard dan dapat Anda konfirmasi sebelum kirim.

## Konfigurasi URL

URL endpoint disimpan di Settings (tabel \`stiboEndpoints\`) dan diisi dari environment variable saat deploy:

\`\`\`
STIBO_INBOUND_URL_ARTICLE_PLANNING
STIBO_INBOUND_URL_EAN_UPDATE
STIBO_INBOUND_URL_ARTICLE_MAINTENANCE
\`\`\`

Pada mode **MOCK**, POST tidak pernah keluar dari sistem — bgId dibuat simulasi (\`MOCK-XXXX\`) dan respons dianggap sukses. Mode LIVE memerlukan kredensial OIDC terkonfigurasi.`,
  },
  {
    slug: "mapping-rule-types", title: "Tipe-Tipe Mapping Rule", category: "Reference", order: 50,
    summary: "10 tipe mapping (SYSTEM_FORMULA s/d EXTERNAL_SOURCE), perilaku, dan cara menanganinya.",
    body: `# Tipe-Tipe Mapping Rule

Mesin transformasi memetakan kolom sumber ke atribut Stibo (\`AT_*\`) memakai **5.900+ rule** yang diekstrak dari Brand Mapping Template. Setiap rule punya tipe yang menentukan cara pengisiannya:

## Daftar tipe

| Tipe | Perilaku | Contoh |
| --- | --- | --- |
| **SYSTEM_FORMULA** | Diisi otomatis oleh formula sistem | bgId, timestamp, hash |
| **DIRECT** | Salin langsung dari kolom sumber | AT_PRODUCT_NAME ← column B |
| **MAPPING** | Transformasi via tabel LOV/lookup | color name → LOV code |
| **MANUAL_PORTAL** | Harus diinput manual di portal | atribut khusus campaign |
| **MANUAL / MANUAL_DIRECT** | Input manual oleh operasional | catatan khusus brand |
| **AI_ASSIST** | Disarankan AI, perlu review manusia | klasifikasi kategori ambigu |
| **EXTERNAL_SOURCE** | Dari sistem eksternal (ERP/RNA) | comp code, SBU |
| **NOT_AVAILABLE** | Belum tersedia di template brand | atribut baru belum ada sumbernya |
| **OTHER** | Kasus khusus di luar klasifikasi | — |

## Interpretasi warna pada pratinjau

- **Hijau (SYSTEM_FORMULA / DIRECT / MAPPING)** — terisi otomatis, tidak perlu aksi.
- **Oranye (MANUAL*, AI_ASSIST)** — perlu input keputusan manusia; wizard menandai sel-sel ini.
- **Abu-abu (NOT_AVAILABLE)** — tidak dipetakan; aman diabaikan atau ditindaklanjuti dengan menambah rule baru.
- **Merah** — error validasi pada nilai.

## Mengelola rule

- Semua rule dapat dilihat dan difilter di **Data Master → Mapping Rules** (filter brand + tipe + pencarian teks).
- EDITOR/ADMIN dapat menambah rule baru, mengubah \`mappingType\`, \`sourceField\`, \`logic\`, atau menonaktifkan rule (\`active = false\`) tanpa menghapus jejak audit.
- Rule yang dinonaktifkan dilewati mesin transformasi namun tetap tampil dengan badge INACTIVE.`,
  },
  {
    slug: "lov-reference-data", title: "LOV & Reference Data", category: "Reference", order: 60,
    summary: "47 tabel LOV (3.800+ nilai), struktur RNA, dan perannya dalam transformasi.",
    body: `# LOV & Reference Data

## List of Values (LOV)

LOV adalah kamus nilai terkontrol yang dipakai mesin **MAPPING** untuk menerjemahkan nilai bebas dari file brand menjadi kode standar Stibo.

- **47 tabel LOV** berisi **3.800+ nilai** (diekstrak dari workbook MDD).
- Contoh tabel: \`SEASON\`, \`COLOR\`, \`SIZE_GRID\`, \`GENDER\`, \`DIVISION\`, \`PRODUCT_TYPE\`.
- Kelola di **Data Master → LOV Tables**: tambah/edit/hapus tabel dan nilai (peran EDITOR ke atas).

### Contoh transformasi MAPPING

\`\`\`
Sumber: "Navy Blue"  →  LOV COLOR  →  "NVY"  →  AT_COLOR_CODE
Sumber: "AU26"       →  LOV SEASON →  "AU26" →  AT_SEASON
\`\`\`

Bila nilai sumber tidak ditemukan di LOV, baris ditandai **warning** dan pratinjau menampilkan saran nilai terdekat.

## RNA (Brand Reporting Structure)

Tabel RNA (2.364 baris) adalah struktur pelaporan resmi perusahaan:

| Kolom | Contoh | Dipakai untuk |
| --- | --- | --- |
| country | ID | Wizard Country |
| compCode | 0888 | Segmen COMP nama file |
| sbu / subSbu / sbuGrouping | SPORTS | Wizard SBU |
| brandCode / brandName | ELL / Ellesse | Validasi brand |
| reportingBrandCode | ELL-ID | bgId composition |

Wizard memvalidasi kombinasi **Country + SBU + Brand** Anda terhadap RNA. Kombinasi yang tidak dikenal akan ditolak dengan saran entri terdekat — ini mencegah data "yatim" masuk ke STEP.

## Sumber kebenaran

Urutan prioritas saat konflik: **1)** tabel RNA & LOV di sistem ini (diekstrak dari workbook resmi), **2)** input manual Anda, **3)** rule per-brand. Bila workbook resmi diperbarui, jalankan ulang seed atau gunakan Bulk Import untuk menyinkronkan.`,
  },
  {
    slug: "attributes-mdd", title: "Atribut (MDD Core)", category: "Reference", order: 70,
    summary: "167 atribut AT_*, tipe validasi, dan konvensi penamaan atribut Stibo.",
    body: `# Atribut (MDD Core)

Data master atribut diambil dari **MDD (Master Data Definition)** Stibo — 167 atribut \`AT_*\` yang menjadi target akhir transformasi.

## Konvensi penamaan

\`\`\`
AT_PRODUCT_NAME, AT_COLOR_CODE, AT_SEASON, AT_EAN, ...
└┬┘ └────┬─────┘
 prefix   nama atribut Stibo
\`\`\`

## Tipe validasi

| Validation | Arti | Contoh atribut |
| --- | --- | --- |
| \`text\` | Teks bebas | AT_PRODUCT_NAME |
| \`lov\` | Harus anggota LOV tertentu | AT_COLOR_CODE → LOV COLOR |
| \`number\` | Numerik | AT_PRICE |
| \`date\` | Tanggal (ISO) | AT_LAUNCH_DATE |
| \`boolean\` | true/false | AT_IS_ACTIVE |
| \`regex\` | Pola khusus | AT_EAN (13 digit) |

## Melihat & mengelola

- **Data Master → Attributes**: cari berdasarkan \`AT_*\` atau nama, edit nama/validasi/deskripsi (EDITOR ke atas).
- Menambah atribut baru memerlukan kode berawalan \`AT_\` — sistem menolak kode lain untuk menjaga konsistensi dengan MDD.
- Atribut yang dipakai rule mapping per brand dapat ditelusuri di tab **Mapping Rules** (filter by attribute).

> **Catatan**: Daftar atribut di portal harus disinkronkan bila tim MDM Stibo mengubah MDD resmi. Gunakan Bulk Import untuk sinkronisasi massal.`,
  },
  {
    slug: "pipeline-architecture", title: "Arsitektur Pipeline", category: "Integration", order: 80,
    summary: "Dari upload di portal hingga data masuk STEP: komponen, aliran data, dan titik kontrol.",
    body: `# Arsitektur Pipeline

## Gambaran besar

\`\`\`
[Browser: STIBO Hub]
   │  upload (Excel) + wizard metadata
   ▼
[STIBO Hub API]  ── parse → validate → map → preview
   │  konfirmasi user (2-phase)
   ▼
[STEPXML builder]  (PIM.xsd compliant)
   │  POST (LIVE) / simulate (MOCK)
   ▼
[Stibo STEP IIEP endpoint]  →  bgId → import queue
\`\`\`

## Komponen

| Komponen | Teknologi | Peran |
| --- | --- | --- |
| Portal web | Next.js 16 + Prisma | UI, API, mesin transformasi |
| Database | SQLite (dev) / PostgreSQL (prod) | Master data, uploads, audit |
| File storage | Lokal / S3 \`stibo-hub-artifacts-*\` | Artefak upload |
| STEPXML builder | Server lib (\`stepxml.ts\`) | Serialize hasil mapping ke XML PIM.xsd |
| Stibo connector | OIDC client + REST POST (\`stibo.ts\`) | Autentikasi & kirim ke IIEP |

## Titik kontrol (quality gates)

1. **Validasi nama file** — routing salah = data salah tujuan.
2. **Validasi RNA** — kombinasi Country/SBU/Brand harus dikenal.
3. **Pratinjau transformasi** — Anda melihat hasil per baris sebelum kirim.
4. **Konfirmasi dua fase** — dialog eksplisit menampilkan mode, endpoint, jumlah baris, dan endpoint URL sebelum POST.
5. **Audit log** — setiap aksi (upload/transform/send/CRUD master data) tercatat aktor + waktu + detail.

## Keterkaitan dengan pipeline lama (Lambda)

Portal ini adalah jalur **baru** yang melengkapi pipeline yang sudah berjalan (MAP Portal → S3 → EventBridge → Lambda). Jalur lama tetap valid untuk brand yang sudah onboarding; jalur baru memberi kontrol interaktif + pratinjau sebelum kirim.`,
  },
  {
    slug: "stibo-api-integration", title: "Integrasi API Stibo STEP", category: "Integration", order: 90,
    summary: "OIDC auth, format POST IIEP, struktur bgId, dan perbedaan mode MOCK vs LIVE.",
    body: `# Integrasi API Stibo STEP

## Autentikasi (OIDC)

Portal adalah OIDC confidential client ke identity provider Stibo:

\`\`\`
POST /oauth/token
grant_type=client_credentials
client_id=*** (Secrets Manager: stibo/prod/...)
client_secret=***
\`\`\`

- Token di-cache hingga kedaluwarsa (lazy fetch, TTL).
- Kredensial **tidak pernah** berada di kode atau repo — hanya environment variable / AWS Secrets Manager.

## Mengirim data (IIEP)

\`\`\`
POST {STIBO_INBOUND_URL_ARTICLE_PLANNING}
Content-Type: multipart/form-data
  file  = <STEPXML>
  bgId  = {reportingBrand}-{flow}-{season}-{seq}
\`\`\`

Struktur STEPXML diserialisasi sesuai **PIM.xsd**: satu \`Products\` root, atribut per \`Product\` (\`ID\`, \`AT_*\`), validasi nilai LOV di sisi portal sebelum kirim.

## Mode MOCK vs LIVE

| Aspek | MOCK (default) | LIVE |
| --- | --- | --- |
| POST keluar | Tidak — disimulasikan | Ya, ke endpoint IIEP |
| bgId | \`MOCK-XXXXXXXX\` | bgId riil |
| Audit | Tetap tercatat penuh | Tetap tercatat penuh |
| Kebutuhan | Bisa jalan tanpa kredensial | OIDC + URL endpoint terisi |

Mode dikontrol di **Settings** dan ditampilkan sebagai badge di topbar. Praktik terbaik: selalu uji di MOCK dulu, periksa pratinjau STEPXML, lalu pindah ke LIVE saat go-live yang diawasi tim MDM.

## Menangani kegagalan

- HTTP non-2xx → job ditandai FAILED, snippet respons disimpan, tombol retry tersedia di **Uploads**.
- Timeout → naikkan timeout koneksi di Settings dan periksa jaringan/VPC ke STEP.
- Semua kegagalan masuk **Audit Log** untuk analisis tim COE.`,
  },
  {
    slug: "roles-permissions", title: "Peran & Izin", category: "Governance", order: 100,
    summary: "Matriks ADMIN/EDITOR/VIEWER per modul dan prinsip audit.",
    body: `# Peran & Izin

## Matriks izin

| Modul / Aksi | ADMIN | EDITOR | VIEWER |
| --- | --- | --- | --- |
| Dashboard, Uploads, Docs, Assistant | ✔ | ✔ | ✔ (read) |
| Upload & transform & kirim | ✔ | ✔ | ✖ |
| Master data: create/edit | ✔ | ✔ | ✖ |
| Master data: delete | ✔ | ✖ | ✖ |
| Bulk import | ✔ | ✔ | ✖ |
| User management | ✔ | ✖ | ✖ |
| Settings (mode, endpoint URL) | ✔ | ✖ | ✖ |
| Audit log | ✔ | ✔ | ✖ |

## Prinsip

1. **Least privilege** — berikan peran terkecil yang memungkinkan kerja. VIEWER untuk brand team, EDITOR untuk COE analyst, ADMIN terbatas untuk COE lead + IT.
2. **Auditability** — semua perubahan state (CRUD master data, import, send) menulis AuditLog dengan aktor, aksi, target, dan detail JSON (nilai lama → baru untuk edit).
3. **Two-phase send** — pengiriman ke Stibo selalu lewat dialog konfirmasi dua fase, terlepas dari peran.
4. **Shared accounts dilarang** — satu akun per orang; akun nonaktif tidak bisa login meski token masih ada.

## Mengelola pengguna

- **User Management** (ADMIN): tambah akun, ubah peran, nonaktifkan akun.
- Password disimpan sebagai scrypt hash (salt per-user).
- Sesi cookie HMAC berumur 12 jam; logout menghapus cookie.`,
  },
  {
    slug: "bulk-import-guide", title: "Panduan Bulk Import", category: "Guide", order: 110,
    summary: "Format CSV per entitas, alur preview → apply, dan penanganan error baris.",
    body: `# Panduan Bulk Import

Bulk Import memungkinkan pembaruan master data secara massal (mis. sinkronisasi hasil revisi workbook resmi) tanpa mengedit satu per satu.

## Alur dua fase

1. **PREVIEW** — file diparse, setiap baris divalidasi (kewajiban kolom, duplikat, referensi). Anda melihat ringkasan: *Total / Valid / Failed* plus detail error per baris. Tidak ada perubahan yang ditulis.
2. **APPLY** — hanya dijalankan bila Anda setuju dengan ringkasan. Baris valid ditulis; baris gagal dilewati dan dilaporkan.

## Format CSV per entitas

**Brands** (\`code,name,division,status\`):
\`\`\`csv
ELL,Ellesse,SPORTS,ACTIVE
NIK,Nike,SPORTS,ACTIVE
\`\`\`

**Attributes** (\`code,name,validation,description\`) — kode wajib berawalan \`AT_\`:
\`\`\`csv
AT_TEST_COLOR,Test Color,lov,Atribut uji warna
\`\`\`

**Mapping Rules** (\`brandSheet,attributeId,attribute,mappingType,sourceField,logic\`):
\`\`\`csv
adidas,AT_BRAND,Brand,DIRECT,colBrand,
\`\`\`

**LOV Values** (\`tableKey,code,label\`):
\`\`\`csv
SEASON,SS27,Spring 2027
\`\`\`

## Aturan penting

- **Baris duplikat** (mis. brand code sudah ada) di-update bila flag *upsert* aktif; selain itu ditolak.
- **Referensi wajib ada**: \`tableKey\` LOV harus mengacu tabel yang tersedia; \`attributeId\` rule disarankan mengacu atribut terdaftar.
- Semua apply tercatat di **Audit Log** dengan jumlah inserted/updated/failed per entitas.
- Unduh template CSV dari tombol **Download template** di dialog import.`,
  },
  {
    slug: "faq", title: "FAQ", category: "Guide", order: 120,
    summary: "Pertanyaan yang sering muncul seputar upload, transformasi, dan kirim.",
    body: `# FAQ

**Upload saya gagal diparse — apa penyebab umum?**
Pastikan file .xlsx/.xls/.csv tidak terproteksi sheet dan memiliki header kolom di baris pertama. Sistem memilih sheet terbaik otomatis; bila workbook punya banyak sheet kosong, hapus sheet non-data.

**Kenapa banyak kolom bertipe MANUAL?**
Template beberapa brand memang menandai atribut sebagai input manual ("Manual Input in Portal"). Lengkapi sel oranye di wizard; nilai yang Anda isi akan ikut ke STEPXML.

**Apakah saya bisa mengubah hasil mapping sebelum kirim?**
Ya — pratinjau transformasi memungkinkan override per sel (klik nilai). Override tercatat di audit.

**Bedanya MOCK dan LIVE?**
MOCK mensimulasikan pengiriman (bgId \`MOCK-*\`, tidak ada trafik keluar). LIVE melakukan POST riil ke IIEP Stibo. Badge mode selalu terlihat di topbar.

**Saya salah kirim ke LIVE — apa yang harus dilakukan?**
Hubungi tim MDM Stibo untuk menarik batch via bgId (tercatat di Audit Log), lalu perbaiki data dan kirim ulang. Praktik terbaik: selalu uji MOCK dulu untuk file/brand baru.

**Kenapa kombinasi Country/SBU/Brand saya ditolak?**
Validasi wizard mengacu tabel RNA. Pastikan kombinasi tersebut ada di **Data Master → RNA**; bila struktur organisasi berubah, minta COE memperbarui RNA via Bulk Import.

**Siapa yang bisa menghapus master data?**
Hanya ADMIN. Editor dapat menambah/mengubah namun tidak menghapus — ini menjaga jejak audit tetap aman.

**Bagaimana cara menambah brand baru ke pipeline?**
1) Tambah brand di Data Master → Brands; 2) pastikan entri RNA-nya ada; 3) tambah Naming Route bila flow-nya khusus; 4) unggah file sampel dan uji di MOCK.`,
  },
  {
    slug: "glossary", title: "Glosarium", category: "Reference", order: 130,
    summary: "Istilah Stibo, master data, dan internal MAP yang dipakai di seluruh portal.",
    body: `# Glosarium

| Istilah | Arti |
| --- | --- |
| **Stibo STEP** | Platform MDM (Product Master Data Management) tujuan akhir semua data artikel |
| **IIEP** | Inbound Integration Endpoint — pintu masuk data ke STEP |
| **STEPXML** | Format XML standar Stibo (PIM.xsd) untuk import data |
| **bgId** | Background Process ID — identifier batch import di STEP |
| **MDD** | Master Data Definition — definisi resmi atribut di STEP |
| **AT_* ** | Prefiks atribut Stibo (mis. AT_COLOR_CODE) |
| **LOV** | List of Values — kamus nilai terkontrol |
| **RNA** | Brand Reporting Structure — tabel referensi company/SBU/brand |
| **SBU** | Strategic Business Unit — kelompok bisnis (mis. SPORTS) |
| **compCode** | Company code (0888 = MAP Aktif Adiperkasa Tbk) |
| **Recap Sample** | Flow data rekap sampel produk per season |
| **EAN** | European Article Number — barcode 13 digit |
| **MOCK mode** | Mode simulasi kirim (tanpa trafik ke STEP) |
| **LIVE mode** | Mode kirim riil ke IIEP STEP |
| **Mapping rule** | Aturan pemetaan kolom sumber → atribut Stibo |
| **Direct mapping** | Salinan langsung tanpa transformasi |
| **2-phase confirm** | Konfirmasi dua langkah sebelum aksi destruktif (kirim) |
| **COE** | Center of Excellence — tim pemilik proses master data |
| **Season code** | Kode musim (AU26 = Autumn 2026, SP27 = Spring 2027) |
| **Naming route** | Aturan routing (brand+flow) → IIEP endpoint |`,
  },
  {
    slug: "changelog", title: "Changelog", category: "Governance", order: 140,
    summary: "Riwayat rilis portal STIBO Hub.",
    body: `# Changelog

## v2.0 — Rilis fitur berbasis review maa-btool

**Documentation Center**
- 14 halaman dokumentasi terstruktur (Guide / Reference / Integration / Governance) dengan pencarian penuh dan editor konten untuk ADMIN/EDITOR.

**Assistant v2**
- Mode **Q&A**: tanya apa saja tentang data master, rules, LOV, naming, RNA, status pipeline, dan dokumentasi — jawaban berbasis query database real-time dengan data cards + sumber.
- Riwayat percakapan tersimpan per pengguna; suggested prompts; hapus riwayat.

**Data Master — CRUD penuh**
- Attributes: create/edit/delete (+ deskripsi).
- LOV: CRUD tabel + nilai.
- Mapping Rules: create/edit/deactivate/delete.
- **Tab baru**: Naming Routes (88 route, CRUD) dan RNA (2.364 baris, CRUD).
- Export CSV semua tabel; Bulk Import (preview → apply) untuk brands/attributes/rules/LOV values.

**Platform**
- Command Palette (⌘K) ala maa-btool: navigasi, pencarian lintas entitas, quick actions.
- Navigasi sidebar dikelompokkan per section.
- Onboarding checklist di Dashboard.

## v1.0 — Rilis awal

- SPA shell: Assistant (pipeline wizard), Dashboard, Uploads, Data Master (read-mostly), Users, Audit, Settings.
- Mesin transformasi 5.925 rule (29 brand sheet), LOV 47 tabel, RNA 2.364 baris, 88 naming routes.
- Parser nama file + routing IIEP; STEPXML builder PIM.xsd; kirim MOCK/LIVE dengan konfirmasi dua fase.
- Seed dari workbook resmi: brands, attributes, LOV, rules, RNA, naming.
- Deploy AWS EC2 (docker compose) — semua resource berprefiks/tertag \`stibo\`.`,
  },
];
