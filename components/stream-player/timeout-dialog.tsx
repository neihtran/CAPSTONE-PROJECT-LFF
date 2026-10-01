"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeoutUserAction } from "@/actions/moderation";

const PRESET_DURATIONS = [
  { label: "1 phút", minutes: 1 },
  { label: "5 phút", minutes: 5 },
  { label: "10 phút", minutes: 10 },
  { label: "30 phút", minutes: 30 },
  { label: "1 giờ", minutes: 60 },
  { label: "1 ngày", minutes: 1440 },
];

/**
 * TimeoutDialog — modal chọn thời gian timeout rồi gọi server action.
 */
export function TimeoutDialog({
  streamId,
  targetUserId,
  targetUsername,
  onClose,
}: {
  streamId: string;
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
}) {
  const [duration, setDuration] = useState(10);
  const [customMinutes, setCustomMinutes] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const minutes = customMinutes ? parseInt(customMinutes, 10) : duration;
    if (!minutes || minutes < 1 || minutes > 10080) {
      toast.error("Thời gian không hợp lệ (1-10080 phút)");
      return;
    }

    startTransition(async () => {
      try {
        await timeoutUserAction({
          streamId,
          targetUserId,
          durationMinutes: minutes,
          reason: "Vi phạm quy định chat",
        });
        toast.success(`Đã timeout @${targetUsername} trong ${minutes} phút`);
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể timeout user"
        );
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border rounded-xl shadow-2xl w-full max-w-sm mx-4 space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Timeout @{targetUsername}</h2>
          <p className="text-sm text-muted-foreground">
            Chọn thời gian cấm chat tạm thời.
          </p>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-3 gap-2">
          {PRESET_DURATIONS.map((d) => (
            <button
              key={d.minutes}
              type="button"
              onClick={() => {
                setDuration(d.minutes);
                setCustomMinutes("");
              }}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium border transition-colors",
                customMinutes === "" && duration === d.minutes
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-muted/70 border-border"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={10080}
            placeholder="Tùy chỉnh..."
            value={customMinutes}
            onChange={(e) => {
              setCustomMinutes(e.target.value);
            }}
            onFocus={() => setDuration(0)}
            className="flex-1 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">phút</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-md bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? "Đang timeout..." : "Timeout"}
          </button>
        </div>
      </div>
    </div>
  );
}
