"use client";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

function DailyReminderPreference() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      Promise.resolve().then(() => {
        setIsSupported(false);
        setMessage("Notifikasi push tidak didukung di browser ini.");
      });
      return;
    }
    Promise.resolve().then(() => setIsSupported(true));
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.pushManager.getSubscription().then((subscription) => {
        setIsEnabled(Boolean(subscription));
      });
    });
  }, []);

  async function enableReminder() {
    if (!vapidPublicKey) {
      setMessage("Notifikasi push belum dikonfigurasi.");
      return;
    }
    setIsBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Izin notifikasi tidak diberikan.");
        return;
      }
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        throw new Error("Failed to save notification subscription");
      }
      setIsEnabled(true);
      setMessage("Aktif jam 20:00 WIB");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengaktifkan pengingat.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disableReminder() {
    setIsBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsEnabled(false);
      setMessage("Pengingat dimatikan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mematikan pengingat.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (message && !isBusy) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message, isBusy])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Pengingat harian</span>
        {message && !isBusy && (
          <span className="text-xs text-muted-foreground">{message}</span>
        )}
      </div>
      <Switch
        checked={isEnabled}
        disabled={!isSupported || isBusy}
        onCheckedChange={(checked) => {
          if (checked) {
            enableReminder()
          } else {
            disableReminder()
          }
        }}
      />
    </div>
  );
}

export { DailyReminderPreference }
