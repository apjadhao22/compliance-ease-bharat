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
  // TODO: Add Zone II and Zone III for Maharashtra
  // TODO: Add configurations for Karnataka, Delhi, Tamil Nadu, etc.
];
