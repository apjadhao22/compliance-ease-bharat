import { format } from "date-fns";

export interface ESICRecord {
  esicNo: string;
  name: string;
  daysPaid: number;
  totalWages: number;
  eeContribution: number;
  erContribution: number;
  reasonCode?: string; // e.g. "01" for Left Service, "02" for Retrenched, etc.
  lastWorkingDay?: string;
}

/**
 * Generates ESIC Monthly Contribution Return format (CSV).
 * Used for upload to the ESIC portal.
 * Note: Final upload mapping and verification is manual.
 */
export function generateEsicCsv(
  records: ESICRecord[],
  employerCode: string = "31000123456789",
  monthYYYYMM: string
): string {
  // ESIC upload portal typically requires plain rows without headers for some parsers,
  // but standard CSV output often includes headers for checking.
  let content = "IP Number,IP Name,No of Days for which wages paid/payable,Total Monthly Wages,Reason Code for Zero working days(0-11)\n";
  
  // Actually, the official ESIC bulk upload structure is usually positional:
  // IP Number (10 chars), IP Name, No. of Days, Wages, Reason Code
  // Let's generate a strict CSV format
  records.forEach((record) => {
    const ipNo = (record.esicNo || "0000000000").padStart(10, "0").slice(0, 10);
    const name = (record.name || "UNKNOWN").toUpperCase().replace(/[^A-Z\s.]/g, "").slice(0, 85);
    const days = record.daysPaid;
    const wages = Math.round(record.totalWages);
    const reasonCode = (days === 0 && record.reasonCode) ? record.reasonCode : "";
    const lastWorkingDay = (days === 0 && record.lastWorkingDay) ? record.lastWorkingDay : "";

    const line = [
      ipNo,
      `"${name}"`,
      days.toString(),
      wages.toString(),
      reasonCode,
      lastWorkingDay
    ].join(",");

    content += line + "\n";
  });

  return content;
}
