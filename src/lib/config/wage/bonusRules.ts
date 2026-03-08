export const BONUS_RULES = {
  minPercentage: 8.33,
  maxPercentage: 20.0,
  eligibilityWageCeiling: 21000,
  calculationCeiling: 7000, // Or the minimum wage for the scheduled employment, whichever is higher
  minWorkingDays: 30, // Minimum days worked in accounting year to be eligible
  citations: [
    {
      actName: "Payment of Bonus Act, 1965 / Code on Wages, 2019",
      section: "Section 10 / Section 26",
      url: "https://labour.gov.in/sites/default/files/THE_CODE_ON_WAGES_2019.pdf"
    }
  ]
};
