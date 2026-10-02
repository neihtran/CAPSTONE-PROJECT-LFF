"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addBannedWordAction,
  removeBannedWordAction,
} from "@/actions/banned-words";

type BannedWord = {
  id: string;
  pattern: string;
  action: "REJECT" | "FILTER";
  reason: string | null;
};

/**
 * BannedWordsManager — quản lý danh sách regex/string banned của AutoMod.
 *
 * Owner thêm/xóa. Pattern có thể là plain text hoặc regex (regex phải valid).
 *
 * Action:
 *   - REJECT: block message hoàn toàn.
 *   - FILTER: mask bằng * thay vì reject (vd: "****" thay vì "shit").
 */
export function BannedWordsManager({
  streamId,
  ownerUsername,
  isOwner,
  bannedWords,
}: {
  streamId: string;
  ownerUsername: string;
  isOwner: boolean;
  bannedWords: BannedWord[];
}) {
  const [pattern, setPattern] = useState("");
  const [action, setAction] = useState<"REJECT" | "FILTER">("REJECT");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Confirm dialog state.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    pattern: string;
  } | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pattern.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        await addBannedWordAction({
          streamId,
          pattern: trimmed,
          action,
          reason: reason.trim() || undefined,
        });
        toast.success("Đã thêm banned word");
        setPattern("");
        setReason("");
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Không thể thêm banned word"
        );
      }
    });
  };

  // Mở confirm dialog thay vì window.confirm().
  const requestRemove = (id: string, pat: string) => {
    setPendingRemove({ id, pattern: pat });
    setConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemove) return;
    const { id } = pendingRemove;
    try {
      await removeBannedWordAction({ id });
      toast.success("Đã xóa");
      setPendingRemove(null);
    } catch (err) {
      setPendingRemove(null);
      throw err instanceof Error ? err : new Error("Không thể xóa");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">AutoMod — Banned Words</h3>
        <p className="text-sm text-muted-foreground">
          Pattern có thể là text thường (vd: <code>từ-bad</code>) hoặc regex
          (vd: <code>\btừ-bad\w*</code>). REJECT sẽ block message, FILTER sẽ
          mask bằng <code>***</code>.
        </p>
      </div>

      {isOwner && (
        <form onSubmit={handleAdd} className="space-y-3 border rounded-md p-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="Pattern (vd: spam-slur hoặc \\bspam\\w*)"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              disabled={isPending}
              className="md:col-span-2"
            />
            <Select
              value={action}
              onValueChange={(v) => setAction(v as "REJECT" | "FILTER")}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REJECT">REJECT (block)</SelectItem>
                <SelectItem value="FILTER">FILTER (mask)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Lý do (optional, vd: từ ngữ thô)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
          />
          <Button
            type="submit"
            disabled={isPending || !pattern.trim()}
            className="w-full"
          >
            {isPending ? "Đang thêm..." : "Thêm banned word"}
          </Button>
        </form>
      )}

      <div className="space-y-1.5">
        {bannedWords.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Chưa có banned word nào.
          </p>
        ) : (
          bannedWords.map((bw) => (
            <div
              key={bw.id}
              className="flex items-center gap-x-3 p-3 border rounded-md"
            >
              <code className="flex-1 min-w-0 font-mono text-xs bg-muted px-2 py-1 rounded truncate">
                {bw.pattern}
              </code>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium border",
                  bw.action === "REJECT"
                    ? "bg-red-500/10 text-red-600 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                )}
              >
                {bw.action}
              </span>
              {bw.reason && (
                <span className="text-xs text-muted-foreground line-clamp-1 flex-shrink max-w-32">
                  {bw.reason}
                </span>
              )}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => requestRemove(bw.id, bw.pattern)}
                  disabled={isPending}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  Xóa
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Confirm dialog thay thế window.confirm(). */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setPendingRemove(null);
        }}
        title="Xóa banned word"
        description={
          pendingRemove
            ? `Bạn có chắc muốn xóa pattern "${pendingRemove.pattern}"?`
            : ""
        }
        variant="danger"
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
