# Prompt for ChatGPT — full briefing on the ShostaBazar project

> Copy everything below this line into ChatGPT.

---

You are helping me with my university **Cyber Security course project**. The project is already built. Below is a complete, accurate description of it: what it is, the teacher's requirements, the tech stack, every file, the database, every route, how each security feature works internally, what was tested, and what is **not** done yet. Treat this as the single source of truth. Do not invent features that are not listed here. If something I ask is not covered, say so instead of guessing.

After reading, briefly confirm you understand. Then I'll ask you to help with things like the **project report (PDF)**, the **presentation (PPTX)**, **viva / Q&A preparation**, explaining code, or planning the remaining work.

---

## 1. Course context and the teacher's requirements

**Project title:** *ShostaBazar: A Secure Online Marketplace* ("Shosta Bazar" is Bangla for "cheap market".)

The course mainly teaches **MySQL + JavaScript**, and we were free to choose the rest of the stack.

**The teacher's brief (paraphrased, nothing left out):**
- Make a login and registration webpage/app, plus a landing page / admin dashboard **with a search feature**, using as many security measures as possible, for example:
  - username and password
  - two-factor authentication
  - hashed passwords
  - timeout after 3 or more failed attempts
  - password recovery
  - minimum password length, etc.
  - notification of a new-device login through email or SMS
  - protection against SQL injection, XSS, CSRF, etc.
- **Marks (total 30):** main project features and relation to the course = 15; project report = 5; presentation and skill = 5; viva and Q&A = 5.
- Teams of up to 2 members, both getting the same mark for features. The team must be registered in the teacher's Google Sheet before the mid-term.
- **Report:** must include the main back-end code, screenshots of the main front-end features, descriptions of those features, and the back-end logic explaining how each security measure is applied.
- Presentation, viva and Q&A happen in the last week of the semester.
- Submit a **printed** report, and upload the report (**PDF**) and presentation (**PPTX**) before final evaluation.

---

## 2. Tech stack (exact)

- **Runtime:** Node.js 20+ (`"engines": { "node": ">=20" }`)
- **Server:** Express **5** (`express@^5.3.0`)
- **Database:** MySQL **8** (tested on MySQL 8.4) via `mysql2@^3.24.6` (promise API, connection pool)
- **Templates:** EJS (`ejs@^7`), server-side rendered, auto-escaped with `<%= %>`
- **Front end:** plain HTML/CSS/vanilla JavaScript. No framework and no CDN; everything is self-hosted, because the CSP only allows `'self'`.
- **Security / auth libraries:**
  - `bcryptjs` for password hashing
  - `express-session` + `express-mysql-session` for sessions stored in MySQL
  - `helmet` for security headers and CSP
  - `express-rate-limit` for rate limiting
  - `otplib@13` for TOTP (authenticator app)
  - `qrcode` for the QR code shown during TOTP setup
  - `cookie-parser` for the signed device cookie
  - `nodemailer` for SMTP email
  - `dotenv` for config
- **SMS:** Twilio REST API called with Node's built-in `fetch` (optional, needs credentials)
- **npm `overrides`:** forces `mysql2` to the top-level version, because `express-mysql-session` depended on an older, vulnerable `mysql2`. `npm audit` reports **0 vulnerabilities**.
- **Deployment files:** `Dockerfile` (node:20-alpine, runs as the non-root `node` user, with a healthcheck) and `docker-compose.yml` (MySQL 8.4 + app).
- **Scripts:** `npm start` (node server.js), `npm run dev` (node --watch), `npm run db:init` (create tables + seed only), `npm test` (end-to-end security test).
- **Size:** about 2,270 lines of JS/SQL/CSS (excluding views and node_modules), plus 25 EJS view files.

---

## 3. File structure (every file and its purpose)

```
shostabazar/
├── server.js                     Express app: middleware order, MySQL session store, routes, 404 + error handler, starts DB init then listens
├── package.json / package-lock.json
├── .env.example                  Every config variable, documented (copy to .env)
├── .gitignore                    node_modules, .env, logs, etc. (.env is never committed)
├── .dockerignore
├── Dockerfile                    node:20-alpine, npm ci --omit=dev, USER node, HEALTHCHECK, CMD node server.js
├── docker-compose.yml            services: db (mysql:8.4, UTC timezone, healthcheck, volume) + app (waits for a healthy db)
├── README.md                     Requirement→code mapping table, extra measures, setup (Docker / manual MySQL), demo script, structure, deployment notes
├── database/
│   ├── schema.sql                All CREATE TABLE IF NOT EXISTS statements (8 tables)
│   └── init.js                   waitForDb (30 retries × 2 s), applySchema, seed admin from .env + 10 demo products; runs automatically on server start
├── src/
│   ├── config/index.js           Reads .env; security tuning values; derives a 32-byte AES key (SHA-256 of ENCRYPTION_KEY or the session secret); in production exits if SESSION_SECRET is shorter than 32 chars
│   ├── config/db.js              mysql2 pool (multipleStatements:false, timezone 'Z', sets session time_zone '+00:00'); helpers query() and one()
│   ├── middleware/security.js    Helmet/CSP, CSRF token + check, flash messages, loadUser (session validation), requireAuth, requireAdmin, guestOnly, noCache, rate limiters
│   ├── services/auth.js          regenerateSession, lock check, registerFailure (lockout), issueLoginOtp, describeDevice, checkDevice (new-device alert), completeLogin
│   ├── services/notify.js        sendEmail (SMTP via nodemailer + dev mailbox), sendSms (Twilio + dev mailbox), HTML-escapes email content
│   ├── services/audit.js         audit(req, event, {...}) → audit_logs table (IP, user agent, details)
│   ├── utils/crypto.js           randomToken (crypto.randomBytes), randomOtp (crypto.randomInt), sha256, safeEqual (timingSafeEqual), AES-256-GCM encrypt/decrypt
│   ├── utils/validate.js         str() (type check + trim + max length), isUsername, isEmail, isPhone, passwordProblems (policy), toId (strict integer)
│   └── routes/
│       ├── auth.js               register, login, verify-2fa, resend code, logout, forgot, reset
│       ├── account.js            security settings page, change password, phone, TOTP setup/enable/disable, forget device
│       ├── market.js             landing, dashboard + search, sell, product page, buy (transaction), delete, my listings, my orders
│       ├── admin.js              overview stats, users (search + actions), security logs (search/filter), products (search + remove)
│       └── dev.js                /dev/mailbox (development only)
├── views/                        EJS templates (no inline <script> or style="" anywhere, because of the CSP)
│   ├── partials/                 header (nav, dev banner), footer, flash, errors, password-fields (strength meter + policy checklist), product-card
│   ├── auth/                     login, register, verify-2fa, forgot, reset
│   ├── market/                   dashboard, new, product, listings, orders
│   ├── account/                  index (security settings), totp-setup
│   ├── admin/                    nav, index, users, logs, products
│   ├── index.ejs                 public landing page
│   ├── error.ejs                 generic error page (400/403/404/429/500)
│   └── dev-mailbox.ejs           shows sent emails/SMS (dev only)
├── public/
│   ├── css/style.css             full responsive design (teal brand colour, cards, tables, admin stats, bar chart done with CSS classes)
│   ├── js/app.js                 show/hide password, live password-policy checklist + strength meter, confirm dialogs, UTC→local time, digits-only OTP input, idle-timeout redirect
│   └── img/favicon.svg
├── tests/security-e2e.js         65-check end-to-end security test over real HTTP (npm test)
└── docs/chatgpt-project-brief.md this file
```

---

## 4. Database schema (MySQL, InnoDB, utf8mb4, all times UTC)

1. **users**: id, username (UNIQUE, 30), email (UNIQUE, 254), phone (nullable), password_hash (bcrypt), role ENUM('user','admin'), is_active, totp_secret (AES-256-GCM encrypted, nullable), totp_enabled, totp_last_step (blocks TOTP replay), failed_attempts, lock_until (lockout time), session_version (incremented to sign out all sessions), password_changed_at, last_login_at, last_login_ip, created_at.
2. **otp_codes**: id, user_id (FK, cascade), code_hash (SHA-256 of the 6-digit code), purpose ('login'), attempts, expires_at, used_at, created_at.
3. **password_resets**: id, user_id (FK), token_hash (SHA-256, UNIQUE), expires_at, used_at, request_ip, created_at.
4. **known_devices**: id, user_id (FK), device_hash (SHA-256 of device-cookie + user agent), device_label (e.g. "Chrome on Linux"), ip, first_seen, last_seen, UNIQUE(user_id, device_hash).
5. **audit_logs**: id, user_id, username, event, ip, user_agent, details, created_at (indexed on event, created_at, user_id).
6. **products**: id, seller_id (FK), title, description, category, price DECIMAL(10,2), stock, is_active (soft delete), created_at.
7. **orders**: id, buyer_id, product_id, quantity, unit_price, total, status ENUM('placed','shipped','delivered','cancelled'), created_at.
8. **dev_mailbox**: id, channel ('email'/'sms'), recipient, subject, body, action_url, created_at. Development only.
9. **sessions** is created automatically by express-mysql-session.

Tables are created automatically on startup (`CREATE TABLE IF NOT EXISTS`). The admin account comes from `ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD` and is only created if that password passes the password policy. When `SEED_DEMO_DATA=true` and the products table is empty, 10 demo products (Bangladeshi-flavoured: Walton phone, Tangail saree, Panjabi, Chinigura rice, cricket bat, security books, a FIDO2 key…) are added, owned by the admin.

Product categories (fixed whitelist): Electronics, Fashion, Home, Books, Sports, Grocery, Other.

---

## 5. All routes

**Auth (`src/routes/auth.js`)**
- `GET/POST /register`: guests only; rate limited
- `GET/POST /login`: guests only; rate limited; `?timeout=1` shows the inactivity notice
- `GET/POST /verify-2fa`: second step of login
- `POST /verify-2fa/resend`: new email code, at most once per 60 s
- `POST /logout`: POST only, CSRF protected
- `GET/POST /forgot`: request a reset link; rate limited
- `GET/POST /reset/:token`: set a new password

**Marketplace (`src/routes/market.js`)**
- `GET /`: public landing page (signed-in users are redirected to /dashboard or /admin)
- `GET /dashboard`: signed in; product search with `q`, `category`, `sort` (newest, price_asc, price_desc, title), `page` (12 per page); shows mini stats
- `GET /products/new`, `POST /products`: sell an item
- `GET /products/:id`: product page
- `POST /products/:id/buy`: place an order
- `POST /products/:id/delete`: soft delete by the owner or an admin
- `GET /listings`: my listings
- `GET /orders`: my orders

**Account / security settings (`src/routes/account.js`, all require sign-in)**
- `GET /account`: account info, 2FA status, change password, recognised devices, recent security activity (last 15 events)
- `POST /account/password`, `POST /account/phone`
- `GET /account/2fa/setup`, `POST /account/2fa/enable`, `POST /account/2fa/disable` (disabling requires the password)
- `POST /account/devices/:id/delete`

**Admin (`src/routes/admin.js`, admin role only)**
- `GET /admin`: stats (users, active products, orders, sales volume, failed logins in 24 h, locked accounts, blocked requests in 24 h, users with an authenticator app), a 7-day successful vs. failed sign-in bar chart, the 10 latest security events, and a user search box
- `GET /admin/users?q=`: search by username or email (up to 100 rows)
- `POST /admin/users/:id/:action`: actions are `unlock`, `disable`, `enable`, `promote`, `demote`, `logout` (revoke sessions). An admin can't act on themself. Every action is audit-logged.
- `GET /admin/logs?q=&event=`: search username, IP or details and filter by event type (last 200)
- `GET /admin/products?q=`: search by title or seller, with remove buttons

**Dev:** `GET /dev/mailbox` (only mounted when `DEV_MAILBOX=true`; shows the last 30 emails/SMS with clickable links)

---

## 6. How each security feature works (back-end logic)

### 6.1 Registration and password policy
- Server-side validation (client-side checks are only for convenience):
  - username matches `^[A-Za-z0-9_]{3,30}$`
  - email matches a regex with a 254-character limit and is lowercased
  - phone is optional and matches `^\+?[0-9]{8,15}$`
  - the terms checkbox is required
- **Password policy (`passwordProblems`):**
  - at least 8 characters (configurable with `PASSWORD_MIN_LENGTH`) and at most 128
  - must have a lowercase letter, an uppercase letter, a digit and a special character
  - not in a built-in list of common passwords (password123, qwerty123, bangladesh, Admin@123, …)
  - must not contain the username, or the email's local part (if that is 4+ characters)
  - the same policy applies on register, reset and change password
- Duplicate username or email gives the message "already registered".
- The password is hashed with **bcrypt, cost 12** (configurable with `BCRYPT_ROUNDS`; bcrypt adds a random salt). Plain text is never stored or logged.
- A welcome email is sent and a `REGISTER` audit event is written.

### 6.2 Login: step 1 (password)
- `SELECT * FROM users WHERE username = ? OR email = ?`, so you can sign in with either the username or the email.
- **Unknown user:** the server still runs `bcrypt.compare` against a dummy hash, so the timing is the same and it's harder to tell which usernames exist. The response is the generic "Invalid username or password."
- **Locked account** (`lock_until` is in the future): HTTP 423 with the minutes remaining.
- **Disabled account:** 403.
- **Wrong password:** `registerFailure()` atomically increments `failed_attempts`.
  - Below 3: the response shows "N attempt(s) left".
  - At **3**: sets `lock_until = now + 15 min` (`MAX_FAILED_ATTEMPTS`, `LOCK_MINUTES`), resets the counter, writes an `ACCOUNT_LOCKED` audit event and **emails the owner** (IP, device, time, reset link).
- **Correct password:** the session ID is **regenerated** (stops session fixation) and `req.session.pending2fa = {userId, method:'totp'|'email', at, lastSent}` is stored. The user is **not signed in yet**.
  - If TOTP is off, a 6-digit OTP is created and sent.

### 6.3 Login: step 2 (two-factor authentication)
- **Email/SMS OTP:**
  - The code comes from `crypto.randomInt` (a cryptographically secure random generator).
  - Only its **SHA-256 hash** is stored in `otp_codes`, and old codes are deleted.
  - It expires after **5 min** (`OTP_TTL_MINUTES`) and allows at most **5 tries per code**.
  - It's compared with `crypto.timingSafeEqual`.
  - It's emailed, and also sent by SMS if the user has a phone number. The email subject starts with the code.
- **Authenticator app (TOTP, RFC 6238):**
  - Verified with `otplib.verify` using `epochTolerance: 30` (±30 s of clock drift) and `afterTimeStep: totp_last_step`, so **each code can be used only once** (replay protection).
  - `totp_last_step` is updated after each successful use.
- The pending 2FA state lasts **10 minutes**. "Resend code" is limited to once every 60 s.
- **A wrong 2FA code also counts as a failed attempt**, so 3 total failures (password or code) lock the account.
- **On success, `completeLogin()`:**
  - regenerates the session again
  - stores userId, sessionVersion and loginAt
  - resets failed attempts, records last_login_at/IP and deletes the OTP rows
  - runs `checkDevice()`
  - writes a `LOGIN_SUCCESS` audit event
  - redirects to a safe `returnTo` (same-site paths only, which blocks open redirects) or to /admin or /dashboard

### 6.4 New-device login notification
- Every browser gets a long-lived (1 year), **signed, httpOnly** cookie `sb_device` holding 32 random bytes.
- The device fingerprint is `SHA-256(deviceId | userAgent)`.
- If that fingerprint isn't in `known_devices` for this user, it's inserted with a label such as "Firefox on Windows". If the user already had at least one device, the user gets a **"New device sign-in" email** (device, IP, time, "Secure my account" link) and an **SMS** if they have a phone, a `NEW_DEVICE_LOGIN` event is logged, and a flash message is shown. The very first device doesn't trigger an alert.
- Users can see their devices and remove them on `/account`. A removed device triggers the alert again next time.

### 6.5 Password recovery
- `POST /forgot` **always shows the same message** ("If an account exists…"), so it can't be used to find registered emails.
- The token is 32 random bytes (256 bits) in hex. **Only its SHA-256 hash** is stored, and it expires in **15 min** (`RESET_TTL_MINUTES`). Older tokens for that user are deleted.
- The email contains the link `APP_URL/reset/<token>`.
- `GET/POST /reset/:token`:
  - the token must be exactly 64 hex characters, unused and not expired
  - the password policy applies, and the new password must differ from the old one
- **On success:**
  - updates the hash and `password_changed_at`
  - **unlocks the account** (failed_attempts = 0, lock_until = NULL)
  - **increments `session_version`**, which signs out every existing session
  - marks the token used (**single use**) and deletes the user's other tokens
  - sends a "password changed" email
  - writes a `PASSWORD_RESET_DONE` audit event

### 6.6 Sessions and timeouts
- Sessions are stored server-side in MySQL. The cookie is `sb.sid`, with **httpOnly**, **SameSite=Strict**, `secure` when `COOKIE_SECURE=true`, and is signed with `SESSION_SECRET`.
- **Idle timeout of 15 min** (`SESSION_IDLE_MINUTES`): a rolling cookie maxAge. The client JS also sends an idle page to `/login?timeout=1`.
- **Absolute timeout of 8 h** (`SESSION_ABSOLUTE_HOURS`), checked in `loadUser`.
- `loadUser` reloads the user from the DB on **every request** and signs them out if the user was deleted or disabled, or if `session_version` changed. This is why the following take effect immediately:
  - a password change (which keeps the current session but signs out the others)
  - a password reset
  - an admin "disable", "demote" or "revoke sessions"
- Signed-in pages are sent with `Cache-Control: no-store`, so pressing Back after logout shows nothing.
- Logout is POST + CSRF, destroys the session and clears the cookie.

### 6.7 SQL injection protection
- **Every** query uses `?` placeholders through mysql2. User input is never concatenated into SQL.
- `multipleStatements: false`, so stacked queries such as `; DROP TABLE` are impossible.
- `ORDER BY` can't use placeholders, so the sort value is looked up in a **fixed whitelist object** (`SORTS`). Unknown values fall back to "newest".
- IDs from the URL or form go through `toId()`, which only accepts `^\d{1,10}$`. For example, `1 OR 1=1` is rejected and gives a 404.
- `LIKE` searches escape `%`, `_` and `\`, so wildcards are taken literally.
- Category and event filters are checked against whitelists.
- `str()` rejects arrays and objects in the request body (type confusion) and caps the length.

### 6.8 XSS protection
- All EJS output uses `<%= %>`, which HTML-escapes it. Raw `<%- %>` is only used for including partials.
- **Content-Security-Policy (Helmet):**
  - `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  - `upgrade-insecure-requests` is added only with HTTPS
  - Because of this, the project has **no inline scripts or inline styles at all**. Even the bar chart widths are CSS classes (`w-0` … `w-100`).
- Session and device cookies are **httpOnly**, so injected JS can't steal them.
- Email bodies escape user data (`esc()`).

### 6.9 CSRF protection
- **Synchronizer token pattern:**
  - a random 32-byte token per session (`req.session.csrfToken`) is put in every form as `_csrf`
  - every POST, PUT or DELETE is compared with `timingSafeEqual`; it can also come from the `x-csrf-token` header
  - a missing or wrong token gives **403** and a `CSRF_BLOCKED` audit event
- Second layer: **SameSite=Strict** session cookie.
- `form-action 'self'` in the CSP.

### 6.10 Access control
- `requireAuth` protects all marketplace and account pages.
- `requireAdmin` (role-based) protects /admin. A denied attempt gives 403 and an `ACCESS_DENIED` audit event.
- **IDOR protection:**
  - deleting a product checks seller_id == user or role admin
  - deleting a device uses `WHERE id = ? AND user_id = ?`
  - unpublished products are only visible to their seller

### 6.11 Business-logic security (buying)
- The order runs in a **MySQL transaction** with `SELECT … FOR UPDATE`, so two buyers can't both take the last item (race condition).
- **The price is read from the database, never from the form**, so price tampering doesn't work.
- Quantity must be 1–100 and no more than the stock. You can't buy your own item, or a removed one.

### 6.12 Rate limiting (per IP, in memory)
- **Global:** 600 requests / 15 min
- **Login:** 20 / 15 min
- **2FA (verify + resend):** 20 / 15 min
- **Registration:** 10 / hour
- **Forgot/reset:** 5 / hour
- Over the limit gives 429 and a `RATE_LIMITED` audit event.

### 6.13 Other hardening
- Helmet headers:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: same-origin`
  - frameguard against clickjacking
  - HSTS (1 year, only when `COOKIE_SECURE=true`)
- `x-powered-by` is disabled.
- Request bodies are limited to 10 KB.
- The error handler never shows stack traces to users.
- `trust proxy` is configurable, so the real client IP is used behind Nginx/Render.
- The Docker image runs as non-root.
- **Secrets at rest:** OTPs and reset tokens are stored only as SHA-256 hashes, and TOTP secrets are encrypted with **AES-256-GCM** (random 12-byte IV and an auth tag; stored as `iv.tag.ciphertext`).
- **Audit log events:**
  - `REGISTER`
  - `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED_LOCKED`, `LOGIN_BLOCKED_DISABLED`
  - `ACCOUNT_LOCKED`, `OTP_SENT`, `PASSWORD_OK_TOTP_REQUIRED`, `NEW_DEVICE_LOGIN`, `LOGOUT`
  - `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_UNKNOWN_EMAIL`, `PASSWORD_RESET_DONE`
  - `PASSWORD_CHANGED`, `PASSWORD_CHANGE_FAILED`, `PHONE_UPDATED`
  - `TOTP_ENABLED`, `TOTP_DISABLED`, `TOTP_DISABLE_FAILED`
  - `DEVICE_REMOVED`, `CSRF_BLOCKED`, `RATE_LIMITED`, `ACCESS_DENIED`
  - `PRODUCT_CREATED`, `PRODUCT_REMOVED`, `ORDER_PLACED`, `SEARCH`, `ADMIN_ACTION`

### 6.14 Email and SMS delivery
- If `SMTP_HOST` is set, nodemailer sends a real email (text plus a simple branded HTML version). Example: Gmail with an App Password (`smtp.gmail.com`, port 465, secure).
- If `TWILIO_*` is set, SMS goes through Twilio's REST API.
- **Dev mailbox:** when `DEV_MAILBOX=true` (the default outside production), every email and SMS is also saved to the `dev_mailbox` table and shown at `/dev/mailbox`. A yellow banner on every page links to it. This lets the class demo show OTPs and reset links without real email. **It must be turned off on any public server**, otherwise anyone could read login codes.

### 6.15 UI / UX
- Responsive design: a public landing page with a security-features panel and featured products; a marketplace with product cards (category emoji instead of images), search bar, filters and pagination.
- A **live password checklist + strength meter**, show/hide password buttons, and an OTP input that accepts digits only.
- Masked email on the 2FA page (e.g. `al***@test.com`).
- Times are stored in UTC and shown in the viewer's local time.
- Confirmation dialogs before destructive actions.
- Flash messages and a friendly error page.

---

## 7. Configuration (`.env` variables)

- **App:** `NODE_ENV`, `PORT` (3000), `APP_URL`, `SESSION_SECRET` (≥32 chars), `ENCRYPTION_KEY`, `COOKIE_SECURE`, `TRUST_PROXY`
- **Database:** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **First admin and seed data:** `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (example default `Ch@ngeMe-Adm1n!`), `SEED_DEMO_DATA`
- **Security tuning:** `MAX_FAILED_ATTEMPTS`=3, `LOCK_MINUTES`=15, `SESSION_IDLE_MINUTES`=15, `SESSION_ABSOLUTE_HOURS`=8, `OTP_TTL_MINUTES`=5, `RESET_TTL_MINUTES`=15, `BCRYPT_ROUNDS`=12, `PASSWORD_MIN_LENGTH`=8
- **Email:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- **SMS:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
- **Dev mailbox:** `DEV_MAILBOX`

---

## 8. Testing done and results

**Automated end-to-end test, `tests/security-e2e.js` (`npm test`).** It drives the running app over real HTTP with its own cookie jar, reads OTPs from the dev mailbox table, and needs a fresh, empty database. Run against **real MySQL 8.4**, the result was **65 passed, 0 failed**, with no server errors. It covers:

1. Registration: weak password rejected; strong accepted; stored as `$2b$12$…` bcrypt; duplicate username rejected.
2. Login + 2FA:
   - redirect to /verify-2fa
   - OTP stored hashed
   - OTP also sent by SMS
   - correct OTP signs in
   - device cookie is signed and httpOnly
   - CSP includes `frame-ancestors 'none'`
   - `Cache-Control: no-store`
   - no `x-powered-by`
   - session cookie is HttpOnly + SameSite=Strict
3. New device: login by email works; "new device" email sent ("Firefox on Windows"); `NEW_DEVICE_LOGIN` logged.
4. Lockout:
   - 1st wrong password shows "2 left", 2nd shows "1 left", 3rd locks (423)
   - the correct password is refused while locked
   - a lockout email is sent
   - a wrong OTP is rejected and counts as a failure
5. Password reset:
   - same response for known and unknown emails
   - token stored only as a hash
   - policy enforced
   - reset works; the link can't be reused; a random token is rejected
   - login with the new password works
6. SQL injection:
   - `' OR '1'='1' --` login fails
   - `admin'--` fails
   - a UNION SELECT in search returns safely with no hashes leaked
   - `price; DROP TABLE users` as the sort value is ignored
   - `/products/1 OR 1=1` gives 404
7. XSS: reflected (search) and stored (product title/description) payloads are escaped.
8. CSRF: no token gives 403; a forged token gives 403; both are logged.
9. Access control and logic:
   - a user gets 403 on /admin
   - an anonymous user is redirected to login
   - can't delete someone else's listing (IDOR)
   - a forged price (0.01) is ignored and the DB price is used
   - stock goes down
   - can't buy more than the stock
   - can't buy your own item
10. Admin:
    - admin login with 2FA
    - all admin pages return 200
    - an XSS payload in the logs search is escaped
    - user search works
    - a disabled user is signed out immediately
11. Change password: the current session stays and the other device's session is revoked.
12. TOTP:
    - QR code shown
    - secret encrypted at rest
    - login asks for the app code
    - a **replayed code is rejected**
    - a fresh code is accepted
13. Logout: the dashboard redirects to login afterwards.

**Manual browser check:** the landing page, login, 2FA, admin dashboard, marketplace and an XSS search were checked visually, with **no console or CSP errors**. One cosmetic bug (a gap in the logo text) was found and fixed.

**Template smoke test:** every view was rendered with `<script>` payloads; everything was escaped and there are no inline styles.

---

## 9. Git status

- A local git repo on branch `main` with **2 commits**:
  1. `b5061f2`: Initial commit (the whole app)
  2. `8ca62f2`: Add end-to-end security test and fix logo spacing
- **Not pushed to GitHub yet** (on purpose). The commit author is the git identity configured on my machine.
- `.env` and `node_modules` are ignored. A stray `.claude/` folder created by the editor tooling is untracked and isn't part of the project.

---

## 10. What is NOT done yet / known limitations (be honest about these)

**Not done:**
1. **Docker has not been run yet.** `docker compose up --build` was never executed, because Docker on the dev machine needs sudo. The app itself was tested with Node + a temporary MySQL 8.4, so the Dockerfile and compose file are untested.
2. **No real email/SMS is configured.** Codes and alerts currently only appear in the dev mailbox. For a public deployment, an SMTP account (e.g. a Gmail App Password) is required; without it nobody could receive their 2FA code once the dev mailbox is off. SMS needs paid Twilio credentials.
3. **Not deployed publicly**, with no HTTPS yet. A public deployment needs:
   - HTTPS (a reverse proxy or a host like Railway/Render)
   - `COOKIE_SECURE=true`, `TRUST_PROXY=1`, `APP_URL=https://…`
   - `DEV_MAILBOX=false`
   - new secrets and passwords
4. **docker-compose.yml has placeholder fallback secrets** (session secret, DB passwords, admin password). If they aren't overridden, the app starts with them silently. A planned improvement is to make it refuse to start instead, and add a production `.env` template.
5. **Not pushed to GitHub yet.**
6. **The project report (PDF) and presentation (PPTX) have not been written yet**, and there are no screenshots yet. The team Google Sheet registration is my own task.
7. The temporary demo database/servers are stopped, so a local run needs Docker or a local MySQL.

**Design limitations and trade-offs (good to mention in the viva):**
- **User enumeration:** the "N attempts left" and "account locked" messages show that a username exists. Timing is equalised and password reset is enumeration-safe, but the login messages favour usability.
- **Lockout can be abused:** an attacker who knows a username can lock that account for 15 minutes. This is the standard trade-off of account lockout; IP rate limiting and the admin unlock button reduce it.
- Failed attempts on **non-existent** usernames only count toward the per-IP rate limit, not a lockout.
- **Rate limiting is stored in memory**, so it resets on restart and isn't shared between several app instances. A Redis store would be needed to scale.
- No **email verification** at registration; the email is effectively verified at first login by the OTP.
- No **backup/recovery codes** for TOTP. If the phone is lost, recovery goes through email (password reset doesn't remove TOTP, so an admin would have to help).
- No **CAPTCHA**, no **password history** (only "new ≠ current"), no **breached-password API** (HaveIBeenPwned), no **WebAuthn/passkeys**.
- The device check uses a cookie + user agent. Clearing cookies or updating the browser looks like a "new device".
- Marketplace features are minimal:
  - no product images or uploads (deliberately avoided, to skip file-upload risks; emoji placeholders are used)
  - no editing a listing
  - no seller-side order management or status changes
  - no payments or cart
  - no messaging between users
- The admin can remove products and manage users but can't edit products or orders.

---

## 11. How to run it (for reference)

- **Docker:** `sudo docker compose up --build`, then open http://localhost:3000. Admin: `admin` / `Ch@ngeMe-Adm1n!`. Dev mailbox: http://localhost:3000/dev/mailbox
- **Manual:** create a MySQL DB and user (README has the GRANT statement), then `cp .env.example .env`, edit it, then `npm install`, then `npm run dev`
- **Tests:** start the app on an empty DB, then `npm test`

**Demo script for the presentation:**
1. Register with a weak password, then a strong one.
2. Log in with the OTP from the mailbox.
3. Log in from a private window and show the new-device email.
4. Enter 3 wrong passwords, show the lock and the email, then unlock it from the admin page.
5. Forgot password: use the link, then show that reuse fails.
6. SQL injection payloads in login and search.
7. XSS payload in search and in a product title.
8. Delete the `_csrf` field in DevTools and show the 403 and the log entry.
9. Set up the authenticator app with the QR code.
10. A normal user opens /admin and gets 403.

---

**What I will ask you next:** help me write the project report (with code excerpts and an explanation of each security measure), a slide outline for the PPTX, likely viva questions with good answers, or the plan for the remaining items in section 10. Please wait for my specific request.

---

## 12. Update: Netlify deployment support (added later)

- The Express app was moved from `server.js` into **`src/app.js`**. `server.js` now only starts it for `npm start` / Docker.
- **`netlify/functions/server.js`**: runs the same app as a Netlify Function using `serverless-http`.
  - Creates the tables and seeds the admin once per cold start.
  - Takes the visitor IP from Netlify's `x-nf-client-connection-ip` header (`X-Forwarded-For` spoofing is ignored).
  - Marks requests as HTTPS so `Secure` cookies work.
  - Returns 503 if the database is unreachable.
- **`netlify.toml`**:
  - `public/` is served by the CDN; every other path is rewritten to the function.
  - Uses the `zisi` bundler with `included_files` for the views, both `schema.sql` files and `certs/`.
  - Node 20 and basic security headers for static files.
- **Database:**
  - TLS support: `DB_SSL`, `DB_SSL_CA` / `DB_SSL_CA_FILE` (certificate always verified).
  - `DB_POOL_SIZE` and `DB_CONNECT_RETRIES`.
  - Idle connections are closed after 30 s.
- **EJS** is now registered explicitly (`app.engine('ejs', …)`) because Netlify's bundler missed Express's dynamic `require('ejs')`.
- **`netlify.env.example`** (committed template) and a locally generated **`netlify.env`** with real secrets (git-ignored). `certs/README.md` explains the Aiven CA certificate.
- **Tests:** the real Netlify bundle (built with Netlify's `zip-it-and-ship-it`) was run on its own through a local Lambda emulator in production mode. All **65/65** security checks passed, with `Secure; HttpOnly; SameSite=Strict` cookies.
- **Not done:** the actual Netlify site, the Aiven database and the Gmail App Password have to be created by the student. Rate limits are per function instance on Netlify (the lockout is in MySQL, so it still works).
