# ADR 0001: Modular layered architecture

- Status: Accepted
- Date: 2026-07-23

## Context

SIPEKA membutuhkan batas fitur dan isolasi business rule dari framework serta database.

## Decision

Gunakan feature modules dengan lapisan domain, application, infrastructure, dan presentation.
Cross-module import hanya melalui `index.ts`. ESLint melarang deep import serta dependency domain
ke React, Next.js, Supabase, infrastructure, dan browser globals.

## Consequences

Route Handler dan Server Action hanya mengadaptasi transport ke application service. Adapter
Supabase mengimplementasikan repository interface dan tidak masuk ke React component.
