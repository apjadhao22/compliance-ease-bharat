export const MATERNITY_RULES = {
  maxWeeksNormalDelivery: 26,
  maxWeeksPrenatal: 8,
  maxWeeksPostNatal: 18,
  maxWeeksTubectomy: 2,
  maxWeeksMiscarriage: 6,
  maxWeeksSurrogacyOrAdoption: 12,
  minWorkingDaysPrecedingYear: 80, // Must have worked 80 days in the 12 months preceding delivery
  medicalBonus: 3500, // Payable if prenatal confinement care isn't provided free of charge by the employer
  citations: [
    {
      actName: "Maternity Benefit Act, 1961 / Code on Social Security, 2020",
      section: "Section 5 / Chapter VI (Section 59, 60)",
      url: "https://labour.gov.in/sites/default/files/SS_Code_2020.pdf"
    }
  ]
};
