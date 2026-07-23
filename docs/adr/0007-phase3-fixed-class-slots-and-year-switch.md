# ADR-0007: Fixed class slots and guarded academic-year switching

- Status: Accepted
- Date: 2026-07-23

## Decision

Each academic year creates exactly 30 immutable technical slots: X-1..X-10, XI-1..XI-10, and
XII-1..XII-10. Display names are derived from grade and number. Before the Phase 7 promotion
workflow exists, activating another year is rejected when the current active year still has active
students with current enrollment. The exception is an empty first activation.

## Consequences

The database remains the last line of defense against free-form classes and inconsistent switching.
Year metadata remains editable, but used years are not hard-deleted. Promotion must later provide the
atomic transition for students before normal year switching is enabled.
