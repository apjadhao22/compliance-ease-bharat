import { format } from "date-fns";
import { PF_CONFIG } from "../config/socialSecurity/pfEsicConfig";

export interface EPFRecord {
  uan: string;
  name: string;
  grossWages: number;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  eeShare: number;
  epsContribution: number;
  erShare: number;
  ncpDays: number;
  refundOfAdvances: number;
}

/**
 * Generate EPF ECR text file content from payroll run data.
 * The output is separated by #~# as per EPFO ECR version 2.0 format.
 * Note: Final upload to the Shram Suvidha / EPFO Unified Portal is manual.
 */
export function generateEpfEcrText(
  records: EPFRecord[],
  monthYYYYMM: string,
  establishmentId: string = "MHPUN12345"
): string {
  let content = "Salary Details\n";
  content += `Return Month: ${monthYYYYMM} (MMYYYY)\n`;
  content += `Establishment ID: ${establishmentId}\n`;
  content += `ECR Submitted Date: ${format(new Date(), "dd/MM/yyyy")}\n\n`;
  content += "UAN|Member Name|Gross Wages|EPF Wages|EPS Wages|EDLI Wages|EE Share|EPS Contribution|ER Share|NCP Days|Refund of Advances\n";

  records.forEach((record) => {
    const uan = (record.uan || "000000000000").padStart(12, "0");
    const name = (record.name || "UNKNOWN").toUpperCase().replace(/[^A-Z\s.]/g, "").slice(0, 85);
    const gross = Math.round(record.grossWages);
    const epfWages = Math.round(record.epfWages);
    const epsWages = Math.min(Math.round(record.epfWages), PF_CONFIG.wageCeiling);
    const edliWages = epsWages;
    
    // Validate bounds
    const eeShare = Math.round(record.eeShare);
    const epsContribution = Math.round(record.epsContribution);
    const erShare = Math.round(record.erShare); // Total employer minus EPS
    
    const ncpDays = record.ncpDays;
    const advances = record.refundOfAdvances;

    const line = [
      uan,
      name,
      gross.toString().padStart(10, "0"),
      epfWages.toString().padStart(10, "0"),
      epsWages.toString().padStart(10, "0"),
      edliWages.toString().padStart(10, "0"),
      eeShare.toString().padStart(10, "0"),
      epsContribution.toString().padStart(10, "0"),
      erShare.toString().padStart(10, "0"),
      ncpDays.toString().padStart(3, "0"),
      advances.toString(),
    ].join("#~#");

    content += line + "\n";
  });

  return content;
}
