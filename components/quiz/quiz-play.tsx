"use client";

// ═════════════════════════════════════════════════════════════
//  QuizPlay — ORCHESTRATOR panggung kuis /quiz/play/[code].
//  Fullscreen tanpa AppShell (lihat components/layout/app-shell).
//
//  Mode dari param `code`:
//   • solo-{setId}  → latihan lokal (tanpa multiplayer), demo
//     bawaan kalau Supabase off / set gagal dimuat.
//   • host-{setId}  → host = state master, generate kode room,
//     broadcast di channel realtime `quiz:{code}`.
//   • CODE (6 char) → join room via join_request → sync.
//
//  Protokol (union QuizBroadcast di quiz-shared):
//   join_request → sync · state (soal baru/finished) · reveal ·
//   answer · ready · heartbeat 3s (host) · host_left (→ takeover).
//  Anti-cheat: soal yang dibroadcast TANPA answer & explain.
//  Anti-hilang: refresh = join_request ulang → sync posisi
//  terkini; host keluar → pemain lain bisa ambil alih (30 detik).
// ═════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ambulance,
  ArrowLeft,
  Coffee,
  Donut,
  Leaf,
  RotateCcw,
  SearchX,
  Skull,
  Tent,
  Wrench,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { clamp, randomCode } from "@/lib/utils";
import { recordActivity } from "@/lib/activity";
import type { PlayerAnswer, QuizPlayerState, QuizQuestion, QuizRoomState, QuizSetDTO } from "@/lib/types";
import QuizLobby from "./quiz-lobby";
import QuizStage from "./quiz-stage";
import QuizPodium from "./quiz-podium";
import QuizReview from "./quiz-review";
import {
  HEARTBEAT_MS,
  HOST_TIMEOUT_MS,
  JOIN_TIMEOUT_MS,
  QUESTION_MS,
  REVEAL_SECONDS,
  TAKEOVER_COUNTDOWN,
  buildDemoSet,
  computeStats,
  getLocalSet,
  getMeId,
  rightNamesFor,
  scoreFor,
  stripQuestion,
  type PlayMode,
  type PublicQuestion,
  type QuizBroadcast,
  type RevealInfo,
} from "./quiz-shared";

type Phase = "loading" | "lobby" | "question" | "reveal" | "finished" | "notfound" | "error";

type ParsedCode = { mode: PlayMode; setId: string; roomCode: string } | null;

function parseCode(raw: string): ParsedCode {
  const c = decodeURIComponent(raw || "").trim();
  if (c.startsWith("solo-")) return { mode: "solo", setId: c.slice(5), roomCode: "solo" };
  if (c.startsWith("host-")) return { mode: "host", setId: c.slice(5), roomCode: "" };
  if (/^[a-z0-9]{6}$/i.test(c)) return { mode: "join", setId: "", roomCode: c.toUpperCase() };
  return null;
}

function derivePhase(st: QuizRoomState, rv: RevealInfo | null): Phase {
  if (st.status === "lobby") return "lobby";
  if (st.status === "finished") return "finished";
  return rv ? "reveal" : "question";
}

export default function QuizPlay({ code }: { code: string }) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const parsed = useMemo(() => parseCode(code), [code]);

  // ── UI state (mirror dari refs lewat syncUi) ──
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎲");
  const [roomState, setRoomState] = useState<QuizRoomState | null>(null);
  const [questionPub, setQuestionPub] = useState<PublicQuestion | null>(null);
  const [reveal, setReveal] = useState<RevealInfo | null>(null);
  const [players, setPlayers] = useState<QuizPlayerState[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [myAnswers, setMyAnswers] = useState<PlayerAnswer[]>([]);
  const [advanceIn, setAdvanceIn] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [combo, setCombo] = useState(0);
  const [roomCode, setRoomCode] = useState("");
  const [hostGoneAt, setHostGoneAt] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [goneNow, setGoneNow] = useState(0);

  // ── refs otoritatif (sumber kebenaran mesin) ──
  const modeRef = useRef<PlayMode>("solo");
  const phaseRef = useRef<Phase>("loading");
  const roomStateRef = useRef<QuizRoomState | null>(null);
  const playersRef = useRef<QuizPlayerState[]>([]);
  const questionPubRef = useRef<PublicQuestion | null>(null);
  const revealRef = useRef<RevealInfo | null>(null);
  const pickedRef = useRef<number | null>(null);
  const myAnswersRef = useRef<PlayerAnswer[]>([]);
  const comboRef = useRef(0);
  const questionsRef = useRef<QuizQuestion[] | null>(null);
  const fullQuestionsRef = useRef<QuizQuestion[] | null>(null);
  const heardRef = useRef<Map<number, Map<string, PlayerAnswer>>>(new Map());
  const picksRef = useRef<Map<string, { picked: number; ms: number }>>(new Map());
  const isHostRef = useRef(false);
  const joinedRef = useRef(false);
  const endedRef = useRef(false);
  const chRef = useRef<RealtimeChannel | null>(null);
  const setIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string>("");
  const meIdRef = useRef<string>("");
  const meNameRef = useRef<string>("Tamu");
  const meAvatarRef = useRef<string>("🐣");
  const userIdRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const emojiRef = useRef("🎲");
  const lastBeatRef = useRef(0);
  const hostGoneAtRef = useRef<number | null>(null);
  const advanceAtRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const joinTimerRef = useRef<number | null>(null);
  const tickerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const stopTimer = (id: number | null) => {
    if (id === null) return;
    window.clearTimeout(id);
    window.clearInterval(id);
  };

  // ── mirror refs → state (panggil setelah mutasi refs) ──
  const syncUi = () => {
    setPhase(phaseRef.current);
    setRoomState(roomStateRef.current ? { ...roomStateRef.current } : null);
    setPlayers(playersRef.current.map((p) => ({ ...p })));
    setQuestionPub(questionPubRef.current ? { ...questionPubRef.current } : null);
    setReveal(revealRef.current ? { ...revealRef.current } : null);
    setPicked(pickedRef.current);
    setMyAnswers([...myAnswersRef.current]);
    setAnsweredCount(picksRef.current.size);
    setIsHost(isHostRef.current);
    setCombo(comboRef.current);
  };

  // ── kirim broadcast (aman kalau channel belum ada) ──
  const send = (msg: QuizBroadcast) => {
    const ch = chRef.current;
    if (!ch) return;
    void ch
      .send({ type: "broadcast", event: "msg", payload: msg as unknown as Record<string, unknown> })
      .catch(() => {});
  };

  const recordHeard = (qIdx: number, id: string, pickedIdx: number, ms: number) => {
    if (qIdx < 0) return;
    let m = heardRef.current.get(qIdx);
    if (!m) {
      m = new Map();
      heardRef.current.set(qIdx, m);
    }
    m.set(id, { q: qIdx, picked: pickedIdx, correct: false, ms });
  };

  const currentQ = () => roomStateRef.current?.current_q ?? 0;

  /** pemegang kendali game: host asli, solo, atau host hasil takeover. */
  const isMaster = () => modeRef.current !== "join" || isHostRef.current;

  // ═══════════════════════════════════════════════════
  //  MESIN GAME (semua lewat refs — aman dari stale closure)
  // ═══════════════════════════════════════════════════

  /** umumkan jawaban benar + hitung pemain + finalisasi jawabanku. */
  const applyReveal = (correct: number, explain: string | undefined, fromHost?: QuizPlayerState[]) => {
    if (phaseRef.current === "reveal" || phaseRef.current === "finished") return;
    stopTimer(revealTimerRef.current);
    revealTimerRef.current = null;
    revealRef.current = { correct, explain };
    if (fromHost) playersRef.current = fromHost;

    const qIdx = currentQ();
    if (pickedRef.current !== null) {
      const ms = picksRef.current.get(meIdRef.current)?.ms;
      myAnswersRef.current = [
        ...myAnswersRef.current,
        { q: qIdx, picked: pickedRef.current, correct: pickedRef.current === correct, ms },
      ];
    } else {
      myAnswersRef.current = [...myAnswersRef.current, { q: qIdx, picked: -1, correct: false }];
    }

    playSound("chat");
    if (pickedRef.current === correct) {
      comboRef.current += 1;
      window.setTimeout(() => playSound("success"), 170);
      void recordActivity("quiz_answer");
    } else if (pickedRef.current !== null) {
      comboRef.current = 0;
      window.setTimeout(() => playSound("wrong"), 170);
    } else {
      comboRef.current = 0;
    }

    phaseRef.current = "reveal";
    if (isMaster() && modeRef.current !== "solo" && advanceAtRef.current === null) {
      advanceAtRef.current = Date.now() + REVEAL_SECONDS * 1000;
      stopTimer(advanceTimerRef.current);
      advanceTimerRef.current = window.setTimeout(() => advance(), REVEAL_SECONDS * 1000);
    }
    syncUi();
  };

  /** host/solo: mulai soal ke-{idx} (broadcast state untuk host). */
  const startQuestion = (idx: number) => {
    const qs = questionsRef.current ?? [];
    const q = qs[idx];
    if (!q) {
      finishGame();
      return;
    }
    stopTimer(revealTimerRef.current);
    picksRef.current.clear();
    pickedRef.current = null;
    revealRef.current = null;
    playersRef.current = playersRef.current.map((p) => ({ ...p, answered_current: false }));
    roomStateRef.current = {
      status: "playing",
      current_q: idx,
      q_started_at: Date.now(),
      quiz_title: titleRef.current,
      emoji: emojiRef.current,
      total_questions: qs.length,
    };
    questionPubRef.current = stripQuestion(q);
    phaseRef.current = "question";
    if (isMaster() && modeRef.current !== "solo") {
      send({
        type: "state",
        host_id: meIdRef.current,
        set_id: setIdRef.current,
        state: roomStateRef.current,
        question: questionPubRef.current,
        players: playersRef.current,
      });
    }
    syncUi();
    // joiner murni tidak menjalankan timer reveal — host yang memegang kendali
    if (isMaster()) revealTimerRef.current = window.setTimeout(() => doReveal(), QUESTION_MS);
  };

  /** host/solo: umumkan jawaban benar + hitung skor semua pemain. */
  const doReveal = () => {
    if (phaseRef.current !== "question") return;
    const q = questionsRef.current?.[currentQ()];
    if (!q) return;
    stopTimer(revealTimerRef.current);
    revealTimerRef.current = null;
    const correct = q.answer;
    playersRef.current = playersRef.current.map((p) => {
      const pk = picksRef.current.get(p.id);
      const gain = pk && pk.picked === correct ? scoreFor(pk.ms) : 0;
      return { ...p, score: p.score + gain, answered_current: !!pk };
    });
    if (isMaster() && modeRef.current !== "solo") {
      send({
        type: "reveal",
        host_id: meIdRef.current,
        correct,
        explain: q.explain,
        players: playersRef.current,
      });
    }
    applyReveal(correct, q.explain, playersRef.current);
  };

  /** host/solo: lanjut soal berikutnya atau selesaikan. */
  const advance = () => {
    stopTimer(advanceTimerRef.current);
    advanceTimerRef.current = null;
    advanceAtRef.current = null;
    setAdvanceIn(null);
    if (!isMaster()) return;
    const st = roomStateRef.current;
    if (!st) return;
    const next = st.current_q + 1;
    if (next >= (questionsRef.current?.length ?? 0)) {
      finishGame();
      return;
    }
    startQuestion(next);
  };

  /** selesai → status finished (+ broadcast lengkap untuk review). */
  const finishGame = () => {
    stopTimer(revealTimerRef.current);
    stopTimer(advanceTimerRef.current);
    advanceTimerRef.current = null;
    setAdvanceIn(null);
    const totalQ = questionsRef.current?.length ?? 0;
    roomStateRef.current = {
      status: "finished",
      current_q: Math.max(0, roomStateRef.current?.current_q ?? totalQ - 1),
      q_started_at: Date.now(),
      quiz_title: titleRef.current,
      emoji: emojiRef.current,
      total_questions: totalQ,
    };
    questionPubRef.current = null;
    phaseRef.current = "finished";
    if (isMaster() && modeRef.current !== "solo") {
      fullQuestionsRef.current = questionsRef.current;
      send({
        type: "state",
        host_id: meIdRef.current,
        set_id: setIdRef.current,
        state: roomStateRef.current,
        question: null,
        players: playersRef.current,
        full_questions: questionsRef.current ?? [],
      });
    }
    if (modeRef.current === "solo") fullQuestionsRef.current = questionsRef.current;
    doFinishLocal();
    syncUi();
  };

  /** persist attempt + plays + aktivitas (sekali per game). */
  const doFinishLocal = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    playSound("success");
    void recordActivity("quiz");
    const setId = setIdRef.current;
    const uid = userIdRef.current;
    const saveable = !!setId && !setId.startsWith("demo") && !setId.startsWith("local-") && isSupabaseConfigured;
    if (saveable && uid) {
      const myScore = playersRef.current.find((p) => p.id === meIdRef.current)?.score ?? 0;
      void (async () => {
        try {
          const sb = getSupabase();
          await sb.from("quiz_attempts").insert({
            set_id: setId,
            room_code: roomCodeRef.current || null,
            user_id: uid,
            player_name: meNameRef.current,
            score: myScore,
            total: questionsRef.current?.length ?? 0,
            answers: myAnswersRef.current,
          });
        } catch {
          /* tanpa sesi / FK gagal — diam */
        }
        if (isHostRef.current || modeRef.current === "solo") {
          // plays +1 dari client (race kecil tidak masalah — kontrak modul)
          try {
            const sb = getSupabase();
            const { data } = await sb.from("quiz_sets").select("plays").eq("id", setId!).maybeSingle();
            const cur =
              typeof (data as { plays?: number } | null)?.plays === "number"
                ? (data as { plays: number }).plays
                : 0;
            await sb.from("quiz_sets").update({ plays: cur + 1 }).eq("id", setId!);
          } catch {
            /* diam */
          }
        }
      })();
    }
  };

  /** host: sync penuh (balasan join_request & perubahan lobby). */
  const broadcastSync = () => {
    const st = roomStateRef.current;
    if (!st) return;
    send({
      type: "sync",
      host_id: meIdRef.current,
      set_id: setIdRef.current,
      state: st,
      players: playersRef.current,
      question: questionPubRef.current,
      reveal: revealRef.current,
      questions: st.status === "playing" ? null : questionsRef.current,
    });
  };

  const startHeartbeat = () => {
    stopTimer(heartbeatTimerRef.current);
    heartbeatTimerRef.current = window.setInterval(() => {
      send({ type: "heartbeat", host_id: meIdRef.current });
    }, HEARTBEAT_MS);
    send({ type: "heartbeat", host_id: meIdRef.current });
  };

  /** ambil alih kepemimpinan (host lama menghilang). */
  const becomeHost = () => {
    isHostRef.current = true;
    joinedRef.current = true;
    hostGoneAtRef.current = null;
    setHostGoneAt(null);
    setIsHost(true);
    lastBeatRef.current = Date.now();
    startHeartbeat();
    if (phaseRef.current === "question") {
      const st = roomStateRef.current;
      const elapsed = st ? Date.now() - st.q_started_at : 0;
      stopTimer(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => doReveal(), Math.max(500, QUESTION_MS - elapsed));
    } else if (phaseRef.current === "reveal") {
      advanceAtRef.current = Date.now() + REVEAL_SECONDS * 1000;
      stopTimer(advanceTimerRef.current);
      advanceTimerRef.current = window.setTimeout(() => advance(), REVEAL_SECONDS * 1000);
    } else if (phaseRef.current === "lobby") {
      broadcastSync();
    }
    playSound("success");
    toast("success", "Kamu kini host-nya — kendali penuh di tanganmu!");
    syncUi();
  };

  const takeover = () => {
    if (isHostRef.current) return;
    const qs = questionsRef.current;
    if (qs && qs.length > 0) {
      becomeHost();
      return;
    }
    // joiner yang masuk mid-game belum punya soal lengkap → ambil dari DB
    const sid = setIdRef.current;
    if (sid && isSupabaseConfigured && !sid.startsWith("demo") && !sid.startsWith("local-")) {
      void (async () => {
        try {
          const sb = getSupabase();
          const { data } = await sb.from("quiz_sets").select("*").eq("id", sid).maybeSingle();
          const got = (data as QuizSetDTO | null)?.questions ?? null;
          if (got && got.length > 0) {
            questionsRef.current = got;
            becomeHost();
          } else {
            toast("error", "Soal kuis tidak bisa diambil — minta host kembali ya");
          }
        } catch {
          toast("error", "Soal kuis tidak bisa diambil — minta host kembali ya");
        }
      })();
      return;
    }
    toast("error", "Soal kuis tidak tersedia untuk diambil alih");
  };

  /** handler semua broadcast masuk. */
  const handleBroadcast = (msg: QuizBroadcast) => {
    switch (msg.type) {
      case "join_request": {
        if (!isHostRef.current || modeRef.current === "solo") return;
        const existing = playersRef.current.find((p) => p.id === msg.id);
        if (existing) {
          existing.name = msg.name || existing.name;
          existing.avatar = msg.avatar || existing.avatar;
        } else if (playersRef.current.length < 30 && phaseRef.current !== "finished") {
          playersRef.current = [
            ...playersRef.current,
            {
              id: msg.id,
              name: msg.name || "Pemain",
              avatar: msg.avatar || "🐣",
              score: 0,
              answered_current: false,
              ready: false,
            },
          ];
          playSound("join");
        }
        broadcastSync();
        syncUi();
        break;
      }
      case "ready": {
        if (!isHostRef.current || modeRef.current === "solo") return;
        playersRef.current = playersRef.current.map((p) => (p.id === msg.id ? { ...p, ready: msg.ready } : p));
        broadcastSync();
        syncUi();
        break;
      }
      case "sync": {
        if (modeRef.current !== "join") return;
        const firstJoin = !joinedRef.current;
        joinedRef.current = true;
        stopTimer(joinTimerRef.current);
        joinTimerRef.current = null;
        lastBeatRef.current = Date.now();
        hostGoneAtRef.current = null;
        setHostGoneAt(null);
        if (msg.questions && msg.questions.length > 0) questionsRef.current = msg.questions;
        if (msg.set_id) setIdRef.current = msg.set_id;
        roomStateRef.current = msg.state;
        playersRef.current = msg.players;
        questionPubRef.current = msg.question;
        revealRef.current = msg.reveal;
        pickedRef.current = null;
        picksRef.current.clear();
        if (msg.state.status === "lobby") {
          // game baru dimulai ulang
          myAnswersRef.current = [];
          heardRef.current = new Map();
          comboRef.current = 0;
        }
        // soal yang terlewat (refresh / join mid-game) dianggap tidak dijawab
        if (msg.state.status === "playing") {
          for (let i = 0; i < msg.state.current_q; i++) {
            if (!myAnswersRef.current.some((a) => a.q === i)) {
              myAnswersRef.current.push({ q: i, picked: -1, correct: false });
            }
          }
        }
        phaseRef.current = derivePhase(msg.state, msg.reveal);
        if (firstJoin) {
          playSound("join");
          toast("info", "Berhasil masuk room!");
        }
        syncUi();
        break;
      }
      case "state": {
        if (modeRef.current !== "join") return;
        if (msg.set_id) setIdRef.current = msg.set_id;
        lastBeatRef.current = Date.now();
        roomStateRef.current = msg.state;
        playersRef.current = msg.players;
        picksRef.current.clear();
        pickedRef.current = null;
        revealRef.current = null;
        questionPubRef.current = msg.question;
        if (msg.state.status === "finished") {
          if (msg.full_questions && msg.full_questions.length > 0) {
            fullQuestionsRef.current = msg.full_questions;
            questionsRef.current = msg.full_questions;
          }
          phaseRef.current = "finished";
          doFinishLocal();
        } else if (msg.state.status === "lobby") {
          // "Main Lagi" → game baru untuk joiner juga
          myAnswersRef.current = [];
          heardRef.current = new Map();
          comboRef.current = 0;
          phaseRef.current = "lobby";
        } else {
          phaseRef.current = "question";
        }
        syncUi();
        break;
      }
      case "reveal": {
        if (modeRef.current !== "join") return;
        lastBeatRef.current = Date.now();
        applyReveal(msg.correct, msg.explain, msg.players);
        break;
      }
      case "answer": {
        if (msg.id === meIdRef.current) return;
        const qIdx = currentQ();
        picksRef.current.set(msg.id, { picked: msg.picked, ms: msg.ms });
        recordHeard(qIdx, msg.id, msg.picked, msg.ms);
        // host: semua pemain sudah menjawab → reveal dini
        if (
          isMaster() &&
          modeRef.current !== "solo" &&
          phaseRef.current === "question" &&
          playersRef.current.length > 0 &&
          playersRef.current.every((p) => picksRef.current.has(p.id))
        ) {
          doReveal();
          return;
        }
        syncUi();
        break;
      }
      case "heartbeat": {
        lastBeatRef.current = Date.now();
        if (hostGoneAtRef.current !== null) {
          hostGoneAtRef.current = null;
          setHostGoneAt(null);
        }
        break;
      }
      case "host_left": {
        if (isHostRef.current) return;
        hostGoneAtRef.current = Date.now();
        setHostGoneAt(hostGoneAtRef.current);
        break;
      }
    }
  };

  // ═══════════════════════════════════════════════════
  //  BOOT — disetel sekali per mount room / retry
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (authLoading) return;
    if (!parsed) {
      phaseRef.current = "error";
      setErrorText("Tautan kuis tidak valid — cek lagi kode atau tautannya ya.");
      syncUi();
      return;
    }

    let cancelled = false;
    const mode = parsed.mode;
    modeRef.current = mode;
    phaseRef.current = "loading";
    isHostRef.current = mode === "host" || mode === "solo";
    joinedRef.current = mode !== "join";
    endedRef.current = false;
    questionsRef.current = null;
    fullQuestionsRef.current = null;
    heardRef.current = new Map();
    picksRef.current = new Map();
    playersRef.current = [];
    myAnswersRef.current = [];
    revealRef.current = null;
    pickedRef.current = null;
    questionPubRef.current = null;
    roomStateRef.current = null;
    hostGoneAtRef.current = null;
    advanceAtRef.current = null;
    comboRef.current = 0;
    lastBeatRef.current = Date.now();
    setHostGoneAt(null);
    setReviewing(false);
    setAdvanceIn(null);
    setErrorText(null);
    setBanner(null);
    meIdRef.current = getMeId(user?.id ?? null);

    const loadSet = async (): Promise<QuizSetDTO | null> => {
      const sid = parsed.setId;
      if (!sid) return null;
      if (sid.startsWith("local-")) return getLocalSet(sid);
      if (isSupabaseConfigured) {
        try {
          const sb = getSupabase();
          const { data } = await sb.from("quiz_sets").select("*").eq("id", sid).maybeSingle();
          return (data as QuizSetDTO | null) ?? null;
        } catch {
          return null;
        }
      }
      return null;
    };

    const bootHostOrSolo = async () => {
      let set = await loadSet();
      if (!set || !set.questions || set.questions.length === 0) {
        if (mode === "host") {
          phaseRef.current = "error";
          setErrorText(
            !isSupabaseConfigured
              ? "Mode bareng butuh koneksi Supabase — konfigurasi dulu lewat /setup, atau coba Solo Latihan."
              : "Kuis tidak ditemukan atau soalnya kosong — mungkin sudah dihapus."
          );
          syncUi();
          return;
        }
        set = buildDemoSet();
        setBanner("Mode demo — Supabase belum siap / kuis tidak ditemukan, ini soal contoh.");
      }
      if (cancelled) return;

      questionsRef.current = set.questions;
      setIdRef.current = set.id;
      titleRef.current = set.title;
      emojiRef.current = set.emoji || "🎲";
      setTitle(set.title);
      setEmoji(set.emoji || "🎲");
      meNameRef.current = profile?.display_name || "Tamu";
      meAvatarRef.current = profile?.avatar || "🐣";

      const mePlayer: QuizPlayerState = {
        id: meIdRef.current,
        name: meNameRef.current,
        avatar: meAvatarRef.current,
        score: 0,
        answered_current: false,
        ready: true,
      };

      if (mode === "solo") {
        roomCodeRef.current = "solo";
        setRoomCode("solo");
        playersRef.current = [mePlayer];
        startQuestion(0);
        return;
      }

      // mode host → room broadcast
      const rc = randomCode(6);
      roomCodeRef.current = rc;
      setRoomCode(rc);
      const sb = getSupabase();
      const ch = sb.channel(`quiz:${rc}`, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "msg" }, ({ payload }) => {
        handleBroadcast(payload as unknown as QuizBroadcast);
      });
      ch.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          playersRef.current = [mePlayer];
          roomStateRef.current = {
            status: "lobby",
            current_q: 0,
            q_started_at: 0,
            quiz_title: titleRef.current,
            emoji: emojiRef.current,
            total_questions: questionsRef.current?.length ?? 0,
          };
          phaseRef.current = "lobby";
          startHeartbeat();
          syncUi();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          phaseRef.current = "error";
          setErrorText("Gagal terhubung ke server realtime — coba refresh halaman.");
          syncUi();
        }
      });
      chRef.current = ch;
    };

    const bootJoin = () => {
      if (!isSupabaseConfigured) {
        phaseRef.current = "error";
        setErrorText("Join room butuh koneksi Supabase — konfigurasi dulu lewat panduan /setup.");
        syncUi();
        return;
      }
      roomCodeRef.current = parsed.roomCode;
      setRoomCode(parsed.roomCode);
      const sb = getSupabase();
      const ch = sb.channel(`quiz:${parsed.roomCode}`, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "msg" }, ({ payload }) => {
        handleBroadcast(payload as unknown as QuizBroadcast);
      });
      let tries = 0;
      ch.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          const sendJoin = () =>
            send({ type: "join_request", id: meIdRef.current, name: meNameRef.current, avatar: meAvatarRef.current });
          sendJoin();
          stopTimer(joinTimerRef.current);
          joinTimerRef.current = window.setInterval(() => {
            if (joinedRef.current) {
              stopTimer(joinTimerRef.current);
              joinTimerRef.current = null;
              return;
            }
            tries += 1;
            if (tries * 2000 >= JOIN_TIMEOUT_MS) {
              stopTimer(joinTimerRef.current);
              joinTimerRef.current = null;
              phaseRef.current = "notfound";
              syncUi();
              return;
            }
            sendJoin();
          }, 2000);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          phaseRef.current = "notfound";
          syncUi();
        }
      });
      chRef.current = ch;
    };

    void (mode === "join" ? bootJoin() : bootHostOrSolo());

    // ticker 300ms: countdown auto-advance (host) + watchdog host hilang (joiner)
    tickerTimerRef.current = window.setInterval(() => {
      if (advanceAtRef.current !== null) {
        setAdvanceIn(Math.max(0, Math.ceil((advanceAtRef.current - Date.now()) / 1000)));
      }
      if (!isHostRef.current && joinedRef.current) {
        const gone = Date.now() - lastBeatRef.current > HOST_TIMEOUT_MS;
        if (gone && hostGoneAtRef.current === null) {
          hostGoneAtRef.current = Date.now();
          setHostGoneAt(hostGoneAtRef.current);
        } else if (!gone && hostGoneAtRef.current !== null) {
          hostGoneAtRef.current = null;
          setHostGoneAt(null);
        }
      }
    }, 300);

    // ── cleanup: semua timer + channel dibersihkan ──
    return () => {
      cancelled = true;
      stopTimer(revealTimerRef.current);
      stopTimer(advanceTimerRef.current);
      stopTimer(heartbeatTimerRef.current);
      stopTimer(joinTimerRef.current);
      stopTimer(tickerTimerRef.current);
      const ch = chRef.current;
      chRef.current = null;
      if (ch) {
        if (isHostRef.current) {
          void ch
            .send({
              type: "broadcast",
              event: "msg",
              payload: { type: "host_left" } as unknown as Record<string, unknown>,
            })
            .catch(() => {})
            .finally(() => {
              void getSupabase().removeChannel(ch);
            });
        } else {
          void getSupabase().removeChannel(ch);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, authLoading, retryKey]);

  // host keluar via refresh/tutup tab → kabari klien lain (best effort)
  useEffect(() => {
    if (!isHost) return;
    const h = () => {
      const ch = chRef.current;
      if (ch) {
        void ch
          .send({ type: "broadcast", event: "msg", payload: { type: "host_left" } as unknown as Record<string, unknown> })
          .catch(() => {});
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isHost]);

  // ═══════════════════════════════════════════════════
  //  AKSI UI
  // ═══════════════════════════════════════════════════
  const pick = (idx: number) => {
    if (phaseRef.current !== "question" || pickedRef.current !== null) return;
    const st = roomStateRef.current;
    if (!st || !questionPubRef.current) return;
    const ms = clamp(Date.now() - st.q_started_at, 0, QUESTION_MS);
    pickedRef.current = idx;
    picksRef.current.set(meIdRef.current, { picked: idx, ms });
    recordHeard(st.current_q, meIdRef.current, idx, ms);
    playSound("click");

    if (modeRef.current === "solo") {
      // solo: hitung skor sendiri lalu reveal instan
      const q = questionsRef.current?.[st.current_q];
      if (!q) return;
      const correct = q.answer;
      playersRef.current = playersRef.current.map((p) =>
        p.id === meIdRef.current
          ? { ...p, score: p.score + (idx === correct ? scoreFor(ms) : 0), answered_current: true }
          : p
      );
      applyReveal(correct, q.explain);
      return;
    }

    send({ type: "answer", id: meIdRef.current, picked: idx, ms });
    // host menjawab → cek reveal dini (delay kecil agar broadcast answer tersiar dulu)
    if (isMaster() && playersRef.current.length > 0 && playersRef.current.every((p) => picksRef.current.has(p.id))) {
      window.setTimeout(() => {
        if (phaseRef.current === "question") doReveal();
      }, 350);
    }
    syncUi();
  };

  const exitToHub = () => {
    playSound("click");
    router.push("/quiz");
  };

  const toggleReady = () => {
    if (isHostRef.current || modeRef.current !== "join") return;
    const cur = playersRef.current.find((p) => p.id === meIdRef.current);
    send({ type: "ready", id: meIdRef.current, ready: !(cur?.ready ?? false) });
    playSound("click");
  };

  const restartGame = () => {
    playSound("click");
    playersRef.current = playersRef.current.map((p) => ({
      ...p,
      score: 0,
      answered_current: false,
      ready: p.id === meIdRef.current,
    }));
    myAnswersRef.current = [];
    heardRef.current = new Map();
    picksRef.current.clear();
    comboRef.current = 0;
    pickedRef.current = null;
    revealRef.current = null;
    questionPubRef.current = null;
    endedRef.current = false;
    fullQuestionsRef.current = null;
    setMyAnswers([]);
    setReviewing(false);
    if (modeRef.current === "solo") {
      startQuestion(0);
      return;
    }
    roomStateRef.current = {
      status: "lobby",
      current_q: 0,
      q_started_at: 0,
      quiz_title: titleRef.current,
      emoji: emojiRef.current,
      total_questions: questionsRef.current?.length ?? 0,
    };
    phaseRef.current = "lobby";
    if (isMaster()) broadcastSync();
    syncUi();
  };

  // countdown banner host hilang
  useEffect(() => {
    if (hostGoneAt === null) return;
    const t = window.setInterval(() => setGoneNow(Date.now()), 300);
    return () => window.clearInterval(t);
  }, [hostGoneAt]);
  const takeoverLeft =
    hostGoneAt !== null ? Math.max(0, TAKEOVER_COUNTDOWN - Math.floor((goneNow - hostGoneAt) / 1000)) : 0;

  // ── data review & statistik (dihitung saat finished/review) ──
  const total = roomState?.total_questions ?? questionsRef.current?.length ?? 0;
  const allQuestions: QuizQuestion[] | null = useMemo(() => {
    if (phase !== "finished") return null;
    if (modeRef.current === "join") return fullQuestionsRef.current;
    return questionsRef.current;
  }, [phase, reviewing]); // eslint-disable-line react-hooks/exhaustive-deps
  const reviewQuestions = reviewing ? allQuestions : null;

  const rightBy: Record<number, string[]> = useMemo(() => {
    if (!reviewQuestions) return {};
    const out: Record<number, string[]> = {};
    reviewQuestions.forEach((_, idx) => {
      out[idx] = rightNamesFor(idx, reviewQuestions, heardRef.current, playersRef.current);
    });
    return out;
  }, [reviewQuestions]);

  const stats = useMemo(() => computeStats(allQuestions ?? [], heardRef.current), [allQuestions]);

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: "var(--cream)" }}>
      <div className="cafe-bg" />
      <div className="cafe-overlay" />
      <div className="deco s1">✦</div>
      <div className="deco leaf">
        <Leaf size={22} strokeWidth={2.5} />
      </div>
      <div className="deco bean">
        <Coffee size={22} strokeWidth={2.5} />
      </div>

      {/* banner host hilang */}
      <AnimatePresence>
        {hostGoneAt !== null && !isHost && phase !== "finished" && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[4000] card !py-2.5 !px-4 flex items-center gap-3"
            style={{ borderColor: "var(--red)", boxShadow: "var(--shadow-lg)" }}
          >
            <motion.span className="inline-flex" animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
              <Skull size={20} strokeWidth={2.5} />
            </motion.span>
            <div className="text-[12px] font-semibold leading-tight">
              Host menghilang…
              <br />
              <span className="text-[var(--text-muted)]">
                {takeoverLeft > 0 ? `ambil alih dalam ${takeoverLeft}s` : "kamu bisa lanjutkan!"}
              </span>
            </div>
            {takeoverLeft <= 0 && (
              <button
                className="btn-primary !text-[12px] !py-1.5 inline-flex items-center gap-1.5"
                onClick={takeover}
              >
                <Ambulance size={13} strokeWidth={2.5} />
                Lanjutkan sebagai Host
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* banner mode demo */}
      <AnimatePresence>
        {banner && phase !== "loading" && phase !== "error" && phase !== "notfound" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-3 left-3 z-[4000] chip !text-[11px] max-w-[240px] !whitespace-normal leading-snug"
          >
            {banner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ LOADING ══ */}
      {(phase === "loading" || authLoading) && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card text-center py-12 w-full max-w-[420px]">
            <motion.div
              className="flex justify-center text-[var(--accent-deep)]"
              animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            >
              <Tent size={46} strokeWidth={2.5} />
            </motion.div>
            <p className="font-head font-bold mt-2">Menyiapkan panggung…</p>
            <div className="skeleton h-[10px] w-[180px] mx-auto mt-3" />
          </div>
        </div>
      )}

      {/* ══ ERROR ══ */}
      {phase === "error" && !authLoading && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card text-center py-10 w-full max-w-[440px] animate-popIn">
            <div className="flex justify-center text-[var(--text-muted)]">
              <Wrench size={44} strokeWidth={2.5} />
            </div>
            <p className="font-head font-bold text-[15.5px] mt-2 px-4 leading-snug">{errorText}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              <button
                className="btn-secondary inline-flex items-center gap-1.5"
                onClick={exitToHub}
              >
                <ArrowLeft size={15} strokeWidth={2.5} />
                Kembali ke Kafe
              </button>
              {(parsed?.mode === "host" || parsed?.mode === "solo") && (
                <Link
                  className="btn-yellow inline-flex items-center gap-1.5"
                  href="/quiz/play/solo-demo"
                  onClick={() => playSound("click")}
                >
                  <Donut size={15} strokeWidth={2.5} />
                  Coba Solo Demo
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ ROOM TIDAK DITEMUKAN ══ */}
      {phase === "notfound" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card text-center py-10 w-full max-w-[440px] animate-popIn">
            <motion.div
              className="flex justify-center text-[var(--text-muted)]"
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
            >
              <SearchX size={44} strokeWidth={2.5} />
            </motion.div>
            <p className="font-head font-bold text-[17px] mt-2">Room tidak ditemukan</p>
            <p className="text-[12.5px] font-semibold text-[var(--text-muted)] mt-1 px-4">
              Pastikan kode <b>{roomCode}</b> benar & host masih membuka room-nya ya.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={() => {
                  playSound("click");
                  setRetryKey((k) => k + 1);
                }}
              >
                <RotateCcw size={15} strokeWidth={2.5} />
                Coba Lagi
              </button>
              <button
                className="btn-secondary inline-flex items-center gap-1.5"
                onClick={exitToHub}
              >
                <ArrowLeft size={15} strokeWidth={2.5} />
                Kembali ke Kafe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOBBY ══ */}
      {phase === "lobby" && !authLoading && (
        <QuizLobby
          code={roomCode}
          title={title}
          emoji={emoji}
          totalQuestions={roomState?.total_questions ?? 0}
          players={players}
          meId={meIdRef.current}
          isHost={isHost}
          onStart={() => {
            playSound("click");
            startQuestion(0);
          }}
          onToggleReady={toggleReady}
          onExit={exitToHub}
        />
      )}

      {/* ══ QUESTION / REVEAL ══ */}
      {(phase === "question" || phase === "reveal") && questionPub && roomState && (
        <QuizStage
          title={title}
          emoji={emoji}
          qIndex={roomState.current_q}
          total={roomState.total_questions}
          question={questionPub}
          qStartedAt={roomState.q_started_at}
          picked={picked}
          reveal={reveal}
          answeredCount={answeredCount}
          players={players}
          meId={meIdRef.current}
          isHost={isHost}
          advanceIn={advanceIn}
          combo={combo}
          onPick={pick}
          onNext={() => {
            playSound("click");
            advance();
          }}
          onExit={exitToHub}
        />
      )}

      {/* ══ FINISHED — podium / review ══ */}
      {phase === "finished" && !authLoading && (
        reviewing && reviewQuestions && reviewQuestions.length > 0 ? (
          <QuizReview
            questions={reviewQuestions}
            myAnswers={myAnswers}
            rightBy={rightBy}
            onExit={() => {
              playSound("click");
              setReviewing(false);
            }}
          />
        ) : (
          <QuizPodium
            title={title}
            emoji={emoji}
            players={players}
            totalQuestions={total}
            meId={meIdRef.current}
            canRestart={isHost || modeRef.current === "solo"}
            stats={stats}
            onRestart={restartGame}
            onReview={() => {
              const qs = modeRef.current === "join" ? fullQuestionsRef.current : questionsRef.current;
              if (!qs || qs.length === 0) {
                toast("info", "Review belum tersedia — soal belum tersinkron penuh");
                return;
              }
              playSound("click");
              setReviewing(true);
            }}
            onHome={exitToHub}
          />
        )
      )}
    </div>
  );
}
