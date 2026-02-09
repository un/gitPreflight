import { NextResponse } from "next/server";
import { fetchAuthMutation, fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@gitpreflight/convex";
import { getResendClient, getResendFromEmail } from "@/lib/resend";
import { WelcomeEmail } from "@/emails/WelcomeEmail";

export const runtime = "nodejs";
const LAUNCH_AUDIENCE_ID = "b7b56724-8185-470d-a004-3992b17403f1";

export async function POST(request: Request) {
  void request;
  const ok = await isAuthenticated();
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const identity = await fetchAuthQuery(api.auth.getCurrentUser, {} as any);
  const email = identity?.email;
  if (!email) return NextResponse.json({ ok: true, skipped: true });

  const resend = getResendClient();
  const from = getResendFromEmail();

  const waitlistAlreadyAdded = await fetchAuthQuery(api.emailEvents.hasSent, { type: "launch_waitlist" });
  let waitlistAdded = waitlistAlreadyAdded;

  if (!waitlistAlreadyAdded && resend) {
    try {
      await (resend as any).contacts.create({
        audienceId: LAUNCH_AUDIENCE_ID,
        email,
        firstName: identity?.name ?? undefined
      });
      waitlistAdded = true;
      await fetchAuthMutation(api.emailEvents.markSent, { type: "launch_waitlist" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already\s*exists|conflict|409/i.test(msg)) {
        waitlistAdded = true;
        await fetchAuthMutation(api.emailEvents.markSent, { type: "launch_waitlist" });
      }
    }
  }

  const alreadyWelcome = await fetchAuthQuery(api.emailEvents.hasSent, { type: "welcome" });
  if (alreadyWelcome) {
    return NextResponse.json({ ok: true, skipped: true, waitlistAdded });
  }

  if (!resend || !from) {
    return NextResponse.json({ ok: true, emailed: false, waitlistAdded });
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Welcome to GitPreflight",
    react: WelcomeEmail({ name: identity?.name })
  });

  await fetchAuthMutation(api.emailEvents.markSent, { type: "welcome" });
  return NextResponse.json({ ok: true, emailed: true, waitlistAdded });
}
