// Helper to build ICE servers list from env for WebRTC
// Supports both comma-separated and JSON array formats.

export type IceServer = RTCIceServer;

function parseUrls(input?: string | null): string[] {
  if (!input) return [];
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    if (trimmed.startsWith("[")) {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    // fall through to CSV parse
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

export function getIceServers(): IceServer[] {
  const stunUrls = parseUrls(process.env.NEXT_PUBLIC_STUN_URLS);
  const turnUrls = parseUrls(process.env.NEXT_PUBLIC_TURN_URLS);
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();

  const servers: IceServer[] = [];

  if (stunUrls.length) {
    servers.push({ urls: stunUrls });
  }

  if (turnUrls.length && turnUsername && turnCredential) {
    // You can pass multiple TURN urls in a single server entry
    servers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
  }

  // Sensible defaults if nothing configured
  if (servers.length === 0) {
    servers.push({ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] });
  }

  return servers;
}
