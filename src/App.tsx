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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import DashboardLayout from "./components/DashboardLayout";
import ESSLayout from "./components/ESSLayout";
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

// ESS pages — lazy loaded
const ESSLogin = lazy(() => import("./pages/ess/ESSLogin"));
const ESSDashboard = lazy(() => import("./pages/ess/ESSDashboard"));
const ESSPayslips = lazy(() => import("./pages/ess/ESSPayslips"));
const ESSTaxDeclarations = lazy(() => import("./pages/ess/ESSTaxDeclarations"));
const ESSLeaves = lazy(() => import("./pages/ess/ESSLeaves"));
const ESSProfile = lazy(() => import("./pages/ess/ESSProfile"));
const ESSDocuments = lazy(() => import("./pages/ess/ESSDocuments"));
const ESSSettings = lazy(() => import("./pages/dashboard/ESSSettings"));
const ESSTimesheets = lazy(() => import("./pages/ess/ESSTimesheets"));
const ESSExpenses = lazy(() => import("./pages/ess/ESSExpenses"));
const ESSAdvances = lazy(() => import("./pages/ess/ESSAdvances"));
const ESSAssets = lazy(() => import("./pages/ess/ESSAssets"));
const ESSNotices = lazy(() => import("./pages/ess/ESSNotices"));
const ESSSchedule = lazy(() => import("./pages/ess/ESSSchedule"));
const ESSRegularization = lazy(() => import("./pages/ess/ESSRegularization"));
const ESSCompOff = lazy(() => import("./pages/ess/ESSCompOff"));
const ESSMaternity = lazy(() => import("./pages/ess/ESSMaternity"));
const ESSAnnualStatement = lazy(() => import("./pages/ess/ESSAnnualStatement"));
const ESSGrievance = lazy(() => import("./pages/ess/ESSGrievance"));
const ESSPosh = lazy(() => import("./pages/ess/ESSPosh"));
const ESSExit = lazy(() => import("./pages/ess/ESSExit"));
const Approvals = lazy(() => import("./pages/dashboard/Approvals"));

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
            <Route path="/forgot-password" element={<ErrorBoundary sectionName="Forgot Password"><ForgotPassword /></ErrorBoundary>} />
            <Route path="/reset-password" element={<ErrorBoundary sectionName="Reset Password"><ResetPassword /></ErrorBoundary>} />
            <Route path="/verify-email" element={<ErrorBoundary sectionName="Verify Email"><VerifyEmail /></ErrorBoundary>} />
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
              <Route path="settings/ess" element={<ErrorBoundary sectionName="ESS Settings"><Suspense fallback={<PageLoader />}><ESSSettings /></Suspense></ErrorBoundary>} />
              <Route path="approvals" element={<ErrorBoundary sectionName="Approvals"><Suspense fallback={<PageLoader />}><Approvals /></Suspense></ErrorBoundary>} />
            </Route>
            {/* ESS Login — standalone, no layout */}
            <Route path="/ess/login" element={<ErrorBoundary sectionName="ESS Login"><Suspense fallback={<PageLoader />}><ESSLogin /></Suspense></ErrorBoundary>} />
            {/* ESS Portal */}
            <Route path="/ess" element={<ESSLayout />}>
              <Route index element={<ErrorBoundary sectionName="ESS Dashboard"><Suspense fallback={<PageLoader />}><ESSDashboard /></Suspense></ErrorBoundary>} />
              <Route path="payslips" element={<ErrorBoundary sectionName="Payslips"><Suspense fallback={<PageLoader />}><ESSPayslips /></Suspense></ErrorBoundary>} />
              <Route path="tax" element={<ErrorBoundary sectionName="Tax Declarations"><Suspense fallback={<PageLoader />}><ESSTaxDeclarations /></Suspense></ErrorBoundary>} />
              <Route path="leaves" element={<ErrorBoundary sectionName="ESS Leaves"><Suspense fallback={<PageLoader />}><ESSLeaves /></Suspense></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary sectionName="ESS Profile"><Suspense fallback={<PageLoader />}><ESSProfile /></Suspense></ErrorBoundary>} />
              <Route path="documents" element={<ErrorBoundary sectionName="ESS Documents"><Suspense fallback={<PageLoader />}><ESSDocuments /></Suspense></ErrorBoundary>} />
              <Route path="timesheets" element={<ErrorBoundary sectionName="ESS Timesheets"><Suspense fallback={<PageLoader />}><ESSTimesheets /></Suspense></ErrorBoundary>} />
              <Route path="expenses" element={<ErrorBoundary sectionName="ESS Expenses"><Suspense fallback={<PageLoader />}><ESSExpenses /></Suspense></ErrorBoundary>} />
              <Route path="advances" element={<ErrorBoundary sectionName="ESS Advances"><Suspense fallback={<PageLoader />}><ESSAdvances /></Suspense></ErrorBoundary>} />
              <Route path="assets" element={<ErrorBoundary sectionName="ESS Assets"><Suspense fallback={<PageLoader />}><ESSAssets /></Suspense></ErrorBoundary>} />
              <Route path="notices" element={<ErrorBoundary sectionName="ESS Notices"><Suspense fallback={<PageLoader />}><ESSNotices /></Suspense></ErrorBoundary>} />
              <Route path="schedule" element={<ErrorBoundary sectionName="ESS Schedule"><Suspense fallback={<PageLoader />}><ESSSchedule /></Suspense></ErrorBoundary>} />
              <Route path="regularization" element={<ErrorBoundary sectionName="ESS Regularization"><Suspense fallback={<PageLoader />}><ESSRegularization /></Suspense></ErrorBoundary>} />
              <Route path="comp-off" element={<ErrorBoundary sectionName="ESS Comp-Off"><Suspense fallback={<PageLoader />}><ESSCompOff /></Suspense></ErrorBoundary>} />
              <Route path="maternity" element={<ErrorBoundary sectionName="ESS Maternity"><Suspense fallback={<PageLoader />}><ESSMaternity /></Suspense></ErrorBoundary>} />
              <Route path="annual-statement" element={<ErrorBoundary sectionName="ESS Annual Statement"><Suspense fallback={<PageLoader />}><ESSAnnualStatement /></Suspense></ErrorBoundary>} />
              <Route path="grievance" element={<ErrorBoundary sectionName="ESS Grievance"><Suspense fallback={<PageLoader />}><ESSGrievance /></Suspense></ErrorBoundary>} />
              <Route path="posh" element={<ErrorBoundary sectionName="ESS POSH"><Suspense fallback={<PageLoader />}><ESSPosh /></Suspense></ErrorBoundary>} />
              <Route path="exit" element={<ErrorBoundary sectionName="ESS Exit"><Suspense fallback={<PageLoader />}><ESSExit /></Suspense></ErrorBoundary>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
