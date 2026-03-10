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

export const STATE_OSH_WORKING_HOURS: WorkingHoursConfig[] = [
  {
    stateOrUT: 'Maharashtra',
    establishmentType: 'Shops and Commercial Establishments',
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverDaily: 10.5,
    maxOvertimeQuarterly: 125,
    overtimeRateMultiplier: 2.0,
    citation: {
      codeName: 'Maharashtra Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2017',
      sectionOrRule: 'Section 12 & 14',
      url: 'https://mahakamgar.maharashtra.gov.in/images/pdf/maharashtra-shops-and-establishments-act-2017.pdf'
    }
  },
  {
    stateOrUT: 'Karnataka',
    establishmentType: 'Shops and Commercial Establishments',
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverDaily: 12, // Karnataka S&E Act 1961 permits wider spread-over of 12 hours
    maxOvertimeQuarterly: 125,
    overtimeRateMultiplier: 2.0,
    citation: {
      codeName: 'Karnataka Shops and Commercial Establishments Act, 1961',
      sectionOrRule: 'Section 7',
      url: 'https://labour.karnataka.gov.in/english'
    }
  },
  {
    stateOrUT: 'Delhi',
    establishmentType: 'Shops and Commercial Establishments',
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverDaily: 10.5,
    maxOvertimeQuarterly: 125,
    overtimeRateMultiplier: 2.0,
    citation: {
      codeName: 'Delhi Shops and Establishments Act, 1954',
      sectionOrRule: 'Section 8',
      url: 'https://labour.delhi.gov.in/'
    }
  },
  {
    stateOrUT: 'Telangana',
    establishmentType: 'Shops and Commercial Establishments',
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverDaily: 12,
    maxOvertimeQuarterly: 75,
    overtimeRateMultiplier: 2.0,
    citation: {
      codeName: 'Telangana Shops and Establishments Act, 1988',
      sectionOrRule: 'Section 15',
      url: 'https://labour.telangana.gov.in/'
    }
  }
];
