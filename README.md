# ☕ FocusSpace 2.0

> Ruang belajar virtual yang cozy — fokus, musik, belajar bareng, adu kuis, dan mini-games. Dalam satu kafe. 🌟

**FocusSpace 2.0** adalah remake penuh dari [FocusSpace versi lama](https://github.com/avoocreator/focus-space-bymasDafa) (yang masih HTML/JS sederhana) menjadi aplikasi modern dengan desain *cozy café neubrutalism* yang sama persis, tapi animasi lebih interaktif & profesional — plus 5 fitur besar baru.

---

## ✨ Fitur

| Fitur | Deskripsi |
|---|---|
| 🧠 **Pomodoro + Target Harian** | Timer fokus 25/5/15 dengan cincin progress animasi, mode fokus layar penuh, quest harian, task list dengan prioritas, kutipan semangat |
| 🎧 **Musik Cozy + Spotify** | 4 track lofi *generatif* (dibangkitkan real-time via Web Audio, bebas copyright, tetap play saat pindah halaman), **integrasi Spotify** (OAuth PKCE — browsing playlist, cari lagu, putar penuh untuk Premium / kontrol remote untuk akun gratis), plus pemutar file lokal |
| 🚪 **Ruangan Belajar** | Chat realtime dengan gambar, reply, reaksi cepat, lobi dengan jumlah orang online live, room ber-password, dan **@kazu** — asisten AI (Gemini) di dalam chat |
| 🎙️ **Voice Channel** | Voice channel P2P (WebRTC mesh) ala Discord di setiap ruangan — mute, deafen, indikator bicara, tanpa server tambahan |
| 🎲 **Kuis Bareng (Gemini)** | Generate kuis dari topik/materi dengan **Gemini AI**, editor soal manual, host room dengan kode 6 digit, leaderboard live beranimasi, **podium** 🥇🥈🥉 dengan confetti, review jawaban per soal — persis alur Wayground |
| 🎮 **Mini-Games + Streak** | **Wordle Indonesia**, **Minesweeper**, **2048** — semua punya *Tantangan Harian* (puzzle sama untuk semua orang tiap hari) dan **streak hari** 🔥 + XP + level + lencana |
| 📲 **PWA** | Installable sebagai aplikasi (desktop & HP), pintasan cepat (Fokus/Musik/Kuis/Games), offline fallback, ikon maskable |
| 🎨 **8 Tema** | Cozy Cafe, Midnight, Forest, Ocean, Sakura, Sunset, Lavender, Matcha — plus filter temperatur layar (night-light) |

**100% gratis** — Supabase (free tier), Gemini API (free tier), Spotify Web API (gratis), Vercel Hobby (gratis). Tidak ada layanan berbayar yang dibutuhkan.

---

## 🚀 Setup Dari Nol (± 10 menit)

Semua yang dibutuhkan hanya **3 API key gratis**. Ikuti berurutan:

### 1️⃣ Supabase — database, login, realtime (WAJIB)

1. Buka [supabase.com](https://supabase.com) → daftar gratis → **New Project**
   - Nama: `focus-space` (bebas), password database boleh di-generate, **Region: Singapore** (terdekat untuk Indonesia)
2. Tunggu project jadi (~2 menit), lalu buka **SQL Editor** → **New query**
3. Buka file [`supabase/schema.sql`](supabase/schema.sql) di repo ini → **copy SELURUH isinya** → paste di SQL Editor → **Run** ✅
   - (Aman dijalankan ulang — script-nya idempotent)
4. Buka **Project Settings (⚙️) → API** → salin:
   - `Project URL` → ini `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → ini `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **PENTING untuk mode Tamu:** buka **Authentication → Sign In / Up** → centang **Allow anonymous sign-ins** → Save
6. *(Opsional)* Login Google: **Authentication → Providers → Google** → aktifkan, isi Client ID/Secret dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (buat OAuth Client ID tipe *Web application*, Authorized redirect URI: `https://xxxx.supabase.co/auth/v1/callback`)

### 2️⃣ Gemini API — generator kuis AI & Kazu (WAJIB)

1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. **Create API key** (gratis, tanpa kartu kredit) → salin → ini `GEMINI_API_KEY`

### 3️⃣ Spotify — musik dari Spotify (OPSIONAL, skip dulu juga boleh)

1. Buka [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → login → **Create app**
   - App name: `FocusSpace`
   - **Redirect URIs**: `http://localhost:3000/music/callback` **dan** `https://DOMAIN-VERCEL-KAMU.vercel.app/music/callback` (isi domain final setelah deploy, klik Add)
   - **Which API/SDKs are you planning to use?** → centang **Web API** + **Web Playback SDK**
2. Salin **Client ID** → ini `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` (tidak butuh client secret — aplikasi memakai PKCE)

> ℹ️ **Catatan Spotify:** memutar lagu *penuh di dalam browser* hanya untuk akun **Premium** (kebijakan Spotify). Akun **gratis** tetap bisa: browsing playlist, cari lagu, preview 30 detik, dan mengontrol pemutaran di app Spotify milikmu (mode remote).

### 4️⃣ Jalankan di komputer (development)

```bash
# 1. Install dependency
npm install

# 2. Buat file env — salin template
cp .env.example .env.local      # Windows: copy .env.example .env.local

# 3. Isi .env.local dengan key dari langkah 1-3

# 4. Jalankan
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) 🎉

### 5️⃣ Deploy ke Vercel (gratis)

1. Push repo ini ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "FocusSpace 2.0 ☕"
   git remote add origin https://github.com/USERNAME/focus-space.git
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com) → login dengan GitHub → **Add New… → Project** → pilih repo ini
3. Framework otomatis terdeteksi (Next.js) — **sebelum** klik Deploy, buka **Environment Variables** dan tambahkan semua variabel dari `.env.example`:

   | Variable | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | dari Supabase step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dari Supabase step 1 |
   | `GEMINI_API_KEY` | dari step 2 |
   | `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | dari step 3 (opsional) |
   | `GEMINI_MODEL` | *(opsional)* default `gemini-2.5-flash` |

4. **Deploy** → dapat domain `xxxx.vercel.app`
5. Kembali ke Spotify Dashboard → tambahkan `https://xxxx.vercel.app/music/callback` ke Redirect URIs (kalau kamu pakai Spotify)

Selesai! Aplikasinya live. 🎊

### 📲 Install sebagai aplikasi

Buka situsnya di Chrome/Edge (desktop) atau Chrome/Safari (HP) → klik tombol **📲 Install Aplikasi** di header, atau ikon "install" di address bar. FocusSpace akan terpasang punya jendela sendiri + pintasan cepat (klik kanan ikon → Timer Fokus / Musik / Kuis / Games).

---

## 🗂️ Struktur Project

```
├── app/                    # Halaman (Next.js App Router)
│   ├── page.tsx            # 🏠 Dashboard: pomodoro, target, quest
│   ├── music/              # 🎧 Musik (radio cozy + Spotify + file lokal)
│   ├── rooms/              # 🚪 Ruangan chat + voice channel
│   ├── quiz/               # 🎲 Kuis (hub, create, play/[code])
│   ├── games/              # 🎮 Wordle, Minesweeper, 2048
│   ├── profile/            # 👤 Statistik, streak, lencana
│   ├── login/              # 🔑 Login (tamu / email OTP / Google)
│   ├── setup/              # Panduan setup di dalam aplikasi
│   └── api/                # Serverless functions (Gemini & Spotify token)
├── components/             # Komponen per fitur + UI kit
├── lib/                    # Klien Supabase, tipe, util, streak, engine musik
├── stores/                 # Zustand store (musik global)
├── supabase/schema.sql     # ⭐ DATABASE — jalankan ini di Supabase
├── public/                 # Manifest PWA, service worker, ikon
└── .env.example            # Template environment variables
```

## 🧰 Stack

- **Next.js 14** (App Router) + TypeScript + React 18
- **Tailwind CSS** + **Framer Motion** (animasi) + **Zustand** (state)
- **Supabase** — Postgres, Auth (tamu/email OTP/Google), Realtime (chat, presence, signaling voice, sinkron kuis), Storage (gambar chat)
- **Gemini API** — generator kuis & asisten Kazu
- **Spotify Web API + Web Playback SDK** — OAuth PKCE (tanpa client secret)
- **WebRTC mesh** — voice channel P2P (STUN Google + TURN gratis Open Relay)
- **PWA** — manifest + service worker buatan sendiri (tanpa library tambahan)

## 🔧 Troubleshooting

| Masalah | Solusi |
|---|---|
| Beranda muncul "Supabase belum dikonfigurasi" | `.env.local` belum diisi / server belum di-restart. Di Vercel: cek Environment Variables lalu re-deploy |
| Login Tamu gagal | Aktifkan *Allow anonymous sign-ins* di Supabase → Authentication → Sign In/Up |
| Kuis AI error "Gemini" | Cek `GEMINI_API_KEY` di env. Free tier Gemini punya limit per menit — tunggu sebentar |
| Spotify "redirect mismatch" | Redirect URI di Spotify Dashboard harus **persis** sama: `https://domain.vercel.app/music/callback` |
| Lagu Spotify tidak bisa diputar di browser | Hanya akun Premium yang bisa streaming in-browser; akun gratis pakai tombol kontrol remote/preview 30s |
| Voice "Channel penuh" / gagal konek | Voice pakai P2P mesh (maks ±8 orang). Jaringan korporat/NAT ketat kadang memblokir P2P — coba hotspot |
| Streak/XP tidak naik | Pastikan sudah login (tamu pun bisa) & `schema.sql` sudah dijalankan (RPC `touch_streak` ada di dalamnya) |

## 📝 Lisensi & Kredit

Dibuat ulang dengan ☕ dari [FocusSpace by masDafa](https://github.com/avoocreator/focus-space-bymasDafa). Musik lofi generatif, desain cozy café neubrutalism, dan semua karakter tersayang (Kazu!) diporting dari versi asli.
