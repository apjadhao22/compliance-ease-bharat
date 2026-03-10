/**
 * Unit tests for the pure helper functions exported from Timesheets.tsx.
 *
 * These tests exercise the classification logic that separates uploaded
 * timesheet rows into "known employees", "unknown (new) employees", and
 * "blank code" rows — without touching Supabase or the DOM.
 */
import { describe, it, expect } from "vitest";
import {
    parseTimesheetDate,
    parseNumberRobust,
    classifyByEmpCode,
} from "./Timesheets";

// ── parseTimesheetDate ─────────────────────────────────────────────────────────

describe("parseTimesheetDate", () => {
    it("parses a plain ISO string", () => {
        expect(parseTimesheetDate("2026-03-15")).toBe("2026-03-15");
    });

    it("parses a Date object", () => {
        // new Date("2026-01-01") → "2026-01-01"
        expect(parseTimesheetDate(new Date("2026-01-01T00:00:00.000Z"))).toMatch(/^2026-01-0[12]$/);
        // Allow ±1 day due to timezone; just verify shape
    });

    it("parses an Excel serial number (45000 ≈ some 2023 date)", () => {
        const result = parseTimesheetDate(45000);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.startsWith("202")).toBe(true); // sanity: 2020s era
    });

    it("handles slash-separated date strings", () => {
        const result = parseTimesheetDate("2026/03/15");
        expect(result).toBe("2026-03-15");
    });

    it("returns empty string for non-date strings", () => {
        expect(parseTimesheetDate("not-a-date")).toBe("");
        expect(parseTimesheetDate("abc")).toBe("");
    });

    it("returns empty string for null / undefined", () => {
        expect(parseTimesheetDate(null)).toBe("");
        expect(parseTimesheetDate(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
        expect(parseTimesheetDate("")).toBe("");
    });
});

// ── parseNumberRobust ─────────────────────────────────────────────────────────

describe("parseNumberRobust", () => {
    it("returns a numeric value directly", () => {
        expect(parseNumberRobust(8, 0)).toBe(8);
        expect(parseNumberRobust(0, 5)).toBe(0);
        expect(parseNumberRobust(2.5, 0)).toBe(2.5);
    });

    it("parses string integers", () => {
        expect(parseNumberRobust("9", 0)).toBe(9);
        expect(parseNumberRobust("  9  ", 0)).toBe(9);
    });

    it("parses string with comma decimal separator", () => {
        expect(parseNumberRobust("7,5", 0)).toBe(7.5);
    });

    it("strips non-numeric characters", () => {
        expect(parseNumberRobust("8h", 0)).toBe(8);
        expect(parseNumberRobust("OT: 2", 0)).toBe(2);
    });

    it("returns defaultVal for blank / null / undefined", () => {
        expect(parseNumberRobust("", 8)).toBe(8);
        expect(parseNumberRobust(null, 8)).toBe(8);
        expect(parseNumberRobust(undefined, 8)).toBe(8);
    });

    it("returns defaultVal for non-numeric strings", () => {
        expect(parseNumberRobust("n/a", 0)).toBe(0);
    });
});

// ── classifyByEmpCode ─────────────────────────────────────────────────────────

describe("classifyByEmpCode", () => {
    const empMap = new Map([
        ["EMP001", "uuid-1"],
        ["EMP002", "uuid-2"],
    ]);

    it("routes known emp codes to knownRows", () => {
        const rows = [
            { emp_code: "EMP001", date: "2026-03-01", normal_hours: 8 },
            { emp_code: "EMP002", date: "2026-03-01", normal_hours: 7 },
        ];
        const { knownRows, unknownGroups, blankCodeIndices } =
            classifyByEmpCode(rows, "emp_code", empMap);

        expect(knownRows).toHaveLength(2);
        expect(unknownGroups.size).toBe(0);
        expect(blankCodeIndices).toHaveLength(0);
        expect(knownRows[0].empId).toBe("uuid-1");
        expect(knownRows[1].empId).toBe("uuid-2");
    });

    it("routes unknown emp codes to unknownGroups", () => {
        const rows = [
            { emp_code: "EMP999", date: "2026-03-01", normal_hours: 8 },
            { emp_code: "EMP999", date: "2026-03-02", normal_hours: 8 },
            { emp_code: "EMP888", date: "2026-03-01", normal_hours: 6 },
        ];
        const { knownRows, unknownGroups } = classifyByEmpCode(rows, "emp_code", empMap);

        expect(knownRows).toHaveLength(0);
        expect(unknownGroups.size).toBe(2);
        expect(unknownGroups.get("EMP999")?.rows).toHaveLength(2);
        expect(unknownGroups.get("EMP888")?.rows).toHaveLength(1);
    });

    it("routes blank / missing codes to blankCodeIndices", () => {
        const rows = [
            { emp_code: "",      date: "2026-03-01" },   // blank
            { emp_code: "EMP001", date: "2026-03-01" },  // known
            { emp_code: "   ",   date: "2026-03-02" },   // whitespace-only → blank
        ];
        const { blankCodeIndices, knownRows } = classifyByEmpCode(rows, "emp_code", empMap);

        expect(blankCodeIndices).toHaveLength(2);
        expect(blankCodeIndices).toContain(0);
        expect(blankCodeIndices).toContain(2);
        expect(knownRows).toHaveLength(1);
    });

    it("normalises case and whitespace before lookup", () => {
        const rows = [
            { emp_code: " emp001 ", date: "2026-03-01" },  // lower-case + spaces
            { emp_code: "EMP.001",  date: "2026-03-02" },  // dots stripped
        ];
        const { knownRows } = classifyByEmpCode(rows, "emp_code", empMap);

        // Both should resolve to EMP001 → uuid-1
        expect(knownRows).toHaveLength(2);
        expect(knownRows.every(r => r.empId === "uuid-1")).toBe(true);
    });

    it("groups multiple rows for the same unknown code under one entry", () => {
        const rows = [
            { emp_code: "NEWCODE", date: "2026-03-01" },
            { emp_code: "NEWCODE", date: "2026-03-02" },
            { emp_code: "NEWCODE", date: "2026-03-03" },
        ];
        const { unknownGroups } = classifyByEmpCode(rows, "emp_code", empMap);

        expect(unknownGroups.size).toBe(1);
        expect(unknownGroups.get("NEWCODE")?.rows).toHaveLength(3);
        // rawCode should preserve the original casing from the file
        expect(unknownGroups.get("NEWCODE")?.rawCode).toBe("NEWCODE");
    });

    it("preserves original rowIndex for each row", () => {
        const rows = [
            { emp_code: "EMP999", date: "2026-03-01" }, // index 0
            { emp_code: "EMP001", date: "2026-03-01" }, // index 1
            { emp_code: "EMP999", date: "2026-03-02" }, // index 2
        ];
        const { knownRows, unknownGroups } = classifyByEmpCode(rows, "emp_code", empMap);

        expect(knownRows[0].rowIndex).toBe(1);
        const unknown = unknownGroups.get("EMP999")!;
        expect(unknown.rows[0].rowIndex).toBe(0);
        expect(unknown.rows[1].rowIndex).toBe(2);
    });

    it("handles a mix of known, unknown, and blank rows", () => {
        const rows = [
            { emp_code: "",       date: "2026-03-01" }, // blank   → idx 0
            { emp_code: "EMP001", date: "2026-03-01" }, // known   → idx 1
            { emp_code: "NEW01",  date: "2026-03-01" }, // unknown → idx 2
            { emp_code: "EMP002", date: "2026-03-02" }, // known   → idx 3
            { emp_code: "NEW01",  date: "2026-03-02" }, // unknown → idx 4
        ];
        const { knownRows, unknownGroups, blankCodeIndices } =
            classifyByEmpCode(rows, "emp_code", empMap);

        expect(blankCodeIndices).toEqual([0]);
        expect(knownRows).toHaveLength(2);
        expect(unknownGroups.size).toBe(1);
        expect(unknownGroups.get("NEW01")?.rows).toHaveLength(2);
    });

    it("returns empty results for an empty input array", () => {
        const { knownRows, unknownGroups, blankCodeIndices } =
            classifyByEmpCode([], "emp_code", empMap);

        expect(knownRows).toHaveLength(0);
        expect(unknownGroups.size).toBe(0);
        expect(blankCodeIndices).toHaveLength(0);
    });
});
