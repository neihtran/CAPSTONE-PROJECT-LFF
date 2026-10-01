import { NextResponse } from "next/server";
import webpush from "web-push";

/**
 * GET /api/push/vapid-key
 *
 * Returns the public VAPID key cho client to subscribe.
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@twitch-clone.local";

  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "VAPID keys not configured. Run web-push generate-vapid-keys and add to .env" },
      { status: 503 }
    );
  }

  // Set VAPID for server-side.
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error("[vapid-key] config error:", err);
  }

  return NextResponse.json({
    publicKey,
    enabled: true,
  });
}
