# ShostaBazar: A Secure Online Marketplace

ShostaBazar (শস্তা বাজার, "cheap market") is a small online marketplace built for a Cyber Security course. Users can register, sign in with two-step verification, list items for sale, search for products and place orders. Admins get a dashboard with user management, security logs and search.

The point of the project is security, so every requirement from the course brief is built in and explained below.

**Stack:** Node.js 20 · Express 5 · MySQL 8 (`mysql2`) · EJS templates · plain JavaScript and CSS (no front-end framework).

---

## Features vs. course requirements

| Requirement | How ShostaBazar implements it | Where in the code |
|---|---|---|
| Login & registration | Register with username, email, optional phone and password. Sign in with username **or** email. | `src/routes/auth.js` |
| Landing / admin dashboard with search | Public landing page; a user dashboard with product search (keyword, category, sort, pagination); an admin dashboard with user, log and product search. | `src/routes/market.js`, `src/routes/admin.js` |
| Username & password | Usernames are 3–30 characters (`[A-Za-z0-9_]`). Passwords are checked against a policy. | `src/utils/validate.js` |
| Two-factor authentication | **Every** sign-in needs a second factor: a 6-digit code sent by email (and SMS if a phone is set), **or** an authenticator app (TOTP, RFC 6238) with a QR code setup. TOTP secrets are encrypted at rest with AES-256-GCM, and a TOTP code can't be used twice. | `src/services/auth.js`, `src/routes/account.js` |
| Hashed passwords | bcrypt with a per-password salt and cost factor 12. Plain-text passwords are never stored or logged. | `src/routes/auth.js` |
| Timeout after 3 failed attempts | 3 wrong passwords **or** 2FA codes lock the account for 15 minutes, and the owner gets an email. IP-based rate limiting also slows down brute force and credential stuffing. Sessions expire after 15 minutes idle and 8 hours total. | `registerFailure()` in `src/services/auth.js`, `src/middleware/security.js` |
| Password recovery | "Forgot password" emails a random 256-bit one-time link that lasts 15 minutes. Only its SHA-256 hash is stored. The response is the same whether or not the email exists, so it can't be used to find accounts. A reset unlocks the account and signs out every session. | `/forgot`, `/reset/:token` in `src/routes/auth.js` |
| Minimum password length etc. | At least 8 characters with lowercase, uppercase, a digit and a symbol. Common passwords are rejected, and so are passwords containing the username or email name. There is a live strength meter and checklist in the browser, and the same rules are enforced again on the server. | `passwordProblems()` in `src/utils/validate.js` |
| Notify new device login (email/SMS) | Each browser gets a random signed `httpOnly` device cookie. If a sign-in comes from a device not seen before, the user gets an email (and SMS through Twilio if configured) with the device, IP and time. Users can see and remove devices on the Security page. | `checkDevice()` in `src/services/auth.js` |
| SQL injection protection | All queries use `?` placeholders through `mysql2`, and stacked queries are turned off. `ORDER BY` uses a fixed whitelist. IDs are checked with a strict regex. `LIKE` wildcards are escaped. | `src/config/db.js`, `src/routes/*.js` |
| XSS protection | EJS escapes all output with `<%= %>`. A strict Content-Security-Policy (`script-src 'self'`, no inline scripts or styles) blocks injected scripts. Session cookies are `httpOnly`. Emails escape user data. | `src/middleware/security.js`, `views/` |
| CSRF protection | A random per-session token goes in every form and is compared in constant time on every POST. Cookies are `SameSite=Strict`. Blocked attempts are logged. Logout is POST-only. | `csrfToken` / `csrfProtect` in `src/middleware/security.js` |

### Extra security measures (bonus points)

- **Session fixation protection:** the session ID is regenerated after the password step and again after 2FA.
- **Session revocation:** each user has a `session_version` number. Changing or resetting a password, disabling a user or "revoke sessions" in the admin panel signs out all of that user's other sessions.
- **User enumeration resistance:** for unknown usernames the server still runs a dummy bcrypt comparison so the timing matches, and password reset always gives the same response.
- **Access control:** admin pages are restricted by role. Ownership checks stop users from deleting someone else's listing or device (IDOR protection).
- **Business-logic safety:** the order price is always read from the database, never from the form. Buying runs in a transaction with `SELECT … FOR UPDATE` so two buyers can't both buy the last item. You can't buy your own item.
- **Security headers with Helmet:** CSP, `X-Frame-Options`/`frame-ancestors 'none'` (clickjacking), `nosniff`, Referrer-Policy, and HSTS when served over HTTPS.
- **Rate limiting:** separate limits for login, 2FA, registration, password reset and overall traffic.
- **Audit log:** logins, failures, lockouts, new devices, resets, CSRF blocks, rate-limit hits, access denials, admin actions and searches are all recorded with IP and user agent. Admins can search them.
- **Hardening:** 10 KB request body limit, `x-powered-by` removed, no stack traces shown to users, `Cache-Control: no-store` on signed-in pages, and the Docker image runs as a non-root user.
- **Secrets at rest:** OTPs and reset tokens are stored only as hashes, and TOTP seeds are AES-256-GCM encrypted.

---

## Run it locally

### Option A — Docker (easiest, no MySQL install needed)

```bash
docker compose up --build
```

Then open http://localhost:3000. The admin login is `admin` / `Ch@ngeMe-Adm1n!` (change it in `.env` or `docker-compose.yml`).

### Option B — Node + your own MySQL

1. Create the database and a user with only the privileges the app needs:
   ```sql
   CREATE DATABASE shostabazar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'shostabazar'@'localhost' IDENTIFIED BY 'a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES ON shostabazar.* TO 'shostabazar'@'localhost';
   ```
2. Configure the app and start it:
   ```bash
   cp .env.example .env      # then edit DB_PASSWORD, SESSION_SECRET, ADMIN_PASSWORD ...
   npm install
   npm run dev               # or: npm start
   ```
   Tables are created automatically on first start from `database/schema.sql`. The admin account and 10 demo products are seeded from `.env`.

### Where do the OTP codes and emails go?

If `SMTP_HOST` is empty, nothing is actually emailed. Every email and SMS (OTP codes, reset links, new-device and lockout alerts) appears at **http://localhost:3000/dev/mailbox**, which is handy for the class demo. To send real email, fill in the `SMTP_*` settings (for example Gmail with an App Password). For real SMS, fill in the `TWILIO_*` settings. **Set `DEV_MAILBOX=false` on any public deployment.**

### Automated security test

`tests/security-e2e.js` drives the running app over real HTTP and makes **65 checks**: registration and password policy, OTP 2FA, new-device alerts, lockout after 3 failures, password reset, SQL injection, XSS, CSRF, access control, buying logic, the admin panel, session revocation and TOTP replay protection. Run it against a **fresh, empty** database:

```bash
npm start        # terminal 1
npm test         # terminal 2  ->  RESULT: 65 passed, 0 failed
```

A screenshot of that output is good evidence for the report.

---

## Demo script for the presentation

1. **Register** a user. Try a weak password like `password` and see it rejected by the policy.
2. **Log in.** The 6-digit code appears in the dev mailbox. Enter it to finish signing in.
3. **New-device alert:** sign in from a different browser (or a private window). A "New device sign-in" email appears in the mailbox.
4. **Lockout:** enter a wrong password 3 times. The account locks for 15 minutes, an alert email is sent, and the admin dashboard shows "Locked accounts: 1". An admin can unlock it from **Admin → Users**.
5. **Password recovery:** use "Forgot password?", open the link from the mailbox and set a new password. Using the same link again fails.
6. **SQL injection:** type `' OR '1'='1' -- ` as the username, or `%' UNION SELECT password_hash FROM users -- ` in the search box. Nothing leaks, because the input is only ever treated as data.
7. **XSS:** search for `<script>alert(1)</script>` or list a product with that title. It shows up as plain text. Even if it got through, CSP would block it.
8. **CSRF:** in DevTools, delete the hidden `_csrf` input from a form and submit it. You get "403 Request blocked", and **Admin → Security logs** shows `CSRF_BLOCKED`.
9. **Authenticator app:** go to Security settings → *Set up authenticator app*, scan the QR code with Google/Microsoft Authenticator, then sign out and back in with the app code.
10. **Access control:** as a normal user, open `/admin`. You get 403 and an `ACCESS_DENIED` log entry.

---

## Project structure

```
server.js                  Express app: middleware order, sessions, routes, error handling
database/schema.sql        MySQL tables (users, otp_codes, password_resets, known_devices, audit_logs, products, orders)
database/init.js           Applies the schema and seeds the admin + demo products (npm run db:init)
src/config/index.js        Reads .env (all security settings can be changed here)
src/config/db.js           mysql2 connection pool (parameterised queries only)
src/middleware/security.js Helmet/CSP, CSRF, session checks, role checks, rate limiters
src/services/auth.js       Lockout, OTP, new-device detection, completing a login
src/services/notify.js     Email (nodemailer/SMTP) + SMS (Twilio) + dev mailbox
src/services/audit.js      Security audit log
src/utils/validate.js      Input validation and password policy
src/utils/crypto.js        Secure random values, SHA-256, constant-time compare, AES-256-GCM
src/routes/                auth, account (2FA/devices/password), market, admin, dev mailbox
tests/security-e2e.js      End-to-end security test (npm test)
views/                     EJS templates (auto-escaped)
public/                    CSS + client JS (no inline scripts, as CSP requires)
```

## Deploying

The repo can be deployed as-is:

- **Docker / any VPS:** `docker compose up -d --build`. Put Nginx or Caddy with HTTPS in front, then set `COOKIE_SECURE=true`, `TRUST_PROXY=1`, `APP_URL=https://your-domain` and `DEV_MAILBOX=false`.
- **Render / Railway / Fly.io:** create a MySQL database, set the variables from `.env.example` in the dashboard and use `npm start` as the start command.

Before going public, always change `SESSION_SECRET`, `ENCRYPTION_KEY`, `ADMIN_PASSWORD` and the database passwords.
# Project
# Project
