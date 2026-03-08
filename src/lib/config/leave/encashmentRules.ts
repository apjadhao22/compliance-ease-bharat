import { Citation } from '../wage/types';

export interface LeaveEncashmentConfig {
  maxEncashmentDaysLimit: number; // usually 30 days limit for encashment at end of year
  carryForwardLimit: number; // usually 30 days
  citation: Citation;
}

export const ANNUAL_LEAVE_ENCASHMENT_RULES: LeaveEncashmentConfig = {
  maxEncashmentDaysLimit: 30, // Section 32(3)
  carryForwardLimit: 30, // Section 32(3)
  citation: {
    codeName: 'Occupational Safety, Health and Working Conditions Code, 2020',
    sectionOrRule: 'Chapter VII, Section 32',
    url: 'https://labour.gov.in/sites/default/files/OSH_Code_2020.pdf'
  }
};
