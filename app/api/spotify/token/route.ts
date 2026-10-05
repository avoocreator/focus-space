// Route handler: tukar code OAuth Spotify (PKCE) jadi token.
// Client secret TIDAK dipakai — alur public client PKCE.

import { NextResponse } from "next/server";

interface TokenRequestBody {
  code?: unknown;
  verifier?: unknown;
  redirect_uri?: unknown;
}

export async function POST(req: Request): Promise<NextResponse> {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SPOTIFY_CLIENT_ID belum diset — lihat /setup" },
      { status: 400 }
    );
  }

  let body: TokenRequestBody;
  try {
    body = (await req.json()) as TokenRequestBody;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const { code, verifier, redirect_uri } = body;
  if (typeof code !== "string" || typeof verifier !== "string" || typeof redirect_uri !== "string") {
    return NextResponse.json(
      { error: "code, verifier, dan redirect_uri (string) wajib dikirim" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri,
        code_verifier: verifier,
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
