"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { formatVND, parseVNDInput } from "@/lib/format";

type Tier = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number; // integer VNĐ (zero-decimal currency)
  level: number;
  color: string;
  status: string;
  subscriberCount: number;
};

type Subscriber = {
  id: string;
  status: string;
  subscriberUsername: string;
  subscriberImageUrl: string;
  tierName: string;
  tierColor: string;
  monthsActive: number;
  currentPeriodEnd: string;
  createdAt: string;
};

const PRESET_TIERS = [
  { name: "Đồng", level: 1, priceCents: 20_000, color: "#CD7F32", description: "Badge đồng cơ bản" },
  { name: "Bạc", level: 2, priceCents: 50_000, color: "#C0C0C0", description: "Badge bạc + emote đặc biệt" },
  { name: "Vàng", level: 3, priceCents: 100_000, color: "#FFD700", description: "Badge vàng + emote + badge chat đặc biệt" },
];

export function SubscriptionDashboard({
  streamerId,
  initialTiers,
  initialSubscribers,
  totalRevenueCents,
}: {
  streamerId: string;
  initialTiers: Tier[];
  initialSubscribers: Subscriber[];
  totalRevenueCents: number;
}) {
  const [tiers, setTiers] = useState(initialTiers);
  const [subscribers] = useState(initialSubscribers);
  const [revenue] = useState(totalRevenueCents);

  return (
    <div className="space-y-8">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tổng revenue" value={formatVND(revenue)} color="#32CD32" />
        <StatCard
          label="Active subscribers"
          value={subscribers.filter((s) => s.status === "ACTIVE").length.toString()}
          color="#9146FF"
        />
        <StatCard
          label="Tổng subscribers"
          value={subscribers.length.toString()}
          color="#FFD700"
        />
        <StatCard
          label="Số gói"
          value={tiers.length.toString()}
          color="#00C2A8"
        />
      </div>

      {/* Tiers management */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Gói Subscription</h2>
            <p className="text-sm text-muted-foreground">
              Tạo và quản lý các gói subscribe (VNĐ)
            </p>
          </div>
          <CreateTierButton
            streamerId={streamerId}
            onCreated={(tier) => setTiers((prev) => [...prev, tier])}
          />
        </div>

        {tiers.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-muted-foreground">
            Chưa có gói nào. Tạo gói subscription đầu tiên.
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                streamerId={streamerId}
                onUpdated={(updated) =>
                  setTiers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                }
                onDeleted={(id) =>
                  setTiers((prev) => prev.filter((t) => t.id !== id))
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Subscriber list */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Subscribers</h2>
          <p className="text-sm text-muted-foreground">
            Danh sách người đã subscribe bạn
          </p>
        </div>

        {subscribers.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-muted-foreground">
            Chưa có ai subscribe.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gói</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tháng</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hết hạn</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{sub.subscriberUsername}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: sub.tierColor }}
                      >
                        {sub.tierName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{sub.monthsActive}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDistanceToNow(new Date(sub.currentPeriodEnd), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-medium ${
                          sub.status === "ACTIVE" ? "text-green-500" : "text-muted-foreground"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-4 space-y-1" style={{ borderColor: `${color}30` }}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function TierCard({
  tier,
  streamerId,
  onUpdated,
  onDeleted,
}: {
  tier: Tier;
  streamerId: string;
  onUpdated: (t: Tier) => void;
  onDeleted: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(tier.name);
  const [editPrice, setEditPrice] = useState(String(tier.priceCents));

  const handleDelete = () => {
    if (!confirm(`Xóa gói "${tier.name}"?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/subscriptions/tiers?id=${tier.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        toast.success("Đã xóa gói");
        onDeleted(tier.id);
      } catch {
        toast.error("Không thể xóa gói");
      }
    });
  };

  const handleSaveEdit = () => {
    const priceCents = parseVNDInput(editPrice);
    if (!editName || priceCents < 10_000) {
      toast.error("Tên và giá tối thiểu 10.000 đ");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/subscriptions/tiers?id=${tier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, priceCents }),
        });
        if (!res.ok) throw new Error("Update failed");
        toast.success("Đã cập nhật gói");
        onUpdated({ ...tier, name: editName, priceCents });
        setEditing(false);
      } catch {
        toast.error("Không thể cập nhật");
      }
    });
  };

  return (
    <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: `${tier.color}40` }}>
      <div className="flex items-start justify-between">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: tier.color }}
        >
          {tier.name}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          >
            {editing ? "Hủy" : "Sửa"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
          >
            Xóa
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            placeholder="Tên gói"
          />
          <input
            type="number"
            step="1000"
            min="10000"
            max="10000000"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            placeholder="Giá (VNĐ)"
          />
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={isPending}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            {isPending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      ) : (
        <>
          {tier.description && (
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          )}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold">{formatVND(tier.priceCents)}</p>
              <p className="text-xs text-muted-foreground">/ tháng</p>
            </div>
            <p className="text-xs text-muted-foreground">
              👥 {tier.subscriberCount} subscriber{tier.subscriberCount !== 1 ? "s" : ""}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function CreateTierButton({
  streamerId,
  onCreated,
}: {
  streamerId: string;
  onCreated: (t: Tier) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = parseVNDInput(price);
    if (!name || priceCents < 10_000) {
      toast.error("Vui lòng nhập tên và giá (tối thiểu 10.000 đ)");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/subscriptions/tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, priceCents, level: 1, description }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Create failed");
        toast.success("Đã tạo gói subscription");
        onCreated({
          id: data.id,
          name,
          description,
          priceCents,
          level: 1,
          color: "#9146FF",
          status: "ACTIVE",
          subscriberCount: 0,
        });
        setOpen(false);
        setName("");
        setPrice("");
        setDescription("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo thất bại");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        + Tạo gói mới
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Tạo gói Subscription mới</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Tên gói</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                  placeholder="VD: Đồng, Bạc, Vàng"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Giá (VNĐ/tháng)</label>
                <input
                  type="number"
                  step="1000"
                  min="10000"
                  max="10000000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                  placeholder="VD: 50000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  10.000 đ — 10.000.000 đ
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Mô tả (tùy chọn)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none"
                  rows={2}
                  placeholder="Quyền lợi..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 rounded-lg border text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Đang tạo..." : "Tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
