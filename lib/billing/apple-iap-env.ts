import fs from "node:fs";
import path from "node:path";
import { Environment } from "@apple/app-store-server-library";

export function getAppleBundleId(): string {
  return process.env.APPLE_BUNDLE_ID?.trim() || "com.phasespace.lineroom";
}

export function getIosIapProductId(): string | null {
  const a = process.env.IOS_IAP_PRODUCT_ID?.trim();
  const b = process.env.NEXT_PUBLIC_IOS_IAP_PRODUCT_ID?.trim();
  return a || b || null;
}

export function getAppleAppStoreNumericId(): number | undefined {
  const raw = process.env.APPLE_APP_STORE_APP_ID?.trim();
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function getAppleIapVerifierEnvironment(): Environment {
  const raw = process.env.APPLE_IAP_ENVIRONMENT?.trim().toLowerCase();
  if (raw === "sandbox") return Environment.SANDBOX;
  return Environment.PRODUCTION;
}

export function loadAppleRootCertificates(): Buffer[] {
  const dir = path.join(process.cwd(), "certs", "apple");
  const names = ["AppleRootCA-G3.cer", "AppleIncRootCertificate.cer"];
  const buffers: Buffer[] = [];
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) buffers.push(fs.readFileSync(p));
  }
  return buffers;
}
