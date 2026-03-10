import { WageRate } from './types';

/**
 * State-wise Minimum Wage Configurations
 * Note: These are monthly rates (Basic + VDA) typically for 26 days of work.
 */
export const STATE_MINIMUM_WAGES: WageRate[] = [
  // Maharashtra - Shops and Establishments (Effective April 2024 - March 2025 roughly)
  // Zone I = Municipal Corporations of Greater Mumbai, Navi Mumbai, Thane, Pune, Nagpur, etc.
  {
    jurisdiction: 'State',
    stateOrUT: 'Maharashtra',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Unskilled',
    zone: 'Zone I',
    amount: 12816, // Example/current valid from calculation.ts
    effectiveFrom: '2024-04-01',
    citation: {
      codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019',
      sectionOrRule: 'Section 3 / Section 6',
      notificationDate: '2024-03-31',
      url: 'https://mahakamgar.maharashtra.gov.in/' // TODO: Replace with exact PDF link
    }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Maharashtra',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Semi-Skilled',
    zone: 'Zone I',
    amount: 13996,
    effectiveFrom: '2024-04-01',
    citation: {
      codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019',
      sectionOrRule: 'Section 3 / Section 6',
      url: 'https://mahakamgar.maharashtra.gov.in/'
    }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Maharashtra',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Skilled',
    zone: 'Zone I',
    amount: 15296,
    effectiveFrom: '2024-04-01',
    citation: {
      codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019',
      sectionOrRule: 'Section 3 / Section 6',
      url: 'https://mahakamgar.maharashtra.gov.in/'
    }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Maharashtra',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Highly Skilled',
    zone: 'Zone I',
    amount: 17056,
    effectiveFrom: '2024-04-01',
    citation: {
      codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019',
      sectionOrRule: 'Section 3 / Section 6',
      url: 'https://mahakamgar.maharashtra.gov.in/'
    }
  },
  // Karnataka - Shops & Commercial Establishments (Zone 1 - Bangalore)
  {
    jurisdiction: 'State',
    stateOrUT: 'Karnataka',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Unskilled',
    zone: 'Zone I',
    amount: 14000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.karnataka.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Karnataka',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Semi-Skilled',
    zone: 'Zone I',
    amount: 15000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.karnataka.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Karnataka',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Skilled',
    zone: 'Zone I',
    amount: 16000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.karnataka.gov.in/' }
  },
  // Delhi - All Establishments
  {
    jurisdiction: 'State',
    stateOrUT: 'Delhi',
    category: 'All',
    skillLevel: 'Unskilled',
    zone: 'All',
    amount: 17494,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.delhi.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Delhi',
    category: 'All',
    skillLevel: 'Semi-Skilled',
    zone: 'All',
    amount: 19279,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.delhi.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Delhi',
    category: 'All',
    skillLevel: 'Skilled',
    zone: 'All',
    amount: 21215,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.delhi.gov.in/' }
  },
  // Telangana - Shops & Commercial Establishments
  {
    jurisdiction: 'State',
    stateOrUT: 'Telangana',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Unskilled',
    zone: 'All',
    amount: 13000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019', sectionOrRule: 'G.O. Ms. No. 1/2024', url: 'https://labour.telangana.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Telangana',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Semi-Skilled',
    zone: 'All',
    amount: 14000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019', sectionOrRule: 'G.O. Ms. No. 1/2024', url: 'https://labour.telangana.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Telangana',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Skilled',
    zone: 'All',
    amount: 15500,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019', sectionOrRule: 'G.O. Ms. No. 1/2024', url: 'https://labour.telangana.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'Telangana',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Highly Skilled',
    zone: 'All',
    amount: 17000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948 / Code on Wages, 2019', sectionOrRule: 'G.O. Ms. No. 1/2024', url: 'https://labour.telangana.gov.in/' }
  },
  // Tamil Nadu - Shops & Commercial Establishments (Zone A)
  {
    jurisdiction: 'State',
    stateOrUT: 'TamilNadu',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Unskilled',
    zone: 'Zone A',
    amount: 11000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.tn.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'TamilNadu',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Semi-Skilled',
    zone: 'Zone A',
    amount: 12000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.tn.gov.in/' }
  },
  {
    jurisdiction: 'State',
    stateOrUT: 'TamilNadu',
    category: 'Shops and Commercial Establishments',
    skillLevel: 'Skilled',
    zone: 'Zone A',
    amount: 13000,
    effectiveFrom: '2024-04-01',
    citation: { codeName: 'Minimum Wages Act, 1948', sectionOrRule: 'Section 3', url: 'https://labour.tn.gov.in/' }
  }
];
