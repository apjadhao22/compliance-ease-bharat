import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";

// Eagerly loaded (landing + auth — always needed)
import Index from "./pages/Index";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import DashboardOverview from "./pages/dashboard/Overview";

// Lazy-loaded dashboard pages — each becomes its own chunk
const CompanySetup = lazy(() => import("./pages/dashboard/CompanySetup"));
const Employees = lazy(() => import("./pages/dashboard/Employees"));
const Payroll = lazy(() => import("./pages/dashboard/Payroll"));
const ProfessionalTax = lazy(() => import("./pages/dashboard/ProfessionalTax"));
const BonusGratuity = lazy(() => import("./pages/dashboard/BonusGratuity"));
const TDSPage = lazy(() => import("./pages/dashboard/TDS"));
const LWFPage = lazy(() => import("./pages/dashboard/LWF"));
const ComplianceCalendar = lazy(() => import("./pages/dashboard/ComplianceCalendar"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const FormIIUpload = lazy(() => import("./pages/dashboard/FormIIUpload"));
const Accidents = lazy(() => import("./pages/dashboard/Accidents"));
const Maternity = lazy(() => import("./pages/dashboard/Maternity"));
const EqualRemuneration = lazy(() => import("./pages/dashboard/EqualRemuneration"));
const EPFESICPage = lazy(() => import("./pages/dashboard/EPFESIC"));
const Assets = lazy(() => import("./pages/dashboard/Assets"));
const Expenses = lazy(() => import("./pages/dashboard/Expenses"));
const FnFSettlement = lazy(() => import("./pages/dashboard/FnFSettlement"));
const Leaves = lazy(() => import("./pages/dashboard/Leaves"));
const Timesheets = lazy(() => import("./pages/dashboard/Timesheets"));
const Registers = lazy(() => import("./pages/dashboard/Registers"));
const Advances = lazy(() => import("./pages/dashboard/Advances"));
const POSH = lazy(() => import("./pages/dashboard/POSH"));
const Documents = lazy(() => import("./pages/dashboard/Documents"));
const ShiftPolicies = lazy(() => import("./pages/dashboard/ShiftPolicies"));
const OSHCompliance = lazy(() => import("./pages/dashboard/OSHCompliance"));
const IRCompliance = lazy(() => import("./pages/dashboard/IRCompliance"));
const SECompliance = lazy(() => import("./pages/dashboard/SECompliance"));
const AuditLog = lazy(() => import("./pages/dashboard/AuditLog"));
const NoticeBoard = lazy(() => import("./pages/dashboard/NoticeBoard"));
const GigCess = lazy(() => import("./pages/dashboard/GigCess"));

const queryClient = new QueryClient();

// Minimal loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center p-12">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  // Top-level boundary: catches any error that escapes individual pages
  <ErrorBoundary fullPage>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              {/* Per-route boundary + Suspense: each page loads independently */}
              <Route index element={<ErrorBoundary sectionName="Overview"><Suspense fallback={<PageLoader />}><DashboardOverview /></Suspense></ErrorBoundary>} />
              <Route path="company" element={<ErrorBoundary sectionName="Company Setup"><Suspense fallback={<PageLoader />}><CompanySetup /></Suspense></ErrorBoundary>} />
              <Route path="employees" element={<ErrorBoundary sectionName="Employees"><Suspense fallback={<PageLoader />}><Employees /></Suspense></ErrorBoundary>} />
              <Route path="payroll" element={<ErrorBoundary sectionName="Payroll"><Suspense fallback={<PageLoader />}><Payroll /></Suspense></ErrorBoundary>} />
              <Route path="epf-esic" element={<ErrorBoundary sectionName="EPF & ESIC"><Suspense fallback={<PageLoader />}><EPFESICPage /></Suspense></ErrorBoundary>} />
              <Route path="pt" element={<ErrorBoundary sectionName="Professional Tax"><Suspense fallback={<PageLoader />}><ProfessionalTax /></Suspense></ErrorBoundary>} />
              <Route path="bonus-gratuity" element={<ErrorBoundary sectionName="Bonus & Gratuity"><Suspense fallback={<PageLoader />}><BonusGratuity /></Suspense></ErrorBoundary>} />
              <Route path="tds" element={<ErrorBoundary sectionName="TDS"><Suspense fallback={<PageLoader />}><TDSPage /></Suspense></ErrorBoundary>} />
              <Route path="lwf" element={<ErrorBoundary sectionName="LWF"><Suspense fallback={<PageLoader />}><LWFPage /></Suspense></ErrorBoundary>} />
              <Route path="calendar" element={<ErrorBoundary sectionName="Compliance Calendar"><Suspense fallback={<PageLoader />}><ComplianceCalendar /></Suspense></ErrorBoundary>} />
              <Route path="reports" element={<ErrorBoundary sectionName="Reports"><Suspense fallback={<PageLoader />}><Reports /></Suspense></ErrorBoundary>} />
              <Route path="form-ii-upload" element={<ErrorBoundary sectionName="Form II Upload"><Suspense fallback={<PageLoader />}><FormIIUpload /></Suspense></ErrorBoundary>} />
              <Route path="accidents" element={<ErrorBoundary sectionName="Accidents"><Suspense fallback={<PageLoader />}><Accidents /></Suspense></ErrorBoundary>} />
              <Route path="maternity" element={<ErrorBoundary sectionName="Maternity"><Suspense fallback={<PageLoader />}><Maternity /></Suspense></ErrorBoundary>} />
              <Route path="equal-remuneration" element={<ErrorBoundary sectionName="Equal Remuneration"><Suspense fallback={<PageLoader />}><EqualRemuneration /></Suspense></ErrorBoundary>} />
              <Route path="assets" element={<ErrorBoundary sectionName="Assets"><Suspense fallback={<PageLoader />}><Assets /></Suspense></ErrorBoundary>} />
              <Route path="expenses" element={<ErrorBoundary sectionName="Expenses"><Suspense fallback={<PageLoader />}><Expenses /></Suspense></ErrorBoundary>} />
              <Route path="fnf" element={<ErrorBoundary sectionName="F&F Settlement"><Suspense fallback={<PageLoader />}><FnFSettlement /></Suspense></ErrorBoundary>} />
              <Route path="leaves" element={<ErrorBoundary sectionName="Leaves"><Suspense fallback={<PageLoader />}><Leaves /></Suspense></ErrorBoundary>} />
              <Route path="timesheets" element={<ErrorBoundary sectionName="Timesheets"><Suspense fallback={<PageLoader />}><Timesheets /></Suspense></ErrorBoundary>} />
              <Route path="advances" element={<ErrorBoundary sectionName="Advances"><Suspense fallback={<PageLoader />}><Advances /></Suspense></ErrorBoundary>} />
              <Route path="registers" element={<ErrorBoundary sectionName="Registers"><Suspense fallback={<PageLoader />}><Registers /></Suspense></ErrorBoundary>} />
              <Route path="posh" element={<ErrorBoundary sectionName="POSH"><Suspense fallback={<PageLoader />}><POSH /></Suspense></ErrorBoundary>} />
              <Route path="osh" element={<ErrorBoundary sectionName="OSH Compliance"><Suspense fallback={<PageLoader />}><OSHCompliance /></Suspense></ErrorBoundary>} />
              <Route path="ir" element={<ErrorBoundary sectionName="IR Compliance"><Suspense fallback={<PageLoader />}><IRCompliance /></Suspense></ErrorBoundary>} />
              <Route path="se" element={<ErrorBoundary sectionName="Shops & Establishments"><Suspense fallback={<PageLoader />}><SECompliance /></Suspense></ErrorBoundary>} />
              <Route path="documents" element={<ErrorBoundary sectionName="Documents"><Suspense fallback={<PageLoader />}><Documents /></Suspense></ErrorBoundary>} />
              <Route path="shifts" element={<ErrorBoundary sectionName="Shift Policies"><Suspense fallback={<PageLoader />}><ShiftPolicies /></Suspense></ErrorBoundary>} />
              <Route path="audit-log" element={<ErrorBoundary sectionName="Audit Log"><Suspense fallback={<PageLoader />}><AuditLog /></Suspense></ErrorBoundary>} />
              <Route path="notice-board" element={<ErrorBoundary sectionName="Notice Board"><Suspense fallback={<PageLoader />}><NoticeBoard /></Suspense></ErrorBoundary>} />
              <Route path="gig-cess" element={<ErrorBoundary sectionName="Gig &amp; Platform Worker Cess"><Suspense fallback={<PageLoader />}><GigCess /></Suspense></ErrorBoundary>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
