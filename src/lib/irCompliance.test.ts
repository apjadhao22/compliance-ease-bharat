import { describe, it, expect } from 'vitest';
import { computeRetrenchmentCompensation } from './calculations';

describe('Industrial Relations - Retrenchment Compensation', () => {

  it('should compute compensation based on years of service and daily average pay', () => {
    // 5 years service, 52000 month averge (52000/26 = 2000 day), 30 days notice required, 30 days given
    const result = computeRetrenchmentCompensation(5, 52000, 30, 30);
    
    // 5 years * 15 days * 2000 daily
    expect(result.retrenchmentCompensation).toBe(150000);
    expect(result.noticePayShortfall).toBe(0);
    expect(result.total).toBe(150000);
    expect(result.citation.sectionOrRule).toContain('Retrenchment Compensation');
  });

  it('should compute shortfall notice pay if notice given is less than required', () => {
    // 3 years service, 26000 month average (1000 daily), 30 days notice required, 0 notice given
    const result = computeRetrenchmentCompensation(3, 26000, 0, 30);
    
    // 3 years * 15 days * 1000
    expect(result.retrenchmentCompensation).toBe(45000);
    // 30 days * 1000
    expect(result.noticePayShortfall).toBe(30000);
    expect(result.total).toBe(75000);
  });

});
