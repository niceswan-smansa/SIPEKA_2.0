create schema if not exists private;

revoke all on schema private from public;

create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('SUPER_ADMIN', 'ADMIN', 'USER');
create type public.grade_level as enum ('X', 'XI', 'XII', 'ALUMNI');
create type public.attendance_status as enum ('IZIN', 'SAKIT', 'TANPA_KETERANGAN');
create type public.gender as enum ('L', 'P');
create type public.audit_scope as enum ('OPERATIONAL', 'ACCOUNT');
create type public.revision_operation as enum ('CREATE', 'UPDATE', 'DELETE');
create type public.batch_status as enum ('PREVIEWED', 'COMPLETED', 'REVERTED', 'FAILED');
