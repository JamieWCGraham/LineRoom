import { LineRoomEditor } from "@/components/LineRoomEditor";
import { GuestSessionGate } from "@/components/auth/guest-session-gate";

export default function LineRoomLocalPage() {
  return (
    <GuestSessionGate>
      <LineRoomEditor mode="local" />
    </GuestSessionGate>
  );
}
