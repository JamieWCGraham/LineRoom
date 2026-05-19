import { getAppBuildId } from "@/lib/navigation/appBuildId";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { buildId: getAppBuildId() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
