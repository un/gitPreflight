import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { ReposClient } from "./ReposClient";

export default async function ReposPage() {
  const ok = await isAuthenticated();
  if (!ok) redirect("/sign-in");
  return <ReposClient />;
}
