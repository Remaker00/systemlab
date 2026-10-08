import { SystemCanvas } from "@/components/canvas/SystemCanvas";
import { SmallScreenNotice } from "@/components/SmallScreenNotice";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <SystemCanvas />
      <SmallScreenNotice />
    </main>
  );
}
