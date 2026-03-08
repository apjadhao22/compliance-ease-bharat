import { Citation } from '../wage/types';

// Under the OSH Code, 2020:
// Working hours covered under Chapter VI

export interface WorkingHoursConfig {
  stateOrUT: string;
  establishmentType: string;
  maxDailyHours: number;
  maxWeeklyHours: number;
  maxSpreadOverDaily: number;
  maxOvertimeQuarterly: number; // usually 125 hours
  overtimeRateMultiplier: number; // usually 2x
  citation: Citation;
}

export const NATIONAL_OSH_WORKING_HOURS: WorkingHoursConfig = {
  stateOrUT: 'National/Default',
  establishmentType: 'All',
  maxDailyHours: 8,
  maxWeeklyHours: 48,
  maxSpreadOverDaily: 10.5, // Daily working hours + resting intervals cannot exceed this
  maxOvertimeQuarterly: 125,
  overtimeRateMultiplier: 2.0,
  citation: {
    codeName: 'Occupational Safety, Health and Working Conditions Code, 2020',
    sectionOrRule: 'Chapter VI, Section 25 & 27',
    url: 'https://labour.gov.in/sites/default/files/OSH_Code_2020.pdf'
  }
};

// TODO: Add state-specific overrides as state rules are notified.
export const STATE_OSH_WORKING_HOURS: WorkingHoursConfig[] = [
  // E.g. Maharashtra Factories Rules 202X etc...
];
