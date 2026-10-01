import React from "react";
import { redirect } from "next/navigation";

import { getOrCreatePreferences } from "@/lib/notification-service";
import { getSelf } from "@/lib/auth-service";
import { PreferencesForm } from "@/components/notifications/preferences-form";

export const dynamic = "force-dynamic";

/**
 * /notifications/preferences — user customize notification preferences.
 */
export default async function PreferencesPage() {
  let self;
  try {
    self = await getSelf();
  } catch {
    redirect("/sign-in");
  }

  const pref = await getOrCreatePreferences(self.id);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt thông báo</h1>
        <p className="text-sm text-muted-foreground">
          Chọn những loại thông báo bạn muốn nhận.
        </p>
      </div>

      <PreferencesForm
        initialValues={{
          onFollow: pref.onFollow,
          onLive: pref.onLive,
          onClip: pref.onClip,
          onModeration: pref.onModeration,
          onSystem: pref.onSystem,
          emailEnabled: pref.emailEnabled,
        }}
      />
    </div>
  );
}
