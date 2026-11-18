# Rapid Nova Ambulance

## Implementation plan

1. Set up npm workspaces, TypeScript, Vite and the visual system.
2. Build public navigation, informational pages and configurable service, location and career routes.
3. Add MongoDB models, validated API routes and operational records.
4. Connect public inquiry forms and generic notifications.
5. Add cookie authentication, permissions and the administrative portal.
6. Verify builds, accessibility, route behavior, security controls and SEO output.
7. Document configuration and deployment.

## Business inputs

Confirm dispatch and billing contact details, operating hours, company address, licensed services, service area boundaries, job openings, credentials, team information, approved images, and legal documents before publication.

## Local setup

Requires Node 24, npm and a MongoDB instance.

```sh
npm ci
cp .env.example .env
npm run dev --workspace backend
npm run dev --workspace frontend
```

Set `MONGODB_URI` in the root `.env` first. The frontend runs at localhost:5173 and forwards API calls to localhost:4000. Use synthetic data during development. With SMTP and Twilio unset, transportation records are saved and delivery entries are marked Skipped. Public content starts empty until published by authorized staff. The bundled public-site photos are generated illustrative imagery. Operator-approved photos can be entered in Settings and individual listings. Use a separate photo for each listing detail page. Details without a configured photo use a text heading.

### Provision staff accounts

Set the four `PROVISION_*` variables temporarily in a protected shell or root `.env`, then build and run from the repo root.

```sh
npm run build --workspace backend
node --env-file=.env backend/dist/backend/src/index.js --provision-admin
```

Use a unique strong password, one of the supported roles and a random Base32 TOTP secret of at least 32 characters. Enroll the account in an authenticator with SHA-1, six digits and a 30-second period. Deliver setup credentials through a secure channel and remove provisioning values after use. Production password recovery requires SMTP. Roles determine access to operations, recruitment, content, settings, users and audit records. Only Super Admins manage other staff roles. Super Admin provisioning is offline.

### Content and operations

Use the dashboard to enter verified company and legal content, publish licensed services and confirmed locations, and post actual job vacancies. Keep drafts unpublished. The service area map field accepts a verified HTTPS map link. Use the Careers area to publish positions before accepting applications. Resume files are capped at 2 MB, checked for PDF signatures and delivered as authenticated attachments. PDF signature checks cannot identify all malicious documents. Review malware scanning and staff file handling before opening recruitment to the public.

Statuses are selected by staff. The dashboard aggregates active records and archive filters show archived transport requests. The TTL index expires public inquiry and application records based on the configured retention period at submission. Set policies for archives, notifications, audit records and separately managed backups before production. Changing the default does not alter existing expiry timestamps.

### Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
TEST_MONGO=1 npm test
npx playwright install chromium
npm run test:e2e
```

MongoDB integration tests use a disposable MongoDB binary. Playwright can use installed Chrome with `PLAYWRIGHT_CHANNEL=chrome`. Browser tests use synthetic responses so they never contact a live provider.

## Deployment preparation

In Vercel, select the Vite framework preset, set Root Directory to `frontend`, and enable Include source files outside of the Root Directory so the build can access `shared/` and the root lockfile. The frontend configuration installs its workspace dependencies with `npm ci --include=dev` and builds to `dist` relative to `frontend`. Set `SITE_ORIGIN` to the public HTTPS origin. Optionally set `SEO_PUBLIC_API_BASE` to the verified public API base at build time to generate indexable metadata and sitemap entries for published detail pages. Rebuild after changing published listings. Ensure production hosting serves generated route files before the SPA fallback. Use `VITE_API_BASE` for a dedicated API URL, or route `/api/*` to the API via a reverse proxy. Production frontend and API must share a schemeful site for strict cookies, for example `www` and `api` under the same HTTPS domain.

Build the backend with `npm run build --workspace backend` and start with `npm run start --workspace backend`. Set the API environment variables at the host, match `PUBLIC_ORIGIN` to the public frontend origin, and enable `TRUST_PROXY=1` only when the API sits exactly one trusted proxy hop from the HTTPS edge. Restrict MongoDB credentials to the application database and use private network access where available. Confirm index creation, backups and recovery, log retention, and a distributed rate-limit store before a multi-instance rollout. Configure provider credentials only after reviewing the hosts, database, mailbox and messaging providers separately.

The platform is designed for general transportation and facility inquiries. Complete the company's privacy, security and regulatory review before going live, approve legal placeholders and confirm all operational information. Keep future protected patient intake in a separately reviewed workflow. Review the audit log infrastructure, MFA encryption key rotation, notification retry policy and accessibility before release.

See [API.md](API.md) for API contracts.

For production, provide `MFA_ENCRYPTION_KEY` as 64 hex characters from a cryptographically random generator. Provision production staff with that key configured. Keep it in the backend secret manager and plan MFA reenrollment if the key is lost. OpenStreetMap embed URLs can render inline; other verified HTTPS map links open the appropriate map provider.

If the disposable MongoDB binary requires a newer operating system, set a compatible `MONGOMS_VERSION` (for example `7.0.24` on Intel macOS Ventura) or set `TEST_MONGO_URI` to a disposable MongoDB on localhost. The test creates and deletes its own isolated database.
