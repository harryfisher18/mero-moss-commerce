import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BRANDING } from "@/domain/merchant/branding";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { resetDemoStore } from "@/server/demo-reset";
import { SqliteBrandingRepository } from "./branding-repository";

let db: Database;
let branding: SqliteBrandingRepository;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  branding = new SqliteBrandingRepository(db);
});

afterEach(() => db.close());

describe("SqliteBrandingRepository", () => {
  it("uses the seeded wording until something is saved", () => {
    expect(branding.get()).toEqual(DEFAULT_BRANDING);
    expect(branding.history()).toEqual([]);
  });

  it("saves changes and records each changed field, newest first", () => {
    const first = { tagline: "Made to be used.", announcement: "" };
    expect(branding.save(first, "owner@example.com", "2026-11-16T10:00:00.000Z")).toEqual([
      { field: "tagline", before: DEFAULT_BRANDING.tagline, after: "Made to be used." },
    ]);
    branding.save(
      { ...first, announcement: "Free returns within 30 days." },
      "owner@example.com",
      "2026-11-16T11:00:00.000Z",
    );
    expect(branding.get()).toEqual({
      tagline: "Made to be used.",
      announcement: "Free returns within 30 days.",
    });
    expect(branding.history()).toEqual([
      {
        field: "announcement",
        before: "",
        after: "Free returns within 30 days.",
        actor: "owner@example.com",
        createdAt: "2026-11-16T11:00:00.000Z",
      },
      {
        field: "tagline",
        before: DEFAULT_BRANDING.tagline,
        after: "Made to be used.",
        actor: "owner@example.com",
        createdAt: "2026-11-16T10:00:00.000Z",
      },
    ]);
  });

  it("records nothing when nothing changes", () => {
    expect(branding.save(DEFAULT_BRANDING, "owner", "2026-11-16T10:00:00.000Z")).toEqual([]);
    expect(branding.history()).toEqual([]);
  });

  it("returns to the seeded wording after a demo reset", () => {
    branding.save(
      { tagline: "Changed.", announcement: "Hello" },
      "owner",
      "2026-11-16T10:00:00.000Z",
    );
    resetDemoStore(db, { actor: "owner", at: "2026-11-16T11:00:00.000Z" });
    expect(branding.get()).toEqual(DEFAULT_BRANDING);
    expect(branding.history()).toEqual([]);
  });
});
