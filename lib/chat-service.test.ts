import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";

import { loadChatHistory, saveChatMessage } from "@/lib/chat-service";

// Mock module db — không kết nối DB thật.
vi.mock("@/lib/db", () => ({
  get db() {
    return prismaMock;
  },
}));

let prismaMock: DeepMockProxy<PrismaClient>;

const STREAM_ID = "stream-1111-1111-1111-111111111111";
const USER_ID = "user-2222-2222-2222-222222222222";
const OTHER_USER_ID = "user-3333-3333-3333-333333333333";

beforeEach(() => {
  prismaMock = mockDeep<PrismaClient>();
  mockReset(prismaMock);
});

describe("saveChatMessage", () => {
  it("should persist message with correct fields", async () => {
    prismaMock.chatMessage.create.mockResolvedValue({
      id: "msg-1",
      streamId: STREAM_ID,
      userId: USER_ID,
      text: "Hello world",
      sentAt: new Date(),
    } as any);

    await saveChatMessage(STREAM_ID, USER_ID, "Hello world");

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: {
        streamId: STREAM_ID,
        userId: USER_ID,
        text: "Hello world",
      },
    });
  });

  it("should persist message with whitespace (không trim)", async () => {
    // Trim là việc của caller (route handler), service chỉ lưu raw.
    prismaMock.chatMessage.create.mockResolvedValue({} as any);

    await saveChatMessage(STREAM_ID, USER_ID, "  spaced  ");

    expect(prismaMock.chatMessage.create).toHaveBeenCalledWith({
      data: {
        streamId: STREAM_ID,
        userId: USER_ID,
        text: "  spaced  ",
      },
    });
  });

  it("should handle multiple sequential saves", async () => {
    prismaMock.chatMessage.create.mockResolvedValue({} as any);

    await saveChatMessage(STREAM_ID, USER_ID, "msg 1");
    await saveChatMessage(STREAM_ID, USER_ID, "msg 2");
    await saveChatMessage(STREAM_ID, OTHER_USER_ID, "msg 3");

    expect(prismaMock.chatMessage.create).toHaveBeenCalledTimes(3);
  });
});

describe("loadChatHistory", () => {
  it("should query with ASC order (oldest first) — khớp với UI render", async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([]);

    await loadChatHistory(STREAM_ID);

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { streamId: STREAM_ID },
        orderBy: { sentAt: "asc" },
      })
    );
  });

  it("should respect limit parameter", async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([]);

    await loadChatHistory(STREAM_ID, 100);

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it("should default to 50 messages", async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([]);

    await loadChatHistory(STREAM_ID);

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it("should map DB rows to HistoryItem format", async () => {
    const sentAt = new Date("2024-01-01T12:34:56Z");
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        text: "first",
        sentAt,
        user: { id: USER_ID, username: "alice" },
      },
      {
        id: "msg-2",
        text: "second",
        sentAt: new Date("2024-01-01T12:35:00Z"),
        user: { id: OTHER_USER_ID, username: "bob" },
      },
    ] as any);

    const history = await loadChatHistory(STREAM_ID);

    expect(history).toEqual([
      {
        id: "msg-1",
        message: "first",
        timestamp: sentAt.getTime(),
        from: { identity: USER_ID, name: "alice" },
      },
      {
        id: "msg-2",
        message: "second",
        timestamp: new Date("2024-01-01T12:35:00Z").getTime(),
        from: { identity: OTHER_USER_ID, name: "bob" },
      },
    ]);
  });

  it("should include user fields (id, username)", async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([]);

    await loadChatHistory(STREAM_ID);

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      })
    );
  });

  it("should return empty array when no messages exist", async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([]);

    const history = await loadChatHistory(STREAM_ID);

    expect(history).toEqual([]);
  });

  it("should preserve order from DB query result", async () => {
    // Nếu service nhận ASC từ DB, output PHẢI giữ ASC.
    // Đảm bảo service không tự sort lại.
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { id: "1", text: "a", sentAt: new Date(1000), user: { id: "u1", username: "u1" } },
      { id: "2", text: "b", sentAt: new Date(2000), user: { id: "u2", username: "u2" } },
      { id: "3", text: "c", sentAt: new Date(3000), user: { id: "u3", username: "u3" } },
    ] as any);

    const history = await loadChatHistory(STREAM_ID);

    expect(history.map((m) => m.message)).toEqual(["a", "b", "c"]);
  });
});
