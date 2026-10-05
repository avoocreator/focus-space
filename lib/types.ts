// ═══════════════════════════════════════════════════════
//  FOCUSSPACE 2.0 — TIPE DATA BERSAMA (kontrak semua fitur)
//  Nama field mengikuti kolom di supabase/schema.sql.
//  JANGAN mengubah tipe di sini tanpa update schema.
// ═══════════════════════════════════════════════════════

export type ProfileDTO = {
  id: string;
  display_name: string;
  avatar: string;
  status: string;
  xp: number;
  streak_current: number;
  streak_longest: number;
  last_active_date: string | null;
  created_at: string;
};

export type TaskPriority = "low" | "normal" | "high";

export type TaskDTO = {
  id: string;
  user_id: string;
  title: string;
  emoji: string | null;
  priority: TaskPriority;
  done: boolean;
  created_at: string;
  done_at: string | null;
};

export type FocusMode = "focus" | "break" | "long";

export type FocusSessionDTO = {
  id: string;
  user_id: string;
  mode: FocusMode;
  duration_sec: number;
  completed: boolean;
  created_at: string;
};

export type StudyRoomDTO = {
  id: string;
  name: string;
  password_hash: string | null;
  owner_id: string | null;
  created_at: string;
};

export type RoomMessageDTO = {
  id: string;
  room_name: string;
  user_id: string | null;
  sender: string;
  avatar: string;
  body: string;
  image_url: string | null;
  is_kazu: boolean;
  created_at: string;
};

export type VoiceChannelDTO = {
  id: string;
  room_name: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number; // index 0..3
  explain?: string;
};

export type QuizSetDTO = {
  id: string;
  host_id: string | null;
  host_name: string;
  title: string;
  topic: string | null;
  emoji: string;
  questions: QuizQuestion[];
  is_public: boolean;
  plays: number;
  created_at: string;
};

export type PlayerAnswer = {
  q: number; // index pertanyaan
  picked: number; // index opsi, -1 kalau tidak jawab
  correct: boolean;
  ms?: number; // waktu jawab dalam milidetik
};

export type QuizAttemptDTO = {
  id: string;
  set_id: string;
  room_code: string | null;
  user_id: string | null;
  player_name: string;
  score: number;
  total: number;
  answers: PlayerAnswer[];
  created_at: string;
};

export type GameKey = "wordle" | "minesweeper" | "g2048";

export type GameScoreDTO = {
  id: string;
  user_id: string;
  game: GameKey;
  score: number;
  won: boolean;
  meta: Record<string, unknown>;
  created_at: string;
};

// ── Event realtime quiz room (broadcast channel "quiz:{code}") ──
export type QuizRoomState = {
  status: "lobby" | "playing" | "finished";
  current_q: number;
  q_started_at: number; // epoch ms saat soal mulai (sinkron semua pemain)
  quiz_title: string;
  emoji: string;
  total_questions: number;
};

export type QuizPlayerState = {
  id: string; // user id atau guest id
  name: string;
  avatar: string;
  score: number;
  answered_current: boolean;
  ready: boolean;
};

// ── Event realtime voice channel (broadcast "vc:{channelId}") ──
export type VcSignal = {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice" | "hello" | "bye";
  payload?: unknown;
};
