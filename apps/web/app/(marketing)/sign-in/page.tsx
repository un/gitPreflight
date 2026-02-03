import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import SignInClient from "./SignInClient";

export default async function SignInPage() {
  const ok = await isAuthenticated();
  if (ok) redirect("/dashboard");
  return <SignInClient />;
}
