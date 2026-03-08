import { WageRate } from './types';

/**
 * National Floor Wage Configuration
 * Under Section 9 of the Code on Wages, 2019
 */
export const NATIONAL_FLOOR_WAGE: WageRate = {
  jurisdiction: 'National',
  amount: 4576, // Example floor wage (₹176/day * 26 days). Note: Current proposals are higher (~₹400/day), adjust as per actual latest notification.
  effectiveFrom: '2020-01-01', // Example date
  citation: {
    codeName: 'Code on Wages, 2019',
    sectionOrRule: 'Section 9',
    notificationNumber: 'S.O. XYZ(E)', // TODO: Update with real notification if available
    url: 'https://labour.gov.in/'
  }
};
