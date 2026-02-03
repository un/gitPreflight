# S035 Manual QA (Logged Out)

Goal: validate marketing UX while logged out.

## What I checked

Started `next dev` for `apps/web` and made unauthenticated HTTP requests (no cookies).

- GET `/` -> 200
- GET `/sign-in` -> 200
- GET `/device` -> 200
- GET `/dashboard` -> 307 (redirect expected when logged out)

## Notes

- This does not replace a real browser pass for anchor scrolling and mobile header behavior.
