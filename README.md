# Manthan

Manthan is a collaborative learning hub where students explore ideas, ask questions, publish blogs, share real-time "moments", take quizzes, and build community.

## Tech Stack
- Next.js (App Router, TypeScript)
- Firebase (Auth, Firestore)
- ImageKit (media uploads)
- Tailwind CSS + Radix UI

## Key Features
- Moments feed with image uploads, likes, favorites, and comments with @mentions
- Blogging & questions with tagging
- User profiles with favorite moments
- Real-time notifications (mentions)
- PWA manifest + mobile-safe viewport adjustments

## Getting Started
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` (if present) or create `.env.local` and add required keys (Firebase, ImageKit, optional Cloudinary if still used elsewhere).
3. Run the dev server: `npm run dev`
4. Open http://localhost:3000

## Environment Variables
Place in `.env.local`:

Firebase (example):
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

ImageKit:
```
IMAGEKIT_PRIVATE_KEY=...
IMAGEKIT_PUBLIC_KEY=...
IMAGEKIT_URL_ENDPOINT=...
```

Optional (legacy Cloudinary for certain uploads if still enabled):
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

WebRTC voice calling (for international reliability):
```
# STUN (optional; falls back to public STUN if omitted)
NEXT_PUBLIC_STUN_URLS=stun:stun.l.google.com:19302,stun:global.stun.twilio.com:3478

# TURN (recommended for strict NAT/firewalls)
NEXT_PUBLIC_TURN_URLS=turn:turn.yourdomain.com:3478?transport=udp,turn:turn.yourdomain.com:3478?transport=tcp,turns:turn.yourdomain.com:5349?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=your_turn_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_turn_password
```

See `docs/webrtc.md` for details and best practices.

## Scripts
- `npm run dev` – start local development
- `npm run build` – production build
- `npm run start` – start production server
- `npm run typecheck` – run TypeScript

## Branding
All prior references to "CollabCampus" have been renamed to "Manthan".

## License
Private / Internal (add a license if you intend to distribute).
