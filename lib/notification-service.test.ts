import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  return {
    db: {
      notificationPreference: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/realtime", () => ({
  publishNotification: vi.fn(),
}));

import { db } from "@/lib/db";
import {
  createNotification,
  getUnreadCount,
  getOrCreatePreferences,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updatePreferences,
  notifyFollow,
  notifyClipCreated,
} from "@/lib/notification-service";

const mockPrefFindUnique = db.notificationPreference.findUnique as ReturnType<typeof vi.fn>;
const mockPrefCreate = db.notificationPreference.create as ReturnType<typeof vi.fn>;
const mockPrefUpdate = db.notificationPreference.update as ReturnType<typeof vi.fn>;
const mockNotifCreate = db.notification.create as ReturnType<typeof vi.fn>;
const mockNotifFindMany = db.notification.findMany as ReturnType<typeof vi.fn>;
const mockNotifUpdateMany = db.notification.updateMany as ReturnType<typeof vi.fn>;
const mockNotifCount = db.notification.count as ReturnType<typeof vi.fn>;

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when actor is self", async () => {
    const result = await createNotification({
      recipientId: "u1",
      actorId: "u1",
      type: "FOLLOW",
      title: "Test",
      body: "Test",
    });
    expect(result).toBeNull();
    expect(mockNotifCreate).not.toHaveBeenCalled();
  });

  it("should return null when preference is OFF", async () => {
    mockPrefFindUnique.mockResolvedValue({
      onFollow: false,
      onLive: true,
      onClip: true,
      onModeration: true,
      onSystem: true,
    });

    const result = await createNotification({
      recipientId: "u2",
      actorId: "u1",
      type: "FOLLOW",
      title: "Test",
      body: "Test",
    });
    expect(result).toBeNull();
    expect(mockNotifCreate).not.toHaveBeenCalled();
  });

  it("should create when preference is ON (or default)", async () => {
    mockPrefFindUnique.mockResolvedValue({
      onFollow: true,
      onLive: true,
      onClip: true,
      onModeration: true,
      onSystem: true,
    });
    mockNotifCreate.mockResolvedValue({ id: "n1" });

    const result = await createNotification({
      recipientId: "u2",
      actorId: "u1",
      type: "FOLLOW",
      title: "Test",
      body: "Test",
    });
    expect(result?.id).toBe("n1");
  });

  it("should default ON if no preference row", async () => {
    mockPrefFindUnique.mockResolvedValue(null);
    mockNotifCreate.mockResolvedValue({ id: "n1" });

    const result = await createNotification({
      recipientId: "u2",
      actorId: "u1",
      type: "LIVE",
      title: "Test",
      body: "Test",
    });
    expect(result?.id).toBe("n1");
  });
});

describe("getUnreadCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return count", async () => {
    mockNotifCount.mockResolvedValue(5);
    expect(await getUnreadCount("u1")).toBe(5);
    expect(mockNotifCount).toHaveBeenCalledWith({
      where: { recipientId: "u1", status: "UNREAD" },
    });
  });
});

describe("listMyNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should query by recipientId", async () => {
    mockNotifFindMany.mockResolvedValue([]);
    await listMyNotifications("u1");
    expect(mockNotifFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientId: "u1" }),
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("should support onlyUnread filter", async () => {
    mockNotifFindMany.mockResolvedValue([]);
    await listMyNotifications("u1", { onlyUnread: true });
    expect(mockNotifFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "UNREAD" }),
      })
    );
  });
});

describe("markNotificationRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should updateMany with id + recipient + UNREAD filter", async () => {
    mockNotifUpdateMany.mockResolvedValue({ count: 1 });
    await markNotificationRead({ notificationId: "n1", userId: "u1" });
    expect(mockNotifUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "n1",
          recipientId: "u1",
          status: "UNREAD",
        },
      })
    );
  });
});

describe("markAllNotificationsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should updateMany and return count", async () => {
    mockNotifUpdateMany.mockResolvedValue({ count: 7 });
    const count = await markAllNotificationsRead("u1");
    expect(count).toBe(7);
  });
});

describe("getOrCreatePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return existing preference", async () => {
    const existing = {
      id: "p1",
      userId: "u1",
      onFollow: true,
    };
    mockPrefFindUnique.mockResolvedValue(existing);
    const result = await getOrCreatePreferences("u1");
    expect(result).toBe(existing);
    expect(mockPrefCreate).not.toHaveBeenCalled();
  });

  it("should create if not exists", async () => {
    mockPrefFindUnique.mockResolvedValue(null);
    const created = { id: "p2", userId: "u1" };
    mockPrefCreate.mockResolvedValue(created);
    const result = await getOrCreatePreferences("u1");
    expect(result).toBe(created);
    expect(mockPrefCreate).toHaveBeenCalled();
  });
});

describe("updatePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should ensure row exists then update", async () => {
    mockPrefFindUnique.mockResolvedValue(null);
    mockPrefCreate.mockResolvedValue({ id: "p1" });
    mockPrefUpdate.mockResolvedValue({
      onFollow: false,
      onLive: true,
    });

    const result = await updatePreferences("u1", { onFollow: false });
    expect(mockPrefUpdate).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { onFollow: false },
    });
  });
});

describe("notifyFollow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call createNotification with correct args", async () => {
    mockPrefFindUnique.mockResolvedValue(null); // default ON
    mockNotifCreate.mockResolvedValue({ id: "n1" });

    await notifyFollow({
      followerId: "u1",
      followedId: "u2",
      followerUsername: "alice",
    });
    expect(mockNotifCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientId: "u2",
          actorId: "u1",
          type: "FOLLOW",
          linkUrl: "/alice",
        }),
      })
    );
  });
});

describe("notifyClipCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send CLIP notification to streamer", async () => {
    mockPrefFindUnique.mockResolvedValue(null);
    mockNotifCreate.mockResolvedValue({ id: "n1" });

    await notifyClipCreated({
      streamerId: "u1",
      creatorUsername: "bob",
      clipId: "c1",
      clipTitle: "Best moment",
    });
    expect(mockNotifCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientId: "u1",
          type: "CLIP",
          linkUrl: "/clips/c1",
        }),
      })
    );
  });
});
