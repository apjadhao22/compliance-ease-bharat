import { Citation } from '../wage/types';

export interface WelfareConfig {
  canteenWorkerThreshold: number;
  crecheWorkerThreshold: number;
  welfareOfficerThreshold: number;
  safetyCommitteeThreshold: number;
  medicalCheckupFrequency: 'annual' | 'bi-annual' | 'pre-employment';
  citation: Citation;
}

export const OSH_WELFARE_RULES: WelfareConfig = {
  canteenWorkerThreshold: 100, // Section 24(1)(b)
  crecheWorkerThreshold: 50,   // Section 24(1)(d)
  welfareOfficerThreshold: 250, // Section 24(1)(a)
  safetyCommitteeThreshold: 250, // Section 22(1)
  medicalCheckupFrequency: 'annual', // Section 6(1)(c)
  citation: {
    codeName: 'Occupational Safety, Health and Working Conditions Code, 2020',
    sectionOrRule: 'Chapter V (Welfare), Chapter IV (Committees), Chapter II (Duties of Employer)',
    url: 'https://labour.gov.in/sites/default/files/OSH_Code_2020.pdf'
  }
};
