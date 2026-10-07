"use client";
import dynamic from "next/dynamic";
const SidequestApp = dynamic(() => import("@/components/sidequest-app"), {
  ssr: false,
  loading: () => (
    <main className="boot-screen">
      <span className="eyebrow">SIDEQUEST IRL</span>
      <h1>
        GOOD PEOPLE.
        <br />
        SMALL QUESTS.
      </h1>
      <p>Opening your field journal...</p>
    </main>
  ),
});
export default function Page() {
  return <SidequestApp />;
}
