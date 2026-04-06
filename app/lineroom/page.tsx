import { LineRoomEditor } from "@/components/LineRoomEditor";
import { requireAuthUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function LineRoomLocalPage() {
  const supabase = await createClient();
  await requireAuthUser(supabase);
  return <LineRoomEditor mode="local" />;
}
