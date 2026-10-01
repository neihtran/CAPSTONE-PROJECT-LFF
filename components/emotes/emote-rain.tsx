"use client";

import React, { useEffect, useRef, useState } from "react";

type EmoteItem = {
  code: string;
  imageUrl: string;
  count: number;
  id: string;
};

type EmoteRainProps = {
  trigger?: EmoteItem | null;
  onDone?: () => void;
};

/**
 * EmoteRain — animated emote rain overlay.
 *
 * Trigger khi có donation/sub với emote mention.
 * Các emote bay ngang màn hình với animation.
 *
 * Usage:
 *   <EmoteRain trigger={{ code: "pog", imageUrl: "...", count: 5 }} />
 */
export function EmoteRain({ trigger, onDone }: EmoteRainProps) {
  const [emotes, setEmotes] = useState<Array<EmoteItem & { x: number; delay: number; key: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger) return;

    // Spawn N emotes based on count.
    const items: Array<EmoteItem & { x: number; delay: number; key: string }> = [];
    const count = Math.min(trigger.count, 10); // cap at 10 per trigger

    for (let i = 0; i < count; i++) {
      items.push({
        ...trigger,
        x: 20 + Math.random() * 60, // % from left
        delay: i * 150, // stagger
        key: `${trigger.id}-${i}-${Date.now()}`,
      });
    }

    setEmotes(items);

    // Clean up after animation.
    const timeout = setTimeout(() => {
      setEmotes([]);
      onDone?.();
    }, 4000 + count * 150);

    return () => clearTimeout(timeout);
  }, [trigger, onDone]);

  if (emotes.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[95] overflow-hidden"
      aria-hidden="true"
    >
      {emotes.map((emote) => (
        <img
          key={emote.key}
          src={emote.imageUrl}
          alt={emote.code}
          className="absolute object-contain select-none"
          style={{
            left: `${emote.x}%`,
            top: "-80px",
            width: "64px",
            height: "64px",
            animation: `emoteRain 4s ease-in forwards`,
            animationDelay: `${emote.delay}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes emoteRain {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.5);
            opacity: 0;
          }
          10% {
            transform: translateY(10vh) rotate(15deg) scale(1.2);
            opacity: 1;
          }
          30% {
            transform: translateY(30vh) rotate(-10deg) scale(1);
          }
          60% {
            transform: translateY(60vh) rotate(5deg) scale(0.9);
          }
          90% {
            transform: translateY(85vh) rotate(-5deg) scale(0.8);
            opacity: 0.5;
          }
          100% {
            transform: translateY(100vh) rotate(0deg) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
