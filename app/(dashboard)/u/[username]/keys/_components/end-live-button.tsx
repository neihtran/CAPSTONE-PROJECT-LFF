"use client";

import React, { useRef, useState, useTransition, ElementRef } from "react";
import { toast } from "sonner";
import { Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { endStream } from "@/actions/stream";

/**
 * EndLiveButton — nút "Kết thúc Live" cho Stream Dashboard.
 *
 * Luồng:
 *   1. Click → mở confirm dialog.
 *   2. Confirm → gọi server action `endStream(streamId)`.
 *      - Đóng LiveKit Room → viewers disconnect real-time.
 *      - DB update: isLive=false.
 *   3. Toast success/failure.
 *
 * Lý do cần confirm:
 *   - Hành động KHÔNG THỂ HOÀN TÁC.
 *   - Viewer đang xem sẽ bị ngắt kết nối ngay lập tức.
 *   - Streamer cần có ý định rõ ràng trước khi đóng.
 */
export function EndLiveButton({
  streamId,
  isLive,
}: {
  streamId: string;
  isLive: boolean;
}) {
  const closeRef = useRef<ElementRef<"button">>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Nếu stream không live → không hiện nút.
  if (!isLive) return null;

  const handleEnd = () => {
    startTransition(async () => {
      try {
        await endStream(streamId);
        toast.success("Đã kết thúc Live");
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể kết thúc stream"
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Power className="h-4 w-4" />
          Kết thúc Live
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Power className="h-5 w-5 text-rose-500" />
            Kết thúc phiên Live?
          </DialogTitle>
          <DialogDescription>
            Hành động này <strong>không thể hoàn tác</strong>. Tất cả viewer đang
            xem sẽ bị ngắt kết nối ngay lập tức, và bạn sẽ cần chờ LiveKit đóng
            room hoàn tất trước khi go-live lại.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose ref={closeRef} asChild>
            <Button variant="ghost" disabled={isPending}>
              Hủy
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleEnd}
            disabled={isPending}
            className="gap-2"
          >
            <Power className="h-4 w-4" />
            {isPending ? "Đang đóng..." : "Xác nhận kết thúc"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}