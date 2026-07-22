# SIPEKA Engineering Rules

## Source of Truth

- Read `docs/implementation-plan.md` completely before changing code.
- Do not change product requirements without explicit approval.
- Preserve every agreed feature even when it is not part of the current phase.
- Work on one implementation phase at a time.
- Inspect and inventory existing logo, hero image, and student-data files before creating replacements or format assumptions.

## Architecture

- Keep domain, application, infrastructure, and presentation boundaries.
- React components must not contain database queries or business rules.
- Route Handlers and Server Actions must stay thin.
- Cross-module imports must use each module's public API.
- Domain code must not import React, Next.js, Supabase, or browser APIs.

## Authorization and Data Safety

- `USER` is read-only.
- `SUPER_ADMIN` may manage accounts but may not access operational student or attendance data.
- All operational writes require active `ADMIN` authorization, validation, transaction, revision history, and audit logging.
- Never expose Supabase service-role credentials to the client.
- Never commit secrets, real student data, exported reports, or production database dumps.
- Treat existing student-data source files as read-only and sensitive. Never copy them into `public/`, fixtures, snapshots, logs, CI artifacts, or the client bundle.
- Do not print full student rows or identifiers in terminal output or completion reports; report only schema, counts, and redacted samples.
- Preserve original logo and hero-image files. Document any optimized or converted derivatives before using them.
- Do not cache protected operational data for offline access.

## Database

- Do not use Prisma.
- SQL migrations are the schema source of truth.
- Do not edit migrations that have already been merged; add a new migration.
- Enable and test RLS on every exposed table.
- Enforce critical rules with database constraints, not only UI validation.
- Bulk attendance, imports, promotions, rollbacks, and destructive alumni actions must be atomic.

## Quality

- Add or update tests for every behavior change.
- Cover permissions with RLS/integration tests.
- Run lint, typecheck, unit tests, database tests, relevant E2E tests, and production build before declaring completion.
- Do not leave untracked TODOs.
- Keep user-facing text in Bahasa Indonesia.
- Keep internal code identifiers in consistent English.

## Completion Report

At the end of every task, report:

1. files changed;
2. migrations added;
3. commands run;
4. test and build results;
5. security and architecture decisions;
6. remaining risks or TODOs limited to the current phase.
