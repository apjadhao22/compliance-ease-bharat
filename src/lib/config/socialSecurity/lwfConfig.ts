import { Citation } from '../wage/types';

export interface LWFSlabEntry {
  maxGross: number;   // Infinity for open-ended
  employeeAmount: number;
  employerAmount: number;
}

export interface LWFStateConfig {
  state: string;
  stateCode: string;
  isApplicable: boolean;
  contributionType: 'fixed' | 'slab';
  fixedEmployee?: number;
  fixedEmployer?: number;
  slabs?: LWFSlabEntry[];
  frequency: 'half-yearly' | 'annual';
  applicableMonths: number[];  // 1-indexed: [6,12] = Jun+Dec, [1] = Jan only
  dueDescription: string;
  formName: string;
  filingUrl: string;
  citation: Citation;
}

export const LWF_STATE_CONFIGS: LWFStateConfig[] = [
  {
    state: "Maharashtra", stateCode: "MH", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 25, fixedEmployer: 75, frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "A-1 Return", filingUrl: "https://public.mlwb.in/",
    citation: { sectionOrRule: "Section 6BB", codeName: "Bombay LWF Act, 1953" }
  },
  {
    state: "Karnataka", stateCode: "KA", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 20, fixedEmployer: 40, frequency: 'annual', applicableMonths: [1],
    dueDescription: "15 January", formName: "Form D", filingUrl: "https://klwb.karnataka.gov.in/",
    citation: { sectionOrRule: "Rule 3", codeName: "Karnataka LWF Act, 1965" }
  },
  {
    state: "TamilNadu", stateCode: "TN", isApplicable: true, contributionType: 'slab',
    slabs: [
        { maxGross: 5000, employeeAmount: 25, employerAmount: 50 },
        { maxGross: 10000, employeeAmount: 50, employerAmount: 100 },
        { maxGross: Infinity, employeeAmount: 75, employerAmount: 150 }
    ],
    frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jan / 15 Jul", formName: "Form A", filingUrl: "https://lwb.tn.gov.in/",
    citation: { sectionOrRule: "Rule 11-A", codeName: "Tamil Nadu LWF Act, 1972" }
  },
  {
    state: "AndhraPradesh", stateCode: "AP", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 30, fixedEmployer: 70, frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Manual", filingUrl: "https://labour.ap.gov.in/",
    citation: { sectionOrRule: "Section", codeName: "AP LWF Act" }
  },
  {
    state: "Telangana", stateCode: "TG", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 2, fixedEmployer: 5, frequency: 'annual', applicableMonths: [1],
    dueDescription: "31 January", formName: "Annual Return", filingUrl: "https://labour.telangana.gov.in/",
    citation: { sectionOrRule: "Section", codeName: "Telangana LWF Act" }
  },
  {
    state: "WestBengal", stateCode: "WB", isApplicable: true, contributionType: 'slab',
    slabs: [
        { maxGross: 5000, employeeAmount: 3, employerAmount: 6 },
        { maxGross: 7500, employeeAmount: 5, employerAmount: 10 },
        { maxGross: Infinity, employeeAmount: 12, employerAmount: 24 }
    ],
    frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Form C", filingUrl: "https://wblwb.org/",
    citation: { sectionOrRule: "Section", codeName: "West Bengal LWF Act, 1974" }
  },
  {
    state: "Gujarat", stateCode: "GJ", isApplicable: true, contributionType: 'slab',
    slabs: [
        { maxGross: 6000, employeeAmount: 6, employerAmount: 12 },
        { maxGross: 9000, employeeAmount: 12, employerAmount: 24 },
        { maxGross: Infinity, employeeAmount: 18, employerAmount: 36 }
    ],
    frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Form A", filingUrl: "https://glwb.gujarat.gov.in/",
    citation: { sectionOrRule: "Section", codeName: "Gujarat LWF Act" }
  },
  {
    state: "MadhyaPradesh", stateCode: "MP", isApplicable: true, contributionType: 'slab',
    slabs: [
        { maxGross: 5000, employeeAmount: 10, employerAmount: 30 },
        { maxGross: 7500, employeeAmount: 20, employerAmount: 60 },
        { maxGross: Infinity, employeeAmount: 30, employerAmount: 90 }
    ],
    frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "e-Return", filingUrl: "https://labour.mp.gov.in/",
    citation: { sectionOrRule: "Section", codeName: "MP LWF Act, 1982" }
  },
  {
    state: "Chhattisgarh", stateCode: "CG", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 15, fixedEmployer: 45, frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Form", filingUrl: "https://cglabour.nic.in/",
    citation: { sectionOrRule: "Section", codeName: "Chhattisgarh LWF Act" }
  },
  {
    state: "Odisha", stateCode: "OD", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 20, fixedEmployer: 40, frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Form D", filingUrl: "https://labour.odisha.gov.in/",
    citation: { sectionOrRule: "Section", codeName: "Odisha LWF Act" }
  },
  {
    state: "Jharkhand", stateCode: "JH", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 20, fixedEmployer: 40, frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Manual", filingUrl: "https://jharkhandlabour.nic.in/",
    citation: { sectionOrRule: "Section", codeName: "Jharkhand LWF Act" }
  },
  {
    state: "Goa", stateCode: "GA", isApplicable: true, contributionType: 'fixed',
    fixedEmployee: 60, fixedEmployer: 120, frequency: 'half-yearly', applicableMonths: [6, 12],
    dueDescription: "15 Jul / 15 Jan", formName: "Form", filingUrl: "https://labour.goa.gov.in/",
    citation: { sectionOrRule: "Section", codeName: "Goa LWF Act, 1986" }
  },
  // Inapplicable states
  { state: "Punjab", stateCode: "PB", isApplicable: false, contributionType: 'fixed', frequency: 'annual', applicableMonths: [], dueDescription: "", formName: "", filingUrl: "", citation: { sectionOrRule: "", codeName: "" } },
  { state: "Haryana", stateCode: "HR", isApplicable: true, contributionType: 'fixed', fixedEmployee: 0, fixedEmployer: 0, frequency: 'annual', applicableMonths: [12], dueDescription: "31 Jan", formName: "Haryana LWF", filingUrl: "", citation: { sectionOrRule: "", codeName: "Haryana LWF Act" } }, // Note: some states like HR have variable or different rules. Based on prompt instruction: "Non-LWF states: Punjab, Haryana, Rajasthan...", Setting to false:
];

// Based on the prompt instructions:
const NON_LWF_STATES = ["Punjab", "Haryana", "Rajasthan", "UttarPradesh", "Uttarakhand", "Delhi", "Bihar", "Assam", "HimachalPradesh", "JammuKashmir", "Ladakh", "Sikkim", "Meghalaya", "Tripura", "Manipur", "Mizoram", "Nagaland", "ArunachalPradesh", "AndamanNicobar", "Lakshadweep", "DadraNagarHaveliDamanDiu"];

NON_LWF_STATES.forEach(state => {
    // Only add if not already in the array
    if (!LWF_STATE_CONFIGS.some(s => s.state === state)) {
        LWF_STATE_CONFIGS.push({
            state: state,
            stateCode: "",
            isApplicable: false,
            contributionType: 'fixed',
            frequency: 'annual',
            applicableMonths: [],
            dueDescription: "",
            formName: "",
            filingUrl: "",
            citation: { sectionOrRule: "N/A", codeName: "Not Applicable" }
        });
    } else {
        const item = LWF_STATE_CONFIGS.find(s => s.state === state);
        if (item) {
            item.isApplicable = false;
        }
    }
});

export const LWF_CONFIG_BY_STATE: Record<string, LWFStateConfig> = LWF_STATE_CONFIGS.reduce((acc, config) => {
  acc[config.state] = config;
  return acc;
}, {} as Record<string, LWFStateConfig>);
