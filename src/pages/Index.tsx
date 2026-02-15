import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Calculator, Calendar, FileText, Users, Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Shield,
    title: "EPF & ESIC Automation",
    description: "Auto-calculate employee & employer contributions, generate ECR files. Apply ₹15,000 EPS wage ceiling automatically.",
  },
  {
    icon: Landmark,
    title: "Professional Tax",
    description: "Maharashtra slab-based calculations with monthly filing support. Auto-apply ₹312 February adjustment.",
  },
  {
    icon: Calculator,
    title: "Bonus & Gratuity",
    description: "Annual bonus (8.33%–20%) per Payment of Bonus Act. Gratuity calculation with 5-year eligibility check.",
  },
  {
    icon: FileText,
    title: "TDS on Salaries",
    description: "New tax regime slabs for FY 2025-26. ₹75,000 standard deduction, monthly TDS computation & Form 16.",
  },
  {
    icon: Users,
    title: "Labour Welfare Fund",
    description: "Maharashtra rates — Employee ₹25 + Employer ₹75. Half-yearly tracking for June 30 & December 31 deadlines.",
  },
  {
    icon: Calendar,
    title: "Compliance Calendar",
    description: "Never miss EPF 15th, ESIC 21st, or PT deadlines. Visual indicators for overdue, upcoming & completed filings.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "₹999",
    description: "For small businesses getting started",
    features: ["Up to 25 employees", "EPF, ESIC, PT calculations", "Basic reports", "Email support"],
    popular: false,
  },
  {
    name: "Professional",
    price: "₹2,499",
    description: "For growing companies needing full compliance",
    features: [
      "Up to 100 employees",
      "All Starter features",
      "Bonus, Gratuity, TDS, LWF",
      "Form generation (ECR, Form D, Form 16)",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "₹4,999",
    description: "For large organizations with custom needs",
    features: [
      "Unlimited employees",
      "All Professional features",
      "API access",
      "Dedicated account manager",
      "Custom integrations",
    ],
    popular: false,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-secondary">ComplianceEngine</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/sign-in">Sign In</Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/sign-up">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(207_68%_53%/0.08),transparent_60%)]" />
        <div className="container text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
            Trusted by 500+ Indian Companies
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Automate Indian{" "}
            <span className="text-primary">Statutory Compliance</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            EPF, ESIC, Professional Tax, Bonus, Gratuity, TDS & LWF — All in One Platform.
            Stay compliant, avoid penalties, save hours every month.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 text-base font-semibold shadow-lg">
              <Link to="/sign-up">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="px-8 text-base font-semibold">
              Watch Demo
            </Button>
          </div>
          {/* Dashboard mockup */}
          <div className="mx-auto mt-16 max-w-4xl rounded-xl border bg-card p-4 shadow-2xl">
            <div className="rounded-lg bg-muted p-8">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Employees", value: "247", color: "text-primary" },
                  { label: "EPF Filed", value: "₹4.2L", color: "text-success" },
                  { label: "PT Due", value: "3 days", color: "text-accent" },
                  { label: "Compliance", value: "98%", color: "text-success" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-card p-4 text-center shadow-sm">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-20 md:py-28">
        <div className="container">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything You Need for Compliance
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              End-to-end statutory compliance automation built for Indian labour laws
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group border bg-card transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t py-20 md:py-28">
        <div className="container">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose the plan that fits your organization
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${
                  plan.popular
                    ? "border-2 border-primary shadow-xl scale-[1.03]"
                    : "border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-success">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    asChild
                    className={`w-full ${
                      plan.popular
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link to={`/sign-up?plan=${plan.name.toLowerCase()}`}>
                      Get Started
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-secondary py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-secondary-foreground">ComplianceEngine</span>
            </div>
            <div className="flex gap-6 text-sm text-secondary-foreground/70">
              <a href="#" className="hover:text-secondary-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-secondary-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-secondary-foreground transition-colors">Contact Us</a>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-secondary-foreground/50">
            © {new Date().getFullYear()} ComplianceEngine. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
