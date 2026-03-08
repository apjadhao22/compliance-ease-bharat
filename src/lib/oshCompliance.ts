import { Citation } from './config/wage/types';
import { NATIONAL_OSH_WORKING_HOURS, STATE_OSH_WORKING_HOURS, WorkingHoursConfig } from './config/osh/workingHours';

export interface TimesheetEntry {
  date: string;
  hoursWorked: number;
  spreadOverHours: number; // Total duration from log in to log out including breaks
}

export interface WorkingHoursValidationInput {
  employeeId: string;
  state: string;
  establishmentType?: string;
  weekStartDate: string;
  timesheetEntries: TimesheetEntry[];
  quarterlyOvertimeHoursAccumulated: number; // How many OT hours already done in this quarter before this week
}

export interface OSHViolation {
  issue: string;
  limitRule: number;
  actualValue: number;
  date?: string;
}

export interface WorkingHoursValidationResult {
  isCompliant: boolean;
  totalHoursWorked: number;
  overtimeHoursDue: number;
  statutoryOvertimeRateMultiplier: number;
  violations: OSHViolation[];
  citations: Citation[];
  newQuarterlyOvertimeAccumulated: number;
}

export function validateWorkingHours(input: WorkingHoursValidationInput): WorkingHoursValidationResult {
  let config = NATIONAL_OSH_WORKING_HOURS;
  let citations = [config.citation];
  
  // Try to find state override
  const stateOverride = STATE_OSH_WORKING_HOURS.find(
    s => s.stateOrUT.toLowerCase() === input.state.toLowerCase() &&
         (!input.establishmentType || s.establishmentType.toLowerCase() === input.establishmentType.toLowerCase())
  );

  if (stateOverride) {
    config = stateOverride;
    citations = [stateOverride.citation]; // Prioritise state-specific rule
  }

  let isCompliant = true;
  const violations: OSHViolation[] = [];
  let totalHoursWorked = 0;
  let currentWeekOvertime = 0;

  // 1. Daily Checks
  for (const entry of input.timesheetEntries) {
    totalHoursWorked += entry.hoursWorked;

    // Daily Hour Limit Check
    if (entry.hoursWorked > config.maxDailyHours) {
      // It's overtime. Note: Standard rule is overtime is calculated daily or weekly, whichever is higher
      const dailyOT = entry.hoursWorked - config.maxDailyHours;
      currentWeekOvertime += dailyOT;
      
      violations.push({
        issue: 'Daily working hours exceeded standard limit (Overtime applies)',
        limitRule: config.maxDailyHours,
        actualValue: entry.hoursWorked,
        date: entry.date
      });
    }

    // Spread-over Check
    if (entry.spreadOverHours > config.maxSpreadOverDaily) {
      isCompliant = false;
      violations.push({
        issue: 'Daily spread-over exceeded statutory limit',
        limitRule: config.maxSpreadOverDaily,
        actualValue: entry.spreadOverHours,
        date: entry.date
      });
    }
  }

  // 2. Weekly Hour Check
  const effectiveWeeklyOt = totalHoursWorked > config.maxWeeklyHours 
    ? totalHoursWorked - config.maxWeeklyHours 
    : 0;

  // statutory OT is daily or weekly OT, whichever is more beneficial to worker
  const standardOvertimeHoursDue = Math.max(currentWeekOvertime, effectiveWeeklyOt);

  if (totalHoursWorked > config.maxWeeklyHours) {
    violations.push({
      issue: 'Weekly working hours exceeded standard limit (Overtime applies)',
      limitRule: config.maxWeeklyHours,
      actualValue: totalHoursWorked
    });
  }

  // 3. Quarterly OT Ceiling Check
  const newQuarterlyTotal = input.quarterlyOvertimeHoursAccumulated + standardOvertimeHoursDue;
  if (newQuarterlyTotal > config.maxOvertimeQuarterly) {
    isCompliant = false;
    violations.push({
      issue: 'Quarterly overtime ceiling exceeded limit',
      limitRule: config.maxOvertimeQuarterly,
      actualValue: newQuarterlyTotal
    });
  }

  return {
    isCompliant,
    totalHoursWorked,
    overtimeHoursDue: standardOvertimeHoursDue,
    statutoryOvertimeRateMultiplier: config.overtimeRateMultiplier,
    violations,
    citations,
    newQuarterlyOvertimeAccumulated: newQuarterlyTotal
  };
}

export function checkWomenNightShift(gender: string | null | undefined, shiftStartHour: number, shiftEndHour: number, consentProvided: boolean): { allowed: boolean, warning?: string, citation: Citation } {
  const isFemale = gender && gender.toLowerCase() === 'female';
  
  // Night shift definition generally between 7 PM and 6 AM under OSH Section 43
  // Simplistic hour check (integer 0-23 hours)
  const isNightShift = (shiftStartHour >= 19 || shiftStartHour < 6) || (shiftEndHour > 19 || shiftEndHour <= 6) || (shiftStartHour > shiftEndHour); // Crosses midnight

  const citation = {
    codeName: 'Occupational Safety, Health and Working Conditions Code, 2020',
    sectionOrRule: 'Chapter X, Section 43',
    url: 'https://labour.gov.in/sites/default/files/OSH_Code_2020.pdf'
  };

  if (isFemale && isNightShift) {
    if (!consentProvided) {
      return {
        allowed: false,
        warning: 'Statutory prohibition: Women employees cannot be assigned night shifts between 7 PM and 6 AM without explicit consent and adequate safety measures.',
        citation
      };
    } else {
      return {
        allowed: true, // allowed but requires conditions
        warning: 'Ensure adequate safeguards (transport, security, amenities) are documented under OSH Section 43 conditions.',
        citation
      };
    }
  }

  return { allowed: true, citation };
}
