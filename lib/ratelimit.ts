/**
 * Upstash Ratelimit utility.
 *
 * IMPORTANT: Việc khởi tạo Redis client phải được kiểm tra TRƯỚC KHI gọi constructor.
 * Nếu env rỗng/undefined, KHÔNG tạo Redis instance vì `new Redis({url:"", token:""})`
 * tự throw lỗi ngay lúc khởi tạo — try/catch bên ngoài cũng không kịp bắt.
 *
 * Sau khi init, mọi chỗ gọi ratelimit.limit() phải guard bằng `if (ratelimit)`.
 *
 * Fail-open: khi không có Upstash → ratelimit = null → enforceRateLimit luôn pass.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = {
  success: boolean;
  limit: number;
  reset: number;
  remaining: number;
  pending?: Promise<unknown>;
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

// Kiểm tra env TRƯỚC KHI tạo bất kỳ instance nào.
// Chỉ khởi tạo khi CẢ 2 biến đều có giá trị truthy (không rỗng sau trim).
const isUpstashConfigured =
  typeof UPSTASH_URL === "string" &&
  UPSTASH_URL.length > 0 &&
  typeof UPSTASH_TOKEN === "string" &&
  UPSTASH_TOKEN.length > 0;

// Cache Redis instance để không tạo lại mỗi lần gọi limit().
let _redisInstance: Redis | null = null;
let _ratelimitInstance: Ratelimit | null = null;
let _strictRatelimitInstance: Ratelimit | null = null;

/**
 * Lazy init Redis + Ratelimit — chỉ tạo khi thực sự cần và đã verified env.
 */
const getRatelimit = (): Ratelimit | null => {
  if (!isUpstashConfigured) return null;

  if (!_ratelimitInstance) {
    // Tạo Redis instance MỘT LẦN DUY NHẤT khi first call.
    _redisInstance = new Redis({
      url: UPSTASH_URL!,
      token: UPSTASH_TOKEN!,
    });

    _ratelimitInstance = new Ratelimit({
      redis: _redisInstance,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "twitch-clone:ratelimit",
      ephemeralCache: new Map(),
    });
  }

  return _ratelimitInstance;
};

const getStrictRatelimit = (): Ratelimit | null => {
  if (!isUpstashConfigured) return null;

  if (!_strictRatelimitInstance) {
    _redisInstance = new Redis({
      url: UPSTASH_URL!,
      token: UPSTASH_TOKEN!,
    });

    _strictRatelimitInstance = new Ratelimit({
      redis: _redisInstance,
      limiter: Ratelimit.slidingWindow(2, "1 m"),
      analytics: true,
      prefix: "twitch-clone:ratelimit:strict",
      ephemeralCache: new Map(),
    });
  }

  return _strictRatelimitInstance;
};

/**
 * Noop limiter — luôn cho phép. Dùng khi không muốn rate limit (dev local).
 */
const noopLimiter = {
  async limit(_identifier: string): Promise<LimitResult> {
    return {
      success: true,
      limit: Number.MAX_SAFE_INTEGER,
      reset: Date.now() + 60_000,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  },
} as unknown as Ratelimit;

/**
 * Enforce rate limit cho một identifier.
 *
 * Nếu Upstash chưa được cấu hình (env rỗng) → noop, luôn pass.
 * Nếu Upstash lỗi khi gọi limit() → fail-open, luôn pass + log warning.
 *
 * @param identifier - chuỗi định danh (vd: `follow:${userId}`)
 * @param isStrict - true dùng strictRatelimit (2/1m), false dùng ratelimit thường (10/10s)
 */
export const enforceRateLimit = async (
  identifier: string,
  options: { isStrict?: boolean } = {}
): Promise<{ success: boolean } | never> => {
  const limiter = options.isStrict
    ? getStrictRatelimit()
    : getRatelimit();

  // Upstash không được cấu hình → pass-through (noop).
  if (!limiter) {
    return { success: true };
  }

  try {
    const result = await limiter.limit(identifier);

    if (!result.success) {
      const resetDate = new Date(result.reset);
      throw new Error(
        `Too many requests. Limit ${result.limit}. Try again at ${resetDate.toISOString()}. (Remaining: ${result.remaining})`
      );
    }

    return result;
  } catch (error) {
    // Lỗi khi gọi Upstash (network, 5xx...) → fail-open + log.
    console.warn(
      `[ratelimit] Upstash gọi thất bại, fail-open cho request: ${identifier}`,
      error
    );
    return { success: true };
  }
};
