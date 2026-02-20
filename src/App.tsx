import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
            <Route index element={<DashboardOverview />} />
            <Route path="company" element={<CompanySetup />} />
            <Route path="employees" element={<Employees />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="pt" element={<ProfessionalTax />} />
            <Route path="bonus-gratuity" element={<BonusGratuity />} />
            <Route path="tds" element={<TDSPage />} />
            <Route path="lwf" element={<LWFPage />} />
            <Route path="calendar" element={<ComplianceCalendar />} />
            <Route path="reports" element={<Reports />} />
            <Route path="form-ii-upload" element={<FormIIUpload />} />
            <Route path="accidents" element={<Accidents />} />
            <Route path="maternity" element={<Maternity />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
