import { Citation } from '../wage/types';

// Under the Code on Social Security, 2020:
// PF covered under Chapter III
// ESIC covered under Chapter IV

export interface PFConfig {
  employeeRate: number; // 12% usually
  employerPFRate: number; // 3.67%
  employerEPSRate: number; // 8.33%
  wageCeiling: number; // 15000 currently
  isApplicableForWorkerTypes: string[]; // 'employee', 'contract' typically
  citation: Citation;
}

export interface ESICConfig {
  employeeRate: number; // 0.75%
  employerRate: number; // 3.25%
  wageCeiling: number; // 21000 currently
  isApplicableForWorkerTypes: string[]; // 'employee', 'contract'
  hazardousEstablishmentApplicability: string; // e.g., 'Even for 1 employee if hazardous'
  citation: Citation;
}

export const PF_CONFIG: PFConfig = {
  employeeRate: 0.12,
  employerPFRate: 0.0367,
  employerEPSRate: 0.0833,
  wageCeiling: 15000,
  isApplicableForWorkerTypes: ['employee', 'contract', 'fixed_term'],
  citation: {
    codeName: 'Code on Social Security, 2020',
    sectionOrRule: 'Chapter III, Section 16',
    url: 'https://labour.gov.in/sites/default/files/SS_Code_2020.pdf'
  }
};

export const ESIC_CONFIG: ESICConfig = {
  employeeRate: 0.0075,
  employerRate: 0.0325,
  wageCeiling: 21000,
  hazardousEstablishmentApplicability: 'Applicable even for a single employee if hazardous establishment/factory',
  isApplicableForWorkerTypes: ['employee', 'contract', 'fixed_term'],
  citation: {
    codeName: 'Code on Social Security, 2020',
    sectionOrRule: 'Chapter IV, Section 29',
    url: 'https://labour.gov.in/sites/default/files/SS_Code_2020.pdf'
  }
};
