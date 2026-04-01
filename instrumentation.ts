export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { startLangfuseOtel } = await import("./lib/langfuse-server");
  startLangfuseOtel();
}
