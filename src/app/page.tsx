import { WorkspaceApp } from "@/components/WorkspaceApp";

export const metadata = {
  title: "misslie command — Modernized & Re-Engineered",
  description: "Re-engineered with REA Studio (Reverse Engineer Anything v6.5.0)"
};

export default function Page() {
  return (
    <main className="main-wrapper">
      <WorkspaceApp />
    </main>
  );
}
