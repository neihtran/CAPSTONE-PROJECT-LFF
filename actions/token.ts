"use server";

import { v4 } from "uuid";
import { AccessToken } from "livekit-server-sdk";

import { getSelf } from "@/lib/auth-service";
import { getUserById } from "@/lib/user-service";
import { isBlockedByUser } from "@/lib/block-service";
import { CreateViewerTokenSchema } from "./token.schema";

/**
 * Action: tạo LiveKit JWT cho viewer tham gia room của host.
 *
 * Flow:
 * - Nếu user đã đăng nhập (qua Clerk) → dùng thông tin user.
 * - Nếu là guest → sinh username ngẫu nhiên.
 * - Nếu host chặn viewer → từ chối.
 *
 * @param hostIdentity - UUID của streamer mà viewer muốn tham gia.
 * @returns JWT string hợp lệ để LiveKit React component kết nối.
 */
export const createViewerToken = async (hostIdentity: string) => {
  // 1) Validate input — chặn query DB / tạo token nếu input sai.
  const parsed = CreateViewerTokenSchema.safeParse({ hostIdentity });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "ID streamer không hợp lệ"
    );
  }

  let self;

  try {
    self = await getSelf();
  } catch (error) {
    const id = v4();
    const username = `guest#${Math.floor(Math.random() * 1000)}`;
    self = { id, username };
  }

  const host = await getUserById(parsed.data.hostIdentity);

  if (!host) {
    throw new Error("User not found");
  }

  const isBlocked = await isBlockedByUser(host.id);

  if (isBlocked) {
    throw new Error("User is blocked");
  }

  const isHost = self.id === host.id;

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: isHost ? `host-${self.id}` : self.id,
      name: self.username,
    }
  );

  token.addGrant({
    room: host.id,
    roomJoin: true,
    canPublish: false,
    canPublishData: true,
  });

  return await Promise.resolve(token.toJwt());
};
