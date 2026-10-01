/**
 * LiveKit helpers — encapsulate Room API calls.
 *
 * Lazy-load RoomServiceClient để tránh crash nếu SDK chưa sẵn sàng
 * (vd: dev không có credentials).
 */

type RoomServiceClientInstance = {
  removeParticipant: (
    room: string,
    identity: string
  ) => Promise<unknown>;
  updateRoomMetadata: (room: string, metadata: string) => Promise<unknown>;
};

let cachedClient: RoomServiceClientInstance | null = null;

async function getClient(): Promise<RoomServiceClientInstance | null> {
  const apiUrl = process.env.LIVEKIT_API_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiUrl || !apiKey || !apiSecret) {
    return null;
  }

  if (cachedClient) return cachedClient;

  try {
    const mod = await import("livekit-server-sdk");
    const Client = mod.RoomServiceClient;
    cachedClient = new Client(apiUrl, apiKey, apiSecret);
    return cachedClient;
  } catch (err) {
    console.warn(
      "[livekit] Failed to load livekit-server-sdk:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Disconnect 1 participant khỏi room.
 *
 * Fail-open: trả về false nếu không connect được (vd: chưa có credentials
 * hoặc room không tồn tại).
 */
export const livekit = {
  async removeParticipant(
    room: string,
    identity: string
  ): Promise<boolean> {
    const client = await getClient();
    if (!client) return false;
    try {
      await client.removeParticipant(room, identity);
      return true;
    } catch (err) {
      console.warn(
        "[livekit] removeParticipant failed:",
        err instanceof Error ? err.message : err
      );
      return false;
    }
  },

  async updateRoomMetadata(
    room: string,
    metadata: string
  ): Promise<boolean> {
    const client = await getClient();
    if (!client) return false;
    try {
      await client.updateRoomMetadata(room, metadata);
      return true;
    } catch (err) {
      console.warn(
        "[livekit] updateRoomMetadata failed:",
        err instanceof Error ? err.message : err
      );
      return false;
    }
  },
};
