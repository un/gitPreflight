import { isAuthenticated } from "@/lib/auth-server";
import SignInClient from "./SignInClient";

export default async function SignInPage() {
  const ok = await isAuthenticated();
  return <SignInClient alreadySignedIn={ok} />;
}
