import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./pages/dashboard/Overview";
import CompanySetup from "./pages/dashboard/CompanySetup";
import Employees from "./pages/dashboard/Employees";
import Payroll from "./pages/dashboard/Payroll";
import ProfessionalTax from "./pages/dashboard/ProfessionalTax";
import BonusGratuity from "./pages/dashboard/BonusGratuity";
import TDSPage from "./pages/dashboard/TDS";
import LWFPage from "./pages/dashboard/LWF";
import ComplianceCalendar from "./pages/dashboard/ComplianceCalendar";
import Reports from "./pages/dashboard/Reports";
import FormIIUpload from "./pages/dashboard/FormIIUpload";
import Accidents from "./pages/dashboard/Accidents";
import Maternity from "./pages/dashboard/Maternity";
import EqualRemuneration from "./pages/dashboard/EqualRemuneration";
import EPFESICPage from "./pages/dashboard/EPFESIC";
import Assets from "./pages/dashboard/Assets";
import Expenses from "./pages/dashboard/Expenses";
import FnFSettlement from "./pages/dashboard/FnFSettlement";
import Leaves from "./pages/dashboard/Leaves";
import Timesheets from "./pages/dashboard/Timesheets";
import Registers from "./pages/dashboard/Registers";
import Advances from "./pages/dashboard/Advances";
import POSH from "./pages/dashboard/POSH";
import Documents from "./pages/dashboard/Documents";
import ShiftPolicies from "./pages/dashboard/ShiftPolicies";
import AuditLog from "./pages/dashboard/AuditLog";
import NoticeBoard from "./pages/dashboard/NoticeBoard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              {/* Per-route boundary: a single page crashing won't kill the sidebar */}
              <Route index element={<ErrorBoundary sectionName="Overview"><DashboardOverview /></ErrorBoundary>} />
              <Route path="company" element={<ErrorBoundary sectionName="Company Setup"><CompanySetup /></ErrorBoundary>} />
              <Route path="employees" element={<ErrorBoundary sectionName="Employees"><Employees /></ErrorBoundary>} />
              <Route path="payroll" element={<ErrorBoundary sectionName="Payroll"><Payroll /></ErrorBoundary>} />
              <Route path="epf-esic" element={<ErrorBoundary sectionName="EPF & ESIC"><EPFESICPage /></ErrorBoundary>} />
              <Route path="pt" element={<ErrorBoundary sectionName="Professional Tax"><ProfessionalTax /></ErrorBoundary>} />
              <Route path="bonus-gratuity" element={<ErrorBoundary sectionName="Bonus & Gratuity"><BonusGratuity /></ErrorBoundary>} />
              <Route path="tds" element={<ErrorBoundary sectionName="TDS"><TDSPage /></ErrorBoundary>} />
              <Route path="lwf" element={<ErrorBoundary sectionName="LWF"><LWFPage /></ErrorBoundary>} />
              <Route path="calendar" element={<ErrorBoundary sectionName="Compliance Calendar"><ComplianceCalendar /></ErrorBoundary>} />
              <Route path="reports" element={<ErrorBoundary sectionName="Reports"><Reports /></ErrorBoundary>} />
              <Route path="form-ii-upload" element={<ErrorBoundary sectionName="Form II Upload"><FormIIUpload /></ErrorBoundary>} />
              <Route path="accidents" element={<ErrorBoundary sectionName="Accidents"><Accidents /></ErrorBoundary>} />
              <Route path="maternity" element={<ErrorBoundary sectionName="Maternity"><Maternity /></ErrorBoundary>} />
              <Route path="equal-remuneration" element={<ErrorBoundary sectionName="Equal Remuneration"><EqualRemuneration /></ErrorBoundary>} />
              <Route path="assets" element={<ErrorBoundary sectionName="Assets"><Assets /></ErrorBoundary>} />
              <Route path="expenses" element={<ErrorBoundary sectionName="Expenses"><Expenses /></ErrorBoundary>} />
              <Route path="fnf" element={<ErrorBoundary sectionName="F&F Settlement"><FnFSettlement /></ErrorBoundary>} />
              <Route path="leaves" element={<ErrorBoundary sectionName="Leaves"><Leaves /></ErrorBoundary>} />
              <Route path="timesheets" element={<ErrorBoundary sectionName="Timesheets"><Timesheets /></ErrorBoundary>} />
              <Route path="advances" element={<ErrorBoundary sectionName="Advances"><Advances /></ErrorBoundary>} />
              <Route path="registers" element={<ErrorBoundary sectionName="Registers"><Registers /></ErrorBoundary>} />
              <Route path="posh" element={<ErrorBoundary sectionName="POSH"><POSH /></ErrorBoundary>} />
              <Route path="documents" element={<ErrorBoundary sectionName="Documents"><Documents /></ErrorBoundary>} />
              <Route path="shifts" element={<ErrorBoundary sectionName="Shift Policies"><ShiftPolicies /></ErrorBoundary>} />
              <Route path="audit-log" element={<ErrorBoundary sectionName="Audit Log"><AuditLog /></ErrorBoundary>} />
              <Route path="notice-board" element={<ErrorBoundary sectionName="Notice Board"><NoticeBoard /></ErrorBoundary>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
