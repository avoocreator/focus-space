# Panduan Setup — FocusSpace 2.0

Panduan lengkap dari nol sampai online. Semua layanan yang dibutuhkan punya paket gratis — tidak ada yang berbayar. Estimasi total: ± 10 menit.

---

## 1️⃣ Supabase — database, login, realtime (WAJIB)

1. Buka [supabase.com](https://supabase.com) → daftar gratis → **New Project**
   - Nama: `focus-space` (bebas), password database boleh di-generate, **Region: Singapore** (terdekat untuk Indonesia)
2. Tunggu project jadi (~2 menit), lalu buka **SQL Editor** → **New query**
3. Buka file [`supabase/schema.sql`](supabase/schema.sql) di repo ini → **copy SELURUH isinya** → paste di SQL Editor → **Run** ✅
   - Aman dijalankan ulang — script-nya idempotent (tidak menduplikasi apa pun)
4. Buka **Project Settings (⚙️) → API** → salin:
   - `Project URL` → ini `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → ini `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **PENTING untuk mode Tamu:** buka **Authentication → Sign In / Up** → centang **Allow anonymous sign-ins** → Save
6. *(Opsional)* Login Google: **Authentication → Providers → Google** → aktifkan, isi Client ID/Secret dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (buat OAuth Client ID tipe *Web application*, Authorized redirect URI: `https://xxxx.supabase.co/auth/v1/callback`)

### Apa saja yang dibuat oleh schema.sql?
Tabel `profiles`, `tasks`, `focus_sessions`, `study_rooms`, `room_messages`, `voice_channels`, `quiz_sets`, `quiz_attempts`, `game_scores` — lengkap dengan Row Level Security, trigger auto-buat profil, fungsi RPC `touch_streak` (streak + XP), konfigurasi Realtime, dan storage bucket `chat-images`.

---

## 2️⃣ Gemini API — kuis AI & asisten Kazu (WAJIB)

1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. **Create API key** (gratis, tanpa kartu kredit) → salin → ini `GEMINI_API_KEY`
3. *(Opsional)* Variabel `GEMINI_MODEL` bisa diisi mis. `gemini-2.5-flash` (sudah jadi default)

Dipakai oleh: generator soal kuis (`/api/gemini/quiz`) dan asisten chat **@kazu** di ruangan (`/api/gemini/chat`). API key tidak pernah dikirim ke browser — semua lewat serverless function.

---

## 3️⃣ Spotify — musik dari Spotify (OPSIONAL, bisa dilewati dulu)

1. Buka [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → login → **Create app**
   - App name: `FocusSpace`
   - **Redirect URIs**: `http://localhost:3000/music/callback` **dan** `https://DOMAIN-VERCEL-KAMU.vercel.app/music/callback` (isi domain final setelah deploy, klik Add)
   - **Which API/SDKs are you planning to use?** → centang **Web API** + **Web Playback SDK**
2. Salin **Client ID** → ini `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` (tidak butuh client secret — aplikasi memakai alur PKCE)

> ℹ️ **Catatan Spotify:** memutar lagu *penuh di dalam browser* hanya untuk akun **Premium** (kebijakan Spotify). Akun **gratis** tetap bisa: browsing playlist, cari lagu, preview 30 detik, dan mengontrol pemutaran di app Spotify milikmu (mode remote). Radio lofi generatif & file lokal tidak butuh Spotify sama sekali.

---

## 4️⃣ Jalankan di komputer (development)

```bash
# 1. Install dependency
npm install

# 2. Buat file env — salin template
cp .env.example .env.local      # Windows: copy .env.example .env.local

# 3. Isi .env.local dengan key dari langkah 1-3

# 4. Jalankan
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — pesan "Supabase belum dikonfigurasi" di beranda akan hilang otomatis begitu env terbaca.

---

## 5️⃣ Deploy ke Vercel (gratis)

1. Push repo ini ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "FocusSpace 2.0"
   git remote add origin https://github.com/USERNAME/focus-space.git
   git branch -M main
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com) → login dengan GitHub → **Add New… → Project** → pilih repo ini
3. Framework otomatis terdeteksi (Next.js) — **sebelum** klik Deploy, buka **Environment Variables** dan tambahkan:

   | Variable | Wajib? | Isi |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | dari Supabase langkah 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | dari Supabase langkah 1 |
   | `GEMINI_API_KEY` | ✅ | dari langkah 2 |
   | `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | opsional | dari langkah 3 |
   | `GEMINI_MODEL` | opsional | default `gemini-2.5-flash` |

4. **Deploy** → dapat domain `xxxx.vercel.app`
5. Kembali ke Spotify Dashboard → tambahkan `https://xxxx.vercel.app/music/callback` ke Redirect URIs (kalau pakai Spotify)

Selesai — aplikasi live. 🎊

---

## 📲 Install sebagai aplikasi (PWA)

Buka situsnya di Chrome/Edge (desktop) atau Chrome/Safari (HP) → klik tombol **Install Aplikasi** di header, atau ikon "install" di address bar. FocusSpace akan terpasang dengan jendela sendiri + pintasan cepat (klik kanan ikon → Timer Fokus / Musik / Kuis / Games).

Untuk PWA penuh, situs harus diakses via **HTTPS** — di Vercel sudah otomatis; untuk tes lokal gunakan `localhost` (dianggap secure context).

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---|---|
| Beranda muncul "Supabase belum dikonfigurasi" | `.env.local` belum diisi / server belum di-restart. Di Vercel: cek Environment Variables lalu re-deploy |
| Login Tamu gagal | Aktifkan *Allow anonymous sign-ins* di Supabase → Authentication → Sign In/Up |
| Kuis AI error "Gemini" | Cek `GEMINI_API_KEY` di env. Free tier Gemini punya limit per menit — tunggu sebentar |
| Spotify "redirect mismatch" | Redirect URI di Spotify Dashboard harus **persis** sama: `https://domain.vercel.app/music/callback` |
| Lagu Spotify tidak bisa diputar di browser | Hanya akun Premium yang bisa streaming in-browser; akun gratis pakai tombol kontrol remote / preview 30s |
| Voice "Channel penuh" / gagal konek | Voice pakai P2P mesh (maks ±8 orang). Jaringan korporat/NAT ketat kadang memblokir P2P — coba hotspot |
| Streak/XP tidak naik | Pastikan sudah login (tamu pun bisa) & `schema.sql` sudah dijalankan (RPC `touch_streak` ada di dalamnya) |
| Pesan error `Cannot find module './xxx.js'` saat `npm run dev` | Cache dev vs build produksi tertukar — hentikan server, hapus folder `.next`, jalankan `npm run dev` lagi |

---

## 🔐 Catatan keamanan

- `anon public key` Supabase **aman** dipakai di client — datanya dilindungi Row Level Security (RLS) di `schema.sql`
- `GEMINI_API_KEY` hanya dipakai di server (API routes), tidak pernah sampai ke browser
- Spotify memakai PKCE — tanpa client secret
- Password ruangan chat di-hash SHA-256 sebelum dikirim ke database
