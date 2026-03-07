import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, Scale, FileWarning, Landmark, ArrowRight } from "lucide-react";

export function RiskCalculator() {
    const [employees, setEmployees] = useState(50);
    const [avgSalary, setAvgSalary] = useState(25000);
    const [monthsDelayed, setMonthsDelayed] = useState(3);

    // Calculated State
    const [statutoryDues, setStatutoryDues] = useState(0);
    const [penalties, setPenalties] = useState(0);
    const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");

    useEffect(() => {
        // Core illustrative calculations based on spec
        const N = employees;
        const S = avgSalary || 25000;
        const M = monthsDelayed;

        // EPF
        const epfBase = 0.12 * N * S * M;
        const epfInterest = epfBase * 0.12 * (M / 12);
        let epfDamagesRate = 0.05; // 0-2 months
        if (M > 2 && M <= 4) epfDamagesRate = 0.10;
        else if (M > 4 && M <= 6) epfDamagesRate = 0.15;
        else if (M > 6) epfDamagesRate = 0.25;
        const epfDamages = epfBase * epfDamagesRate * (M / 12);

        // ESIC
        const esiBase = 0.04 * N * S * M;
        const esiInterest = esiBase * 0.12 * (M / 12);
        const esiDamages = esiBase * epfDamagesRate * (M / 12); // Using similar penalty structure

        // PT (Illustrative Maharashtra)
        const ptPerEmployee = 200;
        const ptBase = ptPerEmployee * N * M;
        const ptPenalty = 0.10 * ptBase;
        const ptInterest = 0.0125 * M * ptBase;

        // Totals
        const totalDues = epfBase + esiBase + ptBase;
        const totalPenalties = epfInterest + epfDamages + esiInterest + esiDamages + ptPenalty + ptInterest;

        setStatutoryDues(Math.round(totalDues / 100) * 100);
        setPenalties(Math.round(totalPenalties / 100) * 100);

        // Dynamic Risk Level for UI coloring
        if (totalDues + totalPenalties < 500000) setRiskLevel("low");
        else if (totalDues + totalPenalties < 2500000) setRiskLevel("medium");
        else setRiskLevel("high");

    }, [employees, avgSalary, monthsDelayed]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl mb-4">
                    Calculate your compliance risk.
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Tell us how many employees you have. We’ll show you what a few months of non-compliance could cost in dues, penalties, interest and legal exposure.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Input Panel */}
                <div className="col-span-1 lg:col-span-4 space-y-8 bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label className="text-base font-semibold">Number of Employees</Label>
                            <span className="text-lg font-bold text-primary">{employees}</span>
                        </div>
                        <Slider
                            value={[employees]}
                            min={1}
                            max={1000}
                            step={1}
                            onValueChange={(val) => setEmployees(val[0])}
                            className="py-4"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>1</span>
                            <span>1,000+</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="salary" className="text-base font-semibold block">Average Monthly Salary (₹)</Label>
                        <Input
                            id="salary"
                            type="number"
                            value={avgSalary}
                            onChange={(e) => setAvgSalary(Number(e.target.value))}
                            className="text-lg"
                        />
                        <p className="text-xs text-muted-foreground flex items-center justify-between">
                            We’ve assumed a typical SME salary.
                            <button
                                onClick={() => setAvgSalary(25000)}
                                className="text-primary hover:underline"
                            >
                                Reset
                            </button>
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="months" className="text-base font-semibold block">Months of Non-Compliance</Label>
                        <Select value={monthsDelayed.toString()} onValueChange={(val) => setMonthsDelayed(Number(val))}>
                            <SelectTrigger id="months" className="text-lg">
                                <SelectValue placeholder="Select delay" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 Month</SelectItem>
                                <SelectItem value="3">3 Months</SelectItem>
                                <SelectItem value="6">6 Months</SelectItem>
                                <SelectItem value="12">12 Months</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Output Panel 2x2 Grid */}
                <div className="col-span-1 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Output Card 1: Statutory Dues */}
                    <Card className={`transition-colors duration-500 border shadow-none overflow-hidden relative ${riskLevel === 'high' ? 'bg-red-50/80 border-red-200' :
                        riskLevel === 'medium' ? 'bg-orange-50/50 border-orange-100' :
                            'bg-amber-50/30 border-amber-100'
                        }`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors duration-500 ${riskLevel === 'high' ? 'bg-red-500/10' : 'bg-orange-500/5'
                            }`} />
                        <CardHeader className="pb-2 relative z-10">
                            <CardDescription className="text-gray-600 font-bold uppercase tracking-wider text-[10px]">What you should already have paid</CardDescription>
                            <CardTitle className="text-xl text-gray-900 font-bold mt-1">Unpaid PF, ESI, PT & TDS</CardTitle>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-2">
                            <div className={`text-4xl md:text-5xl font-[900] tracking-tighter transition-colors duration-500 ${riskLevel === 'high' ? 'text-red-950' : 'text-gray-900'
                                }`}>
                                {formatCurrency(statutoryDues)}
                            </div>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed font-medium">
                                Estimated based on your inputs and standard contribution rates.
                            </p>
                            <div className="mt-3 inline-block bg-white/60 px-3 py-1 rounded-full border shadow-sm">
                                <span className="text-xs font-bold text-gray-700">≈ {monthsDelayed} months of your total payroll liability</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Output Card 2: Penalties */}
                    <Card className={`transition-colors duration-500 border shadow-none overflow-hidden relative ${riskLevel === 'high' ? 'bg-red-50/80 border-red-200' :
                        riskLevel === 'medium' ? 'bg-orange-50/50 border-orange-100' :
                            'bg-amber-50/30 border-amber-100'
                        }`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors duration-500 ${riskLevel === 'high' ? 'bg-red-500/10' : 'bg-orange-500/5'
                            }`} />
                        <CardHeader className="pb-2 relative z-10 flex flex-row items-center justify-between">
                            <div>
                                <CardDescription className="text-gray-600 font-bold uppercase tracking-wider text-[10px]">What authorities can add on top</CardDescription>
                                <CardTitle className="text-xl text-gray-900 font-bold mt-1">Penalties & interest</CardTitle>
                            </div>
                            <AlertTriangle className={`h-5 w-5 ${riskLevel === 'high' ? 'text-red-600' : 'text-orange-500'}`} />
                        </CardHeader>
                        <CardContent className="relative z-10 pt-2">
                            <div className={`text-4xl md:text-5xl font-[900] tracking-tighter transition-colors duration-500 ${riskLevel === 'high' ? 'text-red-950' : 'text-gray-900'
                                }`}>
                                {formatCurrency(penalties)}
                            </div>
                            <ul className="mt-4 space-y-2 text-xs text-gray-600 leading-relaxed font-medium">
                                <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5">•</span> EPF & ESI delays attract 12% interest and up to 25% damages.</li>
                                <li className="flex items-start gap-1.5"><span className="text-orange-500 mt-0.5">•</span> State PT laws add 10% penalty plus monthly interest.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Output Card 3: Legal Risk */}
                    <Card className="border-slate-200 bg-white shadow-sm overflow-hidden relative">
                        <CardHeader className="pb-2 relative z-10 border-b bg-slate-50/50">
                            <CardDescription className="font-bold uppercase tracking-wider text-[10px] text-slate-500">What can happen after one inspection</CardDescription>
                            <CardTitle className="text-xl text-slate-900 font-bold mt-1">Legal & Operational Risk</CardTitle>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-6">
                            <ul className="space-y-4 text-sm font-medium text-slate-700">
                                <li className="flex items-start gap-3">
                                    <div className="bg-red-100 p-1.5 rounded-md shrink-0"><FileWarning className="w-3.5 h-3.5 text-red-600" /></div>
                                    <span className="mt-0.5">Inspection and show-cause notices</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-red-100 p-1.5 rounded-md shrink-0"><Landmark className="w-3.5 h-3.5 text-red-600" /></div>
                                    <span className="mt-0.5">Bank account attachment for large arrears</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-red-100 p-1.5 rounded-md shrink-0"><Scale className="w-3.5 h-3.5 text-red-600" /></div>
                                    <span className="mt-0.5">Criminal prosecution in serious defaults</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-orange-100 p-1.5 rounded-md shrink-0"><ShieldCheck className="w-3.5 h-3.5 text-orange-600" /></div>
                                    <span className="mt-0.5">Employee claims for underpaid benefits</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Output Card 4: With OpticompBharat */}
                    <Card className="border-emerald-900 bg-[#022c22] text-white shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                        <CardHeader className="pb-2 relative z-10 border-b border-emerald-800/50 bg-emerald-950/30">
                            <CardDescription className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">When we run your compliance</CardDescription>
                            <CardTitle className="text-xl text-white font-bold mt-1">Risk from missed filings: Near-zero</CardTitle>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                                </div>
                                <span className="text-sm font-semibold text-emerald-200 uppercase tracking-widest">Safe Status</span>
                            </div>
                            <ul className="space-y-4 text-sm font-medium text-emerald-100/90">
                                <li className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    <span>AI tracks every law and rate change</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    <span>Human experts validate complex edge cases</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    <span>Automated filings, challans, and registers</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Sticky CTA Footer inside calculator area */}
            <div className="mt-8 bg-zinc-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                <div className="relative z-10 text-center md:text-left">
                    <h3 className="text-2xl font-bold text-white mb-2">Stop guessing your risk.</h3>
                    <p className="text-gray-400 font-medium">Start eliminating it before the next inspection.</p>
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <Button size="lg" className="rounded-full bg-white text-black hover:bg-gray-100 font-bold px-8">
                        Talk to a Compliance Expert
                    </Button>
                    <Button size="lg" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 group">
                        Start Free Trial
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </div>

            <p className="text-[10px] text-center text-muted-foreground max-w-4xl mx-auto pt-4 leading-relaxed">
                *Disclaimer: These numbers are illustrative estimates based on typical contribution, interest, and penalty rates for EPF, ESI, and Professional Tax.
                Actual liability depends on inspections, history, and state-specific rules. OpticompBharat provides automation based on current statutes,
                but final responsibility remains with the employer. Always consult your advisor.
            </p>

        </div>
    );
}
