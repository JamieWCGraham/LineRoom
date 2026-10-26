export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const [{ startLangfuseOtel }, { startPostHogLogs }] = await Promise.all([
    import("./lib/langfuse-server"),
    import("./lib/posthog-logs"),
  ]);
  startLangfuseOtel();
  startPostHogLogs();
}
