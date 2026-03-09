import { useState } from "react";
import { Bot, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { defineWages } from "@/lib/calculations";
import { validateWagePayment } from "@/lib/wageCompliance";

interface Anomaly {
    employee_name: string;
    severity: "critical" | "warning" | "success";
    issue: string;
}

interface PayrollAuditModalProps {
    payrollData: any[];
    disabled?: boolean;
}

export function PayrollAuditModal({ payrollData, disabled }: PayrollAuditModalProps) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isAuditing, setIsAuditing] = useState(false);
    const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null);

    const runAudit = async () => {
        if (!payrollData || payrollData.length === 0) return;

        setIsAuditing(true);
        setAnomalies(null);

        try {
            // Send a simplified version of the payroll data to save tokens
            const simplifiedData = payrollData.map(row => ({
                name: row.employees?.name,
                basic: row.basic_paid,
                hra: row.hra_paid,
                gross: row.gross_earnings,
                epf: row.epf_employee,
                esic: row.esic_employee
            }));

            // Run deterministic local (statutory) checks first
            const localAnomalies: Anomaly[] = [];

            payrollData.forEach(row => {
                const name = row.employees?.name || "Unknown";
                const basic = Number(row.basic_paid || 0);
                const allowances = Number(row.hra_paid || 0) + Number(row.other_allowances || 0);
                const gross = Number(row.gross_earnings || 0);
                const totalDeductions = Number(row.total_deductions || 0);

                // 1. 50% Wage Rule Check
                const wageCheck = defineWages({ basic, da: 0, retainingAllowance: 0, allowances });
                if (!wageCheck.isCompliant) {
                    localAnomalies.push({
                        employee_name: name,
                        severity: "warning",
                        issue: `Wage Code Violation: Exclusions (₹${wageCheck.exclusions}) exceed 50% of total remuneration (₹${wageCheck.totalRemuneration}). Suggested Basic+DA: ₹${wageCheck.suggestedStructure.basicDaRetaining}, Allowances: ₹${wageCheck.suggestedStructure.allowances}.`
                    });
                }

                // 2. Deduction Limit Check (Code on Wages - Section 18)
                const paymentCheck = validateWagePayment('monthly', gross, totalDeductions, 0, false);
                if (!paymentCheck.isCompliant) {
                    if (paymentCheck.deductionWarning) {
                        localAnomalies.push({
                            employee_name: name,
                            severity: "critical",
                            issue: `Payment Violation: ${paymentCheck.deductionWarning}`
                        });
                    }
                }

                // 3. Minimum Wage Compliance Check
                const mwStatus = row.min_wage_status;
                if (mwStatus === 'below_floor' || mwStatus === 'below_state_min') {
                    const shortfall = Number(row.min_wage_shortfall || 0);
                    const applicable = Number(row.min_wage_applicable || 0);
                    localAnomalies.push({
                        employee_name: name,
                        severity: "critical",
                        issue: `Minimum Wage Violation: Gross wages (₹${gross.toLocaleString('en-IN')}) are below the statutory minimum of ₹${applicable.toLocaleString('en-IN')}. Shortfall: ₹${shortfall.toLocaleString('en-IN')}.`
                    });
                }
            });

            const { data, error } = await supabase.functions.invoke('audit-payroll', {
                body: { payrollData: simplifiedData }
            });

            if (error) throw error;

            // Merge local anomalies with AI anomalies
            const allAnomalies = [...localAnomalies, ...(data.anomalies || [])];
            setAnomalies(allAnomalies);
        } catch (error: any) {
            console.error("Audit error:", error);
            toast({
                title: "Audit Failed",
                description: "Could not complete the AI audit. Please try again.",
                variant: "destructive"
            });
            setIsOpen(false);
        } finally {
            setIsAuditing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open && !anomalies && !isAuditing) {
                runAudit();
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary" disabled={disabled || payrollData.length === 0}>
                    <Bot className="h-4 w-4" />
                    Run AI Audit
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        AI Payroll Auditor
                    </DialogTitle>
                    <DialogDescription>
                        Scanning {(payrollData || []).length} drafted payslips for statutory violations and anomalies.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 min-h-[200px] flex flex-col">
                    {isAuditing ? (
                        <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm">Analyzing wage rules, deduction limits, and compliance acts...</p>
                        </div>
                    ) : anomalies ? (
                        (anomalies.length === 0 || (anomalies.length === 1 && anomalies[0].severity === 'success')) ? (
                            <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-green-600">
                                <CheckCircle2 className="h-12 w-12" />
                                <div className="text-center">
                                    <p className="font-semibold text-lg">Perfectly Compliant!</p>
                                    <p className="text-sm text-muted-foreground max-w-[250px]">
                                        {anomalies.length === 1 && anomalies[0].severity === 'success'
                                            ? anomalies[0].issue
                                            : "The AI found no statutory violations or wage anomalies in this payroll run."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <ScrollArea className="h-[300px] pr-4">
                                <div className="space-y-3">
                                    {(() => {
                                        const minWageViolations = payrollData.filter(r => r.min_wage_status === 'below_floor' || r.min_wage_status === 'below_state_min');
                                        const totalShortfall = minWageViolations.reduce((s: number, r: any) => s + Number(r.min_wage_shortfall || 0), 0);
                                        if (minWageViolations.length > 0) {
                                            return (
                                                <div className="p-3 rounded-lg border bg-red-50/50 border-red-200 text-red-900 text-sm mb-1">
                                                    <p className="font-semibold">{minWageViolations.length} employee{minWageViolations.length > 1 ? 's' : ''} below minimum wage</p>
                                                    <p>Total monthly shortfall: ₹{totalShortfall.toLocaleString('en-IN')}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    {anomalies.map((anomaly, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded-lg border flex gap-3 ${anomaly.severity === 'critical'
                                                ? 'bg-red-50/50 border-red-200 text-red-900'
                                                : anomaly.severity === 'warning'
                                                    ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                                                    : 'bg-green-50/50 border-green-200 text-green-900'
                                                }`}
                                        >
                                            {anomaly.severity === 'success' ? (
                                                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-green-500" />
                                            ) : (
                                                <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${anomaly.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                                                    }`} />
                                            )}
                                            <div>
                                                <p className="font-medium text-sm">{anomaly.employee_name}</p>
                                                <p className="text-sm mt-1">{anomaly.issue}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )
                    ) : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
                    {!isAuditing && anomalies && anomalies.length > 0 && (
                        <Button onClick={runAudit} variant="secondary">Run Again</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
