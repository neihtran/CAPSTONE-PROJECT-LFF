import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  return {
    db: {
      stream: { findUnique: vi.fn() },
      clip: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

import { db } from "@/lib/db";
import {
  createClip,
  deleteClip,
  toggleClipFeatured,
  listClipsByStream,
  listClipsByCreator,
} from "@/lib/clip-service";

const mockStreamFindUnique = db.stream.findUnique as ReturnType<typeof vi.fn>;
const mockClipCreate = db.clip.create as ReturnType<typeof vi.fn>;
const mockClipFindUnique = db.clip.findUnique as ReturnType<typeof vi.fn>;
const mockClipFindMany = db.clip.findMany as ReturnType<typeof vi.fn>;
const mockClipUpdate = db.clip.update as ReturnType<typeof vi.fn>;
const mockClipDelete = db.clip.delete as ReturnType<typeof vi.fn>;

describe("createClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when videoUrl is empty", async () => {
    await expect(
      createClip({
        streamId: "s1",
        creatorId: "u1",
        title: "Test",
        videoUrl: "",
      })
    ).rejects.toThrow("videoUrl không được rỗng");
  });

  it("should throw when title too long", async () => {
    await expect(
      createClip({
        streamId: "s1",
        creatorId: "u1",
        title: "x".repeat(201),
        videoUrl: "https://example.com/clip.m3u8",
      })
    ).rejects.toThrow("title phải từ 1-200 ký tự");
  });

  it("should throw when startTime >= endTime", async () => {
    await expect(
      createClip({
        streamId: "s1",
        creatorId: "u1",
        title: "Test",
        videoUrl: "https://example.com/clip.m3u8",
        startTime: 60,
        endTime: 60,
      })
    ).rejects.toThrow("startTime phải nhỏ hơn endTime");
  });

  it("should throw when clip longer than 5 minutes", async () => {
    await expect(
      createClip({
        streamId: "s1",
        creatorId: "u1",
        title: "Test",
        videoUrl: "https://example.com/clip.m3u8",
        startTime: 0,
        endTime: 301,
      })
    ).rejects.toThrow("Clip tối đa 5 phút");
  });

  it("should throw when stream not found", async () => {
    mockStreamFindUnique.mockResolvedValue(null);
    await expect(
      createClip({
        streamId: "nonexistent",
        creatorId: "u1",
        title: "Test",
        videoUrl: "https://example.com/clip.m3u8",
      })
    ).rejects.toThrow("Stream không tồn tại");
  });

  it("should create clip when input is valid", async () => {
    mockStreamFindUnique.mockResolvedValue({ id: "s1" });
    mockClipCreate.mockResolvedValue({
      id: "c1",
      title: "Test",
      videoUrl: "https://example.com/clip.m3u8",
      creator: { id: "u1", username: "test", imageUrl: null },
      stream: { id: "s1", name: "Stream", userId: "u2", user: { id: "u2", username: "streamer", imageUrl: null }, thumbnailUrl: null },
    });

    const clip = await createClip({
      streamId: "s1",
      creatorId: "u1",
      title: "Test",
      videoUrl: "https://example.com/clip.m3u8",
    });

    expect(clip.id).toBe("c1");
    expect(mockClipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          streamId: "s1",
          creatorId: "u1",
          title: "Test",
          videoUrl: "https://example.com/clip.m3u8",
        }),
      })
    );
  });
});

describe("deleteClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when clip not found", async () => {
    mockClipFindUnique.mockResolvedValue(null);
    await expect(
      deleteClip({ clipId: "c1", actingUserId: "u1" })
    ).rejects.toThrow("Clip không tồn tại");
  });

  it("should throw when user is not creator or streamer", async () => {
    mockClipFindUnique.mockResolvedValue({
      creatorId: "u2",
      stream: { userId: "u3" },
    });
    await expect(
      deleteClip({ clipId: "c1", actingUserId: "u1" })
    ).rejects.toThrow("Bạn không có quyền xóa clip này");
  });

  it("should delete when user is creator", async () => {
    mockClipFindUnique.mockResolvedValue({
      creatorId: "u1",
      stream: { userId: "u3" },
    });
    mockClipDelete.mockResolvedValue({});
    await deleteClip({ clipId: "c1", actingUserId: "u1" });
    expect(mockClipDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("should delete when user is streamer", async () => {
    mockClipFindUnique.mockResolvedValue({
      creatorId: "u2",
      stream: { userId: "u1" },
    });
    mockClipDelete.mockResolvedValue({});
    await deleteClip({ clipId: "c1", actingUserId: "u1" });
    expect(mockClipDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});

describe("toggleClipFeatured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when clip not found", async () => {
    mockClipFindUnique.mockResolvedValue(null);
    await expect(
      toggleClipFeatured({ clipId: "c1", actingUserId: "u1" })
    ).rejects.toThrow("Clip không tồn tại");
  });

  it("should throw when user is not streamer", async () => {
    mockClipFindUnique.mockResolvedValue({
      isFeatured: false,
      stream: { userId: "u2" },
    });
    await expect(
      toggleClipFeatured({ clipId: "c1", actingUserId: "u1" })
    ).rejects.toThrow("Chỉ streamer mới có quyền featured");
  });

  it("should toggle from false → true", async () => {
    mockClipFindUnique.mockResolvedValue({
      isFeatured: false,
      stream: { userId: "u1" },
    });
    mockClipUpdate.mockResolvedValue({ isFeatured: true });

    const result = await toggleClipFeatured({
      clipId: "c1",
      actingUserId: "u1",
    });
    expect(result.isFeatured).toBe(true);
    expect(mockClipUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { isFeatured: true },
      select: { isFeatured: true },
    });
  });

  it("should toggle from true → false", async () => {
    mockClipFindUnique.mockResolvedValue({
      isFeatured: true,
      stream: { userId: "u1" },
    });
    mockClipUpdate.mockResolvedValue({ isFeatured: false });

    const result = await toggleClipFeatured({
      clipId: "c1",
      actingUserId: "u1",
    });
    expect(result.isFeatured).toBe(false);
  });
});

describe("listClipsByStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call findMany with correct where/orderBy", async () => {
    mockClipFindMany.mockResolvedValue([]);
    await listClipsByStream("s1", { limit: 10, sort: "popular" });
    expect(mockClipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { streamId: "s1" },
        take: 10,
      })
    );
  });

  it("should support sort='recent'", async () => {
    mockClipFindMany.mockResolvedValue([]);
    await listClipsByStream("s1", { sort: "recent" });
    expect(mockClipFindMany).toHaveBeenCalled();
  });
});

describe("listClipsByCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should query by creatorId", async () => {
    mockClipFindMany.mockResolvedValue([]);
    await listClipsByCreator("u1");
    expect(mockClipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creatorId: "u1" },
      })
    );
  });
});
