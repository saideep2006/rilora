# RILORA Website

RILORA’s technology and digital-solutions website, built with Next.js, TypeScript and Supabase. The project includes public company, services and project pages; an administrator-published careers portal; applicant accounts; service enquiry intake; project allocations; and completion certificate issuance and verification.

## Run locally

Requirements: Node.js 20.9 or later and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The Home, Services, Projects, Partnerships and Careers pages render without credentials. Public read APIs return safe empty values while Supabase settings are blank or still placeholders, avoiding failing requests during local setup. Account creation, sign-in, submissions and admin workflows require a real Supabase project.

## Supabase setup

1. Create a Supabase project. Copy its project URL and publishable/anon key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In Supabase SQL Editor, run migrations `202611170001_initial_schema.sql` through `202611170004_career_interest.sql`, followed by `202611180005_application_email_history.sql`, `202611180006_application_status_history.sql`, `202611180007_public_recruitment_enquiries.sql` and `202611180008_website_analytics_partnership_tracking.sql` from `supabase/migrations/`, then optionally `supabase/seed.sql`. The seed creates only baseline confirmed company projects/services and no vacancies or applicant records. Its conflicts now leave existing records untouched.
3. Enable email/password authentication. Configure the site URL and redirect allow list for local development and the deployed domain. Configure Supabase SMTP if signup confirmation and password-reset email delivery should use a production sender.
4. Create the first account through `/account` and confirm its email. In the Supabase SQL Editor, inspect the intended administrator UUID and promote only that account:

   ```sql
   select id, email from auth.users where email = 'your-admin-email@example.com';
   insert into public.user_roles(user_id, role)
   values ('THE_ACCOUNT_UUID', 'admin')
   on conflict(user_id) do update set role = 'admin';
   ```

   There is no public administrator registration. The application has no temporary bootstrap environment variable. Keep the service role key off the browser and out of Git.

## Email notifications

Set `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a domain verified with Resend) and `ADMIN_NOTIFICATION_EMAIL=rilora.official@gmail.com`. Service enquiries and opportunity applications are stored in Supabase first; with email configured, the team receives notifications and applicants receive submission acknowledgements. Role-interest forms include the attached resume in the official inbox notification. For applicant emails, also set the server-only `SUPABASE_SERVICE_ROLE_KEY`; it is used only in server routes. Without an email provider configured, database submissions still succeed and the UI reports that email delivery is unavailable.

Password resets use Supabase Auth’s email flow and require a working Supabase SMTP setup and the `/account` redirect URL on the auth allow list.

## Admin and applicant workflows

- `/admin/login`: secure Supabase email/password administrator sign-in and password reset. The server checks the user's `user_roles` record before issuing a short-lived, HttpOnly administrator session cookie; there is no admin signup route.
- `/admin`: protected, database-driven overview. Direct URLs `/admin/applications`, `/admin/jobs`, `/admin/enquiries`, `/admin/emails`, `/admin/content`, `/admin/settings`, `/admin/analytics` and `/admin/partnerships` open dashboard sections. Published partner directory, project, service, allocation, career-interest and certificate tools remain available from the dashboard.
- Website analytics are opt-in. After consent, the browser stores a random first-party visitor identifier and session ID; the server HMAC-hashes them with `VISITOR_HASH_SECRET`, stores only those hashes, a canonical page path and a timestamp, and de-duplicates React Strict Mode events by event UUID. Total Visits counts distinct anonymous sessions; Unique Visitors counts distinct anonymous IDs all time; Today Visitors counts distinct IDs for the current day in Asia/Kolkata; Monthly Visitors counts distinct IDs this calendar month; Total Page Views counts page-view records. Visitors can decline or change their privacy choice from the footer. Without consent no page-view event is submitted.
- Admin analytics include selected-date-range page-view/visit/unique-visitor trends, popular public paths and recent timestamps. The public counter shows only aggregate totals. `VISITOR_HASH_SECRET` must be a random server-side secret of at least 32 characters; create one with `openssl rand -hex 32`. The existing `site_visits` daily unique records are retained; page-view analytics begin when migration 008 is applied and visitors consent.
- Partnership enquiries are stored in the existing private `service_enquiries` table with category `partnership` and a generated `PART-…` ID. They have their own pending/under-review/approved/active/rejected state, so contact enquiries do not count as partnerships. Admin approval/activation atomically publishes an entry in the existing `partnerships` table; only published approved/active entries contribute to the public count. Migration 008 preserves existing data and adds the confirmed CureTrics record idempotently.
- `/careers`: only published, open opportunities are listed. Job details support direct applications without an account; resume uploads are privately stored and only administrators can access them. No vacancy is seeded.
- The careers page also shows clearly labelled role-interest cards (including Full Stack, SQL, Python, Java, MongoDB, Angular, React, AI/ML, design, marketing, social media, business development, HR and operations). These are interest areas, not advertised jobs. A candidate can submit a name, email, role selection and PDF/DOC/DOCX resume; submissions are stored privately, rate-limited per email, and visible in the administrator’s **Career interests** dashboard. With Resend configured, the submission details and resume attachment are sent to the configured RILORA inbox (`rilora.official@gmail.com` by default).
- `/account`: email/password account registration, profile, applications, assignments and issued certificates. Applicants can only access their own account records.
- `/verify/[certificate-id]`: public validity check limited to issued certificate details. Certificates require an administrator-marked completed application and published eligibility criteria. Browser print can save a certificate as PDF.
- Candidate application and enquiry APIs validate on the server, rate-limit submissions, store records before optional email notification, and expose private resumes only through short-lived admin-authorized access links.
- RiloraGPT retrieves live public site copy, published services and partnerships, and currently published/open job listings for each response. It excludes unpublished content and private applicant/enquiry records. It calls the xAI API only from the backend using `XAI_API_KEY`; `XAI_MODEL` defaults to `grok-4.7`. If the key is missing or rejected, the UI reports that the assistant is unavailable. A per-process request limit is applied without additional database tables.

The SQL migration enables RLS on applicant and administrative tables. Status changes and certificate issuance are administrator-only; an insert trigger prevents an applicant from setting their own application status or applying to an unpublished, closed or expired opportunity. The public certificate lookup is a restricted database function returning only verification fields.

## Optional integrations and deployment

`.env.example` documents Supabase, Resend and xAI settings. Set `NEXT_PUBLIC_SITE_URL` to the exact deployed origin. Keep `SUPABASE_SERVICE_ROLE_KEY`, `VISITOR_HASH_SECRET`, Resend and xAI keys server-only. Admin analytics and optional email notifications require their respective Supabase/Resend configuration. Career resume uploads use the private `candidate-resumes` bucket and require the third migration. Career-interest storage and database rate limits require the fourth migration. Public applications, job images, content visibility and enquiry management require migration 007. Configure `XAI_API_KEY` and optionally `XAI_MODEL` (defaults to `grok-4.7`) for the xAI Grok-powered assistant. The admin Email management tab shows provider readiness, sent/failed counts, recent history and a protected test-send action. Applicant messages can be previewed, edited and manually sent; changing status alone does not send selection or rejection email. Deploy as a Node.js Next.js application and configure the production URL in Supabase Auth redirects.

## Verification

```powershell
npm run build
npm run lint
```

Supabase-backed end-to-end flows require a real Supabase project and configured credentials. No production database, email credentials or deployment target were available in this workspace.
