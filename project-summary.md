# COS (Car Ordering System) - Project Technical Summary

Sebagai Senior Software Engineer, berikut adalah rangkuman teknis mengenai project ini:

## 1. Teknologi (Tech Stack)

Project ini dibangun dengan arsitektur modern yang skalabel menggunakan teknologi berikut:

- **Core Framework**: [NestJS](https://nestjs.com/) (v10+) - Node.js framework untuk membangun aplikasi sisi server yang efisien dan andal.
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Memberikan keamanan tipe data pada saat pengembangan.
- **Database & ORM**:
  - **PostgreSQL**: Database relasional utama.
  - **Prisma ORM** (v7+): Digunakan sebagai interface database dengan pendekatan schema-first.
- **Message Broker & Queue**:
  - **Redis** (via ioredis): Digunakan untuk caching dan pengelolaan queue (BullMQ).
  - **RabbitMQ** (via amqplib): Digunakan untuk komunikasi asinkron antar service atau background processing (Worker).
- **Integrasi Pihak Ketiga**:
  - **AWS SDK (S3)**: Untuk penyimpanan aset/file (e.g., kwitansi, foto kendaraan).
  - **Nodemailer (SMTP)**: Untuk pengiriman notifikasi via email.
  - **OneSignal**: Untuk push notifications ke perangkat mobile.
  - **Tesseract.js**: OCR engine untuk ekstraksi data dari gambar kwitansi.

## 2. Struktur Proyek (Architecture)

Proyek ini mengikuti pola **Package-by-Feature** dan **Clean Architecture** yang modular:

- `src/packages/`: Tempat logika bisnis inti dipisahkan berdasarkan fitur (e.g., `carpool`, `org-unit`, `approval`). Setiap package biasanya memiliki:
  - `dto/`: Definisi input/output data.
  - `domain/`: Entitas dan helper logika bisnis.
  - `repository/`: Implementasi akses data via Prisma.
  - `usecase/`: Logika bisnis utama (Service layer).
  - `controller/`: Endpoint API (jika ada).
- `src/modules/`: NestJS Module wrappers yang mengintegrasikan `packages` ke dalam aplikasi.
- `src/shared/`: Utilitas yang digunakan secara global (database config, logger, filters, interceptors).

## 3. Alur Kerja (Workflows) Berdasarkan Mode

Aplikasi ini dirancang untuk berjalan dalam 3 mode berbeda (ditentukan via env `MODE`):

### A. Mode: API (REST Server)

Digunakan untuk melayani permintaan langsung dari Frontend (Next.js).

- **Flow**: `User Request` -> `Main Middleware` (Auth/Logger) -> `Controller` -> `UseCase` -> `Repository` -> `Prisma` -> `Response`.
- **Tujuan**: Operasi CRUD real-time, otentikasi, dan pengambilan data untuk UI.

### B. Mode: WORKER (Background Processor)

Digunakan untuk memproses tugas-tugas berat di latar belakang secara asinkron agar tidak membebani API utama.

- **Flow**: `Queue (RabbitMQ/BullMQ)` -> `Worker Service (OrderWorker)` -> `Business Logic` -> `Update DB/Notify User`.
- **Tujuan**: Integrasi eksternal, pengiriman notifikasi massal, atau proses OCR (Tesseract).

### C. Mode: SCHEDULER (Cron Jobs)

Digunakan untuk menjalankan tugas otomatis berdasarkan jadwal waktu tertentu.

- **Flow**: `Cron Timer` (NestJS Schedule) -> `Scheduler Service` -> `Sync Logic (HRIS Sync)` -> `Database Update`.
- **Tujuan**: Sinkronisasi data karyawan/unit organisasi dari Sunfish HRIS, pembersihan data lama, atau pembuatan laporan periodik.

---

## 4. Fitur Utama (Core Modules)

- **Organization Unit**: Manajemen hierarki departemen dan cost center.
- **Carpool Engine**: Algoritma pencarian kandidat carpool berdasarkan rute dan waktu (detour management).
- **Approval System**: Workflow persetujuan bertingkat (L1 & L2) untuk pemesanan kendaraan.
- **Execution System**: Pengelolaan perjalanan mulai dari Surat Jalan (SJ) hingga serah terima kendaraan.
