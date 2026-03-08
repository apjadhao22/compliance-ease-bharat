export interface Citation {
  codeName: string;
  sectionOrRule: string;
  notificationNumber?: string;
  notificationDate?: string;
  url?: string;
}

export type Jurisdiction = 'National' | 'State' | 'UT';

export interface WageRate {
  jurisdiction: Jurisdiction;
  stateOrUT?: string;
  category?: string;        // e.g. "Shops and Establishments", "Engineering"
  skillLevel?: string;     // e.g. "Unskilled", "Semi-Skilled", "Skilled", "Highly Skilled"
  zone?: string;           // e.g. "Zone I", "Zone II"
  amount: number;          // Per month by default, or could be per day. We'll standardise on Monthly Gross Minimum
  effectiveFrom: string;   // ISO Date
  effectiveTo?: string;    // ISO Date
  citation: Citation;
}
