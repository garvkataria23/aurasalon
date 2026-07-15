import { Capacitor } from "@capacitor/core";

export const environment = {
  production: true,
  apiBaseUrl: Capacitor.isNativePlatform() ? "http://192.168.1.102:4000/api/v1" : "/api/v1",
  customerAppUrl: "/"
};
