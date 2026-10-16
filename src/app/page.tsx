import { CinderSkyGame } from "@/components/CinderSkyGame";

export const metadata = {
  title: "Cinder Sky — Single-Screen Arcade Defense Game",
  description: "Meteor shards rain onto a mountain valley. Defend six alpine settlements with flak bursts, chain reactions, and workshop upgrades."
};

export default function Page() {
  return (
    <main className="w-full min-h-screen bg-[#050711]">
      <CinderSkyGame />
    </main>
  );
}
