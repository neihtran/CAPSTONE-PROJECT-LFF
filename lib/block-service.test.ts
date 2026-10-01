import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";

import { getSelf } from "@/lib/auth-service";
import {
  blockUser,
  unblockUser,
  isBlockedByUser,
} from "@/lib/block-service";
import {
  AlreadyBlockedError,
  NotBlockedError,
  SelfActionError,
  UserNotFoundError,
} from "@/lib/errors";

// Mock các module phụ thuộc — ta không cần kết nối DB thật.
vi.mock("@/lib/db", () => ({
  get db() {
    return prismaMock;
  },
}));

vi.mock("@/lib/auth-service", () => ({
  getSelf: vi.fn(),
}));

let prismaMock: DeepMockProxy<PrismaClient>;

const SELF_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";
const NOT_FOUND_ID = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  prismaMock = mockDeep<PrismaClient>();
  mockReset(prismaMock);
  vi.mocked(getSelf).mockResolvedValue({
    id: SELF_ID,
    externalUserId: "ext-self",
    username: "self-user",
    imageUrl: "https://example.com/self.png",
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
});

describe("blockUser", () => {
  it("should throw SelfActionError when trying to block yourself", async () => {
    await expect(blockUser(SELF_ID)).rejects.toBeInstanceOf(SelfActionError);
  });

  it("should throw UserNotFoundError when target user does not exist", async () => {
    await expect(blockUser(NOT_FOUND_ID)).rejects.toBeInstanceOf(
      UserNotFoundError
    );
  });

  it("should throw AlreadyBlockedError when user is already blocked", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      username: "other-user",
    } as any);
    prismaMock.block.findUnique.mockResolvedValue({
      id: "block-1",
      blockerId: SELF_ID,
      blockedId: OTHER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await expect(blockUser(OTHER_ID)).rejects.toBeInstanceOf(
      AlreadyBlockedError
    );
  });

  it("should create a block record when valid", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      username: "other-user",
    } as any);
    prismaMock.block.findUnique.mockResolvedValue(null);
    prismaMock.block.create.mockResolvedValue({
      id: "block-new",
      blockerId: SELF_ID,
      blockedId: OTHER_ID,
      blocker: { id: SELF_ID } as any,
      blocked: { id: OTHER_ID, username: "other-user" } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await blockUser(OTHER_ID);

    expect(result.blocked.username).toBe("other-user");
    expect(prismaMock.block.create).toHaveBeenCalledWith({
      data: {
        blockerId: SELF_ID,
        blockedId: OTHER_ID,
      },
      include: {
        blocked: true,
      },
    });
  });
});

describe("unblockUser", () => {
  it("should throw SelfActionError when trying to unblock yourself", async () => {
    await expect(unblockUser(SELF_ID)).rejects.toBeInstanceOf(SelfActionError);
  });

  it("should throw NotBlockedError when user is not currently blocked", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      username: "other-user",
    } as any);
    prismaMock.block.findUnique.mockResolvedValue(null);

    await expect(unblockUser(OTHER_ID)).rejects.toBeInstanceOf(NotBlockedError);
  });

  it("should delete the block record when valid", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      username: "other-user",
    } as any);
    prismaMock.block.findUnique.mockResolvedValue({
      id: "block-existing",
      blockerId: SELF_ID,
      blockedId: OTHER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    prismaMock.block.delete.mockResolvedValue({
      id: "block-existing",
      blockerId: SELF_ID,
      blockedId: OTHER_ID,
      blocked: { id: OTHER_ID, username: "other-user" } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await unblockUser(OTHER_ID);

    expect(result.blocked.username).toBe("other-user");
    expect(prismaMock.block.delete).toHaveBeenCalledWith({
      where: { id: "block-existing" },
      include: { blocked: true },
    });
  });
});

describe("isBlockedByUser", () => {
  it("should return false when checking against yourself", async () => {
    const result = await isBlockedByUser(SELF_ID);
    expect(result).toBe(false);
  });

  it("should return false when target user does not exist", async () => {
    const result = await isBlockedByUser(NOT_FOUND_ID);
    expect(result).toBe(false);
  });

  it("should return true when the other user has blocked self", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      username: "other-user",
    } as any);
    prismaMock.block.findUnique.mockResolvedValue({
      id: "block-x",
      blockerId: OTHER_ID,
      blockedId: SELF_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await isBlockedByUser(OTHER_ID);
    expect(result).toBe(true);
  });

  it("should return false when the other user has NOT blocked self", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      username: "other-user",
    } as any);
    prismaMock.block.findUnique.mockResolvedValue(null);

    const result = await isBlockedByUser(OTHER_ID);
    expect(result).toBe(false);
  });
});
