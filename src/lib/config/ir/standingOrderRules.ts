import { Citation } from '../wage/types';

export interface StandingOrderConfig {
  headcountThreshold: number; // usually 300 under IR Code (was 100/50 under older acts)
  citation: Citation;
}

export const IR_STANDING_ORDERS_RULES: StandingOrderConfig = {
  headcountThreshold: 300, // Chapter IV, Section 28 of IR Code 2020
  citation: {
    codeName: 'Industrial Relations Code, 2020',
    sectionOrRule: 'Chapter IV, Section 28',
    url: 'https://labour.gov.in/sites/default/files/IR_Code_2020.pdf'
  }
};

export interface GrievanceRedressalConfig {
  headcountThreshold: number; // 20 or more under IR Code Section 4
  maxMembers: number; // max 10
  citation: Citation;
}

export const IR_GRIEVANCE_RULES: GrievanceRedressalConfig = {
  headcountThreshold: 20, // Chapter II, Section 4 of IR Code 2020
  maxMembers: 10,
  citation: {
    codeName: 'Industrial Relations Code, 2020',
    sectionOrRule: 'Chapter II, Section 4',
    url: 'https://labour.gov.in/sites/default/files/IR_Code_2020.pdf'
  }
};
