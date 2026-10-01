"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { PRESET_AMOUNTS } from "@/lib/donation-service";
import { formatVND, parseVNDInput } from "@/lib/format";
import { useRouter } from "next/navigation";

/**
 * DonateModal — popup cho viewer donate tip.
 *
 * Preset amounts + custom input + message.
 * Submit → POST /api/donations.
 *
 * Currency: VNĐ (zero-decimal) — truyền nguyên số nguyên vào amount.
 */
export function DonateModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  streamId,
}: {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  streamId?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(PRESET_AMOUNTS[1]); // default 10K
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const isCustom = customAmount !== "";
  // VNĐ là zero-decimal → custom input là số nguyên trực tiếp, không nhân 100.
  const displayAmount = isCustom ? parseVNDInput(customAmount) : amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (displayAmount < 1_000) {
      toast.error("Số tiền tối thiểu là 1.000 đ");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          amountCents: displayAmount,
          streamId: streamId ?? undefined,
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Donation failed");

      toast.success(
        `Đã donate ${formatVND(displayAmount)} cho ${recipientName}! 🎉`
      );
      setMessage("");
      setCustomAmount("");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Donation failed"
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>💸</span>
            Donate cho {recipientName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preset amounts */}
          <div>
            <p className="text-sm font-medium mb-2">Chọn số tiền</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount("");
                  }}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    !isCustom && amount === preset
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {formatVND(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <p className="text-sm font-medium mb-2">Hoặc nhập số tiền khác (VNĐ)</p>
            <div className="relative">
              <Input
                type="number"
                step="1000"
                min="1000"
                max="10000000"
                placeholder="10000"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tối thiểu 1.000 đ — Tối đa 10.000.000 đ
            </p>
          </div>

          {/* Message */}
          <div>
            <p className="text-sm font-medium mb-2">Lời nhắn (tùy chọn)</p>
            <Textarea
              placeholder="Gửi lời chào đến streamer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {message.length}/500
            </p>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Tổng cộng:</span>
            <span className="text-lg font-bold text-primary">
              {displayAmount > 0 ? formatVND(displayAmount) : formatVND(0)}
            </span>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isPending || displayAmount < 1_000}
          >
            {isPending ? "Đang xử lý..." : `Donate ${displayAmount > 0 ? formatVND(displayAmount) : ""}`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Stub payment — demo mode. Không có tiền thật được chuyển.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * DonateButton — trigger button cho DonateModal.
 * Dùng cho các vị trí inline (button thường trong layout).
 */
export function DonateButton({
  recipientId,
  recipientName,
  streamId,
}: {
  recipientId: string;
  recipientName: string;
  streamId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
      >
        <span>💸</span>
        Donate
      </Button>
      <DonateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        recipientId={recipientId}
        recipientName={recipientName}
        streamId={streamId}
      />
    </>
  );
}

/**
 * StickyDonateButton — FAB (Floating Action Button) Donate.
 *
 * Vị trí: fixed bottom-right, luôn hiển thị khi user scroll.
 * Dùng cho trang public streamer — viewer dễ thấy & click donate
 * ngay cả khi đang xem live stream ở trên cùng.
 *
 * Props:
 *   - viewerIsLoggedIn: false → không hiển thị (viewer chưa login).
 *   - isSelf: true → không hiển thị (streamer không tự donate cho mình).
 *   - variant: "fab" (mặc định, big circular) | "compact" (pill).
 */
export function StickyDonateButton({
  recipientId,
  recipientName,
  streamId,
  viewerIsLoggedIn,
  isSelf = false,
  variant = "fab",
}: {
  recipientId: string;
  recipientName: string;
  streamId?: string;
  viewerIsLoggedIn: boolean;
  isSelf?: boolean;
  variant?: "fab" | "compact";
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Viewer chưa login hoặc là chính streamer → không hiển thị.
  if (!viewerIsLoggedIn || isSelf) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Donate cho ${recipientName}`}
        className={
          variant === "fab"
            ? "fixed bottom-4 right-4 z-40 h-14 px-5 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:scale-105 transition-transform flex items-center gap-2 font-semibold"
            : "fixed bottom-4 right-4 z-40 h-10 px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 text-sm font-medium"
        }
      >
        <span className="text-lg">💸</span>
        <span>{variant === "fab" ? "Donate" : "Tip"}</span>
      </button>
      <DonateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        recipientId={recipientId}
        recipientName={recipientName}
        streamId={streamId}
      />
    </>
  );
}
