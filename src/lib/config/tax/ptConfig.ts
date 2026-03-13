import { Citation } from '../wage/types';

export interface PTSlab {
  min: number;
  max: number;       // use Infinity for open-ended
  amount: number;
}

export interface PTStateConfig {
  state: string;
  stateCode: string;  // e.g. "MH", "KA", "WB"
  isApplicable: boolean;  // false for Delhi, Haryana, RJ, UP, UK, etc.
  slabs: PTSlab[];
  genderSpecificSlabs?: {  // Maharashtra has different slabs for male/female
    male: PTSlab[];
    female: PTSlab[];
  };
  frequency: 'monthly' | 'half-yearly' | 'annual' | 'N/A';  // KL/TN/Puducherry=half-yearly, MP/BI/JH/OD=annual
  annualCap: number | null;  // e.g. 2500 for AP, MP, OD; null if no cap
  febAdjustment: boolean;    // whether special-month adjustment applies (MH March, KA Feb)
  specialMonth?: number;     // 2=February, 3=March — which month gets the higher rate
  specialMonthAmount?: number; // the higher amount for that month (typically ₹300)
  formNames: string[];       // e.g. ["Form III", "Form IIIA"]
  filingUrl: string;
  citation: Citation;
  notes?: string;  // e.g. "Act exists but not enforced" for Delhi
}

export const PT_STATE_CONFIGS: PTStateConfig[] = [
  {
    state: "Maharashtra", stateCode: "MH", isApplicable: true, frequency: "monthly",
    annualCap: null, febAdjustment: true, specialMonth: 2, specialMonthAmount: 300,
    formNames: ["Form III", "Form IIIA"], filingUrl: "https://mahagst.gov.in/",
    citation: { sectionOrRule: "Schedule I", codeName: "MH State Tax on Professions Act, 1975" },
    slabs: [],
    genderSpecificSlabs: {
      male: [
        { min: 0, max: 7500, amount: 0 },
        { min: 7501, max: 10000, amount: 175 },
        { min: 10001, max: Infinity, amount: 200 }
      ],
      female: [
        { min: 0, max: 25000, amount: 0 },
        { min: 25001, max: Infinity, amount: 200 }
      ]
    }
  },
  {
    state: "Karnataka", stateCode: "KA", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 24999, amount: 0 },
      { min: 25000, max: Infinity, amount: 200 }
    ],
    annualCap: 2500, febAdjustment: true, specialMonth: 2, specialMonthAmount: 300,
    formNames: ["Form 5A"], filingUrl: "https://ptax.kar.nic.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Karnataka Tax on Professions Act, 1976 (Revised 2025)" }
  },
  {
    state: "TamilNadu", stateCode: "TN", isApplicable: true, frequency: "half-yearly", slabs: [
      { min: 0, max: 21000, amount: 0 },
      { min: 21001, max: 30000, amount: 180 },
      { min: 30001, max: 45000, amount: 425 },
      { min: 45001, max: 60000, amount: 930 },
      { min: 60001, max: 75000, amount: 1025 },
      { min: 75001, max: 100000, amount: 1250 },
      { min: 100001, max: Infinity, amount: 1250 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Form I"], filingUrl: "https://tn.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "TN Tax on Professions Act, 1992" }
  },
  {
    state: "Telangana", stateCode: "TG", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: Infinity, amount: 200 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Form II"], filingUrl: "https://tg.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "TG Tax on Professions Act, 1987" }
  },
  {
    state: "Kerala", stateCode: "KL", isApplicable: true, frequency: "half-yearly", slabs: [
      { min: 0, max: 11999, amount: 0 },
      { min: 12000, max: 17999, amount: 320 },
      { min: 18000, max: 29999, amount: 450 },
      { min: 30000, max: 44999, amount: 600 },
      { min: 45000, max: 99999, amount: 750 },
      { min: 100000, max: 124999, amount: 1000 },
      { min: 125000, max: 200000, amount: 1250 },
      { min: 200001, max: Infinity, amount: 1250 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Form II"], filingUrl: "https://kerala.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Kerala Tax on Professions Act" }
  },
  {
    state: "Gujarat", stateCode: "GJ", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 11999, amount: 0 },
      { min: 12000, max: Infinity, amount: 200 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Form III"], filingUrl: "https://gujarat.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Gujarat Tax on Professions Act, 1976" }
  },
  {
    state: "WestBengal", stateCode: "WB", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 10000, amount: 0 },
      { min: 10001, max: 15000, amount: 110 },
      { min: 15001, max: 25000, amount: 130 },
      { min: 25001, max: 40000, amount: 150 },
      { min: 40001, max: Infinity, amount: 200 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Form III", "Annual Return"], filingUrl: "https://wbprofessiontax.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "West Bengal State Tax on Professions, Trades, Callings and Employments Act, 1979" }
  },
  {
    state: "AndhraPradesh", stateCode: "AP", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: Infinity, amount: 200 }
    ],
    annualCap: 2500, febAdjustment: true, specialMonth: 2, specialMonthAmount: 300, formNames: ["Form V"], filingUrl: "https://apct.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "AP Tax on Professions Act, 1987" }
  },
  {
    state: "MadhyaPradesh", stateCode: "MP", isApplicable: true, frequency: "annual", slabs: [
      { min: 0, max: 225000, amount: 0 },
      { min: 225001, max: 300000, amount: 1500 },
      { min: 300001, max: 400000, amount: 2000 },
      { min: 400001, max: Infinity, amount: 2500 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["e-Return"], filingUrl: "https://mptax.mp.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "MP Vritti Kar Adhiniyam, 1995" }
  },
  {
    state: "Assam", stateCode: "AS", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 25000, amount: 180 },
      { min: 25001, max: Infinity, amount: 208 } // To hit 2500 approximately (208*11+212)
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["Manual returns"], filingUrl: "https://tax.assam.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Assam Professions, Trades, Callings and Employments Taxation Act, 1947" }
  },
  {
    state: "Odisha", stateCode: "OD", isApplicable: true, frequency: "annual", slabs: [
      { min: 0, max: 160000, amount: 0 },
      { min: 160001, max: 300000, amount: 1500 },
      { min: 300001, max: Infinity, amount: 2400 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["e-Filing"], filingUrl: "https://odishatax.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Odisha State Tax on Professions Act" }
  },
  {
    state: "Jharkhand", stateCode: "JH", isApplicable: true, frequency: "annual", slabs: [
      { min: 0, max: 300000, amount: 0 },
      { min: 300001, max: 500000, amount: 1200 },
      { min: 500001, max: 800000, amount: 1800 },
      { min: 800001, max: 1000000, amount: 2100 },
      { min: 1000001, max: Infinity, amount: 2500 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["e-Filing via JTAX"], filingUrl: "https://jharkhand.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Jharkhand Tax on Professions Act, 2011" }
  },
  {
    state: "Bihar", stateCode: "BR", isApplicable: true, frequency: "annual", slabs: [
      { min: 0, max: 300000, amount: 0 },
      { min: 300001, max: 500000, amount: 1000 },
      { min: 500001, max: 1000000, amount: 2000 },
      { min: 1000001, max: Infinity, amount: 2500 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["Manual"], filingUrl: "https://state.bihar.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Bihar State Tax on Professions Act, 2011" }
  },
  {
    state: "Meghalaya", stateCode: "ML", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 50000, amount: 0 },
      { min: 50001, max: 75000, amount: 200 },
      { min: 75001, max: 100000, amount: 300 },
      { min: 100001, max: 150000, amount: 500 },
      { min: 150001, max: 200000, amount: 750 },
      { min: 200001, max: 250000, amount: 1000 },
      { min: 250001, max: 300000, amount: 1250 },
      { min: 300001, max: 350000, amount: 1500 },
      { min: 350001, max: 400000, amount: 1800 },
      { min: 400001, max: 450000, amount: 2100 },
      { min: 450001, max: 500000, amount: 2400 },
      { min: 500001, max: Infinity, amount: 2500 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Manual"], filingUrl: "https://meghalaya.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Meghalaya Professions, Trades, Callings and Employments Taxation Act" }
  },
  {
    state: "Tripura", stateCode: "TR", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 7500, amount: 0 },
      { min: 7501, max: 15000, amount: 150 },
      { min: 15001, max: Infinity, amount: 208 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["Manual"], filingUrl: "https://tripura.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Tripura Professions Taxation Act" }
  },
  {
    state: "Manipur", stateCode: "MN", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 50000, amount: 0 },
      { min: 50001, max: 75000, amount: 100 }, // 1200/yr -> 100/mo
      { min: 75001, max: 100000, amount: 166.67 }, // 2000/yr
      { min: 100001, max: 125000, amount: 200 }, // 2400/yr
      { min: 125001, max: Infinity, amount: 208 } // 2500/yr
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["Manual"], filingUrl: "https://manipur.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Manipur Professions, Trades, Callings and Employments Taxation Act" }
  },
  {
    state: "Sikkim", stateCode: "SK", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 20000, amount: 0 },
      { min: 20001, max: 30000, amount: 125 },
      { min: 30001, max: 40000, amount: 150 },
      { min: 40001, max: Infinity, amount: 200 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["Manual"], filingUrl: "https://sikkim.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Sikkim Tax on Professions Act, 2006" }
  },
  {
    state: "Chhattisgarh", stateCode: "CG", isApplicable: true, frequency: "annual", slabs: [
      { min: 0, max: 225000, amount: 0 },
      { min: 225001, max: 300000, amount: 1500 },
      { min: 300001, max: Infinity, amount: 2500 }
    ],
    annualCap: 2500, febAdjustment: false, formNames: ["e-Filing"], filingUrl: "https://cgcommercialtax.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Chhattisgarh Vritti Kar Adhiniyam, 1995" }
  },
  {
    state: "Goa", stateCode: "GA", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 25000, amount: 150 },
      { min: 25001, max: Infinity, amount: 200 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Manual/e-Filing"], filingUrl: "https://goacomtax.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Goa Tax on Professions Act" }
  },
  {
    state: "Punjab", stateCode: "PB", isApplicable: true, frequency: "monthly", slabs: [
      { min: 0, max: 25000, amount: 0 },
      { min: 25001, max: Infinity, amount: 200 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Manual"], filingUrl: "https://punjabtax.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Punjab State Development Tax Act, 2018" }
  },
  {
    state: "Puducherry", stateCode: "PY", isApplicable: true, frequency: "half-yearly", slabs: [
      { min: 0, max: 99999, amount: 0 },
      { min: 100000, max: 200000, amount: 250 },
      { min: 200001, max: 300000, amount: 500 },
      { min: 300001, max: 400000, amount: 750 },
      { min: 400001, max: 500000, amount: 1000 },
      { min: 500001, max: Infinity, amount: 1250 }
    ],
    annualCap: null, febAdjustment: false, formNames: ["Form"], filingUrl: "https://py.gov.in/",
    citation: { sectionOrRule: "Schedule", codeName: "Puducherry Tax on Professions Act" }
  },
  {
    state: "Delhi", stateCode: "DL", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "",
    citation: { sectionOrRule: "N/A", codeName: "Act exists but not enforced" }, notes: "Act exists but not enforced. Monitor for future implementation."
  },
  {
    state: "Rajasthan", stateCode: "RJ", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "UttarPradesh", stateCode: "UP", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "Uttarakhand", stateCode: "UK", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "Haryana", stateCode: "HR", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "HimachalPradesh", stateCode: "HP", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "JammuKashmir", stateCode: "JK", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "Ladakh", stateCode: "LA", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "AndamanNicobar", stateCode: "AN", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "Lakshadweep", stateCode: "LD", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "DadraNagarHaveliDamanDiu", stateCode: "DN", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "ArunachalPradesh", stateCode: "AR", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "Mizoram", stateCode: "MZ", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  },
  {
    state: "Nagaland", stateCode: "NL", isApplicable: false, frequency: "N/A", slabs: [],
    annualCap: null, febAdjustment: false, formNames: [], filingUrl: "", citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
  }
];

export const PT_CONFIG_BY_STATE: Record<string, PTStateConfig> = PT_STATE_CONFIGS.reduce((acc, config) => {
  acc[config.state] = config;
  return acc;
}, {} as Record<string, PTStateConfig>);

export function getAnnualPTCap(state: string): number | null {
  return PT_CONFIG_BY_STATE[state]?.annualCap ?? null;
}

export function adjustLastMonthPT(
  state: string,
  monthlyPT: number,
  ytdPTSoFar: number  // PT already deducted in months 1-11
): number {
  const cap = getAnnualPTCap(state);
  if (!cap) return monthlyPT;  // no cap, return normal amount
  const remaining = Math.max(0, cap - ytdPTSoFar);
  return Math.min(monthlyPT, remaining);
}
