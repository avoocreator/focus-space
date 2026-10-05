// ═══════════════════════════════════════════════════════════
//  RTC_CONFIG — konfigurasi ICE untuk voice channel (WebRTC).
//  STUN Google + TURN gratis Open Relay (fallback NAT ketat,
//  termasuk TCP di port 443 untuk jaringan yang memblokir UDP).
//  Dipakai oleh use-voice-channel.ts saat membuat RTCPeerConnection.
// ═══════════════════════════════════════════════════════════

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};
