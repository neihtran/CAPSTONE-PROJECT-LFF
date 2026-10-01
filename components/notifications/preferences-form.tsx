"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";

type PreferenceValues = {
  onFollow: boolean;
  onLive: boolean;
  onClip: boolean;
  onModeration: boolean;
  onSystem: boolean;
  emailEnabled: boolean;
};

const PREF_ITEMS: {
  key: keyof Omit<PreferenceValues, "emailEnabled">;
  label: string;
  description: string;
}[] = [
  {
    key: "onFollow",
    label: "Follow mới",
    description: "Khi có ai đó follow bạn.",
  },
  {
    key: "onLive",
    label: "Streamer bạn follow lên sóng",
    description: "Thông báo khi streamer bạn theo dõi vừa LIVE.",
  },
  {
    key: "onClip",
    label: "Clip mới từ stream của bạn",
    description: "Khi ai đó tạo clip từ stream của bạn.",
  },
  {
    key: "onModeration",
    label: "Sự kiện moderation",
    description: "Thông báo khi bạn bị timeout/ban khỏi 1 stream.",
  },
  {
    key: "onSystem",
    label: "Thông báo hệ thống",
    description: "Cập nhật tính năng, bảo trì, thông báo quan trọng.",
  },
];

export function PreferencesForm({
  initialValues,
}: {
  initialValues: PreferenceValues;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (key: keyof PreferenceValues) => {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error("Save failed");
        toast.success("Đã lưu preferences");
        setHasChanges(false);
      } catch {
        toast.error("Không thể lưu preferences");
      }
    });
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-4">
        {PREF_ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-start justify-between gap-x-4 py-3 border-b last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Switch
              checked={values[item.key]}
              onChange={() => handleToggle(item.key)}
              disabled={isPending}
            />
          </div>
        ))}

        <div className="flex items-start justify-between gap-x-4 py-3 border-b">
          <div className="flex-1 min-w-0">
            <p className="font-medium">Email notification</p>
            <p className="text-xs text-muted-foreground">
              Nhận thông báo qua email (chưa hỗ trợ SMTP ngay, chỉ lưu preference).
            </p>
          </div>
          <Switch
            checked={values.emailEnabled}
            onChange={() => handleToggle("emailEnabled")}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setValues(initialValues);
            setHasChanges(false);
          }}
          disabled={isPending || !hasChanges}
          className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </Card>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-primary" : "bg-muted"
      } disabled:opacity-50`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
