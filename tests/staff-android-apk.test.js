import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff app is wired as an Android APK with native FCM", () => {
  const capacitor = read("staff-app/capacitor.config.ts");
  const manifest = read("staff-app/android/app/src/main/AndroidManifest.xml");
  const gradle = read("staff-app/android/app/build.gradle");
  const push = read("staff-app/src/app/core/staff-push.service.ts");

  assert.match(capacitor, /appId: "com\.aura\.staff"/);
  assert.match(gradle, /applicationId "com\.aura\.staff"/);
  assert.match(gradle, /com\.google\.gms\.google-services/);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(push, /PushNotifications\.requestPermissions/);
  assert.match(push, /pushProvider: "fcm"/);
  assert.match(push, /pushNotificationActionPerformed/);
});
