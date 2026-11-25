# PATRIOT frontend (corrected authentication)

## Run locally
1. Open this `frontend` folder in VS Code.
2. Copy `.env.example` to `.env.local`.
3. Fill in your own Supabase Project URL and **publishable/anon key** in `.env.local`. Never put a service-role key in the frontend.
4. Run `npm install`.
5. Run `npm run dev` and open the URL printed by Vite (normally http://localhost:5173).

## Authentication behavior
- Citizen registration collects name, email, phone (international country selector defaults to India/+91), and password.
- Registration uses Supabase's configured **confirmation email link** and redirects to the current app origin.
- The pending-verification screen can resend the confirmation email.
- Sign-in uses email + password and checks that Supabase reports the email as confirmed.
- No SMS OTP flow remains in the active `CitizenAuth.jsx`.

## Supabase checklist
- Authentication > Sign In / Providers > Email: email confirmations enabled.
- Authentication > URL Configuration: Site URL is `http://localhost:5173` during local development.
- Add `http://localhost:5173/**` to allowed Redirect URLs.
- Test with an inbox you can access. Supabase's default email service has delivery/rate limits; a successful UI message does not prove an email was delivered.

## Important limitations
- This package does not include `.env.local`, `node_modules`, or build output.
- Phone-number/password login is not implemented: Supabase does not let a frontend safely translate an arbitrary profile phone number into another user's email. Add a server-side/Edge Function lookup with rate limiting and generic errors before enabling that feature.
- Department authorization, report submission, and dashboard routing must be independently checked against Supabase RLS and server-side role checks before deployment.
- `src/App.backup.jsx` is an inactive backup; the active app entry is `src/App.jsx`.
