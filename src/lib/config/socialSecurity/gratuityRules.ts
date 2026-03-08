export const GRATUITY_RULES = {
  calculationFactor: 15 / 26, // 15 days out of a 26 day working month
  minYearsContinuousService: 5,
  minYearsFixedTerm: 1, // Fixed-term employees get pro-rata gratuity if tenure > 1 year
  ceilingAmount: 2000000, // 20 Lakhs max cap
  citations: [
    {
      actName: "Payment of Gratuity Act, 1972 / Code on Social Security, 2020",
      section: "Section 4 / Chapter V (Section 53)",
      url: "https://labour.gov.in/sites/default/files/SS_Code_2020.pdf"
    }
  ]
};
