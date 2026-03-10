export type StateRule = {
  state: string;
  maxDailyHours: number;
  maxWeeklyHours: number;
  maxSpreadOverHours: number;
  maxContinuousHoursBeforeRest: number;
  minRestIntervalHours: number;
  mandatoryWeeklyOffOptions: string[];
  remarks: string[];
  citations: {
    actName: string;
    section: string;
    url: string;
  }[];
};

export const SE_WORKING_HOURS: Record<string, StateRule> = {
  Maharashtra: {
    state: "Maharashtra",
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverHours: 10.5,
    maxContinuousHoursBeforeRest: 5,
    minRestIntervalHours: 0.5,
    mandatoryWeeklyOffOptions: ["Sunday", "Any other day with notice"],
    remarks: [
      "Commercial establishments: no opening before 7:00 AM, no closing after 9:30 PM without exemptions.",
      "IT/ITES establishments usually enjoy continuous operations exemptions but must provide equivalent compensatory rest.",
    ],
    citations: [
      {
        actName: "Maharashtra Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2017",
        section: "Sections 12-16",
        url: "https://mahakamgar.maharashtra.gov.in/lc-laws-and-rules.htm",
      },
    ],
  },
  Karnataka: {
    state: "Karnataka",
    maxDailyHours: 9, // Includes rest intervals, spread over is 12
    maxWeeklyHours: 48,
    maxSpreadOverHours: 12,
    maxContinuousHoursBeforeRest: 5,
    minRestIntervalHours: 1, // Karnataka generally mandates 1 hour rest after 5 hours
    mandatoryWeeklyOffOptions: ["Sunday", "Another fixed day of the week"],
    remarks: [
      "IT/ITES companies in Karnataka are repeatedly exempted from Chapter III (opening/closing hours) subject to conditions like transport for women in night shifts.",
    ],
    citations: [
      {
        actName: "Karnataka Shops and Commercial Establishments Act, 1961",
        section: "Sections 7-12",
        url: "https://labour.karnataka.gov.in/english",
      },
    ],
  },
  Delhi: {
    state: "Delhi",
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverHours: 10.5,
    maxContinuousHoursBeforeRest: 5,
    minRestIntervalHours: 0.5,
    mandatoryWeeklyOffOptions: ["Sunday"], // Sometimes district magistrates notify different closed days
    remarks: [
      "Delhi Govt permits 24x7 operations for retail and commercial establishments subject to condition of not working an employee beyond 9 hrs/day.",
    ],
    citations: [
      {
        actName: "Delhi Shops and Establishments Act, 1954",
        section: "Sections 8-10",
        url: "https://labour.delhi.gov.in/",
      },
    ],
  },
  Telangana: {
    state: "Telangana",
    maxDailyHours: 9,
    maxWeeklyHours: 48,
    maxSpreadOverHours: 12,
    maxContinuousHoursBeforeRest: 5,
    minRestIntervalHours: 1,
    mandatoryWeeklyOffOptions: ["Sunday"],
    remarks: [
      "Telangana S&E Act 1988 (as amended) applies to all shops and commercial establishments.",
      "IT/ITES establishments may receive exemptions from opening/closing hours but must comply with daily/weekly limits.",
    ],
    citations: [
      {
        actName: "Telangana Shops and Establishments Act, 1988",
        section: "Sections 15-17",
        url: "https://labour.telangana.gov.in/",
      },
    ],
  },
};
