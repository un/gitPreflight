import { Resend } from "resend";

export function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function getResendFromEmail() {
  return process.env.RESEND_FROM_EMAIL;
}
