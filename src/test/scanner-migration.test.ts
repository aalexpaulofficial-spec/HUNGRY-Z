// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("food scan nutrition migration", () => {
  it("preserves existing scans and adds only provenance and portion support idempotently", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
        CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL);
        CREATE TABLE public.scanner_access (user_id uuid PRIMARY KEY, expires_at timestamptz NOT NULL);
        CREATE TABLE public.food_scans (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL,
          food_name text NOT NULL,
          portion text NOT NULL DEFAULT '',
          calories integer NOT NULL DEFAULT 0,
          protein_g numeric NOT NULL DEFAULT 0,
          carbs_g numeric NOT NULL DEFAULT 0,
          fat_g numeric NOT NULL DEFAULT 0,
          fibre_g numeric NOT NULL DEFAULT 0,
          sugar_g numeric NOT NULL DEFAULT 0,
          confidence text NOT NULL DEFAULT 'medium',
          notes text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.food_scans ENABLE ROW LEVEL SECURITY;
        INSERT INTO public.food_scans (id, user_id, food_name, calories, protein_g)
        VALUES ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Old scan', 123, 4.5);
      `);
      const migration = await readFile(
        "drizzle/migrations/0002_food_scan_nutrition_sources.sql",
        "utf8",
      );
      await db.exec(migration);
      await db.exec(migration);
      const rows = await db.query<{ food_name: string; calories: number; fdc_id: number | null }>(
        "SELECT food_name, calories, fdc_id FROM public.food_scans",
      );
      expect(rows.rows).toEqual([{ food_name: "Old scan", calories: 123, fdc_id: null }]);
      const grant = await db.query<{ allowed: boolean }>(
        "SELECT has_column_privilege('authenticated', 'public.food_scans', 'portion_g', 'UPDATE') AS allowed",
      );
      expect(grant.rows[0].allowed).toBe(true);
      const deniedGrant = await db.query<{ allowed: boolean }>(
        "SELECT has_column_privilege('authenticated', 'public.food_scans', 'notes', 'UPDATE') AS allowed",
      );
      expect(deniedGrant.rows[0].allowed).toBe(false);
      const policy = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pg_policies WHERE tablename = 'food_scans' AND policyname = 'Active students update own scans'",
      );
      expect(policy.rows[0].count).toBe(1);
    } finally {
      await db.close();
    }
  }, 20000);

  it("creates missing scanner tables safely when the core profile schema exists", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
        CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL);
      `);
      const migration = await readFile(
        "drizzle/migrations/0002_food_scan_nutrition_sources.sql",
        "utf8",
      );
      await db.exec(migration);
      await db.exec(migration);
      const tables = await db.query<{ scanner_access: string | null; food_scans: string | null }>(
        "SELECT to_regclass('public.scanner_access')::text AS scanner_access, to_regclass('public.food_scans')::text AS food_scans",
      );
      expect(tables.rows[0]).toEqual({
        scanner_access: "scanner_access",
        food_scans: "food_scans",
      });
      const policies = await db.query<{ scan_policies: number }>(
        "SELECT count(*)::int AS scan_policies FROM pg_policies WHERE tablename = 'food_scans'",
      );
      expect(policies.rows[0].scan_policies).toBe(4);
    } finally {
      await db.close();
    }
  }, 20000);

  it("adds photo grouping and food-name correction without changing existing rows", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
        CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL);
        CREATE TABLE public.scanner_access (user_id uuid PRIMARY KEY, expires_at timestamptz NOT NULL);
        CREATE TABLE public.food_scans (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL,
          food_name text NOT NULL,
          portion text NOT NULL DEFAULT '',
          calories integer,
          protein_g numeric,
          carbs_g numeric,
          fat_g numeric,
          fibre_g numeric,
          sugar_g numeric,
          confidence text NOT NULL DEFAULT 'medium',
          notes text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          fdc_id bigint,
          nutrition_source text,
          nutrition_reference text,
          portion_g integer
        );
        GRANT UPDATE ON public.food_scans TO authenticated;
        INSERT INTO public.food_scans (id, user_id, food_name, calories)
        VALUES ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Legacy scan', 123);
      `);
      await db.exec(
        await readFile("drizzle/migrations/0002_food_scan_nutrition_sources.sql", "utf8"),
      );
      const migration = await readFile(
        "drizzle/migrations/0003_scanner_multifood_corrections.sql",
        "utf8",
      );
      await db.exec(migration);
      await db.exec(migration);

      const rows = await db.query<{
        food_name: string;
        calories: number;
        scan_group_id: string | null;
      }>("SELECT food_name, calories, scan_group_id FROM public.food_scans");
      expect(rows.rows).toEqual([{ food_name: "Legacy scan", calories: 123, scan_group_id: null }]);
      const grants = await db.query<{ food_name: boolean; fdc_id: boolean; notes: boolean }>(`
        SELECT
          has_column_privilege('authenticated', 'public.food_scans', 'food_name', 'UPDATE') AS food_name,
          has_column_privilege('authenticated', 'public.food_scans', 'fdc_id', 'UPDATE') AS fdc_id,
          has_column_privilege('authenticated', 'public.food_scans', 'notes', 'UPDATE') AS notes
      `);
      expect(grants.rows[0]).toEqual({ food_name: true, fdc_id: true, notes: false });
      const indexes = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pg_indexes WHERE indexname = 'food_scans_group_created'",
      );
      expect(indexes.rows[0].count).toBe(1);
    } finally {
      await db.close();
    }
  }, 20000);
});
