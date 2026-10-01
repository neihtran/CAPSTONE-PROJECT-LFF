"use server";

import {
  IngressAudioEncodingPreset,
  IngressInput,
  IngressClient,
  IngressVideoEncodingPreset,
  RoomServiceClient,
  type CreateIngressOptions,
} from "livekit-server-sdk";
import { TrackSource } from "livekit-server-sdk/dist/proto/livekit_models";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import {
  CreateIngressSchema,
  ResetIngressesSchema,
} from "./ingress.schema";
import { enforceRateLimit } from "@/lib/ratelimit";

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_API_URL!,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

const ingressClient = new IngressClient(process.env.LIVEKIT_API_URL!);

/**
 * Action: reset tất cả ingress và room của một host.
 * Được gọi trước khi tạo ingress mới.
 * @param hostId - UUID của streamer.
 */
export const resetIngresses = async (hostId: string) => {
  // 1) Validate input — chặn gọi API LiveKit nếu input sai.
  const parsed = ResetIngressesSchema.safeParse({ hostId });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ID streamer không hợp lệ");
  }

  // 2) Strict rate limit — chống gọi reset ingress liên tục (tốn LiveKit quota).
  await enforceRateLimit(`ingress-reset:${parsed.data.hostId}`, {
    isStrict: true,
  });

  const ingresses = await ingressClient.listIngress({
    roomName: parsed.data.hostId,
  });

  const rooms = await roomService.listRooms([parsed.data.hostId]);

  for (const room of rooms) {
    await roomService.deleteRoom(room.name);
  }

  for (const ingress of ingresses) {
    if (ingress.ingressId) {
      await ingressClient.deleteIngress(ingress.ingressId);
    }
  }
};

/**
 * Action: tạo ingress mới cho host hiện tại.
 * LiveKit sẽ trả về URL + stream key để cấu hình OBS.
 * @param ingressType - Giá trị IngressInput enum (RTMP_INPUT hoặc WHIP_INPUT).
 */
export const createIngress = async (ingressType: IngressInput) => {
  // 1) Validate input ngay đầu function — KHÔNG dùng parseInt trực tiếp.
  // ingressType là enum number từ LiveKit SDK, Zod sẽ kiểm tra giá trị hợp lệ.
  const parsed = CreateIngressSchema.safeParse({ ingressType });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Loại kết nối không hợp lệ"
    );
  }

  const self = await getSelf();

  // Strict rate limit cho createIngress — chống spam tạo connection mới.
  await enforceRateLimit(`ingress-create:${self.id}`, { isStrict: true });

  await resetIngresses(self.id);

  const options: CreateIngressOptions = {
    name: self.username,
    roomName: self.id,
    participantName: self.username,
    participantIdentity: self.id,
  };

  if (parsed.data.ingressType === IngressInput.WHIP_INPUT) {
    options.bypassTranscoding = true;
  } else {
    options.video = {
      source: TrackSource.CAMERA,
      preset: IngressVideoEncodingPreset.H264_1080P_30FPS_3_LAYERS,
    };
    options.audio = {
      source: TrackSource.MICROPHONE,
      preset: IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
    };
  }

  const ingress = await ingressClient.createIngress(
    parsed.data.ingressType,
    options
  );

  if (!ingress || !ingress.url || !ingress.streamKey) {
    throw new Error("Failed to create ingress");
  }

  await db.stream.update({
    where: {
      userId: self.id,
    },
    data: {
      ingressId: ingress.ingressId,
      serverUrl: ingress.url,
      streamKey: ingress.streamKey,
    },
  });

  revalidatePath(`/u/${self.username}/keys`);
  return ingress;
};
