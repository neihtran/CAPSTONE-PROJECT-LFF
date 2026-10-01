import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";

import { getStreamByUserId } from "@/lib/stream-service";

// Mock module db — ta không kết nối DB thật.
vi.mock("@/lib/db", () => ({
  get db() {
    return prismaMock;
  },
}));

let prismaMock: DeepMockProxy<PrismaClient>;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ANOTHER_USER_ID = "22222222-2222-2222-2222-222222222222";
const STREAM_ID = "stream-uuid-1";

beforeEach(() => {
  prismaMock = mockDeep<PrismaClient>();
  mockReset(prismaMock);
});

describe("getStreamByUserId", () => {
  it("should return null when user has no stream", async () => {
    prismaMock.stream.findUnique.mockResolvedValue(null);

    const result = await getStreamByUserId(USER_ID);

    expect(result).toBeNull();
    expect(prismaMock.stream.findUnique).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("should return stream when it exists for the user", async () => {
    const mockStream = {
      id: STREAM_ID,
      name: "Test Stream",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      ingressId: "ingress-1",
      serverUrl: "rtmps://ingress.example.com/live",
      streamKey: "secret-key",
      isLive: true,
      isChatEnabled: true,
      isChatDelayed: false,
      isChatFollowersOnly: false,
      userId: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.stream.findUnique.mockResolvedValue(mockStream as any);

    const result = await getStreamByUserId(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(STREAM_ID);
    expect(result?.name).toBe("Test Stream");
    expect(result?.isLive).toBe(true);
  });

  it("should be a 1:1 relation — same userId returns same stream", async () => {
    // Kiểm tra tính unique của userId trên model Stream (1 user chỉ có 1 stream).
    prismaMock.stream.findUnique.mockResolvedValue({
      id: STREAM_ID,
      userId: USER_ID,
      name: "Owned",
      isLive: false,
    } as any);

    const first = await getStreamByUserId(USER_ID);
    const second = await getStreamByUserId(USER_ID);

    expect(first?.id).toBe(second?.id);
    expect(first?.userId).toBe(USER_ID);
  });

  it("should query by the correct userId (không lẫn user khác)", async () => {
    // Mock trả về stream khác tùy theo userId được truyền vào
    prismaMock.stream.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.userId === USER_ID) {
        return {
          id: "stream-1",
          userId: USER_ID,
          name: "Stream của A",
        } as any;
      }
      if (where.userId === ANOTHER_USER_ID) {
        return {
          id: "stream-2",
          userId: ANOTHER_USER_ID,
          name: "Stream của B",
        } as any;
      }
      return null;
    });

    const streamA = await getStreamByUserId(USER_ID);
    const streamB = await getStreamByUserId(ANOTHER_USER_ID);

    expect(streamA?.name).toBe("Stream của A");
    expect(streamB?.name).toBe("Stream của B");
    expect(streamA?.id).not.toBe(streamB?.id);

    // Verify findUnique được gọi với đúng userId tương ứng
    expect(prismaMock.stream.findUnique).toHaveBeenNthCalledWith(1, {
      where: { userId: USER_ID },
    });
    expect(prismaMock.stream.findUnique).toHaveBeenNthCalledWith(2, {
      where: { userId: ANOTHER_USER_ID },
    });
  });
});
