"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

export type Emote = {
  id: string;
  code: string;
  imageUrl: string;
  width: number;
  height: number;
};

type EmotePickerProps = {
  emotes: Emote[];
  onSelect: (emote: Emote) => void;
  onClose: () => void;
};

/**
 * EmotePicker — emoji picker panel cho chat.
 *
 * Features:
 *   - Search by emote code.
 *   - Click emote → insert code into chat input.
 *   - Keyboard shortcut: emoji panel button.
 *
 * Position: floating panel, attached to chat input.
 */
export function EmotePicker({ emotes, onSelect, onClose }: EmotePickerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "channel">("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter emotes.
  const filtered = emotes.filter((e) => {
    if (!search) return true;
    return e.code.toLowerCase().includes(search.toLowerCase());
  });

  // Close on outside click.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-80 rounded-xl border bg-card shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emotes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-md bg-muted text-sm outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Grid */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Không tìm thấy emote &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((emote) => (
              <button
                key={emote.id}
                type="button"
                onClick={() => onSelect(emote)}
                title={`:${emote.code}:`}
                className="group relative flex items-center justify-center p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <img
                  src={emote.imageUrl}
                  alt={emote.code}
                  width={emote.width}
                  height={emote.height}
                  className="w-7 h-7 object-contain select-none"
                  draggable={false}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block pointer-events-none">
                  <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                    :{emote.code}:
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer: emote count */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground">
        {filtered.length} emote{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
