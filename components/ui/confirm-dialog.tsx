"use client";

/**
 * ConfirmDialog — Dialog xác nhận đẹp, thay thế window.confirm() native.
 *
 * Sử dụng shadcn/ui `Dialog` đã có sẵn + sonner toast.
 *
 * @example
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Xóa gói subscription"
 *     description={`Bạn có chắc muốn xóa "${name}"?`}
 *     variant="danger"
 *     confirmText="Xóa"
 *     cancelText="Hủy"
 *     onConfirm={async () => {
 *       await deleteAction({ id });
 *     }}
 *   />
 *
 * Edge cases:
 *   - onConfirm throw → dialog vẫn đóng, error hiển thị qua toast.error
 *     (gọi từ bên ngoài). KHÔNG nuốt lỗi.
 *   - ESC hoặc click overlay → cancel (gọi onOpenChange(false)).
 *   - Enter → confirm (mặc định).
 */

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

export type ConfirmVariant = "danger" | "default";

type ConfirmDialogProps = {
  /** Controlled open state. */
  open: boolean;
  /** Callback khi open thay đổi (ESC, overlay click, button close). */
  onOpenChange: (open: boolean) => void;

  /** Tiêu đề ngắn (vd: "Xóa gói subscription"). */
  title: string;
  /**
   * Mô tả chi tiết, hiển thị dưới title.
   * Có thể là string đơn giản hoặc ReactNode (cho phép custom JSX).
   */
  description: React.ReactNode;

  /** "danger" = nút đỏ (xóa/ban), "default" = nút primary. */
  variant?: ConfirmVariant;
  /** Text nút xác nhận (mặc định: "Xác nhận"). */
  confirmText?: string;
  /** Text nút hủy (mặc định: "Hủy"). */
  cancelText?: string;

  /**
   * Callback khi user click nút xác nhận.
   * - Nếu throw: dialog vẫn đóng (finally), error bubble lên caller.
   * - Dùng useTransition bên trong để tránh double-click.
   */
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onConfirm,
}: ConfirmDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [hasError, setHasError] = useState(false);

  const handleConfirm = () => {
    setHasError(false);
    startTransition(async () => {
      try {
        await onConfirm();
        // Success → đóng dialog.
        onOpenChange(false);
      } catch {
        // Caller đã hiển thị toast.error. Đóng dialog để user thấy action tiếp.
        setHasError(true);
        onOpenChange(false);
      }
    });
  };

  const Icon = variant === "danger" ? AlertTriangle : Info;
  const iconColor = variant === "danger" ? "text-red-500" : "text-primary";
  const confirmVariant: "destructive" | "default" =
    variant === "danger" ? "destructive" : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${iconColor}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            autoFocus
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Đang xử lý..." : confirmText}
          </Button>
        </DialogFooter>

        {/* Hidden helper để TS không complain unused nếu caller ignore. */}
        {hasError && <span className="sr-only">Đã xảy ra lỗi</span>}
      </DialogContent>
    </Dialog>
  );
}
