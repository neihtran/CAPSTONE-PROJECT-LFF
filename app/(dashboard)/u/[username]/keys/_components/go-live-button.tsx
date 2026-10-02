"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radio } from "lucide-react";

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
import { goLiveManually } from "@/actions/stream";

/**
 * GoLiveButton — nút "Bắt đầu Live" cho Stream Dashboard.
 *
 * Luồng:
 *   1. Click → mở confirm dialog.
 *   2. Confirm → gọi server action `goLiveManually(streamId)`.
 *      - Set isLive=true trên DB.
 *      - Tạo StreamSession mới (nếu chưa có open session).
 *      - Notify followers qua notificationService.
 *   3. Toast success/failure + router.refresh().
 *
 * Luật hiển thị (file keys/page.tsx):
 *   - Chỉ hiện khi `isLive === false` (đối ngẫu với EndLiveButton).
 *
 * Fix vấn đề 2 FIX-PROMPT-2.md: thêm nút "Bắt đầu Live" cạnh <EndLiveButton>.
 */
export function GoLiveButton({
  streamId,
  isLive,
}: {
  streamId: string;
  isLive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Nếu stream đang LIVE → không hiện nút (EndLiveButton sẽ lo).
  if (isLive) return null;

  const handleGoLive = () => {
    startTransition(async () => {
      try {
        await goLiveManually(streamId);
        toast.success("Đã bắt đầu Live! 🔴");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể bắt đầu live"
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2 bg-green-500 hover:bg-green-600">
          <Radio className="h-4 w-4" />
          Bắt đầu Live
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-green-500" />
            Bắt đầu phiên Live?
          </DialogTitle>
          <DialogDescription>
            Hành động này sẽ đánh dấu stream là <strong>LIVE</strong> và gửi
            thông báo đến tất cả follower của bạn. Đảm bảo OBS (hoặc phần mềm
            live tương đương) đã bắt đầu đẩy stream lên server URL với stream
            key hiện tại.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Hủy
            </Button>
          </DialogClose>
          <Button
            onClick={handleGoLive}
            disabled={isPending}
            className="gap-2 bg-green-500 hover:bg-green-600"
          >
            <Radio className="h-4 w-4" />
            {isPending ? "Đang bắt đầu..." : "Xác nhận bắt đầu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}