# FocusSpace 2.0

> Kafe virtual buat belajar bareng — fokus bareng, dengar musik, ngobrol, adu kuis, main games. Dalam satu tempat yang cozy. ☕

**FocusSpace** adalah aplikasi web *virtual study café* — tempat belajar virtual yang menggabungkan pomodoro, musik, ruangan chat dengan voice channel, kuis multiplayer bertenaga AI, dan mini-games dengan sistem streak harian.

Ini adalah **remake penuh** dari [FocusSpace versi lama](https://github.com/avoocreator/focus-space-bymasDafa) yang masih HTML/CSS/JS sederhana — desain *cozy café neubrutalism* aslinya dipertahankan, tapi seluruh engine-nya dibangun ulang jadi aplikasi modern dengan animasi interaktif, sistem akun, dan fitur online.

**100% gratis dijalankan** — Supabase (free tier), Gemini API (free tier), Spotify Web API (gratis), dan hosting Vercel Hobby. Tanpa layanan berbayar.

---

## Fitur

### 🧠 Fokus & Produktivitas
- Timer **pomodoro** (25/5/15) dengan cincin progress animasi, mode fokus layar penuh, dan auto-chain istirahat
- **Target harian** (task list) dengan prioritas, sinkron antar perangkat
- **Quest harian** + sistem **streak, XP, level, lencana**, dan heatmap konsistensi 90 hari

### 🎧 Musik
- **Radio lofi generatif** — 4 track dibangkitkan real-time via Web Audio (bebas copyright, tetap play saat pindah halaman)
- **Integrasi Spotify** — OAuth PKCE, browsing playlist & pencarian lagu, putar penuh di browser (Premium) atau mode remote + preview 30 detik (akun gratis)
- Pemutar **file lokal** dengan queue & shuffle

### 🚪 Ruangan Belajar
- **Chat realtime** dengan gambar, reply, reaksi cepat, dan lobi berisi jumlah orang online live
- Ruangan bisa diberi **password**
- **@kazu** — asisten AI (Gemini) yang bisa diajak ngobrol langsung di chat

### 🎙️ Voice Channel
- Voice channel **P2P (WebRTC mesh)** ala Discord di setiap ruangan — tanpa server tambahan
- Mute, deafen, indikator sedang bicara, status koneksi per peserta (ideal sampai ±8 orang)

### 🎲 Kuis Bareng
- **Generator kuis AI** — ketik topik atau tempel materi, Gemini menyusun soalnya
- Editor soal manual, kuis bisa publik atau pribadi
- **Multiplayer live ala Wayground/Kahoot**: kode room 6 digit, lobby pemain, timer per soal, leaderboard live beranimasi, **podium** dengan confetti, dan review jawaban per soal
- Mode **solo latihan** untuk bermain sendiri

### 🎮 Mini-Games + Streak
- **Wordle Indonesia** — 366 kata 5 huruf, keyboard on-screen, statistik & share grid
- **Minesweeper** — 3 tingkat kesulitan, klik pertama selalu aman, best time
- **2048** — animasi geser sungguhan, undo, best score
- Semua game punya **Tantangan Harian** (puzzle sama untuk semua orang) yang menggerakkan **streak harian**

### 🎨 Lainnya
- **8 tema** warna (Cozy Cafe, Midnight, Forest, Ocean, Sakura, Sunset, Lavender, Matcha) + filter temperatur layar (night-light)
- **PWA** — installable sebagai aplikasi dengan pintasan cepat & offline fallback
- Login **tamu** (tanpa daftar), email OTP, atau Google

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) (App Router) + React 18 + TypeScript |
| Styling & animasi | Tailwind CSS + Framer Motion (neubrutalism cozy, CSS variables 8 tema) |
| State | Zustand |
| Database & Auth | [Supabase](https://supabase.com) — PostgreSQL + Row Level Security |
| Realtime | Supabase Realtime — chat, presence, signaling WebRTC, sinkronisasi kuis |
| Storage | Supabase Storage (gambar chat) |
| AI | [Gemini API](https://ai.google.dev) — generator kuis & asisten Kazu |
| Musik | Web Audio API (synthesizer generatif) + Spotify Web API & Web Playback SDK (PKCE) |
| Voice | WebRTC mesh (STUN Google + TURN publik gratis Open Relay) |
| PWA | Manifest + service worker buatan sendiri (tanpa library tambahan) |
| Hosting | Vercel (Hobby, gratis) — serverless functions untuk API Gemini & token Spotify |

### Kenapa stack ini?
- **Supabase** dipilih karena satu layanan menutup database + auth + realtime + storage sekaligus — paling sedikit setup-nya di antara opsi gratis.
- **Voice P2P mesh** tidak butuh server media, jadi tetap gratis tanpa batas.
- **Musik generatif** dibangkitkan kode, bukan file audio — tidak ada masalah lisensi dan tidak ada bandwidth.
- Semua kunci rahasia (Gemini) dijaga di serverless functions; yang di browser hanya kunci publik (anon key, Spotify client ID).

---

## Arsitektur Singkat

```
Browser (Next.js client)
 ├── Supabase JS ────── PostgreSQL (RLS) + Auth + Storage
 ├── Supabase Realtime ─ chat, presence, signaling voice, sinkron kuis
 ├── WebRTC mesh ─────── audio P2P antar peserta voice channel
 └── Web Audio ────────── musik lofi generatif + SFX
            │
Vercel Serverless (API routes)
 ├── /api/gemini/* ──── Gemini API (kunci rahasia di server)
 └── /api/spotify/* ─── token exchange PKCE
```

Streak & XP dihitung server-side lewat fungsi PostgreSQL `touch_streak` (lihat `supabase/schema.sql`) supaya tidak bisa dimanipulasi dari client.

---

## Struktur Project

```
├── app/                    # Halaman (App Router)
│   ├── page.tsx            # Dashboard: pomodoro, target, quest
│   ├── music/              # Musik (radio + Spotify + file lokal)
│   ├── rooms/              # Ruangan chat + voice channel
│   ├── quiz/               # Kuis (hub, create, play/[code])
│   ├── games/              # Wordle, Minesweeper, 2048
│   ├── profile/            # Statistik, streak, lencana
│   ├── login/  setup/      # Login & panduan setup in-app
│   └── api/                # Serverless (Gemini & Spotify token)
├── components/             # Komponen per fitur + UI kit
├── lib/                    # Klien Supabase, tipe, util, streak, engine musik, logika game
├── stores/                 # Zustand store (musik global)
├── supabase/schema.sql     # ⭐ Database — jalankan ini di Supabase
├── public/                 # Manifest PWA, service worker, ikon
├── GUIDE.md                # 📖 Panduan setup & deploy lengkap
└── .env.example            # Template environment variables
```

---

## Mulai Cepat

```bash
git clone https://github.com/avoocreator/focus-space.git
cd focus-space
npm install
cp .env.example .env.local   # isi kunci — lihat GUIDE.md
npm run dev
```

Butuh kunci API gratis (Supabase, Gemini, Spotify opsional)? **Semua langkahnya ada di [GUIDE.md](GUIDE.md)** — termasuk deploy ke Vercel dan troubleshooting. Ada juga halaman `/setup` di dalam aplikasi.

---

## Kredit

Dibuat ulang dengan ☕ dari [FocusSpace by masDafa](https://github.com/avoocreator/focus-space-bymasDafa) — musik lofi generatif, desain cozy café, dan semua karakter tersayang (Kazu!) diporting dari versi asli.

## Lisensi

MIT
