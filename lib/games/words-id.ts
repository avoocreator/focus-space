// Kamus Wordle Indonesia — kata umum, TEPAT 5 huruf (divalidasi oleh scripts/validate-words.mjs).
export const WORDS: string[] = [
  // alam & cuaca
  "hujan", "malam", "senja", "fajar", "subuh", "siang", "bulan", "musim",
  "salju", "embun", "kabut", "gelap", "badai", "angin", "petir", "kilat",
  "gempa", "tanah", "pasir", "pohon", "hutan", "rimba", "kebun", "sawah",
  "bukit", "danau", "ombak", "pulau", "gurun", "oasis", "iklim", "cuaca",
  "udara", "satwa", "flora", "fauna", "lumut", "jamur", "pakis", "rotan",
  "bambu", "mawar", "tulip", "virus", "kuman",
  // rasa & makanan
  "manis", "pahit", "pedas", "gurih", "lezat", "bakso", "udang",
  "telur", "garam", "cabai", "tomat", "bayam", "jeruk", "melon", "salak",
  "sayur", "makan", "minum", "panci", "wajan", "garpu", "gelas", "botol",
  "pisau", "kecap", "samin", "kaldu", "bumbu", "resep", "masak", "rebus",
  "kukus", "bakar", "didih", "beras", "ketan", "tapai", "ngopi", "rehat",
  // sifat & kata kerja umum
  "besar", "kecil", "tebal", "tipis", "lebar", "dalam", "bawah", "kanan",
  "depan", "dekat", "cepat", "pelan", "halus", "kasar", "keras", "lunak",
  "lemah", "berat", "super", "ultra", "hebat", "keren", "indah", "gagah",
  "mewah", "kumuh", "kotor", "segar", "basah", "licin", "penuh", "semua",
  "hanya", "sudah", "belum", "masih", "lebih", "cukup", "pasti", "tentu",
  "siapa", "kapan", "untuk", "tanpa", "sebab", "kalau", "meski", "pergi",
  "jatuh", "duduk", "tidur", "mimpi", "marah", "sedih", "riang", "ceria",
  "damai", "yakin", "takut", "gagal", "kalah", "benar", "salah", "lurus",
  "belok", "putar", "tetap", "wajar", "lazim", "biasa", "mahal", "murah",
  "harga", "antar", "kirim", "pesan",
  // keluarga & sosial
  "kakak", "nenek", "kakek", "tante", "suami", "istri", "jodoh", "teman",
  "musuh", "lawan", "putra", "putri", "warga", "dusun", "dunia", "lokal",
  "galak", "jinak", "ramah", "sopan", "kalbu", "akrab", "rukun",
  // sekolah & kerja
  "tugas", "kerja", "nilai", "ujian", "kelas", "murid", "rumah", "kamar",
  "dapur", "taman", "jalan", "pintu", "kasur", "lampu", "lilin", "kipas",
  "radio", "kabel", "kunci", "logam", "perak", "rekan", "rapat", "bonus",
  "tiket", "hotel", "villa", "tenda", "paket", "surat", "gawai", "layar",
  "papan", "iklan", "viral", "halte", "peron", "taksi", "becak", "dokar",
  "bendi", "wesel",
  // teknologi & sains
  "mesin", "motor", "mobil", "kapal", "sopir", "robot", "sandi", "huruf",
  "abjad", "vokal", "suara", "bunyi", "desis", "gaung", "sinar", "optik",
  "lensa", "fokus", "bidik", "kilau", "rutin", "hasil", "input", "skill",
  "bakat", "teori", "rumus", "angka", "nomor", "total", "tabel", "kolom",
  "baris", "warna", "merah", "putih", "hitam", "hijau", "corak", "karya",
  "agung", "utama", "tunas", "mekar", "rindu", "harap", "tekad",
  "usaha", "sabar", "sunyi", "roket", "orbit", "komet", "sains", "kimia",
  "semen", "keset", "nakas", "pagar", "sirap",
  // hewan
  "singa", "macan", "domba", "zebra", "gajah", "badak", "tupai", "tikus",
  "elang", "bebek", "angsa", "panda", "koala", "lumba", "penyu", "buaya",
  "kobra", "katak", "kodok", "cicak", "kadal", "lebah", "semut", "lalat",
  "kecoa",
  // tubuh & kesehatan
  "tubuh", "sendi", "napas", "nafas", "limpa", "wajah", "mulut", "lidah",
  "leher", "perut", "kulit", "darah", "saraf", "sehat", "sakit", "demam",
  "batuk", "pilek", "sabun", "sampo", "pasta", "sikat",
  // budaya & hiburan
  "novel", "puisi", "sajak", "prosa", "drama", "aktor", "artis", "roman",
  "horor", "komik", "fakta", "opini", "musik", "irama", "ritme", "gitar",
  "piano", "biola", "lirik", "catur", "kartu", "kasti", "galah", "tenis",
  "tinju", "atlet", "wasit", "juara", "piala", "trofi",
  "humor", "kisah", "mitos", "akbar",
];

export const WORD_SET: Set<string> = new Set(WORDS);
