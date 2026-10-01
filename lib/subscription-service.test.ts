import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    subscriptionTier: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    donation: {
      create: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    streamSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    streamView: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    stream: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    streamAlert: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/payment-stub", () => ({
  createSubscriptionIntent: vi.fn(),
  renewSubscriptionIntent: vi.fn(),
  createDonationIntent: vi.fn(),
}));

vi.mock("@/lib/alert-service", () => ({
  buildAlert: vi.fn().mockResolvedValue(null),
}));

import { db } from "@/lib/db";
import {
  createSubscriptionIntent,
  createDonationIntent,
} from "@/lib/payment-stub";
import {
  subscribeToTier,
  cancelSubscription,
  getMySubscription,
  getStreamerTiers,
} from "@/lib/subscription-service";
import {
  createDonation,
  getStreamerDonationRevenue,
  getRecentDonations,
  PRESET_AMOUNTS,
} from "@/lib/donation-service";

const d = db as ReturnType<typeof vi.fn>;
const pSub = createSubscriptionIntent as ReturnType<typeof vi.fn>;
const pDon = createDonationIntent as ReturnType<typeof vi.fn>;

describe("PRESET_AMOUNTS", () => {
  it("should have correct preset values (VNĐ)", () => {
    expect(PRESET_AMOUNTS).toEqual([5_000, 10_000, 20_000, 50_000, 100_000, 200_000]);
  });
});

describe("subscribeToTier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (d.subscriptionTier.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (d.subscription.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (d.subscription.create as ReturnType<typeof vi.fn>).mockReset();
    (d.subscription.update as ReturnType<typeof vi.fn>).mockReset();
    pSub.mockReset();
  });

  it("should throw when subscriber = streamer", async () => {
    await expect(
      subscribeToTier({ subscriberId: "u1", streamerId: "u1", tierId: "t1" })
    ).rejects.toThrow("Bạn không thể tự subscribe chính mình");
  });

  it("should throw when tier not found", async () => {
    (d.subscriptionTier.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      subscribeToTier({ subscriberId: "u1", streamerId: "u2", tierId: "t1" })
    ).rejects.toThrow("Tier không tồn tại");
  });

  it("should create new subscription when payment succeeds", async () => {
    (d.subscriptionTier.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "t1",
      priceCents: 499,
    });
    pSub.mockResolvedValue({ success: true, paymentRef: "pi_123", amountCents: 499 });
    (d.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (d.subscription.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub1",
      paymentRef: "pi_123",
      currentPeriodEnd: new Date(),
    });

    const result = await subscribeToTier({
      subscriberId: "u1",
      streamerId: "u2",
      tierId: "t1",
    });

    expect(result.paymentRef).toBe("pi_123");
    expect(d.subscription.create).toHaveBeenCalled();
  });

  it("should re-subscribe (update existing)", async () => {
    (d.subscriptionTier.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "t1",
      priceCents: 499,
    });
    pSub.mockResolvedValue({ success: true, paymentRef: "pi_456", amountCents: 499 });
    (d.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub_old",
    });
    (d.subscription.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sub_old",
      paymentRef: "pi_456",
      currentPeriodEnd: new Date(),
    });

    const result = await subscribeToTier({
      subscriberId: "u1",
      streamerId: "u2",
      tierId: "t1",
    });

    expect(result.paymentRef).toBe("pi_456");
    expect(d.subscription.update).toHaveBeenCalled();
  });
});

describe("cancelSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (d.subscription.updateMany as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should update status to CANCELED", async () => {
    (d.subscription.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    await cancelSubscription("u1", "u2");
    expect(d.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscriberId: "u1",
          streamerId: "u2",
          status: "ACTIVE",
        },
        data: expect.objectContaining({
          status: "CANCELED",
          canceledAt: expect.any(Date),
        }),
      })
    );
  });
});

describe("getMySubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (d.subscription.findFirst as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should query by subscriberId and streamerId", async () => {
    (d.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await getMySubscription("u1", "u2");
    expect(d.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriberId: "u1",
          streamerId: "u2",
        }),
      })
    );
  });
});

describe("getStreamerTiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (d.subscriptionTier.findMany as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should find by streamerId with ACTIVE status", async () => {
    (d.subscriptionTier.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getStreamerTiers("u1");
    expect(d.subscriptionTier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { streamerId: "u1", status: "ACTIVE" },
      })
    );
  });
});

describe("createDonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pDon.mockReset();
    (d.donation.create as ReturnType<typeof vi.fn>).mockReset();
    (d.streamSession.findFirst as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should throw when amount < 1000 (VNĐ)", async () => {
    await expect(
      createDonation({ amountCents: 500, recipientId: "u1" })
    ).rejects.toThrow("Số tiền tối thiểu là 1.000 đ");
  });

  it("should throw when amount > 10_000_000 (VNĐ)", async () => {
    await expect(
      createDonation({ amountCents: 20_000_000, recipientId: "u1" })
    ).rejects.toThrow("Số tiền tối đa là 10.000.000 đ");
  });

  it("should create donation when payment succeeds", async () => {
    pDon.mockResolvedValue({ success: true, paymentRef: "pi_d1", amountCents: 50_000 });
    (d.donation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "don1",
      paymentRef: "pi_d1",
      status: "COMPLETED",
    });
    (d.streamSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await createDonation({
      amountCents: 50_000,
      donorId: "u1",
      recipientId: "u2",
      message: "Great stream!",
    });

    expect(result.status).toBe("COMPLETED");
    expect(d.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 50_000,
          message: "Great stream!",
        }),
      })
    );
  });

  it("should truncate message at 500 chars", async () => {
    pDon.mockResolvedValue({ success: true, paymentRef: "pi_long", amountCents: 50_000 });
    (d.donation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "don1",
      paymentRef: "pi_long",
      status: "COMPLETED",
    });
    (d.streamSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await createDonation({
      amountCents: 50_000,
      recipientId: "u1",
      message: "x".repeat(600),
    });

    expect(d.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: "x".repeat(500),
        }),
      })
    );
  });
});

describe("getStreamerDonationRevenue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (d.donation.aggregate as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should aggregate COMPLETED donations", async () => {
    (d.donation.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: 12500 },
    });
    const result = await getStreamerDonationRevenue("u1");
    expect(result).toBe(12500);
  });

  it("should return 0 when no donations", async () => {
    (d.donation.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { amountCents: null },
    });
    const result = await getStreamerDonationRevenue("u1");
    expect(result).toBe(0);
  });
});

describe("getRecentDonations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (d.donation.findMany as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should query recent COMPLETED donations", async () => {
    (d.donation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getRecentDonations("u1", 30);
    expect(d.donation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: "u1", status: "COMPLETED" },
        take: 30,
      })
    );
  });
});
