/**
 * Code on Social Security, 2020: Chapter IX
 * Provision of Social Security for Unorganised Workers, Gig Workers and Platform Workers
 */

export interface AggregatorCessInput {
  companyId: string;
  financialYear: string;
  annualTurnover: number;
  amountPayableToGigWorkers: number;
}

export interface CessCalculationResult {
  estimatedContribution: number;
  turnoverCess: number;
  gigWorkerCap: number;
  isCompliant: boolean;
  citation: { codeName: string; sectionOrRule: string; url: string };
}

/**
 * Calculates the statutory cess payable by Aggregators (e.g. food delivery, ride-sharing apps)
 * towards the Social Security Fund for Gig and Platform Workers.
 * 
 * Target Rate: 1% to 2% of annual turnover, NOT EXCEEDING 5% of the amount payable to gig/platform workers.
 */
export function calculateAggregatorCess(input: AggregatorCessInput): CessCalculationResult {
  const TURNOVER_RATE = 0.01; // Assuming 1% as the lowest notified bound
  const GIG_WAGE_CAP_RATE = 0.05; // 5% cap on amount paid

  const turnoverCess = input.annualTurnover * TURNOVER_RATE;
  const gigWorkerCap = input.amountPayableToGigWorkers * GIG_WAGE_CAP_RATE;
  
  // TODO: Implement actual final notified rate bounds once MoLE publishes the exact percentage 
  // currently it's a range (1 to 2%), we use 1% here.
  
  const estimatedContribution = Math.min(turnoverCess, gigWorkerCap);

  return {
    estimatedContribution,
    turnoverCess,
    gigWorkerCap,
    isCompliant: true,
    citation: {
      codeName: 'Code on Social Security, 2020',
      sectionOrRule: 'Chapter IX, Section 114',
      url: 'https://labour.gov.in/sites/default/files/SS_Code_2020.pdf'
    }
  };
}
