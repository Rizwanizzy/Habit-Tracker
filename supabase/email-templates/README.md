# Email templates — signup + password recovery (6-digit OTP emails)

This folder holds the production-ready emails for the app's two in-app OTP flows:

- **`confirm-signup.html`** — signup confirmation email (`/verify-email`)
- **`recovery.html`** — password recovery email (`/forgot-password` → `/reset-password`)

Both templates live **in the repository only** until they are manually pasted into
the Supabase project — committing these files does **not** deploy or change any
Supabase configuration. The frontend flows work regardless of which template is
configured; see §1 and §2 for the per-template setup.

## 1. What changed in the signup flow

- Signup (`supabase.auth.signUp`) no longer tells the user to "check your email
  and click a link". When Supabase returns a user **without** a session
  (Confirm email enabled), the app navigates to **`/verify-email`** and the user
  enters the 6-digit code from the email.
- Verification uses `supabase.auth.verifyOtp({ email, token, type: 'email' })`
  and requires a real session before the app lets the user in.
- Resend uses `supabase.auth.resend({ type: 'signup', email })` with a 60-second
  client cooldown.
- **Backward compatibility:** legacy confirmation-link emails remain valid until
  they expire; existing confirmed accounts are untouched.

## 2. Email subject

Configure in Supabase Dashboard → Authentication → Emails → Templates →
**Confirm signup** → *Subject*:

```
{{ .Token }} is your Habit Tracker verification code
```

And for password recovery — Authentication → Emails → Templates →
**Reset password** → *Subject*:

```
{{ .Token }} is your Habit Tracker password recovery code
```

## 3. HTML templates

Paste the full contents of [`confirm-signup.html`](./confirm-signup.html) into
the *Message* body of the **Confirm signup** template, and
[`recovery.html`](./recovery.html) into the **Reset password** template. Both:

- use `{{ .Token }}` (the 6-digit OTP) — **not** `{{ .ConfirmationURL }}`;
- show the code large, selectable and copyable (no fake "Copy" button, no JS,
  no tracking pixels);
- state a **60-minute** expiry and tell users not to share the code;
- include the "you can ignore this email" out-of-band note;
- are table/inline-style layouts that render in Gmail, Outlook, Apple Mail and
  mobile clients; branding is a text wordmark (no remote image to break).

## 4. Supabase Dashboard configuration (staging → production)

One-time, manual steps in the **Supabase Dashboard**:

1. **Authentication → Sign In / Providers → Email**: keep *Enable Email
   provider* on and **Confirm email ON** (it already is — that's what produced
   the old confirmation link).
2. **Authentication → Emails → Templates → Confirm signup**:
   - Subject: `{{ .Token }} is your Habit Tracker verification code`
   - Body: paste `confirm-signup.html` (save the current default first if you
     want a rollback copy).
2b. **Authentication → Emails → Templates → Reset password**:
   - Subject: `{{ .Token }} is your Habit Tracker password recovery code`
   - Body: paste `recovery.html` (same rollback advice).
3. **Authentication → Settings → Email OTP expiry**: set **3600 seconds**
   (60 minutes). The template copy and the VerifyEmail/ResetPassword pages
   assume this value; if you change the expiry, update both template texts
   and `OTP_EXPIRY_MINUTES` in `src/pages/VerifyEmail.tsx` (and the "60
   minutes" line in `src/pages/ResetPassword.tsx`).
4. **Authentication → Settings → Minimum interval between emails sent**: keep
   the default **60 seconds**. The client enforces the same 60-second cooldown,
   but the server value is the real limit.
5. **Rate limits** (Authentication → Settings): leave the default email rate
   limits in place; the UI surfaces `429` / `over_email_send_rate_limit` errors
   as "Too many code requests. Wait a minute…".
6. No database or SQL changes are required for this feature.

Staging first (if a staging Supabase project exists), then the production
project. Verify by signing up with a real address you control and confirming the
code flow end-to-end, including an expired code (request a new one) and a wrong
code (error copy).

## 5. Rollout plan

| Stage | Action | Status |
| --- | --- | --- |
| 1 | App code: `/verify-email` route, OTP UI, resend, recovery | ✅ in this branch |
| 2 | Email template file + docs | ✅ in this branch (repo artifact) |
| 3 | Paste template + subject into Supabase Dashboard | ⬜ manual |
| 4 | Confirm OTP expiry = 3600 s and email interval = 60 s | ⬜ manual |
| 5 | Test signup on desktop + Android PWA + iOS PWA | ⬜ manual |
| 6 | Deploy app (Cloudflare Pages) after template is live | ⬜ manual |

Password recovery rides the same plan: paste `recovery.html` into **Reset
password**, then QA the flow (below). Recovery never needs extra Supabase
settings beyond the shared OTP expiry/interval above.

**Recovery QA (after the template is pasted):**
- Login → "Forgot password?" → enter email → generic success (no account enumeration).
- Wrong code → "That code is incorrect…"; expired/used code → expired copy; Resend honors the 60 s cooldown.
- Verified code → new + confirm password (show/hide), mismatch rejected, weak password shows the policy error.
- Success → "Password updated" → signed out → sign in with the new password works.
- Reload on `/reset-password` → resumes at the password step (sessionStorage + recovery session).
- The app is NOT opened into the dashboard mid-recovery; `/reset-password` has no session redirect.

**Deploy order matters:** paste the template **before** shipping the new app
build. With the template still configured to send links, the new app still
works (verifyOtp with a token from the link's `token_hash` won't apply, but the
user sees the generic verification screen and can resend — which then sends the
OTP template only after step 3). Cleanest: template first.

## 6. Future Resend SMTP checklist (after the custom domain is bought)

Supabase Auth stays responsible for generating, sending (via custom SMTP),
validating and expiring OTPs — no Resend API key in the frontend, no extra
Worker/database for codes.

- [ ] Buy the domain; add it to **Resend** → Domains → verify.
- [ ] Add the DNS records Resend shows (SPF `include:_spf.resend.com`, DKIM
      TXT records, optional DMARC) at the DNS provider; wait for
      "Verified" in Resend.
- [ ] Resend → API Keys: create a **SMTP** credential (Resend exposes SMTP
      credentials separately from API keys). Host `smtp.resend.com`, port
      **465** (TLS) or 587, username `resend`, password = the SMTP key.
- [ ] Supabase Dashboard → Authentication → SMTP Settings: enable **Custom
      SMTP**, sender = something like `Habit Tracker
      <no-reply@your-domain.tld>`, paste the SMTP host/port/user/password.
      **Minimum interval** 60 s. The SMTP secret stays in Supabase — never in
      `VITE_*` env vars or the repo.
- [ ] Send a test email from Supabase (or sign up with a real address) and
      confirm the sender domain is your domain, not `@supabase-mail` fallback.
- [ ] Re-check the template renders after the switch (Resend doesn't change
      template content — Supabase still injects `{{ .Token }}`).
- [ ] Update the optional logo `<img>` in `confirm-signup.html` and
      `recovery.html` to `https://<domain>/logo.png` once the domain serves it
      publicly (keep the text wordmark fallback).

## 7. Manual QA checklist

**Desktop (Chrome/Firefox/Safari):**
- Sign up with a fresh email → lands on `/verify-email`, email shown, code input focused.
- Paste code with spaces/letters around it → only digits kept; leading zeros preserved.
- Wrong code → "That code is incorrect…", input cleared, focus returned.
- Resend → button disabled with countdown for 60 s; success message only after the API succeeds.
- Reload `/verify-email` → flow resumes (sessionStorage); missing flow → recovery form.
- Old-style confirmation link (from a pre-change email) → still confirms the account.

**Android (Chrome + installed PWA):**
- OTP keyboard (`inputMode=numeric`) appears; keyboard's autofill suggestion fills the code.
- Switch PWA → email app → back: state intact, countdown not restarted.

**iOS (Safari + installed PWA):**
- SMS/OTP autofill above the keyboard fills the code (`autocomplete="one-time-code"`).
- Countdown survives backgrounding (absolute timestamp, not a ticking interval).

## 8. Known limitations

- The email template is inert until manually pasted into the Supabase project.
- The 60-second client cooldown is UX, not security — the Supabase
  server-side email rate limit is the enforcement point.
- Without custom SMTP, codes come from Supabase's built-in sender and are
  fine for staging/low volume; production volume needs the Resend SMTP step.
