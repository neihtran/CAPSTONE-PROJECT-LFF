import React from "react";

import {
  getActiveEvents,
  getCompletedEvents,
} from "@/lib/event-service";
import { EventCard } from "@/components/events/event-card";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [active, completed] = await Promise.all([
    getActiveEvents(50),
    getCompletedEvents(20),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          🎯 Community Events
        </h1>
        <p className="text-muted-foreground mt-1">
          Tham gia các sự kiện cộng đồng và giúp streamer đạt mục tiêu
        </p>
      </div>

      {/* Active events */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔥</span>
          <h2 className="text-xl font-bold">Đang diễn ra</h2>
          <span className="text-xs text-muted-foreground ml-2">
            ({active.length} sự kiện)
          </span>
        </div>

        {active.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground rounded-lg border bg-card">
            <p className="text-lg">🎯 Chưa có sự kiện nào đang diễn ra</p>
            <p className="text-sm mt-2">
              Streamer có thể tạo event mới tại dashboard
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((event) => (
              <EventCard
                key={event.id}
                event={{
                  id: event.id,
                  type: event.type,
                  title: event.title,
                  body: event.body,
                  currentValue: event.currentValue,
                  targetValue: event.targetValue,
                  rewardValueCents: event.rewardValueCents,
                  rewardDescription: event.rewardDescription,
                  endsAt: event.endsAt,
                  status: event.status,
                  streamer: event.streamer,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed events */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✅</span>
            <h2 className="text-xl font-bold">Đã hoàn thành gần đây</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completed.slice(0, 6).map((event) => (
              <EventCard
                key={event.id}
                event={{
                  id: event.id,
                  type: event.type,
                  title: event.title,
                  body: event.body,
                  currentValue: event.currentValue,
                  targetValue: event.targetValue,
                  rewardValueCents: event.rewardValueCents,
                  rewardDescription: event.rewardDescription,
                  endsAt: event.endsAt,
                  status: event.status,
                  streamer: event.streamer,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
