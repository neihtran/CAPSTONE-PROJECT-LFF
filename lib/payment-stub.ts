/**
 * Payment Stub — mock payment service (Sprint 7).
 *
 * Production sẽ thay thế bằng Stripe SDK (stripe-node).
 * Stub này mô phỏng: tạo payment intent, confirm, refund.
 *
 * Tất cả các function đều:
 *   - Không gọi bên thứ 3.
 *   - Trả về mock response với ID giả lập.
 *   - Đủ interface để swap sang Stripe real sau này.
 *
 * Đơn vị tiền tệ: VNĐ (zero-decimal currency).
 *   - KHÔNG nhân 100 khi tạo PaymentIntent (khác với USD cents).
 *   - Truyền thẳng số nguyên VNĐ vào Stripe `amount` field.
 *
 * Để nâng cấp lên Stripe real:
 *   1. Thay stub bằng stripe.paymentIntents.create({ amount, currency: "vnd" }, ...).
 *   2. Thêm webhook handler ở /api/webhooks/stripe — cập nhật DB khi payment thành công.
 *   3. Chuyển subscription sang Stripe Billing (recurring).
 */

export type StubPaymentResult = {
  success: true;
  paymentRef: string; // mock "pi_xxx" style reference
  amountCents: number;
};

export type StubPaymentError = {
  success: false;
  error: string;
};

/**
 * Create a mock payment intent for a one-time donation.
 * Returns mock paymentRef that you'd pass to your webhook handler.
 */
export async function createDonationIntent(
  amountVnd: number,
  donorId?: string
): Promise<StubPaymentResult | StubPaymentError> {
  // VNĐ zero-decimal: truyền nguyên số nguyên, KHÔNG nhân 100.
  if (amountVnd < 1_000) {
    return { success: false, error: "Số tiền tối thiểu là 1.000 đ" };
  }
  if (amountVnd > 10_000_000) {
    return { success: false, error: "Số tiền tối đa là 10.000.000 đ" };
  }

  // Mock payment processing delay.
  await new Promise((r) => setTimeout(r, 100));

  const ref = `pi_stub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return { success: true, paymentRef: ref, amountCents: amountVnd };
}

/**
 * Confirm a mock payment — in real Stripe this is done via webhook.
 * Stub: always succeeds if paymentRef looks valid.
 */
export async function confirmPayment(
  paymentRef: string
): Promise<StubPaymentResult | StubPaymentError> {
  if (!paymentRef.startsWith("pi_stub_")) {
    return { success: false, error: "Invalid payment reference" };
  }

  // Mock processing.
  await new Promise((r) => setTimeout(r, 50));

  return {
    success: true,
    paymentRef,
    amountCents: 0, // caller knows amount from createDonationIntent
  };
}

/**
 * Issue a mock refund — in real Stripe: stripe.refunds.create({ payment_intent }).
 */
export async function refundPayment(
  paymentRef: string,
  amountVnd?: number // full refund if omitted
): Promise<StubPaymentResult | StubPaymentError> {
  if (!paymentRef.startsWith("pi_stub_")) {
    return { success: false, error: "Invalid payment reference" };
  }

  await new Promise((r) => setTimeout(r, 50));

  return {
    success: true,
    paymentRef,
    amountCents: amountVnd ?? 0,
  };
}

/**
 * Create a mock subscription intent.
 * In real Stripe: stripe.subscriptions.create({ items: [{ price: "price_xxx" }], ... }).
 */
export async function createSubscriptionIntent(
  priceVnd: number,
  subscriberId: string,
  tierId: string
): Promise<StubPaymentResult | StubPaymentError> {
  if (priceVnd < 10_000) {
    return { success: false, error: "Giá subscription tối thiểu là 10.000 đ/tháng" };
  }

  await new Promise((r) => setTimeout(r, 100));

  const ref = `sub_stub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return { success: true, paymentRef: ref, amountCents: priceVnd };
}

/**
 * Renew a stub subscription (simulate period end → new period).
 */
export async function renewSubscriptionIntent(
  paymentRef: string,
  amountVnd: number
): Promise<StubPaymentResult | StubPaymentError> {
  if (!paymentRef.startsWith("sub_stub_")) {
    return { success: false, error: "Invalid subscription reference" };
  }

  await new Promise((r) => setTimeout(r, 50));

  return { success: true, paymentRef, amountCents: amountVnd };
}
