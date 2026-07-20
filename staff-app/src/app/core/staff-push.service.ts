import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { StaffAppService } from "./staff-app.service";

type PushState = "checking" | "available" | "enabled" | "blocked" | "unsupported" | "unconfigured";

@Injectable({ providedIn: "root" })
export class StaffPushService {
  readonly state = signal<PushState>("checking");
  readonly busy = signal(false);
  readonly message = signal("");

  private nativeActionListenerReady = false;

  constructor(private readonly staff: StaffAppService, private readonly router: Router) {}

  async refreshStatus(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.setupNativeActionListener();
      const permissions = await PushNotifications.checkPermissions();
      if (permissions.receive === "denied") {
        this.state.set("blocked");
        return;
      }
      if (permissions.receive !== "granted") {
        this.state.set("available");
        return;
      }
      await this.registerNativeDevice();
      this.state.set("enabled");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      this.state.set("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      this.state.set("blocked");
      return;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find((item) => item.active?.scriptURL.includes("staff-push-sw.js"));
    const subscription = await registration?.pushManager.getSubscription();
    this.state.set(subscription ? "enabled" : "available");
  }

  async enable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set("");
    try {
      if (Capacitor.isNativePlatform()) {
        await this.enableNative();
        return;
      }
      const config = await this.staff.mobilePushConfig();
      if (!config.configured || !config.publicKey) {
        this.state.set("unconfigured");
        throw new Error("Mobile push is not configured by the salon yet.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        this.state.set(permission === "denied" ? "blocked" : "available");
        throw new Error("Notification permission was not granted.");
      }
      const registration = await navigator.serviceWorker.register("/assets/staff-push-sw.js");
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.base64UrlToBytes(config.publicKey)
      });
      const device = await this.staff.registerPushDevice(this.deviceId());
      const json = subscription.toJSON();
      await this.staff.registerPushSubscription({
        deviceId: device.id,
        endpoint: subscription.endpoint,
        platform: "web",
        provider: "web-push",
        authSecret: json.keys?.["auth"] || "",
        p256dh: json.keys?.["p256dh"] || "",
        metadata: { staffApp: true, userAgent: navigator.userAgent }
      });
      this.state.set("enabled");
      this.message.set("Mobile notifications enabled on this device.");
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : "Mobile notifications could not be enabled.");
    } finally {
      this.busy.set(false);
    }
  }

  label(): string {
    return ({
      checking: "Checking mobile notifications...",
      available: "Get alerts even when the staff app is closed.",
      enabled: "Mobile notifications are enabled on this device.",
      blocked: "Notifications are blocked in this browser's settings.",
      unsupported: "This browser does not support mobile notifications.",
      unconfigured: "Mobile push needs salon setup before it can be enabled."
    } as const)[this.state()];
  }

  private deviceId(): string {
    const key = "aura.staff.pushDeviceId";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = `staff_push_${crypto.randomUUID()}`;
    localStorage.setItem(key, created);
    return created;
  }

  private async enableNative(): Promise<void> {
    await this.setupNativeActionListener();
    const permissions = await PushNotifications.requestPermissions();
    if (permissions.receive !== "granted") {
      this.state.set("blocked");
      throw new Error("Notification permission was not granted.");
    }
    await this.registerNativeDevice();
    this.state.set("enabled");
    this.message.set("APK notifications enabled on this device.");
  }

  private async registerNativeDevice(): Promise<void> {
    const token = await new Promise<string>(async (resolve, reject) => {
      const registration = await PushNotifications.addListener("registration", async (result) => {
        await registration.remove();
        await registrationError.remove();
        resolve(result.value);
      });
      const registrationError = await PushNotifications.addListener("registrationError", async (error) => {
        await registration.remove();
        await registrationError.remove();
        reject(new Error(error.error || "FCM registration failed."));
      });
      await PushNotifications.register();
    });
    await this.staff.registerPushDevice(this.deviceId(), { platform: "android", pushProvider: "fcm", deviceToken: token });
  }

  private async setupNativeActionListener(): Promise<void> {
    if (this.nativeActionListenerReady) return;
    this.nativeActionListenerReady = true;
    await PushNotifications.createChannel({
      id: "staff_notifications",
      name: "Staff notifications",
      description: "Appointments, shifts, tasks and salon updates",
      importance: 5,
      visibility: 1,
      vibration: true
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = String(action.notification.data?.["url"] || "/staff/notifications");
      void this.router.navigateByUrl(url.startsWith("/staff/") ? url : "/staff/notifications");
    });
  }

  private base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
}
