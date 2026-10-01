import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { resetIngresses } from "@/actions/ingress";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  const eventType = evt.type;

  // ============================================================
  // IDEMPOTENCY CHECK
  // Clerk có thể gửi lại webhook (retry) khi response trước đó không 2xx.
  // Để tránh tạo trùng User hoặc update/delete không tồn tại,
  // ta luôn kiểm tra sự tồn tại của User trước khi thực hiện thao tác.
  // ============================================================

  if (eventType === "user.created") {
    // Idempotency: bỏ qua nếu user đã tồn tại (do Clerk retry hoặc webhook trùng).
    // Trả 200 để Clerk ngừng retry — KHÔNG throw error để tránh retry vô tận.
    const existingUser = await db.user.findUnique({
      where: {
        externalUserId: payload.data.id,
      },
    });

    if (existingUser) {
      console.log(
        `[clerk-webhook] user.created skipped — user already exists with externalUserId=${payload.data.id}`
      );
      return new Response("User already exists, skipped", { status: 200 });
    }

    await db.user.create({
      data: {
        externalUserId: payload.data.id,
        username: payload.data.username,
        imageUrl: payload.data.image_url,
        stream: {
          create: {
            name: `${payload.data.username}'s stream`,
          },
        },
      },
    });
  }

  if (eventType === "user.updated") {
    // Idempotency: nếu user chưa tồn tại thì không update (tránh lỗi Prisma P2025).
    // Trả 200 để Clerk không retry — chờ user.created xử lý trước.
    const existingUser = await db.user.findUnique({
      where: {
        externalUserId: payload.data.id,
      },
    });

    if (!existingUser) {
      console.warn(
        `[clerk-webhook] user.updated skipped — user not found with externalUserId=${payload.data.id}`
      );
      return new Response("User not found, skipped", { status: 200 });
    }

    await db.user.update({
      where: {
        externalUserId: payload.data.id,
      },
      data: {
        username: payload.data.username,
        imageUrl: payload.data.image_url,
      },
    });
  }

  if (eventType === "user.deleted") {
    // Idempotency: nếu user đã bị xóa từ lần retry trước thì bỏ qua.
    // resetIngresses cũng idempotent (nếu không có ingress/room thì listIngress/listRooms trả rỗng).
    const existingUser = await db.user.findUnique({
      where: {
        externalUserId: payload.data.id,
      },
    });

    if (!existingUser) {
      console.log(
        `[clerk-webhook] user.deleted skipped — user not found with externalUserId=${payload.data.id}`
      );
      return new Response("User not found, skipped", { status: 200 });
    }

    await resetIngresses(payload.data.id);

    await db.user.delete({
      where: {
        externalUserId: payload.data.id,
      },
    });
  }

  return new Response("", { status: 200 });
}
