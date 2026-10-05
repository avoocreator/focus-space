// Route handler: refresh access token Spotify (grant_type=refresh_token).
// Kalau Spotify tidak mengembalikan refresh_token baru, klien mempertahankan yang lama.

import { NextResponse } from "next/server";

interface RefreshRequestBody {
  refresh_token?: unknown;
}

export async function POST(req: Request): Promise<NextResponse> {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SPOTIFY_CLIENT_ID belum diset — lihat /setup" },
      { status: 400 }
    );
  }

  let body: RefreshRequestBody;
  try {
    body = (await req.json()) as RefreshRequestBody;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const { refresh_token } = body;
  if (typeof refresh_token !== "string" || !refresh_token) {
    return NextResponse.json({ error: "refresh_token (string) wajib dikirim" }, { status: 400 });
  }

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token,
      }).toString(),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Gagal menghubungi server Spotify — cek koneksi internet 📡" },
      { status: 502 }
    );
  }
}
