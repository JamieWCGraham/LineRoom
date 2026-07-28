/**
 * Operator tool: delete a LineRoom user and associated data.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, and
 * STRIPE_SECRET_KEY when Stripe cleanup applies.
 *
 * Usage:
 *   npx tsx scripts/delete-user.ts --user-id <uuid> --confirm
 *   npx tsx scripts/delete-user.ts --email user@example.com --confirm
 *   npx tsx scripts/delete-user.ts --email user@example.com --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  deleteUserAndData,
  previewUserDeletion,
  resolveUserByEmailOrId,
} from "../lib/account/deleteUserData";

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/delete-user.ts --user-id <uuid> [--dry-run | --confirm]
  npx tsx scripts/delete-user.ts --email <email> [--dry-run | --confirm]

  --dry-run   Print what would be deleted (no mutations)
  --confirm   Required to execute deletion`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let userId: string | undefined;
  let email: string | undefined;
  let dryRun = false;
  let confirm = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--user-id") {
      userId = argv[++i];
    } else if (arg === "--email") {
      email = argv[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--confirm") {
      confirm = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    }
  }

  if (!userId && !email) usage();
  if (userId && email) {
    console.error("Pass only one of --user-id or --email.");
    process.exit(1);
  }
  if (dryRun && confirm) {
    console.error("Pass only one of --dry-run or --confirm.");
    process.exit(1);
  }
  if (!dryRun && !confirm) {
    console.error("Pass --dry-run or --confirm.");
    process.exit(1);
  }

  return { userId, email, dryRun, confirm };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const { userId, email, dryRun, confirm } = parseArgs(process.argv.slice(2));
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await resolveUserByEmailOrId(admin, { userId, email });
  if (!user) {
    console.error("User not found.");
    process.exit(1);
  }

  const preview = await previewUserDeletion(admin, user);
  console.log(JSON.stringify(preview, null, 2));

  if (dryRun) {
    console.log("\nDry run only — no changes made.");
    return;
  }

  if (
    preview.billingProvider === "app_store" &&
    preview.subscriptionStatus &&
    ["active", "trialing"].includes(preview.subscriptionStatus)
  ) {
    console.warn(
      "\nWarning: user may have an active App Store subscription. " +
        "Deletion will not cancel it in iOS Settings.",
    );
  }

  const result = await deleteUserAndData(admin, {
    userId: user.id,
    userEmail: user.email,
    acknowledgeAppStoreSub: true,
  });

  if (!result.ok) {
    console.error("Delete failed:", result.error);
    process.exit(1);
  }

  console.log("\nUser deleted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
