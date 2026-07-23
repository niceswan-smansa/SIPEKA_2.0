# ADR-0008: Phase 3 student RPC boundary and soft state

- Status: Accepted
- Date: 2026-07-23

## Decision

Student, enrollment, class, and academic-year mutations are exposed only through scoped PostgreSQL
RPCs. Each function derives the actor from `auth.uid()`, requires an active ADMIN that does not need
to change password, validates all cross-table invariants, and inserts OPERATIONAL audit data in the
same transaction. Direct Data API writes remain revoked.

Students are never hard-deleted in Phase 3. Deactivation keeps identity and enrollment history while
excluding the student from the default active read model. A move closes the old enrollment and creates
the new current enrollment; it never rewrites historical attendance references. ALUMNI and mass
promotion remain outside this phase.
