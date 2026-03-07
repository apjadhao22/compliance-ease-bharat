import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

const complianceNodes = [
    {
        id: "epf",
        label: "EPF",
        risk: "Delayed PF can draw 12% interest, damages up to 25% and prosecution.",
        solution: "Auto-compute PF, generate ECR, remind and track payments.",
        angle: 0,
        radius: 140,
    },
    {
        id: "esic",
        label: "ESIC",
        risk: "Missing ESI filings blocks employee medical claims and attracts heavy damages.",
        solution: "Calculates ESI accurately against wage ceilings & auto-files returns.",
        angle: 36,
        radius: 160,
    },
    {
        id: "pt",
        label: "Prof. Tax",
        risk: "10% penalty plus monthly interest on unpaid state-wise tax.",
        solution: "Handle 20+ state-wise PT slabs, challans and returns automatically.",
        angle: 72,
        radius: 130,
    },
    {
        id: "lwf",
        label: "LWF",
        risk: "Missed half-yearly state welfare fund deductions cause audit failures.",
        solution: "Track eligibility, bi-annual deductions and state-specific LWF filings.",
        angle: 108,
        radius: 180,
    },
    {
        id: "tds",
        label: "TDS",
        risk: "Late TDS returns can cost ₹200/day plus interest and penalties.",
        solution: "Aligns payroll with TDS rules, prepares data for quarterly 24Q returns.",
        angle: 144,
        radius: 150,
    },
    {
        id: "bonus",
        label: "Bonus",
        risk: "Underpaying statutory bonus triggers immediate union & labour court issues.",
        solution: "Calculate statutory bonus according to latest wage thresholds.",
        angle: 180,
        radius: 170,
    },
    {
        id: "gratuity",
        label: "Gratuity",
        risk: "Miscalculating 5-year tenure leads to legal disputes on full & final exit.",
        solution: "Track 5-year eligibility and compute exact gratuity based on 15/26 formula.",
        angle: 216,
        radius: 140,
    },
    {
        id: "maternity",
        label: "Maternity",
        risk: "Denying 26-week benefits or crèche facilities violates federal law.",
        solution: "Track 26-week leave and statutory benefits while protecting job rights.",
        angle: 252,
        radius: 190,
    },
    {
        id: "posh",
        label: "POSH",
        risk: "No IC committee or skipped annual returns leads to instant ₹50k fine.",
        solution: "Run IC tracking, document mandatory trainings and auto-file annual reports.",
        angle: 288,
        radius: 150,
    },
    {
        id: "clra",
        label: "CLRA",
        risk: "Principal employer held liable for contractor's unpaid wages and PF.",
        solution: "Track contractor licenses and enforce vendor compliance audits.",
        angle: 324,
        radius: 170,
    },
];

export function ComplianceWeb() {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    return (
        <section className="py-24 bg-[#050505] text-white relative overflow-hidden">
            {/* Background Web grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />

            <div className="container relative z-10">
                <div className="text-center mb-16">
                    <p className="text-primary font-bold tracking-[0.2em] uppercase text-sm mb-4">The Indian Labour Law Maze</p>
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                        A web of 40+ laws, <br className="hidden md:block" />all pulling on each other.
                    </h2>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        EPF, ESI, PT, LWF, Wages, Bonus, Maternity, POSH, CLRA... one change in wages or headcount ripples through this entire web.
                        One missed filing can trigger inspections, penalties, and criminal exposure.
                    </p>
                </div>

                {/* The Web Interactive Graphic */}
                <div className="relative w-full max-w-4xl mx-auto aspect-square md:aspect-video flex items-center justify-center mt-12 mb-8">

                    {/* Connecting Lines Base (SVG) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                        <g transform="translate(50%, 50%)">
                            {complianceNodes.map((node) => {
                                // Responsive radius
                                const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                                const r = isMobile ? node.radius * 0.6 : node.radius;
                                const rad = (node.angle * Math.PI) / 180;
                                const x = r * Math.cos(rad) * 2; // Stretch width for video aspect ratio on desktop
                                const y = r * Math.sin(rad);

                                return (
                                    <line
                                        key={`line-${node.id}`}
                                        x1="0"
                                        y1="0"
                                        x2={`${x}%`}
                                        y2={`${y}%`}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                        className={hoveredNode === node.id ? "text-primary opacity-100" : "text-white"}
                                        style={{ transition: 'all 0.3s ease' }}
                                    />
                                )
                            })}
                        </g>
                    </svg>

                    {/* Center Company Node */}
                    <div className="absolute z-20 flex flex-col items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-700 shadow-[0_0_50px_rgba(255,255,255,0.05)] text-center p-4">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse blur-xl" />
                        <span className="font-bold relative z-10 text-lg">Your<br />Payroll</span>
                    </div>

                    {/* Orbiting Compliance Nodes */}
                    {complianceNodes.map((node) => {
                        // Basic responsive positioning
                        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                        const r = isMobile ? node.radius * 0.5 : node.radius;
                        const rad = (node.angle * Math.PI) / 180;
                        const x = r * Math.cos(rad) * (isMobile ? 1 : 1.8);
                        const y = r * Math.sin(rad);

                        const isHovered = hoveredNode === node.id;

                        return (
                            <div
                                key={node.id}
                                className="absolute z-30"
                                style={{
                                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                }}
                                onMouseEnter={() => setHoveredNode(node.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    className={`
                      relative cursor-pointer px-4 py-2 rounded-full text-sm font-bold border transition-all duration-300
                      ${isHovered
                                            ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                                            : 'bg-zinc-900 border-zinc-700 text-gray-300 hover:border-zinc-500'}
                    `}
                                >
                                    {node.label}
                                </motion.div>

                                {/* Tooltip */}
                                {isHovered && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-72 bg-zinc-900 border border-zinc-700/50 rounded-xl p-4 shadow-2xl z-50 pointer-events-none">
                                        <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                            {node.label} Compliance
                                        </h4>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex gap-2 items-start">
                                                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                <p className="text-gray-300"><span className="text-red-300 font-medium">Risk:</span> {node.risk}</p>
                                            </div>
                                            <div className="flex gap-2 items-start pt-2 border-t border-zinc-700/50">
                                                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                                                <p className="text-gray-300"><span className="text-green-300 font-medium">Solution:</span> {node.solution}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="text-center mt-12 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 p-6 rounded-2xl max-w-3xl mx-auto">
                    <p className="text-gray-300">
                        <strong className="text-white">We monitor central and state labour statutes, tax rules, and daily notifications.</strong><br />
                        The more employees you add, the more of this web becomes mandatory. Use the calculator above to see what’s at stake for your headcount.
                    </p>
                </div>
            </div>
        </section>
    );
}
