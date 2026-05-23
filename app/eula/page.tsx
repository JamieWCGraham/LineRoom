import { APPLE_STANDARD_EULA_URL } from "@/lib/legal/urls";
import { redirect } from "next/navigation";

/** App Store Connect EULA field can point here; forwards to Apple’s standard EULA. */
export default function EulaRedirectPage() {
  redirect(APPLE_STANDARD_EULA_URL);
}
