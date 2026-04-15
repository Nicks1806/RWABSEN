// Client-side push notification helpers

import { supabase } from "./supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushPermissionStatus(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!(await isPushSupported())) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(employeeId: string): Promise<boolean> {
  if (!(await isPushSupported())) {
    throw new Error("Push notifications tidak didukung browser/device ini");
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi ditolak");
  }

  // Get VAPID public key
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("VAPID public key tidak tersedia");
  }

  // Get service worker registration
  const reg = await navigator.serviceWorker.ready;

  // Check existing subscription
  let subscription = await reg.pushManager.getSubscription();

  // Create new if none exists
  if (!subscription) {
    const keyArray = urlBase64ToUint8Array(publicKey);
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray.buffer as ArrayBuffer,
    });
  }

  // Save to database
  const subJson = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      employee_id: employeeId,
      endpoint: subscription.endpoint,
      p256dh: subJson.keys?.p256dh || "",
      auth: subJson.keys?.auth || "",
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Failed to save subscription:", error);
    throw new Error("Gagal menyimpan subscription");
  }

  return true;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!(await isPushSupported())) return false;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  }
  return false;
}
