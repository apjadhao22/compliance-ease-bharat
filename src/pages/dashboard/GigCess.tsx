import { useState, useMemo, useEffect } from "react";
import {
    Bike, AlertCircle, Calculator, CheckCircle, Info, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { calculateAggregatorCess } from "@/lib/socialSecurity/gigCess";

const GigCess = () => {
    const [complianceRegime, setComplianceRegime] = useState<'legacy_acts' | 'labour_codes'>('legacy_acts');
    const [annualTurnover, setAnnualTurnover] = useState<number | "">("");
    const [amountPayableToGigWorkers, setAmountPayableToGigWorkers] = useState<number | "">("");
    const [financialYear, setFinancialYear] = useState(() => {
        const now = new Date();
        const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        return `${fy}-${String(fy + 1).slice(2)}`;
    });
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: company } = await supabase
                .from("companies")
                .select("compliance_regime")
                .eq("user_id", user.id)
                .maybeSingle();
            if (company) {
                setComplianceRegime((company as any).compliance_regime || "legacy_acts");
            }
        };
        init();
    }, []);

    const cessResult = useMemo(() => {
        if (!annualTurnover || !amountPayableToGigWorkers) return null;
        return calculateAggregatorCess({
            companyId: "",
            financialYear,
            annualTurnover: Number(annualTurnover),
            amountPayableToGigWorkers: Number(amountPayableToGigWorkers),
        });
    }, [annualTurnover, amountPayableToGigWorkers, financialYear]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3">
                    <Bike className="h-7 w-7 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Gig &amp; Platform Worker Cess
                        </h1>
                        <p className="text-muted-foreground mt-0.5">
                            Aggregator contribution to Social Security Fund — Code on Social Security, 2020
                        </p>
                    </div>
                </div>
            </div>

            {/* Labour Codes gate */}
            {complianceRegime === 'legacy_acts' && (
                <div className="flex items-start gap-3 p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300">
                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Labour Codes regime required</p>
                        <p className="text-sm mt-0.5">
                            Gig &amp; Platform Worker cess (SS Code 2020, Ch IX §114) applies only under the
                            <strong> Labour Codes</strong> compliance regime. Switch your regime in
                            <strong> Company → Compliance Settings</strong> to activate filing obligations.
                        </p>
                    </div>
                </div>
            )}

            {/* Pending notification banner — always shown */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-900 text-sm dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                    <p className="font-semibold">Rates pending Central Government notification</p>
                    <p className="mt-0.5 text-xs opacity-80">
                        Section 114 authorises a cess of <strong>1–2% of annual turnover</strong>, capped at
                        <strong> 5% of the amount paid to gig/platform workers</strong>. The exact rate has not yet
                        been notified by MoLE (Ministry of Labour &amp; Employment). This calculator uses the
                        lower bound (1%) as a conservative estimate. Review and update when the rate is officially
                        notified.
                    </p>
                    <a
                        href="https://labour.gov.in/sites/default/files/SS_Code_2020.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs font-medium hover:underline"
                    >
                        Code on Social Security, 2020 — Ch IX §114 <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Calculator */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Calculator className="h-4 w-4" /> Cess Estimator
                        </CardTitle>
                        <CardDescription>
                            Enter your aggregator financials to estimate the statutory cess contribution.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="fy">Financial Year</Label>
                            <Input
                                id="fy"
                                placeholder="e.g. 2025-26"
                                value={financialYear}
                                onChange={(e) => setFinancialYear(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="turnover">Annual Turnover (₹)</Label>
                            <Input
                                id="turnover"
                                type="number"
                                placeholder="e.g. 50000000"
                                value={annualTurnover}
                                onChange={(e) => setAnnualTurnover(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">Total aggregator platform turnover for the financial year.</p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="gigPay">Amount Payable to Gig/Platform Workers (₹)</Label>
                            <Input
                                id="gigPay"
                                type="number"
                                placeholder="e.g. 10000000"
                                value={amountPayableToGigWorkers}
                                onChange={(e) => setAmountPayableToGigWorkers(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">Total payments made (or payable) to all gig &amp; platform workers in the FY.</p>
                        </div>

                        {cessResult && (
                            <div className="mt-2 space-y-3 border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">1% of Turnover</span>
                                    <span className="font-medium">₹{cessResult.turnoverCess.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">5% of Gig Worker Payments (cap)</span>
                                    <span className="font-medium">₹{cessResult.gigWorkerCap.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center rounded-lg bg-primary/10 p-3">
                                    <span className="font-semibold text-sm">Estimated Cess (lower of two)</span>
                                    <span className="text-lg font-bold text-primary">
                                        ₹{cessResult.estimatedContribution.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                    <span>Estimate based on 1% rate (conservative). Recalculate once MoLE notifies the final rate.</span>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => setShowDetails(!showDetails)}
                                >
                                    {showDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                    {showDetails ? "Hide" : "Show"} statutory citation
                                </Button>
                                {showDetails && (
                                    <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                                        <p className="font-semibold">{cessResult.citation.codeName}</p>
                                        <p>{cessResult.citation.sectionOrRule}</p>
                                        <a
                                            href={cessResult.citation.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-primary hover:underline"
                                        >
                                            View Act <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Who qualifies */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Who is an Aggregator?</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2 text-muted-foreground">
                            <p>Under SS Code 2020, an <strong className="text-foreground">Aggregator</strong> is a digital intermediary that:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Connects <strong className="text-foreground">Gig Workers</strong> (task-based, outside traditional employer–employee relationship) or <strong className="text-foreground">Platform Workers</strong> (online platform, ICT-enabled) to buyers of services.</li>
                                <li>Examples: ride-hailing apps, food delivery platforms, e-commerce logistics, freelance marketplaces.</li>
                                <li>Obligation arises regardless of whether workers are classified as employees.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Filing Obligations</CardTitle>
                            <CardDescription>Once rates are officially notified by MoLE</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                            <div className="flex items-start gap-3">
                                <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
                                <p className="text-muted-foreground">Register under the Social Security Code on the UMANG / MoLE portal as an Aggregator.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
                                <p className="text-muted-foreground">Compute cess: min(1–2% × turnover, 5% × gig worker payments) for the financial year.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
                                <p className="text-muted-foreground">Remit to the <strong className="text-foreground">Social Security Fund</strong> (administered by ESIC/EPFO as designated) by the notified due date.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                                <p className="text-muted-foreground">Maintain records of gig worker count, payments, and cess remittance for inspection under Ch IX.</p>
                            </div>
                            <div className="mt-2 rounded-md p-3 border border-dashed bg-muted/30 text-xs text-muted-foreground">
                                <p className="font-semibold text-foreground mb-1">🔔 Coming soon in OpticompBharat</p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                    <li>Gig worker registration &amp; UAN linkage</li>
                                    <li>Automated cess computation from payroll data</li>
                                    <li>Challan generation once MoLE notifies payment gateway</li>
                                    <li>Annual cess return filing support</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default GigCess;
