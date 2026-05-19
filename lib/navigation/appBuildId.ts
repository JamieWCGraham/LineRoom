/** Shared build id for chunk skew checks (must match `generateBuildId` in next.config). */
export function getAppBuildId(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.LINEROOM_BUILD_ID?.trim() ||
    "development"
  );
}
