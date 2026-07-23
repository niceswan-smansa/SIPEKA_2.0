# ADR-0009: Server-side student search read model

- Status: Accepted
- Date: 2026-07-23

## Decision

Management and read-only search use the same `phase3_search_students` server-side read model. The
`SECURITY INVOKER` function applies the caller's RLS, parameterized partial matching, optional filters,
bounded pagination, and a stable name/id sort. Trigram indexes support normalized name, NIS, and NISN.
URL search parameters are the browser source of truth; the client never downloads all students.

## Consequences

ADMIN and USER share consistent results while SUPER_ADMIN remains isolated. Typo-tolerant fuzzy search,
export, and richer reporting are intentionally deferred to later phases.
