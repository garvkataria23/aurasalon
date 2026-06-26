import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../config/env.js";
import { unauthorized } from "../utils/app-error.js";

const APP_NAME = "aura-customer-auth";

function serviceAccountFromJson() {
  if (!env.firebaseServiceAccountJson) return null;
  try {
    const parsed = JSON.parse(env.firebaseServiceAccountJson);
    return {
      projectId: parsed.project_id || parsed.projectId || env.firebaseProjectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey)
    };
  } catch {
    throw unauthorized("Firebase Admin service account JSON is invalid");
  }
}

function normalizePrivateKey(value = "") {
  return String(value || "").replace(/\\n/g, "\n");
}

function firebaseCredential() {
  const jsonAccount = serviceAccountFromJson();
  if (jsonAccount?.clientEmail && jsonAccount?.privateKey) return cert(jsonAccount);
  if (env.firebaseClientEmail && env.firebasePrivateKey) {
    return cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: normalizePrivateKey(env.firebasePrivateKey)
    });
  }
  if (env.nodeEnv !== "production") return applicationDefault();
  throw unauthorized("Firebase Admin is not configured");
}

function firebaseProjectId() {
  if (env.firebaseProjectId) return env.firebaseProjectId;
  if (env.nodeEnv !== "production") return "aurashineclient";
  throw unauthorized("Firebase project is not configured");
}

function customerFirebaseApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;
  return initializeApp({
    credential: firebaseCredential(),
    projectId: firebaseProjectId()
  }, APP_NAME);
}

export async function verifyCustomerFirebaseIdToken(idToken) {
  if (!idToken) throw unauthorized("Firebase ID token is required");
  try {
    return await getAuth(customerFirebaseApp()).verifyIdToken(String(idToken), true);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code || "") : "";
    if (code === "auth/id-token-expired") throw unauthorized("Firebase token is expired");
    if (code === "auth/id-token-revoked") throw unauthorized("Firebase token has been revoked");
    if (code === "app/invalid-credential" || code === "app/invalid-app-options") throw unauthorized("Firebase Admin is not configured");
    throw unauthorized("Firebase token is invalid");
  }
}
