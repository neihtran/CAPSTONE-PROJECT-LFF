import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Cấu hình Vitest cho dự án Next.js.
 * - alias `@` trỏ về thư mục gốc, giống tsconfig.json
 * - môi trường `node` mặc định (vì unit test các service layer chạy server-side)
 * - include: chỉ chạy test trong `lib/` để không chạy nhầm test cũ ở chỗ khác
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
