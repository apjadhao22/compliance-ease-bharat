import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Calculator, Landmark, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskCalculator } from "@/components/RiskCalculator";
import { ComplianceWeb } from "@/components/ComplianceWeb";
import { LeadFormModal, LeadIntent } from "@/components/LeadFormModal";

const compliances = [
  {
    title: "EPF & ESIC",
    desc: "Automate contributions, ECRs and challans so PF/ESI never slip through the cracks.",
    risk: "Avoid 12% interest, up to 25% damages, and prosecution for repeated defaults."
  },
  {
    title: "Professional Tax",
    desc: "Handle state-wise PT slabs, challans and returns before penalties add up.",
    risk: "Avoid 10% penalty, monthly interest and flat late-filing fines."
  },
  {
    title: "TDS on Salaries",
    desc: "Compute TDS under old/new regimes and feed accurate data into returns.",
    risk: "Prevents ₹200/day late-fee per return and interest on short-deduction."
  },
  {
    title: "Labour Welfare Fund",
    desc: "Track eligibility, deductions and half-yearly filings across states.",
    risk: "Prevents missing mandatory state-wise welfare contributions."
  },
  {
    title: "Bonus & Gratuity",
    desc: "Calculate statutory bonus and 5-year gratuity correctly, every time.",
    risk: "Avoids immediate union disputes and legal claims on full & final exit."
  },
  {
    title: "Maternity Benefit",
    desc: "Track 26-week leave and benefits while protecting the employee’s job rights.",
    risk: "Avoids federal law violations for denying mandatory benefits or crèche facilities."
  },
  {
    title: "Equal Remuneration",
    desc: "Audit pay parity so gaps don’t turn into legal disputes.",
    risk: "Ensures compliance with gender-neutral pay scales across all roles."
  },
  {
    title: "POSH",
    desc: "Run IC, trainings and documentation with a clean audit trail.",
    risk: "Avoids instant ₹50k fine for missing IC committees or annual returns."
  },
  {
    title: "Employee Compensation",
    desc: "Manage incidents, compensation and evidence in one place.",
    risk: "Ensures workplace injury coverage and claims are legally sound."
  },
  {
    title: "Statutory Registers",
    desc: "Keep all mandatory registers in inspector-ready formats.",
    risk: "Auto-maintain Form A, B, C, D to pass spontaneous audits."
  },
];

const payrollServices = [
  { title: "Core Payroll", desc: "Accurate, compliant payroll cycles with inspector-ready payslips." },
  { title: "Employee Management", desc: "Single source of truth for every employee’s data and documents that stands up in audits." },
  { title: "F&F Settlements", desc: "No-surprise exits: full and final dues computed to the last rupee for legal safety." },
  { title: "Timesheets & Attendance", desc: "Attendance and overtime records that stand up in audits." },
  { title: "Leave", desc: "Configurable leave policies aligned tightly with labour laws." },
  { title: "Shifts", desc: "Complex rosters and weekly-offs visualised and legally controlled." },
  { title: "Advances", desc: "Transparent advances and deductions that strictly respect wage rules." },
  { title: "Notice Board & Audit Log", desc: "Broadcast updates and see every compliance-grade change made in the system." },
];

const Index = () => {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("SME Trial");

  const openLeadModal = (intent: LeadIntent) => {
    setLeadIntent(intent);
    setIsLeadModalOpen(true);
  };

  return (
    <>
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
        {/* Navbar - Clean and Airy */}
        <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md">
          <div className="container flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">OpticompBharat</span>
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <a href="#features" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Platform</a>
              <a href="#pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Case Studies</a>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" className="text-sm font-semibold hover:bg-black/5" asChild>
                <Link to="/sign-in">Log in</Link>
              </Button>
              <Button onClick={() => openLeadModal("SME Trial")} className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 shadow-sm">
                Start Free Trial
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Section - Fear Based Marketing */}
        <section className="relative pt-32 pb-12 md:pt-40 md:pb-16 overflow-hidden">
          {/* Soft colorful background blobs for that SaaS feel */}
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-500/10 blur-[120px] rounded-full sm:w-[800px] sm:h-[800px] pointer-events-none -z-10" />
          <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] bg-orange-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

          <div className="container relative z-10 flex flex-col items-center text-center">

            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-[11px] font-bold rounded-full border-red-500/20 bg-red-500/10 text-red-600 tracking-widest uppercase shadow-sm">
              FREE 1-YEAR TRIAL FOR FIRST 100 COMPANIES
            </Badge>

            <h1 className="mx-auto max-w-5xl text-5xl font-[900] tracking-tighter text-foreground sm:text-6xl md:text-7xl leading-[1.05]">
              Indian labour laws change monthly. <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500">One wrong payroll run</span> can trigger inspections and penalties.
            </h1>

            <p className="mx-auto mt-8 max-w-3xl text-lg text-muted-foreground md:text-xl font-medium leading-relaxed">
              From EPF and ESI to PT, LWF, TDS, maternity and POSH – OpticompBharat’s AI + human experts keep every filing, register and benefit up-to-date so you never fear an inspection again.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 w-full mb-12">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button size="lg" asChild className="w-full sm:w-auto rounded-full bg-foreground text-background hover:bg-foreground/90 px-8 h-14 text-base font-bold shadow-xl transition-all hover:-translate-y-1">
                  <a href="#risk-calculator">Calculate My Risk in 10 Seconds</a>
                </Button>
                <Button onClick={() => openLeadModal("Enterprise Quote")} size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-bold bg-white shadow-sm border-gray-200 hover:bg-gray-50 transition-all hover:-translate-y-1">
                  Book a Demo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-medium">No signup needed.</p>
            </div>

            {/* Social Proof */}
            <div className="mb-16 border-t border-b border-border py-6 w-full max-w-5xl flex flex-col items-center justify-center gap-4">
              <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Trusted by 50+ Indian SMEs and compliance consultants</p>
              <div className="flex gap-8 md:gap-16 opacity-40 grayscale flex-wrap justify-center items-center">
                {/* Placeholder logos for social proof */}
                <div className="font-[900] text-xl tracking-tighter">FinTech Innovators</div>
                <div className="font-[900] text-xl tracking-tighter">HealthCare Nexus</div>
                <div className="font-[900] text-xl tracking-tighter">LogiServe India</div>
                <div className="font-[900] text-xl tracking-tighter hidden md:block">EdTech Pioneers</div>
              </div>
            </div>

            <div id="risk-calculator" className="w-full scroll-mt-24">
              <RiskCalculator />
            </div>
          </div>
        </section>

        <ComplianceWeb />

        {/* Bento Grid - Statutory Compliance Firewall */}
        <section id="features" className="py-24 bg-[#0a0f1d] text-white relative">
          <div className="container relative z-10">
            <div className="max-w-3xl mb-16 text-center mx-auto">
              <h2 className="text-4xl font-[900] tracking-tighter sm:text-5xl md:text-6xl text-white">
                The Statutory Compliance<br />
                <span className="text-gray-400">Firewall.</span>
              </h2>
              <p className="mt-6 text-xl text-gray-400 leading-relaxed font-medium">
                We replace manual spreadsheets with an automated engine that computes, files, and tracks every statutory obligation under Indian law.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-6xl mx-auto">

              {/* Large Hero Card (Feature 1) */}
              <div className="col-span-1 md:col-span-8 bg-gradient-to-br from-[#1a233a] to-[#0f1525] p-10 rounded-[2rem] border border-white/10 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[80px] transition-all group-hover:bg-red-500/20" />
                <div className="h-full flex flex-col justify-between relative z-10">
                  <div className="bg-red-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 border border-red-500/30">
                    <Calculator className="w-7 h-7 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold mb-3">{compliances[0].title}</h3>
                    <p className="text-lg text-gray-300 font-medium max-w-xl leading-relaxed mb-4">
                      {compliances[0].desc}
                    </p>
                    <p className="text-sm text-red-400 font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4" /> {compliances[0].risk}
                    </p>
                  </div>
                </div>
              </div>

              {/* Square Card (Feature 2) */}
              <div className="col-span-1 md:col-span-4 bg-[#1a233a] p-10 rounded-[2rem] border border-white/10 flex flex-col justify-between group">
                <div className="bg-orange-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-orange-500/30">
                  <Landmark className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">{compliances[1].title}</h3>
                  <p className="text-gray-300 font-medium mb-4 leading-relaxed">{compliances[1].desc}</p>
                  <p className="text-xs text-orange-400 font-medium flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 shrink-0" /> {compliances[1].risk}
                  </p>
                </div>
              </div>

              {/* List Array - Remaining Compliances */}
              <div className="col-span-1 md:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {compliances.slice(2).map((item) => (
                  <div
                    key={item.title}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                  >
                    <h4 className="text-lg font-bold text-gray-100 mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-300 leading-relaxed mb-4">
                      {item.desc}
                    </p>
                    <div className="pt-4 border-t border-white/10 mt-auto">
                      <p className="text-xs text-emerald-400 font-medium flex items-start gap-1.5 leading-relaxed">
                        <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {item.risk}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>

        {/* Payroll & HR Operations */}
        <section className="py-24 bg-muted/50 relative">
          <div className="container relative z-10">
            <div className="max-w-3xl mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Payroll & HR Operations,<br />
                <span className="text-muted-foreground">tied directly to compliance.</span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl mx-auto">
              {payrollServices.map((item) => (
                <div
                  key={item.title}
                  className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="text-base font-bold text-foreground mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Lead Generation / Getting Started */}
        <section id="pricing" className="border-t py-20 md:py-28 bg-[#0a0f1d] text-white">
          <div className="container">
            <div className="max-w-3xl mb-16 mx-auto text-center">
              <h2 className="text-4xl font-[900] tracking-tighter sm:text-5xl md:text-6xl text-white">
                Stop worrying about compliance.<br />
                <span className="text-gray-400">Start focusing on growth.</span>
              </h2>
              <p className="mt-6 text-xl text-gray-400 font-medium">
                Join the hundreds of companies transforming their HR operations.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">

              {/* SME Free Trial */}
              <Card className="bg-[#1a233a] border-white/10 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[80px] transition-all group-hover:bg-emerald-500/20" />
                <CardHeader className="text-center pb-8 border-b border-white/10 relative z-10">
                  <CardTitle className="text-3xl text-white font-bold tracking-tight">SME Free Trial</CardTitle>
                  <CardDescription className="text-gray-400 font-medium mt-2 text-base">For growing businesses up to 1000 employees</CardDescription>
                  <div className="mt-8 text-6xl font-[900] text-emerald-400 tracking-tighter">1 Year</div>
                  <div className="text-xs tracking-widest uppercase font-bold text-gray-500 mt-4">Platform Free</div>
                </CardHeader>
                <CardContent className="pt-8 relative z-10 flex-1 flex flex-col mb-2">
                  <ul className="space-y-5 mb-10 flex-1">
                    <li className="flex items-start gap-3 text-base text-gray-300 font-medium">
                      <Shield className="w-6 h-6 text-emerald-400 shrink-0" />
                      <span>Full access to automatic statutory deductions (EPF, ESI, PT, TDS)</span>
                    </li>
                    <li className="flex items-start gap-3 text-base text-gray-300 font-medium">
                      <Shield className="w-6 h-6 text-emerald-400 shrink-0" />
                      <span>Auto-generated compliance registers and challans</span>
                    </li>
                    <li className="flex items-start gap-3 text-base text-gray-300 font-medium">
                      <Shield className="w-6 h-6 text-emerald-400 shrink-0" />
                      <span>Unlimited payroll cycles with audit-ready payslips</span>
                    </li>
                  </ul>
                  <Button
                    size="lg"
                    onClick={() => openLeadModal("SME Trial")}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-14 text-lg rounded-full shadow-lg transition-transform hover:-translate-y-1"
                  >
                    Apply for Free Trial
                  </Button>
                </CardContent>
              </Card>

              {/* Enterprise Quote */}
              <Card className="bg-gradient-to-br from-[#0f1525] to-black border-white/5 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] transition-all group-hover:bg-blue-500/10" />
                <CardHeader className="text-center pb-8 border-b border-white/10 relative z-10">
                  <CardTitle className="text-3xl text-white font-bold tracking-tight">Enterprise</CardTitle>
                  <CardDescription className="text-gray-400 font-medium mt-2 text-base">For large-scale, complex HR operations</CardDescription>
                  <div className="mt-8 text-5xl font-[900] text-white tracking-tighter">Custom Quote</div>
                  <div className="text-xs tracking-widest uppercase font-bold text-gray-500 mt-4">Tailored Solutions</div>
                </CardHeader>
                <CardContent className="pt-8 relative z-10 flex-1 flex flex-col mb-2">
                  <ul className="space-y-5 mb-10 flex-1">
                    <li className="flex items-start gap-3 text-base text-gray-300 font-medium">
                      <Users className="w-6 h-6 text-blue-400 shrink-0" />
                      <span>White-glove onboarding and dedicated compliance manager</span>
                    </li>
                    <li className="flex items-start gap-3 text-base text-gray-300 font-medium">
                      <Landmark className="w-6 h-6 text-blue-400 shrink-0" />
                      <span>Advanced API access to ingest your existing HRMS outputs</span>
                    </li>
                    <li className="flex items-start gap-3 text-base text-gray-300 font-medium">
                      <Calculator className="w-6 h-6 text-blue-400 shrink-0" />
                      <span>Multi-state, multi-entity unified compliance dashboard</span>
                    </li>
                  </ul>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => openLeadModal("Enterprise Quote")}
                    className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white font-bold h-14 text-lg rounded-full transition-all hover:-translate-y-1"
                  >
                    Request a Quote
                  </Button>
                </CardContent>
              </Card>

            </div>

            {/* FAQ (Dark Mode adapted) */}
            <div className="mt-32 max-w-4xl mx-auto border-t border-white/10 pt-16">
              <h3 className="text-3xl font-[900] tracking-tight text-center mb-12 text-white">Frequently Asked Questions</h3>
              <div className="grid gap-10 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-bold text-lg text-white">Are laws and rates updated automatically?</h4>
                  <p className="text-gray-400 leading-relaxed text-sm">Yes. We constantly monitor central and state gazettes for changes in VDA, PT slabs, EPF rates, and deadines. The software rules engines are updated centrally, requiring zero patches on your end.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold text-lg text-white">What if there is a notice despite using OpticompBharat?</h4>
                  <p className="text-gray-400 leading-relaxed text-sm">Because our software leaves a perfect audit trail of correctly calculated liabilities and filed challans, resolving a notice usually just involves downloading the exact monthly registers from our system and handing them to the inspector.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold text-lg text-white">Can you work with our existing payroll?</h4>
                  <p className="text-gray-400 leading-relaxed text-sm">While OpticompBharat works best as an end-to-end unified platform replacing your current HRMS/Payroll, our API access on the Enterprise tier allows us to consume payroll outputs solely for compliance filings.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-secondary py-12">
          <div className="container">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold text-secondary-foreground">OpticompBharat</span>
              </div>
              <div className="flex gap-6 text-sm text-secondary-foreground/70">
                <a href="#" className="hover:text-secondary-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-secondary-foreground transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-secondary-foreground transition-colors">Contact Us</a>
              </div>
            </div>
            <div className="mt-8 text-center text-sm text-secondary-foreground/50 border-t border-secondary-foreground/10 pt-8 max-w-5xl mx-auto">
              <p className="mb-4 text-xs">
                OpticompBharat provides automated calculations and reminders based on current statutes and notifications. Final responsibility for statutory compliance remains with the employer; always consult your legal or tax advisor for case-specific decisions.
              </p>
              <p>© {new Date().getFullYear()} OpticompBharat. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Lead Capture Modal */}
      <LeadFormModal
        isOpen={isLeadModalOpen}
        setIsOpen={setIsLeadModalOpen}
        intent={leadIntent}
      />
    </>
  );
};

export default Index;
