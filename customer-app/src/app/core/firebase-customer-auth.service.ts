import { Injectable } from "@angular/core";
import type { FirebaseApp } from "firebase/app";
import type { Auth, ConfirmationResult, RecaptchaVerifier, User } from "firebase/auth";
import { environment } from "../../environments/environment";

const EXPECTED_FIREBASE_PROJECT_ID = "aurashineclient";
export const APPLE_LOGIN_ENABLED = false;

@Injectable({ providedIn: "root" })
export class FirebaseCustomerAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private recaptcha: RecaptchaVerifier | null = null;
  private confirmation: ConfirmationResult | null = null;

  isConfigured(): boolean {
    const config = environment.firebase;
    return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  }

  projectId(): string {
    return String(this.app?.options?.projectId || environment.firebase.projectId || "");
  }

  appId(): string {
    return String(this.app?.options?.appId || environment.firebase.appId || "");
  }

  authDomain(): string {
    return String(this.app?.options?.authDomain || environment.firebase.authDomain || "");
  }

  async signInWithGoogle(): Promise<User> {
    const auth = await this.requireAuth();
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    return result.user;
  }

  async signInWithApple(): Promise<User> {
    if (!APPLE_LOGIN_ENABLED) throw new Error("Apple Sign-In is temporarily disabled.");
    const auth = await this.requireAuth();
    const { OAuthProvider, signInWithPopup } = await import("firebase/auth");
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await this.assertProviderEnabled("apple.com");
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }

  async signInWithFacebook(): Promise<User> {
    const auth = await this.requireAuth();
    const { FacebookAuthProvider, signInWithPopup } = await import("firebase/auth");
    const provider = new FacebookAuthProvider();
    provider.addScope("email");
    provider.addScope("public_profile");
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const auth = await this.requireAuth();
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    return (await signInWithEmailAndPassword(auth, email, password)).user;
  }

  async createWithEmail(email: string, password: string): Promise<User> {
    const auth = await this.requireAuth();
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    return (await createUserWithEmailAndPassword(auth, email, password)).user;
  }

  async updateDisplayName(user: User, name: string): Promise<User> {
    const { updateProfile } = await import("firebase/auth");
    if (name.trim()) await updateProfile(user, { displayName: name.trim() });
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const auth = await this.requireAuth();
    if (!auth.currentUser?.email) throw new Error("Password changes are available for email accounts only.");
    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }

  async updatePasswordAfterVerification(newPassword: string): Promise<void> {
    const auth = await this.requireAuth();
    if (!auth.currentUser?.email) throw new Error("Password changes are available for email accounts only.");
    const { updatePassword } = await import("firebase/auth");
    await updatePassword(auth.currentUser, newPassword);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const auth = await this.requireAuth();
    const { sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(auth, email.trim());
  }

  async deleteCurrentUser(currentPassword = ""): Promise<void> {
    const auth = await this.requireAuth();
    if (!auth.currentUser) return;
    if (auth.currentUser.email && currentPassword) {
      const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
    }
    const { deleteUser } = await import("firebase/auth");
    await deleteUser(auth.currentUser);
  }

  hasEmailPasswordUser(): boolean {
    return Boolean(this.auth?.currentUser?.email);
  }

  biometricSupported(): boolean {
    return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
  }

  async sendPhoneOtp(phone: string, containerId: string): Promise<void> {
    const auth = await this.requireAuth();
    const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
    this.recaptcha?.clear();
    this.recaptcha = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    this.confirmation = await signInWithPhoneNumber(auth, this.normalizePhone(phone), this.recaptcha);
  }

  async verifyPhoneOtp(otp: string): Promise<User> {
    if (!this.confirmation) throw new Error("Request a new OTP before verifying.");
    const result = await this.confirmation.confirm(otp);
    this.confirmation = null;
    return result.user;
  }

  async idTokenFor(user: User): Promise<string> {
    return user.getIdToken();
  }

  async logout(): Promise<void> {
    if (!this.auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(this.auth);
  }

  friendlyMessage(error: unknown, fallback: string): string {
    const code = this.errorCode(error);
    const apiMessage = this.apiErrorMessage(error);
    if (code === "auth/popup-closed-by-user") return "Sign-in was cancelled.";
    if (code === "auth/popup-blocked") return "Allow popups for this site, then try again.";
    if (code === "auth/unauthorized-domain") return `Firebase is blocking this domain. Add ${window.location.hostname} to Authentication > Settings > Authorized domains for project ${this.projectId()}.`;
    if (code === "auth/operation-not-allowed") return `Firebase rejected this provider for project ${this.projectId()} (${this.authDomain()}, app ${this.appId()}). Enable it on this exact Firebase project and web app configuration.`;
    if (code === "auth/account-exists-with-different-credential") return "An account already exists with this email. Sign in with the original method, then link Apple from account settings.";
    if (code === "auth/invalid-phone-number") return "Enter a valid phone number with country code.";
    if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
    if (code === "auth/invalid-verification-code") return "The OTP is not correct. Please check and try again.";
    if (code === "auth/code-expired") return "The OTP has expired. Please request a new one.";
    if (code === "auth/email-already-in-use") return "This email already has an account. Sign in with the correct password.";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "Email or password is incorrect.";
    if (code === "auth/weak-password") return "Use a stronger password with at least 6 characters.";
    if (code === "auth/requires-recent-login") return "Please sign in again before changing this sensitive account setting.";
    if (code === "auth/user-mismatch") return "The current password does not match this account.";
    if (code === "auth/configuration-not-found") return "Firebase Authentication is not enabled for this app yet.";
    if (error instanceof Error && error.message.startsWith("Firebase rejected Apple Sign-In")) return error.message;
    if (apiMessage.includes("Firebase project is not configured")) return "Google sign-in reached Firebase, but the AuraSalon API is missing FIREBASE_PROJECT_ID=aurashineclient.";
    if (apiMessage) return apiMessage;
    if (error instanceof Error && error.message.includes("Firebase project is not configured")) return "Google sign-in reached Firebase, but the AuraSalon API is missing FIREBASE_PROJECT_ID=aurashineclient.";
    if (error instanceof Error && (error.message.startsWith("Http failure response") || error.message.includes("Unknown Error"))) return error.message || fallback;
    return error instanceof Error && !error.message.startsWith("Firebase:")
      ? error.message
      : fallback;
  }

  private async requireAuth(): Promise<Auth> {
    if (!this.isConfigured()) {
      throw new Error("Firebase is not configured. Add the Firebase web config in the customer app environment file.");
    }
    if (!this.auth) {
      const { initializeApp } = await import("firebase/app");
      const { getAuth } = await import("firebase/auth");
      this.app = initializeApp(environment.firebase);
      if (this.projectId() !== EXPECTED_FIREBASE_PROJECT_ID) {
        throw new Error("Customer app is connected to the wrong Firebase project. Expected AuraShineClient.");
      }
      this.auth = getAuth(this.app);
    }
    return this.auth;
  }

  private async assertProviderEnabled(providerId: "apple.com"): Promise<void> {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(environment.firebase.apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId,
        continueUri: window.location.origin,
        customParameter: {}
      })
    });
    const body = await response.json().catch(() => null);
    if (response.ok) return;
    const message = String(body?.error?.message || "");
    if (message.includes("Code flow is not enabled for Apple")) {
      throw new Error(`Firebase reached project ${this.projectId()}, but Apple OAuth code flow is not enabled for this web app. Complete the Apple provider web configuration in Firebase Authentication for ${this.authDomain()}.`);
    }
    if (message.includes("OPERATION_NOT_ALLOWED")) {
      throw new Error(`Firebase rejected Apple Sign-In for project ${this.projectId()} (${this.authDomain()}, app ${this.appId()}). Apple must be enabled on this exact Firebase API key/project.`);
    }
    if (message.includes("INVALID_PROVIDER_ID")) {
      throw new Error(`Firebase does not recognize Apple provider for project ${this.projectId()}. Check the Apple Sign-In provider setup in Firebase Authentication.`);
    }
    throw new Error(message || "Firebase could not verify Apple Sign-In provider status.");
  }

  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith("+")) return trimmed;
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
    return `+${digits}`;
  }

  private errorCode(error: unknown): string {
    return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  }

  private apiErrorMessage(error: unknown): string {
    if (!error || typeof error !== "object") return "";
    const payload = error as { error?: unknown; message?: unknown };
    if (payload.error && typeof payload.error === "object") {
      const apiError = payload.error as { error?: unknown; message?: unknown };
      if (typeof apiError.message === "string") return apiError.message;
      if (typeof apiError.error === "string") return apiError.error;
      if (apiError.error && typeof apiError.error === "object") {
        const nested = apiError.error as { message?: unknown };
        if (typeof nested.message === "string") return nested.message;
      }
    }
    return "";
  }
}
