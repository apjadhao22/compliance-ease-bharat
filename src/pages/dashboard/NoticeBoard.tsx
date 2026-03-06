import { PageSkeleton } from "@/components/PageSkeleton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Pin, Info } from "lucide-react";
import { format } from "date-fns";
import type jsPDF from "jspdf";

interface CompanyInfo { id: string; name: string; address?: string | null; }
interface ICCMember { name: string; designation: string | null; role: string; contact_email: string | null; appointed_on: string; }

// ─── Shared PDF helpers ─────────────────────────────────────────────────────

function pdfHeader(doc: jsPDF, title: string, subtitle: string, company: string, printedOn: string) {
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    let y = 15;

    // Top bar
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageW, 10, "F");

    // Title
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 80);
    doc.text(title, pageW / 2, y + 4, { align: "center" }); y += 9;

    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(subtitle, pageW / 2, y + 2, { align: "center" }); y += 8;

    doc.setDrawColor(200, 200, 220); doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y); y += 5;

    doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text(`Employer / Company: ${company}`, margin, y);
    doc.text(`Printed: ${printedOn}`, pageW - margin, y, { align: "right" }); y += 7;

    doc.setDrawColor(200, 200, 220);
    doc.line(margin, y, pageW - margin, y); y += 5;

    return y;
}

function pdfFooter(doc: jsPDF, company: string, act: string) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
    doc.text(`Displayed under ${act} — ${company} — Printed: ${format(new Date(), "dd MMM yyyy")}`, pageW / 2, pageH - 8, { align: "center" });
    doc.setDrawColor(200, 200, 220); doc.line(18, pageH - 11, pageW - 18, pageH - 11);
}

function signatureBlock(doc: jsPDF, y: number): number {
    const margin = 18;
    y += 10;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    doc.text("Authorised Signatory: _______________________________", margin, y);
    doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 150, y); y += 8;
    doc.text("Seal of Establishment:", margin, y); y += 12;
    return y;
}

// ─── Individual notice PDF generators ───────────────────────────────────────

async function genNotice1_ShopsEstab(company: string, address: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth(); const margin = 18;
    let y = pdfHeader(doc, "ABSTRACT OF THE MAHARASHTRA SHOPS AND ESTABLISHMENTS ACT, 1948", "Rule 27 — Abstract to be displayed at the place of business", company, format(new Date(), "dd MMM yyyy"));

    const items = [
        ["1. Weekly Off Day", "Sunday (or as per company policy)"],
        ["2. Working Hours (per day)", "9 hours (incl. 1 hour rest)"],
        ["3. Overtime Rate", "2× the ordinary rate of wages"],
        ["4. Minimum Age for Employment", "14 years (18 for hazardous work)"],
        ["5. Annual Leave", "Earned Leave: 1 day per 20 days worked"],
        ["6. National / Festival Holidays", "As per the Holiday Calendar displayed separately"],
        ["7. Wage Payment Day", "Before 7th of every succeeding month"],
        ["8. Maternity Leave", "26 weeks (Maternity Benefit Act, 1961)"],
        ["9. Gratuity", "Payable after 5 years of continuous service"],
        ["10. Equal Remuneration", "Equal pay for equal work irrespective of gender"],
    ];

    items.forEach(([k, v]) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(k, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(v, margin + 72, y); y += 7;
        doc.setDrawColor(230, 230, 230); doc.line(margin, y - 2, pageW - margin, y - 2);
    });

    y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 100);
    doc.text(`Establishment: ${company}`, margin, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    doc.text(`Address: ${address}`, margin, y, { maxWidth: pageW - margin * 2 }); y += 8;

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Maharashtra Shops & Establishments Act, 1948");
    doc.save(`Notice_ShopsEstab_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice2_WorkingHours(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "NOTICE OF WORKING HOURS, WEEKLY OFF & OVERTIME", "Factories Act 1948 / Maharashtra Shops & Establishments Act 1948", company, format(new Date(), "dd MMM yyyy"));

    const rows = [
        ["Category", "Work Hours", "Rest Interval", "Weekly Off", "OT Rule"],
        ["Regular Employees", "9 hrs/day · 48 hrs/wk", "1 hr (min 30 min)", "Sunday", "2× Basic Rate"],
        ["Contract/Casual", "8 hrs/day · 40 hrs/wk", "30 min", "As rostered", "2× Basic Rate"],
        ["Night Shift (if any)", "8 hrs/shift", "30 min", "Weekly rotated", "Night Allow + 2× OT"],
    ];

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const colW = [40, 42, 35, 32, 28];
    rows.forEach((row, ri) => {
        if (y > 265) { doc.addPage(); y = 20; }
        let x = margin;
        if (ri === 0) { doc.setFillColor(230, 235, 255); doc.rect(margin, y - 5, pageW - margin * 2, 8, "F"); }
        row.forEach((cell, ci) => {
            doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
            doc.text(cell, x + 1, y); x += colW[ci];
        });
        y += 9;
        doc.setDrawColor(220, 220, 220); doc.line(margin, y - 2, pageW - margin, y - 2);
    });

    y += 5;
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
    doc.text("Important Provisions:", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    const points = [
        "No employee shall be required to work more than 10.5 hours in a day including overtime.",
        "Spread-over shall not exceed 12 hours in a day.",
        "Every employee is entitled to a weekly holiday of 24 consecutive hours rest.",
    ];
    points.forEach(p => { doc.text(`• ${p}`, margin + 2, y, { maxWidth: pageW - margin * 2 - 4 }); y += 7; });

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Factories Act, 1948 / Maharashtra S&E Act, 1948");
    doc.save(`Notice_WorkingHours_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice3_MinimumWages(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "MINIMUM WAGES NOTICE", "The Minimum Wages Act, 1948 — Maharashtra (Zone I) — Effective 1 April 2024", company, format(new Date(), "dd MMM yyyy"));

    const rows: [string, string, string, string][] = [
        ["Unskilled", "₹12,816", "₹427.20", "—"],
        ["Semi-Skilled", "₹13,996", "₹466.53", "—"],
        ["Skilled", "₹15,296", "₹509.87", "—"],
        ["Highly Skilled", "₹17,056", "₹568.53", "—"],
    ];
    const headers = ["Category", "Monthly (₹)", "Daily Rate", "Remarks"];
    const cw = [60, 45, 45, 40];

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.setFillColor(20, 80, 140); doc.rect(margin, y - 5, pageW - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255);
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x + 1, y); x += cw[i]; });
    y += 9; doc.setTextColor(40, 40, 40);

    rows.forEach(([cat, monthly, daily, rem], ri) => {
        if (ri % 2 === 0) { doc.setFillColor(245, 247, 255); doc.rect(margin, y - 5, pageW - margin * 2, 8, "F"); }
        doc.setFont("helvetica", "normal");
        x = margin;
        [cat, monthly, daily, rem].forEach((v, i) => { doc.text(v, x + 1, y); x += cw[i]; });
        y += 9;
    });

    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text("Rates applicable to: Maharashtra — Zone I (Mumbai, Pune, Nagpur & other notified areas)", margin, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.text("Any employer paying less than the above rates is liable for prosecution under the Minimum Wages Act, 1948.", margin, y, { maxWidth: pageW - margin * 2 }); y += 8;

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Minimum Wages Act, 1948");
    doc.save(`Notice_MinimumWages_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice4_POSH(company: string, members: ICCMember[]) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "NOTICE — PREVENTION OF SEXUAL HARASSMENT AT WORKPLACE", "Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013", company, format(new Date(), "dd MMM yyyy"));

    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(180, 20, 20);
    doc.text("ZERO TOLERANCE POLICY", pageW / 2, y, { align: "center" }); y += 7;
    doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const intro = `${company} is committed to providing a safe, respectful, and harassment-free workplace for all employees. Sexual harassment in any form is strictly prohibited and shall result in disciplinary action up to and including termination of employment, and may be referred for criminal prosecution.`;
    const lines = doc.splitTextToSize(intro, pageW - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 5 + 4;

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("What constitutes Sexual Harassment (Section 2(n) of the Act):", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    ["Unwelcome physical, verbal, or non-verbal conduct of a sexual nature",
        "Demand or request for sexual favours",
        "Sexually coloured remarks or display of pornography",
        "Any other unwelcome physical, verbal, or non-verbal conduct of a sexual nature"
    ].forEach(p => { doc.text(`• ${p}`, margin + 3, y, { maxWidth: pageW - margin * 2 - 5 }); y += 6; });

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.text("How to File a Complaint:", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("Submit a written complaint to any ICC member within 3 months of the incident (extendable to 6 months for exceptional reasons).", margin, y, { maxWidth: pageW - margin * 2 }); y += 8;

    if (members.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Internal Complaints Committee (ICC) Roster:", margin, y); y += 6;
        members.forEach(m => {
            if (y > 265) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "normal");
            doc.text(`${m.name} — ${m.role}${m.designation ? ` (${m.designation})` : ""}${m.contact_email ? ` — ${m.contact_email}` : ""}`, margin + 3, y); y += 6;
        });
    } else {
        doc.text("ICC roster to be displayed separately. Contact HR for details.", margin, y); y += 6;
    }

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "POSH Act, 2013");
    doc.save(`Notice_POSH_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice5_EqualRem(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "EQUAL REMUNERATION POLICY", "Equal Remuneration Act, 1976 — Section 4 Compliance Notice", company, format(new Date(), "dd MMM yyyy"));

    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const paras = [
        `${company} is committed to providing equal pay for equal work irrespective of gender. No discrimination shall be made in the recruitment, pay, promotions, training, or working conditions of employees on the grounds of sex.`,
        "Under Section 4 of the Equal Remuneration Act, 1976, it is unlawful to pay a male and female employee unequal wages for the same work or work of a similar nature.",
        "Any employee who believes they are being discriminated against on the basis of gender in matters of pay may raise a grievance with the HR Department or the designated Equal Remuneration Officer.",
    ];
    paras.forEach(p => {
        if (y > 260) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(p, pageW - margin * 2);
        doc.text(lines, margin, y); y += lines.length * 5 + 6;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Equal Remuneration Officer:", margin, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("HR Department / Company Administrator", margin + 3, y); y += 10;

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Equal Remuneration Act, 1976");
    doc.save(`Notice_EqualRemuneration_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice6_PFESIC(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "NOTICE — PROVIDENT FUND & EMPLOYEES' STATE INSURANCE", "The Employees' Provident Funds & MP Act, 1952 · The ESI Act, 1948", company, format(new Date(), "dd MMM yyyy"));

    const sections: [string, string[]][] = [
        ["Employees' Provident Fund (EPF)", [
            "All employees earning basic wages ≤ ₹15,000/month are mandatorily covered.",
            "Employee Contribution: 12% of Basic + DA",
            "Employer Contribution: 12% (3.67% EPF + 8.33% EPS)",
            "For withdrawal / transfers, employees may use the EPFO Member Portal (passbook.epfindia.gov.in)",
        ]],
        ["Employees' State Insurance (ESIC)", [
            "All employees earning gross wages ≤ ₹21,000/month are covered.",
            "Employee Contribution: 0.75% of Gross Wages",
            "Employer Contribution: 3.25% of Gross Wages",
            "Benefits include medical, maternity, disability, and dependent coverage.",
            "For queries, visit the nearest ESIC office or www.esic.in",
        ]],
    ];

    sections.forEach(([title, points]) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20, 50, 130);
        doc.text(title, margin, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
        points.forEach(p => { doc.text(`• ${p}`, margin + 3, y, { maxWidth: pageW - margin * 2 - 5 }); y += 6; });
        y += 4;
    });

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "EPF & MP Act, 1952 / ESI Act, 1948");
    doc.save(`Notice_PF_ESIC_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice7_Maternity(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "NOTICE — MATERNITY BENEFIT ACT, 1961", "Maternity Benefit (Amendment) Act, 2017 — Employee Rights", company, format(new Date(), "dd MMM yyyy"));

    const benefits = [
        ["Maternity Leave", "26 weeks paid leave for companies with 50+ employees (first 2 children). 12 weeks for 3rd child onwards."],
        ["Eligibility", "Employee must have worked for at least 80 days in the 12 months preceding the expected delivery date."],
        ["Miscarriage / Medical Termination", "6 weeks paid leave following miscarriage or medical termination of pregnancy."],
        ["Nursing Breaks", "Two nursing breaks per day until the child is 15 months old."],
        ["Creche Facility", "Companies with 50+ employees must provide or arrange creche facilities."],
        ["Work from Home", "May be availed if nature of work permits, as agreed with the employer."],
        ["No Dismissal", "No employer shall discharge or dismiss an employee during or on account of maternity."],
        ["How to Apply", "Submit a written application to HR at least 8 weeks before expected delivery date with medical certificate."],
    ];

    benefits.forEach(([title, desc]) => {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(title + ":", margin, y); y += 5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(desc, pageW - margin * 2 - 5);
        doc.text(lines, margin + 4, y); y += lines.length * 5 + 4;
    });

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Maternity Benefit Act, 1961");
    doc.save(`Notice_MaternityBenefit_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice8_PaymentOfWages(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "NOTICE — PAYMENT OF WAGES ACT, 1936", "Rights of Employees Regarding Wage Payment", company, format(new Date(), "dd MMM yyyy"));

    const rows: [string, string][] = [
        ["Wage Payment Day", "On or before the 7th of every following month (10th if workforce > 1000)"],
        ["Medium of Payment", "By direct bank transfer (NEFT/RTGS) or cheque"],
        ["Deductions Allowed", "Only deductions authorised by the Act (EPF, ESIC, PT, Advances, Fines)"],
        ["Maximum Fine", "Imposable fines must be pre-approved and cannot exceed 3% of monthly wages"],
        ["Disputes", "Disputes regarding unpaid/delayed wages may be raised with the Payment of Wages Authority"],
        ["Record of Wages", "Wage slips / payslips shall be provided to each employee every month"],
    ];

    rows.forEach(([k, v]) => {
        if (y > 258) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(k + ":", margin, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(v, pageW - margin - 80);
        doc.text(lines, margin + 60, y); y += Math.max(lines.length * 5, 6) + 3;
        doc.setDrawColor(230, 230, 230); doc.line(margin, y - 1, pageW - margin, y - 1);
    });

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Payment of Wages Act, 1936");
    doc.save(`Notice_PaymentOfWages_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice9_Bonus(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    const fy = `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`;
    let y = pdfHeader(doc, "ANNUAL BONUS NOTICE", `Payment of Bonus Act, 1965 — FY ${fy}`, company, format(new Date(), "dd MMM yyyy"));

    const items: [string, string][] = [
        ["Eligibility", "All employees earning ≤ ₹21,000/month who have worked for at least 30 working days in the financial year"],
        ["Bonus Calculation Ceiling", "Wages capped at ₹7,000/month or minimum wage (whichever is higher) for bonus calculation"],
        ["Minimum Bonus", "8.33% of annual wages (or ₹100, whichever is higher)"],
        ["Maximum Bonus", "20% of annual wages (paid only when allocable surplus exists)"],
        ["Payment Timeline", "Within 8 months of the close of the financial year (i.e., by 30 November)"],
        ["Mode of Payment", "By bank transfer or cheque against employee signature"],
        ["Disputes", "Disputes may be referred to the Labour Court or Labour Commissioner"],
    ];

    items.forEach(([k, v]) => {
        if (y > 258) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(k + ":", margin, y); y += 5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(v, pageW - margin * 2 - 5);
        doc.text(lines, margin + 5, y); y += lines.length * 5 + 4;
        doc.setDrawColor(230, 230, 230); doc.line(margin, y - 1, pageW - margin, y - 1);
    });

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Payment of Bonus Act, 1965");
    doc.save(`Notice_AnnualBonus_${company.replace(/\s+/g, "_")}.pdf`);
}

async function genNotice10_Gratuity(company: string) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 18; const pageW = doc.internal.pageSize.getWidth();
    let y = pdfHeader(doc, "NOTICE — PAYMENT OF GRATUITY ACT, 1972", "Employee Rights Regarding Gratuity", company, format(new Date(), "dd MMM yyyy"));

    const items: [string, string][] = [
        ["Eligibility", "Any employee who has rendered continuous service of 5 years or more (except in case of death or disablement)"],
        ["Formula", "Gratuity = (Last Drawn Monthly Wages × 15 × Years of Service) ÷ 26"],
        ["Maximum Amount", "₹20,00,000 (Twenty Lakhs) — government employees covered by separate scheme"],
        ["Nominee", "Every employee should file a nomination form (Form F) with HR"],
        ["How to Claim", "Submit Form I to HR within 30 days of leaving service. Employer must pay within 30 days of receipt."],
        ["Death / Disablement", "Payable to nominee / legal heir even before completion of 5 years in case of death or disablement"],
        ["Tax Exemption", "Gratuity up to ₹20 Lakhs is exempt from income tax under Section 10(10) of the Income Tax Act"],
    ];

    items.forEach(([k, v]) => {
        if (y > 258) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(k + ":", margin, y); y += 5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(v, pageW - margin * 2 - 5);
        doc.text(lines, margin + 5, y); y += lines.length * 5 + 4;
        doc.setDrawColor(230, 230, 230); doc.line(margin, y - 1, pageW - margin, y - 1);
    });

    y = signatureBlock(doc, y);
    pdfFooter(doc, company, "Payment of Gratuity Act, 1972");
    doc.save(`Notice_Gratuity_${company.replace(/\s+/g, "_")}.pdf`);
}

// ─── Notice catalogue ──────────────────────────────────────────────────────

type NoticeEntry = {
    id: number;
    title: string;
    act: string;
    when: string;
    boardRequired: boolean;
    description: string;
    dynamic: boolean;
    generate: (c: CompanyInfo, m: ICCMember[]) => Promise<void>;
};

function buildCatalogue(company: CompanyInfo, members: ICCMember[]): NoticeEntry[] {
    const addr = company.address || "Maharashtra, India";
    return [
        {
            id: 1, boardRequired: true, dynamic: false,
            title: "Abstract of Shops & Establishments Act",
            act: "Maharashtra S&E Act, 1948", when: "Permanent — displayed at all times",
            description: "Summary of employee rights, working hours, leave, wage payment rules.",
            generate: () => genNotice1_ShopsEstab(company.name, addr)
        },
        {
            id: 2, boardRequired: true, dynamic: false,
            title: "Notice of Working Hours & Weekly Off",
            act: "Factories Act / S&E Act", when: "Permanent",
            description: "Details work timings, shifts, rest intervals, and overtime entitlement.",
            generate: () => genNotice2_WorkingHours(company.name)
        },
        {
            id: 3, boardRequired: true, dynamic: true,
            title: "Minimum Wages Notice",
            act: "Minimum Wages Act, 1948", when: "January (on GOM rate revision) — Update annually",
            description: "Maharashtra Zone I MW rates for Unskilled, Semi-Skilled, Skilled, Highly Skilled.",
            generate: () => genNotice3_MinimumWages(company.name)
        },
        {
            id: 4, boardRequired: true, dynamic: true,
            title: "POSH Policy & ICC Roster",
            act: "POSH Act, 2013", when: "Permanent — refresh ICC roster annually",
            description: "Zero-tolerance policy, what constitutes harassment, how to complain, and ICC member list.",
            generate: () => genNotice4_POSH(company.name, members)
        },
        {
            id: 5, boardRequired: true, dynamic: false,
            title: "Equal Remuneration Policy",
            act: "Equal Remuneration Act, 1976", when: "Permanent",
            description: "Commitment to equal pay for equal work regardless of gender.",
            generate: () => genNotice5_EqualRem(company.name)
        },
        {
            id: 6, boardRequired: true, dynamic: false,
            title: "PF & ESIC Registration Notice",
            act: "EPF & MP Act, 1952 / ESI Act, 1948", when: "Permanent",
            description: "Contributions, entitlements, and contact information for EPF and ESIC.",
            generate: () => genNotice6_PFESIC(company.name)
        },
        {
            id: 7, boardRequired: true, dynamic: false,
            title: "Maternity Benefit Notice",
            act: "Maternity Benefit Act, 1961", when: "Permanent",
            description: "26 weeks maternity leave, nursing breaks, creche, and no-dismissal provisions.",
            generate: () => genNotice7_Maternity(company.name)
        },
        {
            id: 8, boardRequired: true, dynamic: false,
            title: "Payment of Wages Notice",
            act: "Payment of Wages Act, 1936", when: "Permanent",
            description: "Wage payment day, permissible deductions, payslip rights, dispute mechanism.",
            generate: () => genNotice8_PaymentOfWages(company.name)
        },
        {
            id: 9, boardRequired: true, dynamic: true,
            title: "Annual Bonus Notice (FY)",
            act: "Payment of Bonus Act, 1965", when: "March / April — display at start of new FY",
            description: "Eligibility, calculation ceiling, min/max bonus %, and payment timeline.",
            generate: () => genNotice9_Bonus(company.name)
        },
        {
            id: 10, boardRequired: true, dynamic: false,
            title: "Gratuity Notice",
            act: "Payment of Gratuity Act, 1972", when: "Permanent",
            description: "Eligibility (5 years), formula, nomination (Form F), and tax exemption.",
            generate: () => genNotice10_Gratuity(company.name)
        },
    ];
}

// ─── Main Component ───────────────────────────────────────────────────────────

const NoticeBoard = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState<CompanyInfo | null>(null);
    const [members, setMembers] = useState<ICCMember[]>([]);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }
            const { data: comp } = await supabase.from("companies").select("id, name, address").eq("user_id", user.id).maybeSingle() as any;
            if (comp) {
                setCompany(comp);
                const { data: m } = await (supabase as any).from("posh_icc_members").select("name, designation, role, contact_email, appointed_on").eq("company_id", comp.id);
                setMembers((m || []) as ICCMember[]);
            }
            setLoading(false);
        };
        init();
    }, []);

    const handleDownload = async (notice: NoticeEntry) => {
        if (!company) return;
        await notice.generate(company, members);
        toast({ title: `${notice.title} downloaded`, description: "A4 PDF ready to print and display." });
    };

    const handleDownloadAll = async () => {
        if (!company) return;
        const catalogue = buildCatalogue(company, members);
        for (const n of catalogue) {
            await n.generate(company, members);
        }
        toast({ title: "All notices downloaded", description: `${catalogue.length} PDFs are ready.` });
    };

    if (loading) return <PageSkeleton />;
    if (!company) return <div className="p-8 text-muted-foreground">Set up your company first.</div>;

    const catalogue = buildCatalogue(company, members);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Pin className="h-6 w-6 text-primary" /> Mandatory Notice Board
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        All notices legally required to be displayed at your workplace. Download, print, and pin on your notice board.
                    </p>
                </div>
                <Button onClick={handleDownloadAll} className="gap-2 self-start bg-primary text-white">
                    <Download className="h-4 w-4" /> Download All ({catalogue.length} PDFs)
                </Button>
            </div>

            {/* Key info banner */}
            <div className="flex gap-3 p-4 rounded-lg border bg-blue-50 border-blue-200">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <span className="font-semibold">Compliance Reminder:</span> All{" "}
                    <span className="font-semibold">🔴 Notice Board Required</span> notices must be displayed at a prominent place accessible to all employees. Refreshing annually (January for MW rates, April for Bonus) is mandatory.
                    {members.length === 0 && (
                        <span className="block mt-1 text-amber-700 font-medium">⚠ No ICC members found — POSH notice will be generated without the roster. Add ICC members in the POSH module first.</span>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {catalogue.map(notice => (
                    <Card key={notice.id} className="flex flex-col hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-sm font-semibold leading-snug">{notice.title}</CardTitle>
                                <div className="flex flex-col gap-1 items-end shrink-0">
                                    {notice.boardRequired && (
                                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">🔴 Notice Board</Badge>
                                    )}
                                    {notice.dynamic && (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">⚡ Dynamic</Badge>
                                    )}
                                </div>
                            </div>
                            <CardDescription className="text-xs mt-1">{notice.act}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col flex-1 gap-3 pt-0">
                            <p className="text-xs text-muted-foreground flex-1">{notice.description}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-0.5">📅 {notice.when}</span>
                                <Button size="sm" variant="outline" onClick={() => handleDownload(notice)} className="gap-1.5 h-7 text-xs">
                                    <Download className="h-3.5 w-3.5" /> PDF
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default NoticeBoard;
