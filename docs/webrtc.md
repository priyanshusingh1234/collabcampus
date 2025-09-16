# WebRTC Calling Configuration

To improve international reliability for voice calls, configure STUN/TURN servers via environment variables.

Recommended env vars (public, used by client):

- NEXT_PUBLIC_STUN_URLS: Comma-separated or JSON array of STUN URLs.
  - Example: `stun:stun.l.google.com:19302,stun:global.stun.twilio.com:3478`
- NEXT_PUBLIC_TURN_URLS: Comma-separated or JSON array of TURN URLs (udp,tcp,tls variants recommended).
  - Example: `turn:turn.yourdomain.com:3478?transport=udp,turn:turn.yourdomain.com:3478?transport=tcp,turns:turn.yourdomain.com:5349?transport=tcp`
- NEXT_PUBLIC_TURN_USERNAME: TURN username (from your provider/coturn realm)
- NEXT_PUBLIC_TURN_CREDENTIAL: TURN password/credential

If these are not set, the app falls back to public STUN only. On strict NAT/firewalled networks, add a TURN service to ensure connectivity.

Notes:
- Use HTTPS in production (required for getUserMedia).
- Provide multiple geographically distributed TURN servers for best latency.
- For coturn, enable `fingerprint`, `realm`, `use-auth-secret` or long-term creds, and open required ports (UDP 3478, TCP fallbacks, TLS 5349).
