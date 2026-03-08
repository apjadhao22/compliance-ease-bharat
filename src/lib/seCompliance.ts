import { SE_WORKING_HOURS, StateRule } from './config/se/workingHours';
import { TimesheetEntry } from './oshCompliance';

export interface SEValidationResult {
  isCompliant: boolean;
  stateRuleApplied: string | null;
  violations: {
    issue: string;
    date?: string;
    limit: number | string;
    actual: number | string;
  }[];
  warnings: string[];
}

/**
 * Validates timesheet entries against State Shops & Establishments (S&E) rules.
 * @param state Name of the state (e.g., "Maharashtra")
 * @param timesheetEntries Array of daily worked hours and spread-over hours
 */
export function validateSEWorkingHours(state: string, timesheetEntries: TimesheetEntry[]): SEValidationResult {
  const rule: StateRule | undefined = SE_WORKING_HOURS[state];
  
  if (!rule) {
    return {
      isCompliant: true,
      stateRuleApplied: null,
      violations: [],
      warnings: [`No specific S&E working hours config found for state: ${state}. Falling back to national OSH rules.`]
    };
  }

  let isCompliant = true;
  const violations: SEValidationResult["violations"] = [];
  let totalSWeekHours = 0;

  for (const entry of timesheetEntries) {
    totalSWeekHours += entry.hoursWorked;

    // Daily Limit Check
    if (entry.hoursWorked > rule.maxDailyHours) {
      isCompliant = false;
      violations.push({
        issue: `Daily working hours exceeded S&E limit for ${state}`,
        date: entry.date,
        limit: rule.maxDailyHours,
        actual: entry.hoursWorked
      });
    }

    // Spread-over Check
    if (entry.spreadOverHours > rule.maxSpreadOverHours) {
      isCompliant = false;
      violations.push({
        issue: `Daily spread-over exceeded S&E limit for ${state}`,
        date: entry.date,
        limit: rule.maxSpreadOverHours,
        actual: entry.spreadOverHours
      });
    }
  }

  // Weekly Limit Check
  if (totalSWeekHours > rule.maxWeeklyHours) {
    isCompliant = false;
    violations.push({
      issue: `Weekly working hours exceeded S&E limit for ${state}`,
      limit: rule.maxWeeklyHours,
      actual: totalSWeekHours
    });
  }

  return {
    isCompliant,
    stateRuleApplied: state,
    violations,
    warnings: []
  };
}
