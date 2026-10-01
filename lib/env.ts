import { z } from "zod";

/**
 * Validates environment variables at app startup (fail-fast).
 *
 * If any required env is missing or malformed, this module throws a descriptive
 * error BEFORE Next.js boots. This prevents cryptic "undefined" errors deep in
 * the call stack when env is misconfigured.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   const url = env.DATABASE_URL; // typed + validated
 *
 * Categories:
 *   - SERVER_ONLY: only available in Node runtime (API routes, RSC).
 *     NEXT_PUBLIC_* prefixed vars are available in both server + client.
 */

const serverSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL phải là URL hợp lệ"),

  // Clerk (server)
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY là bắt buộc"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET là bắt buộc"),

  // LiveKit (server)
  LIVEKIT_API_KEY: z.string().min(1, "LIVEKIT_API_KEY là bắt buộc"),
  LIVEKIT_API_SECRET: z.string().min(1, "LIVEKIT_API_SECRET là bắt buộc"),
  LIVEKIT_API_URL: z.string().url("LIVEKIT_API_URL phải là URL"),

  // OpenAI (optional — fail-open trong moderation-service nếu thiếu)
  OPENAI_API_KEY: z.string().optional(),

  // Upstash (optional — fail-open trong ratelimit nếu thiếu)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // UploadThing
  UPLOADTHING_SECRET: z.string().min(1, "UPLOADTHING_SECRET là bắt buộc"),
  UPLOADTHING_APP_ID: z.string().min(1, "UPLOADTHING_APP_ID là bắt buộc"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY là bắt buộc"),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().min(1),
  NEXT_PUBLIC_LIVEKIT_WS_URL: z.string().min(1),
});

/**
 * Validate CLIENT env vars (NEXT_PUBLIC_*) — safe in both server + client bundles.
 * Throws nếu thiếu.
 */
const parseClientEnv = () => {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
    NEXT_PUBLIC_LIVEKIT_WS_URL: process.env.NEXT_PUBLIC_LIVEKIT_WS_URL,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Client environment validation failed:\n${issues}\n\n` +
        `Tip: copy .env.example.upstash + .env.example (nếu có) vào .env`
    );
  }

  return result.data;
};

export const clientEnv = parseClientEnv();

/**
 * Validate SERVER-only env vars. CHỈ gọi từ server runtime (API routes, RSC).
 *
 * Lưu ý: validation lazy — chỉ chạy khi gọi `serverEnv` lần đầu. Cho phép
 * client bundle import file này mà không crash.
 */
let _serverEnvCache: z.infer<typeof serverSchema> | null = null;

export const getServerEnv = (): z.infer<typeof serverSchema> => {
  if (_serverEnvCache) return _serverEnvCache;

  const result = serverSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LIVEKIT_API_URL: process.env.LIVEKIT_API_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
    UPLOADTHING_APP_ID: process.env.UPLOADTHING_APP_ID,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Server environment validation failed:\n${issues}\n\n` +
        `Server-only env vars cần có đầy đủ trên production.`
    );
  }

  _serverEnvCache = result.data;
  return _serverEnvCache;
};
