# AnisMart

Aplikasi katalog dan pemesanan AnisMart. Pengguna dapat mendaftar, melihat produk, membuat pesanan, dan membayar melalui Midtrans Sandbox; admin mengelola produk dan pesanan.

## Teknologi

- Next.js App Router
- Supabase Auth dan PostgreSQL
- Midtrans Sandbox untuk pembayaran online

## Menjalankan secara lokal

1. Pasang dependensi: `npm install`
2. Salin `.env.example` menjadi `.env.local`, lalu isi nilai environment variable yang diperlukan.
3. Jalankan aplikasi: `npm run dev`

## Environment variables

| Variabel | Kegunaan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci anon/publishable Supabase untuk klien |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci service role Supabase; hanya digunakan di route handler server |
| `MIDTRANS_SERVER_KEY` | Kunci server Midtrans Sandbox; hanya digunakan di route handler server |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Kunci client Midtrans Sandbox untuk Snap.js |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | URL redirect callback Supabase untuk pengembangan lokal (opsional; aplikasi memiliki fallback) |

Jangan masukkan nilai rahasia ke source code atau commit file environment asli. Atur nilainya di `.env.local` untuk lokal dan di Environment Variables project untuk deployment.

## Membuat akun admin

Daftarkan akun melalui aplikasi terlebih dahulu agar akun autentikasi dan baris profil terbentuk. Di Supabase Dashboard, buka **Table Editor → public.profiles**, temukan baris profil akun tersebut, lalu ubah kolom `role` menjadi `admin`. Jangan menyimpan password admin di SQL seed atau migration.
