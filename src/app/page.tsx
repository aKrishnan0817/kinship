import { loadGraph } from "./actions";
import { FamilyApp } from "@/components/FamilyApp";
import { gateDisabled } from "@/lib/auth-token";

export const dynamic = "force-dynamic";

export default async function Home() {
  const graph = await loadGraph();
  return <FamilyApp initialGraph={graph} showSignOut={!gateDisabled()} />;
}
