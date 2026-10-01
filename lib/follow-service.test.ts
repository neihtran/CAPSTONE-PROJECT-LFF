import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import {
  followUser,
  unfollowUser,
  isFollowingUser,
} from "@/lib/follow-service";
import {
  AlreadyFollowingError,
  NotFollowingError,
  SelfActionError,
  UserNotFoundError,
} from "@/lib/errors";

// Mock các module phụ thuộc — service layer gọi db và getSelf, ta không cần kết nối DB thật.
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

  const selfUser = {
    id: SELF_ID,
    externalUserId: "ext-self",
    username: "self-user",
    imageUrl: "https://example.com/self.png",
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  vi.mocked(getSelf).mockResolvedValue(selfUser as any);

  prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.id === SELF_ID) return selfUser as any;
    if (where.id === OTHER_ID)
      return {
        id: OTHER_ID,
        username: "other-user",
      } as any;
    return null;
  });

  // Mặc định: không có block → không mutual block.
  prismaMock.block.findFirst.mockResolvedValue(null);
});

describe("followUser", () => {
  it("should throw SelfActionError when trying to follow yourself", async () => {
    await expect(followUser(SELF_ID)).rejects.toBeInstanceOf(SelfActionError);
  });

  it("should throw UserNotFoundError when target user does not exist", async () => {
    await expect(followUser(NOT_FOUND_ID)).rejects.toBeInstanceOf(
      UserNotFoundError
    );
  });

  it("should throw AlreadyFollowingError when already following the target", async () => {
    prismaMock.follow.findFirst.mockResolvedValue({
      id: "follow-1",
      followerId: SELF_ID,
      followingId: OTHER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await expect(followUser(OTHER_ID)).rejects.toBeInstanceOf(
      AlreadyFollowingError
    );
  });

  it("should throw CannotInteractError when mutual block exists", async () => {
    // Mock 1 block tồn tại
    prismaMock.block.findFirst.mockResolvedValue({
      id: "block-1",
      blockerId: SELF_ID,
      blockedId: OTHER_ID,
    } as any);

    await expect(followUser(OTHER_ID)).rejects.toThrow();
  });

  it("should create a follow relationship when valid", async () => {
    prismaMock.follow.findFirst.mockResolvedValue(null);
    prismaMock.follow.create.mockResolvedValue({
      id: "follow-new",
      followerId: SELF_ID,
      followingId: OTHER_ID,
      follower: { id: SELF_ID } as any,
      following: { id: OTHER_ID, username: "other-user" } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await followUser(OTHER_ID);

    expect(result.following.username).toBe("other-user");
    expect(prismaMock.follow.create).toHaveBeenCalledWith({
      data: {
        followerId: SELF_ID,
        followingId: OTHER_ID,
      },
      include: {
        follower: true,
        following: true,
      },
    });
  });
});

describe("unfollowUser", () => {
  it("should throw SelfActionError when trying to unfollow yourself", async () => {
    await expect(unfollowUser(SELF_ID)).rejects.toBeInstanceOf(SelfActionError);
  });

  it("should throw NotFollowingError when user is not currently following the target", async () => {
    prismaMock.follow.findFirst.mockResolvedValue(null);

    await expect(unfollowUser(OTHER_ID)).rejects.toBeInstanceOf(
      NotFollowingError
    );
  });

  it("should delete the follow record when valid", async () => {
    prismaMock.follow.findFirst.mockResolvedValue({
      id: "follow-existing",
      followerId: SELF_ID,
      followingId: OTHER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    prismaMock.follow.delete.mockResolvedValue({
      id: "follow-existing",
      followerId: SELF_ID,
      followingId: OTHER_ID,
      following: { id: OTHER_ID, username: "other-user" } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await unfollowUser(OTHER_ID);

    expect(result.following.id).toBe(OTHER_ID);
    expect(prismaMock.follow.delete).toHaveBeenCalledWith({
      where: { id: "follow-existing" },
      include: { following: true },
    });
  });
});

describe("isFollowingUser", () => {
  it("should return true when checking against yourself", async () => {
    const result = await isFollowingUser(SELF_ID);
    expect(result).toBe(true);
  });

  it("should return false when target user does not exist", async () => {
    const result = await isFollowingUser(NOT_FOUND_ID);
    expect(result).toBe(false);
  });

  it("should return false when no follow record exists", async () => {
    prismaMock.follow.findFirst.mockResolvedValue(null);
    const result = await isFollowingUser(OTHER_ID);
    expect(result).toBe(false);
  });

  it("should return true when a follow record exists", async () => {
    prismaMock.follow.findFirst.mockResolvedValue({
      id: "follow-x",
      followerId: SELF_ID,
      followingId: OTHER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await isFollowingUser(OTHER_ID);
    expect(result).toBe(true);
  });
});
