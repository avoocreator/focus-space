// Kata semangat harian — diporting dari FocusSpace versi lama (emoji dihapus, ikon di UI).
export const QUOTES: string[] = [
  "Satu langkah kecil setiap hari membuatmu jauh lebih maju.",
  "Fokus bukan soal waktu, tapi soal energi yang kamu arahkan.",
  "Kelelahan adalah tanda kamu sudah berjuang keras. Istirahat itu bukan menyerah.",
  "Belajar itu investasi terbaik yang pernah ada — return-nya seumur hidup.",
  "Kamu tidak harus sempurna. Kamu hanya perlu terus bergerak.",
  "Progres kecil tetaplah progres. Rayakan setiap langkahmu!",
  "Rasa penasaran adalah bahan bakar terbaik untuk belajar.",
  "Hari ini kamu lebih pintar dari hari kemarin. Terus begitu!",
  "Jangan banding-bandingkan perjalananmu dengan orang lain.",
  "Konsistensi mengalahkan motivasi. Hadir setiap hari, meski kecil.",
  "Kesalahan adalah guru terbaik yang bayarannya paling mahal.",
  "Otak yang lelah butuh jeda, bukan paksaan. Istirahat itu produktif!",
  "Temukan ritme belajarmu sendiri, bukan ritme orang lain.",
  "Bahkan bintang perlu kegelapan untuk bersinar.",
  "Passion tanpa disiplin itu mimpi. Disiplin tanpa passion itu penyiksaan. Cari keduanya!",
];

export function quoteOfTheDay(): string {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}
