import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aura.staff",
  appName: "Aura Staff",
  webDir: "www/browser",
  server: {
    androidScheme: "https",
    hostname: "aurashinesalonwellness.in"
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
