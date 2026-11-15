import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_MAX, DEFAULT_BRANDING, diffBranding, parseBranding } from "./branding";

describe("parseBranding", () => {
  it("accepts single-line copy, trimming and collapsing spaces", () => {
    expect(
      parseBranding({
        tagline: "  Made to   be used.  ",
        announcement: " Free returns within 30 days. ",
      }),
    ).toEqual({
      ok: true,
      branding: { tagline: "Made to be used.", announcement: "Free returns within 30 days." },
    });
  });

  it("allows an empty announcement but requires a tagline", () => {
    expect(parseBranding({ tagline: "Kept for years.", announcement: "   " })).toEqual({
      ok: true,
      branding: { tagline: "Kept for years.", announcement: "" },
    });
    expect(parseBranding({ tagline: " ", announcement: "" })).toEqual({
      ok: false,
      errors: { tagline: "Tagline is required." },
    });
  });

  it("rejects long, multi-line or markup copy", () => {
    expect(
      parseBranding({
        tagline: "Line one\nline two",
        announcement: "x".repeat(ANNOUNCEMENT_MAX + 1),
      }),
    ).toEqual({
      ok: false,
      errors: {
        tagline: "Tagline must be a single line of plain text.",
        announcement: "Keep the announcement to 140 characters or fewer.",
      },
    });
    expect(parseBranding({ tagline: "<b>Bold</b>", announcement: "" })).toMatchObject({
      ok: false,
      errors: { tagline: "Tagline must be plain text, without < or > characters." },
    });
  });

  it("refuses names other than Mero & Moss on the storefront", () => {
    for (const text of ["Built with CommerceFlow", "A developer   showcase", "Our studio picks"]) {
      expect(parseBranding({ tagline: "Kept for years.", announcement: text })).toEqual({
        ok: false,
        errors: {
          announcement: "Announcement must not name anything other than Mero & Moss to shoppers.",
        },
      });
    }
    // Whole words only: "studios" or "builders" inside other words are not the product names.
    expect(parseBranding({ tagline: "For builders of good habits.", announcement: "" }).ok).toBe(
      true,
    );
  });
});

describe("diffBranding", () => {
  it("lists changed fields only", () => {
    expect(diffBranding(DEFAULT_BRANDING, DEFAULT_BRANDING)).toEqual([]);
    expect(diffBranding(DEFAULT_BRANDING, { ...DEFAULT_BRANDING, announcement: "Hello" })).toEqual([
      { field: "announcement", before: "", after: "Hello" },
    ]);
  });
});
