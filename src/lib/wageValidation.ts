import { Citation, WageRate } from './config/wage/types';
import { NATIONAL_FLOOR_WAGE } from './config/wage/floorWage';
import { STATE_MINIMUM_WAGES } from './config/wage/minimumWages';

export interface WageValidationInput {
  employeeId: string;
  state: string;
  category?: string;
  skillLevel?: string;
  zone?: string;
  actualMonthlyWages: number; // The "wages" as defined by Code on Wages (Basic + DA + Retaining)
  effectiveDate?: string;
}

export interface WageViolation {
  issue: string;
  requiredAmount: number;
  actualAmount: number;
  shortfall: number;
}

export interface WageValidationResult {
  isCompliant: boolean;
  statutoryMinimumWage: number;
  floorWage: number;
  stateMinimumWage?: number;
  violations: WageViolation[];
  citations: Citation[];
  status: 'Compliant' | 'Non-Compliant' | 'Unknown - State/Category Not Configured';
}

/**
 * Computes statutory minimum wage and checks actual wages against it.
 */
export function validateWages(input: WageValidationInput): WageValidationResult {
  const { state, category, skillLevel, zone, actualMonthlyWages } = input;
  
  // 1. National Floor Wage check
  const floorWage = NATIONAL_FLOOR_WAGE.amount;
  const citations: Citation[] = [NATIONAL_FLOOR_WAGE.citation];
  const violations: WageViolation[] = [];
  let isCompliant = true;
  let status: WageValidationResult['status'] = 'Compliant';

  if (actualMonthlyWages < floorWage) {
    isCompliant = false;
    status = 'Non-Compliant';
    violations.push({
      issue: 'Wages below National Floor Wage',
      requiredAmount: floorWage,
      actualAmount: actualMonthlyWages,
      shortfall: floorWage - actualMonthlyWages
    });
  }

  // 2. State Minimum Wage check
  // Find applicable state minimum wage
  // For strict matching, we look for state + (optional category) + (optional skill) + (optional zone)
  const applicableStateWages = STATE_MINIMUM_WAGES.filter(w => 
    w.stateOrUT.toLowerCase() === state.toLowerCase() &&
    (!w.category || !category || w.category.toLowerCase() === category.toLowerCase()) &&
    (!w.skillLevel || !skillLevel || w.skillLevel.toLowerCase() === skillLevel.toLowerCase()) &&
    (!w.zone || !zone || w.zone.toLowerCase() === zone.toLowerCase())
  );

  let stateMinimumWage: number | undefined;
  
  // If we found a match, use the highest matching amount (in case of overlaps/generics)
  if (applicableStateWages.length > 0) {
    const bestMatch = applicableStateWages.reduce((prev, current) => (prev.amount > current.amount) ? prev : current);
    stateMinimumWage = bestMatch.amount;
    citations.push(bestMatch.citation);

    if (actualMonthlyWages < stateMinimumWage) {
      isCompliant = false;
      status = 'Non-Compliant';
      violations.push({
        issue: `Wages below State Minimum Wage (${state} - ${bestMatch.skillLevel || 'General'})`,
        requiredAmount: stateMinimumWage,
        actualAmount: actualMonthlyWages,
        shortfall: stateMinimumWage - actualMonthlyWages
      });
    }
  } else {
    // We don't have enough data to determine state minimum wage
    if (status !== 'Non-Compliant') {
      status = 'Unknown - State/Category Not Configured';
      isCompliant = false; // We can't guarantee compliance if we don't know the state rules
    }
    violations.push({
      issue: `Applicable state minimum wage not found for ${state} (Category: ${category || 'Any'}, Skill: ${skillLevel || 'Any'}, Zone: ${zone || 'Any'}). Manual verification required.`,
      requiredAmount: 0,
      actualAmount: actualMonthlyWages,
      shortfall: 0
    });
  }

  // Statutory minimum is the higher of floor wage and state wage
  const statutoryMinimumWage = Math.max(floorWage, stateMinimumWage || 0);

  return {
    isCompliant: status === 'Compliant',
    statutoryMinimumWage,
    floorWage,
    stateMinimumWage,
    violations,
    citations,
    status
  };
}
