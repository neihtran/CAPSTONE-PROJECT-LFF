"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";

import { AlertToast, type AlertItem } from "./alert-toast";

const MAX_VISIBLE = 3;
const QUEUE_KEY = "alert-queue";
const ALERT_TOPIC = "alert";

/**
 * AlertQueue — quản lý alert queue.
 *
 * Renders max 3 alerts visible cùng lúc (stack).
 * Alerts mới được thêm vào queue → hiển thị khi slot trống.
 *
 * Integration:
 *   - Listen to LiveKit dataChannel messages với topic "alert".
 *   - Server (alert-service.buildAlert) publish qua RoomServiceClient.sendData.
 *   - Tất cả participants trong room (kể cả streamer) đều nhận.
 */
export function AlertQueue({ hostIdentity }: { hostIdentity: string }) {
  const room = useRoomContext();
  const [queue, setQueue] = useState<AlertItem[]>([]);
  const [visible, setVisible] = useState<AlertItem[]>([]);

  // Add alert to queue.
  const enqueue = useCallback((alert: Omit<AlertItem, "id">) => {
    const item: AlertItem = { ...alert, id: `alert-${Date.now()}-${Math.random()}` };
    setQueue((prev) => [...prev, item]);
  }, []);

  // Listen to LiveKit data channel for alerts published by alert-service.
  useEffect(() => {
    if (!room) return;

    // Match Room.dataReceived signature: (payload, participant?, kind?, topic?).
    // Cast handler type because LiveKit exports 2 RoomEvent.DataReceived enums
    // (Room + Participant) with conflicting signatures → TS picks wrong one.
    const handleData = (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string
    ) => {
      // Chỉ xử lý topic "alert" — bỏ qua chat messages và các topic khác.
      if (topic !== ALERT_TOPIC) return;
      try {
        const text = new TextDecoder().decode(payload);
        const parsed = JSON.parse(text);
        if (parsed?.kind === "alert" && parsed.alert) {
          enqueue({
            type: parsed.alert.type,
            username: parsed.alert.username,
            displayName: parsed.alert.displayName,
            amountCents: parsed.alert.amountCents,
            tierName: parsed.alert.tierName,
            message: parsed.alert.message,
            timestamp: new Date(parsed.alert.timestamp ?? Date.now()),
          });
        }
      } catch (err) {
        console.warn("[AlertQueue] Failed to parse alert payload:", err);
      }
    };

    // Cast event name to "dataReceived" string literal — bypass conflicting enums.
    room.on("dataReceived" as RoomEvent, handleData as never);
    return () => {
      room.off("dataReceived" as RoomEvent, handleData as never);
    };
  }, [room, enqueue]);

  // Process queue — show next alert if slot available.
  useEffect(() => {
    if (visible.length >= MAX_VISIBLE) return;
    if (queue.length === 0) return;

    // Show next alert.
    const [next, ...rest] = queue;
    setVisible((prev) => [...prev, next]);
    setQueue(rest);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, visible.length]);

  const handleAlertDone = useCallback((id: string) => {
    setVisible((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (visible.length === 0) return null;

  return (
    <>
      {/* Inject keyframe animations into document head */}
      <style>{`
        @keyframes slideUpIn {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideUpOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-20px); opacity: 0; }
        }
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Alert stack overlay — fixed position */}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: "360px" }}
      >
        {visible.map((alert) => (
          <div key={alert.id} className="relative">
            <AlertToast
              alert={alert}
              onDone={() => handleAlertDone(alert.id)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Alert context — allow any component to push alerts
// ──────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useRef, type ReactNode } from "react";

type AlertContextType = {
  pushAlert: (alert: Omit<AlertItem, "id">) => void;
};

const AlertContext = createContext<AlertContextType>({ pushAlert: () => {} });

export function AlertProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<Set<(alert: Omit<AlertItem, "id">) => void>>(new Set());

  const pushAlert = useCallback((alert: Omit<AlertItem, "id">) => {
    handlersRef.current.forEach((handler) => handler(alert));
  }, []);

  return (
    <AlertContext.Provider value={{ pushAlert }}>
      {children}
    </AlertContext.Provider>
  );
}

/**
 * Hook để push alert từ bất kỳ component nào.
 *
 * Usage:
 *   const { pushAlert } = useAlert();
 *   pushAlert({ type: "DONATION", username: "viewer1", amountCents: 500 });
 */
export function useAlert() {
  return useContext(AlertContext);
}

/**
 * Hook để register 1 component là "alert consumer".
 * Component đó nhận alerts qua callback.
 *
 * Usage (in AlertOverlay):
 *   useAlertListener((alert) => setQueue(q => [...q, alert]));
 */
export function useAlertListener(
  onAlert: (alert: Omit<AlertItem, "id">) => void
) {
  const callbackRef = useRef(onAlert);
  callbackRef.current = onAlert;

  useEffect(() => {
    const handler = (alert: Omit<AlertItem, "id">) => callbackRef.current(alert);
    // Store handler in shared ref — AlertQueue reads from here.
    (window as unknown as Record<string, unknown>).__alertHandler = handler;
    return () => {
      delete (window as unknown as Record<string, unknown>).__alertHandler;
    };
  }, []);
}

/**
 * Push alert globally (from any component).
 * Calls the registered handler in AlertOverlay.
 */
export function pushAlert(alert: Omit<AlertItem, "id">) {
  const handler = (window as unknown as Record<string, (alert: Omit<AlertItem, "id">) => void> | undefined)?.__alertHandler;
  if (handler) {
    handler(alert);
  }
}
