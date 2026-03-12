import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Shield, LayoutDashboard, FileText, PiggyBank, CalendarDays, User,
  FileArchive, LogOut, Menu, X, Clock, HandCoins, Landmark, Bell,
  Laptop, AlertCircle, Baby, FileBarChart, Scale, DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useESSFeatures } from "@/hooks/useESSFeatures";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface EmployeeInfo {
  name: string;
  company_name: string;
  ess_enabled: boolean;
}

// All possible nav items keyed by ESS feature name (null = always visible)
const ALL_NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/ess", feature: null },
  { label: "Payslips", icon: FileText, path: "/ess/payslips", feature: "payslips" as const },
  { label: "Tax", icon: PiggyBank, path: "/ess/tax", feature: "tax_declarations" as const },
  { label: "Leaves", icon: CalendarDays, path: "/ess/leaves", feature: "leave_requests" as const },
  { label: "Profile", icon: User, path: "/ess/profile", feature: "profile_edit" as const },
  { label: "Timesheets", icon: Clock, path: "/ess/timesheets", feature: "timesheets" as const },
  { label: "Expenses", icon: HandCoins, path: "/ess/expenses", feature: "expenses" as const },
  { label: "Advances", icon: Landmark, path: "/ess/advances", feature: "advances" as const },
  { label: "Assets", icon: Laptop, path: "/ess/assets", feature: "assets" as const },
  { label: "Documents", icon: FileArchive, path: "/ess/documents", feature: "documents" as const },
  { label: "Notices", icon: Bell, path: "/ess/notices", feature: "notices" as const },
  { label: "Schedule", icon: CalendarDays, path: "/ess/schedule", feature: "shift_schedule" as const },
  { label: "Comp-Off", icon: Scale, path: "/ess/comp-off", feature: "comp_off" as const },
  { label: "Regularize", icon: AlertCircle, path: "/ess/regularization", feature: "regularization" as const },
  { label: "Maternity", icon: Baby, path: "/ess/maternity", feature: "maternity_tracking" as const },
  { label: "Annual Stmt", icon: FileBarChart, path: "/ess/annual-statement", feature: "annual_statement" as const },
  { label: "Grievance", icon: AlertCircle, path: "/ess/grievance", feature: "grievance" as const },
  { label: "POSH", icon: Shield, path: "/ess/posh", feature: "posh_complaint" as const },
  { label: "Exit", icon: DoorOpen, path: "/ess/exit", feature: "exit_request" as const },
];

const ESSLayout = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { features } = useESSFeatures();

  // Build visible nav items based on enabled features
  const navItems = ALL_NAV_ITEMS.filter(
    (item) => item.feature === null || features[item.feature]
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (!u) {
        navigate("/ess/login");
        return;
      }
      if (u.user_metadata?.role !== "employee") {
        navigate("/dashboard");
        return;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (!u) {
        navigate("/ess/login");
        return;
      }
      if (u.user_metadata?.role !== "employee") {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    linkAndFetch();
  }, [user]);

  const linkAndFetch = async () => {
    if (!user) return;
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("id, name, company_id, auth_user_id, companies(name, ess_enabled)")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp) {
        await supabase.functions.invoke("link-ess-account");
        const { data: linked } = await supabase
          .from("employees")
          .select("id, name, company_id, companies(name, ess_enabled)")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (linked) {
          setEmployeeInfo({
            name: linked.name,
            company_name: (linked as any).companies?.name ?? "",
            ess_enabled: (linked as any).companies?.ess_enabled ?? true,
          });
        }
      } else {
        setEmployeeInfo({
          name: emp.name,
          company_name: (emp as any).companies?.name ?? "",
          ess_enabled: (emp as any).companies?.ess_enabled ?? true,
        });
      }
      setLinked(true);
    } catch {
      setLinked(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/ess/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  if (linked && employeeInfo && employeeInfo.ess_enabled === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Portal Unavailable</h1>
        <p className="text-muted-foreground">
          Employee portal is not available for your organization. Please contact your HR team.
        </p>
        <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
      </div>
    );
  }

  const isActive = (path: string) =>
    path === "/ess"
      ? location.pathname === "/ess" || location.pathname === "/ess/"
      : location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-bold leading-none">OpticompBharat</p>
                <p className="text-xs text-muted-foreground">Employee Portal</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {employeeInfo && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{employeeInfo.name}</p>
                <p className="text-xs text-muted-foreground">{employeeInfo.company_name}</p>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Desktop horizontal nav */}
        <nav className="hidden overflow-x-auto border-t md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
                isActive(item.path)
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile dropdown nav */}
      {mobileMenuOpen && (
        <nav className="border-b bg-card shadow-md md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors",
                isActive(item.path)
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Page content */}
      <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar — show first 5 visible items */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-card md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
              isActive(item.path) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default ESSLayout;
