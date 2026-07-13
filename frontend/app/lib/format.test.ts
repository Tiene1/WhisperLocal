import { describe, expect, it } from "vitest";
import { formatDateLabel, formatDuration, formatTimeLabel } from "./format";

describe("formatDuration", () => {
  it("retourne '--:--' pour null/undefined/NaN", () => {
    expect(formatDuration(null)).toBe("--:--");
    expect(formatDuration(undefined)).toBe("--:--");
    expect(formatDuration(NaN)).toBe("--:--");
  });

  it("formatte en mm:ss en dessous d'une heure", () => {
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formatte en h:mm:ss au-delà d'une heure", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("tronque les secondes non entières et ne descend jamais sous 0", () => {
    expect(formatDuration(65.9)).toBe("01:05");
    expect(formatDuration(-5)).toBe("00:00");
  });
});

describe("formatDateLabel", () => {
  it("retourne '--' si aucune date fournie", () => {
    expect(formatDateLabel(null)).toBe("--");
    expect(formatDateLabel(undefined)).toBe("--");
  });

  it("formatte une date ISO en libellé court fr-FR", () => {
    const label = formatDateLabel("2026-07-11T14:30:00.000Z");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("formatTimeLabel", () => {
  it("retourne '--:--:--' si aucune date fournie", () => {
    expect(formatTimeLabel(null)).toBe("--:--:--");
    expect(formatTimeLabel(undefined)).toBe("--:--:--");
  });

  it("formatte une heure ISO en libellé fr-FR", () => {
    const label = formatTimeLabel("2026-07-11T14:30:00.000Z");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});
