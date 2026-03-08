export const WAGE_PAYMENT_RULES = {
  paymentDeadlines: {
    daily: "At the end of the shift",
    weekly: "Last working day of the week",
    fortnightly: "Before the end of the second day after the end of the fortnight",
    monthly: "Before the expiry of the seventh day of the succeeding month",
  },
  deductionLimits: {
    generalMaxPercentage: 50, // Generally, total deductions should not exceed 50% of wages
    cooperativeSocietyPercentage: 75, // Exceptions for cooperative societies
    prohibitedDeductions: [
      "Fines exceeding 3% of wages",
      "Fines imposed on persons under 15 years",
      "Deductions for damages not directly attributable to default/neglect",
    ]
  },
  citations: [
    {
      actName: "Code on Wages, 2019",
      section: "Chapter III (Payment of Wages) & Chapter IV (Deductions)",
      url: "https://labour.gov.in/sites/default/files/THE_CODE_ON_WAGES_2019.pdf"
    }
  ]
};
