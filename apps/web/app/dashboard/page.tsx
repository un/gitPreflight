import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const ok = await isAuthenticated();
  if (!ok) redirect("/sign-in");
  return <DashboardClient />;
}
