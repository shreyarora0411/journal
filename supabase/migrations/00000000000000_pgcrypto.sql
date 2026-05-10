-- Phase 0.1: enable extensions used by the rest of the schema.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
