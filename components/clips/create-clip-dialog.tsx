"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClipAction } from "@/actions/clips";

/**
 * CreateClipDialog — modal tạo clip nhanh từ live stream.
 *
 * MVP: videoUrl là URL HLS của stream (sẽ trim startTime/endTime client-side).
 * Sau khi có background worker, chuyển sang upload segment thực sự.
 *
 * Flow:
 *   1. User nhập title (mặc định "Clip by @{user}").
 *   2. Default: videoUrl = stream's HLS URL, startTime=0, endTime=60.
 *   3. Submit → POST /actions/clips.
 */
export function CreateClipDialog({
  streamId,
  streamUserId,
  streamName,
  videoUrl,
  open,
  onOpenChange,
}: {
  streamId: string;
  streamUserId: string;
  streamName: string;
  videoUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(`Clip từ ${streamName}`);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(60);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }

    startTransition(async () => {
      try {
        await createClipAction({
          streamId,
          title: title.trim(),
          videoUrl,
          startTime,
          endTime,
        });
        toast.success("Đã tạo clip!");
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể tạo clip"
        );
      }
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4 space-y-4 p-6"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Tạo clip mới</h2>
          <p className="text-sm text-muted-foreground">
            Cắt 1 đoạn (5-300 giây) từ stream của{" "}
            <strong>@{streamName}</strong>.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tiêu đề</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Mô tả clip..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bắt đầu (giây)</label>
            <Input
              type="number"
              min={0}
              value={startTime}
              onChange={(e) => setStartTime(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Kết thúc (giây)</label>
            <Input
              type="number"
              min={1}
              max={startTime + 300}
              value={endTime}
              onChange={(e) => setEndTime(parseInt(e.target.value) || 60)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Độ dài: {endTime - startTime} giây (tối đa 300s)
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Đang tạo..." : "Tạo clip"}
          </Button>
        </div>
      </form>
    </div>
  );
}
