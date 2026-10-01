/**
 * formatVND — format số tiền VNĐ dùng Intl.NumberFormat.
 *
 * Số tiền trong DB được lưu theo "đơn vị nhỏ nhất" (integer VNĐ, không có decimal).
 * Vì VNĐ là zero-decimal currency trong Stripe — KHÔNG nhân 100.
 *
 * @example
 *   formatVND(50000) // "50.000 đ"
 *   formatVND(1234567) // "1.234.567 đ"
 */
export const formatVND = (amountVnd: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amountVnd);
};

/**
 * Format VND ngắn gọn (rút gọn cho K/M):
 *   formatVNDShort(50000)   // "50K"
 *   formatVNDShort(1500000) // "1.5M"
 */
export const formatVNDShort = (amountVnd: number): string => {
  if (amountVnd >= 1_000_000) {
    return `${(amountVnd / 1_000_000).toFixed(amountVnd >= 10_000_000 ? 0 : 1)}M`;
  }
  if (amountVnd >= 1_000) {
    return `${(amountVnd / 1_000).toFixed(0)}K`;
  }
  return amountVnd.toString();
};

/**
 * parseVNDInput — parse string input từ form thành integer VNĐ.
 * Cho phép user nhập "10.000" hoặc "10000" hoặc "10,000".
 */
export const parseVNDInput = (input: string): number => {
  const cleaned = input.replace(/[.,\s]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
