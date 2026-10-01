"use client";

import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";

import { stringToColor } from "@/lib/utils";
import { ChatMessageContextMenu } from "./chat-message-context-menu";
import { TimeoutDialog } from "./timeout-dialog";
import { useChatModeration } from "./chat-moderation-context";
import type { ChatItem } from "./chat-list";

/**
 * ChatMessage — render 1 message với optional moderation actions.
 *
 * Khi user là moderator/owner của stream:
 *   - Hover message → hiện toolbar với 3 nút: Timeout, Ban, Delete.
 *   - Click "Report" nếu không phải mod → mở dialog report.
 *
 * Ẩn toolbar trên message của chính mình (mod không thể mod chính mình).
 */
export function ChatMessage({ data }: { data: ChatItem }) {
  const color = stringToColor(data.from?.name || "");
  const mod = useChatModeration();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [menuSide, setMenuSide] = useState<"bottom" | "top">("bottom");
  const msgRef = useRef<HTMLDivElement>(null);

  // Auto-flip menu when near viewport bottom.
  useEffect(() => {
    if (!showContextMenu || !msgRef.current) return;
    const el = msgRef.current;
    const rect = el.getBoundingClientRect();
    const menuHeight = 160; // approximate menu height
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuSide(spaceBelow < menuHeight ? "top" : "bottom");
  }, [showContextMenu]);

  // Identity từ LiveKit = userId (custom rule ở chat server).
  // Chỉ show mod tools nếu: có streamId + là mod + KHÔNG phải message của chính mình.
  const isOwnMessage =
    mod.currentUserId && data.from?.identity === mod.currentUserId;

  const showModTools = mod.isModerator && !isOwnMessage && !!mod.streamId;

  // DB history messages có id (messageId từ DB). Live messages không có id.
  const hasId = !!data.id;
  const isLive = hasId && (data.id ?? "").startsWith("live-");
  const messageId = hasId && !isLive ? (data.id ?? null) : null;
  const targetUserId = data.from?.identity ?? "";
  const targetUsername = data.from?.name ?? "Unknown";

  return (
    <>
      <div
        ref={msgRef}
        className="group flex gap-2 p-2 rounded-md hover:bg-white/5 relative"
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(true);
        }}
      >
        <p className="text-sm text-white/40">
          {format(data.timestamp, "HH:MM")}
        </p>
        <div className="flex flex-wrap items-baseline gap-1 grow">
          <p className="text-sm font-semibold whitespace-nowrap">
            <span className="truncate" style={{ color: color }}>
              {data.from?.name}
            </span>
            :
          </p>
          <p className="text-sm break-all">
            <EmoteText message={data.message} />
          </p>
        </div>

        {/* Mod toolbar - show on hover. */}
        {(showModTools || mod.currentUserId) && (
          <div
            className={`absolute right-2 top-1/2 -translate-y-1/2 ${
              showContextMenu
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            } transition-opacity`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(!showContextMenu);
              }}
              className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
              aria-label="Mở menu moderation"
            >
              ⋯
            </button>
          </div>
        )}
      </div>

      {/* Context menu popover. */}
      {showContextMenu && (
        <ChatMessageContextMenu
          messageId={messageId}
          targetUserId={targetUserId}
          targetUsername={targetUsername}
          streamId={mod.streamId}
          isMod={showModTools}
          isLive={isLive}
          reporterUserId={mod.currentUserId}
          onClose={() => setShowContextMenu(false)}
          onTimeout={() => {
            setShowContextMenu(false);
            setShowTimeoutDialog(true);
          }}
          menuSide={menuSide}
        />
      )}

      {/* Timeout dialog. */}
      {showTimeoutDialog && mod.streamId && (
        <TimeoutDialog
          streamId={mod.streamId}
          targetUserId={targetUserId}
          targetUsername={targetUsername}
          onClose={() => setShowTimeoutDialog(false)}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// EmoteText — renders message text with emote codes as images.
//
// Shortcode format: :KEKW:, :pog:, :ha:
// Matches word boundaries — won't match inside words.
// ──────────────────────────────────────────────────────────────────────────

// Global emote registry (client-side).
// In a real app this would be fetched from API and cached.
// For MVP: render emoji-like shortcodes as text.
const KNOWN_EMOTES: Record<string, string> = {
  // These are text representations — real images come from DB emote table.
  kekl: "😂",
  kekw: "😂",
  pog: "🤯",
  pogchamp: "🤯",
  ha: "😂",
  omegalul: "😭",
  lul: "😂",
  weirdchamp: "🥴",
  peepohappy: "😊",
  peeposad: "😢",
  peepolove: "🥰",
  based: "🧠",
  coomer: "🥴",
  // Fallback: anything starting with : and ending with : renders as-is
};

/**
 * Render message text with :code: shortcodes as images.
 * For MVP: we don't have global emotes loaded yet (they'd come from API).
 * This is a placeholder that renders emoji representations.
 */
function EmoteText({ message }: { message: string }) {
  // Split message by emote shortcode pattern.
  // Format: :code: (colon-wrapped word).
  const parts = message.split(/(:[\w]+:)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith(":") && part.endsWith(":")) {
          const code = part.slice(1, -1).toLowerCase();
          const emoji = KNOWN_EMOTES[code];
          if (emoji) {
            return (
              <span key={i} className="inline-flex items-center" title={code}>
                {emoji}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
