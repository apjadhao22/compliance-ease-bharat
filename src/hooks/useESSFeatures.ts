import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ESSFeatures = {
  payslips: boolean;
  tax_declarations: boolean;
  leave_requests: boolean;
  profile_edit: boolean;
  timesheets: boolean;
  shift_schedule: boolean;
  comp_off: boolean;
  regularization: boolean;
  expenses: boolean;
  advances: boolean;
  annual_statement: boolean;
  documents: boolean;
  assets: boolean;
  notices: boolean;
  grievance: boolean;
  posh_complaint: boolean;
  maternity_tracking: boolean;
  exit_request: boolean;
};

const DEFAULT_FEATURES: ESSFeatures = {
  payslips: true,
  tax_declarations: true,
  leave_requests: true,
  profile_edit: true,
  timesheets: false,
  shift_schedule: false,
  comp_off: false,
  regularization: false,
  expenses: false,
  advances: false,
  annual_statement: false,
  documents: false,
  assets: false,
  notices: false,
  grievance: false,
  posh_complaint: false,
  maternity_tracking: false,
  exit_request: false,
};

async function fetchESSFeatures(): Promise<ESSFeatures> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_FEATURES;

  // Try to find company_id — admin path first
  let companyId: string | null = null;

  const { data: cm } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (cm) {
    companyId = cm.company_id;
  } else {
    // ESS employee path
    const { data: emp } = await supabase
      .from("employees")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (emp) companyId = emp.company_id;
  }

  if (!companyId) return DEFAULT_FEATURES;

  const { data: config } = await supabase
    .from("ess_feature_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!config) return DEFAULT_FEATURES;

  return {
    payslips: config.payslips_enabled ?? true,
    tax_declarations: config.tax_declarations_enabled ?? true,
    leave_requests: config.leave_requests_enabled ?? true,
    profile_edit: config.profile_edit_enabled ?? true,
    timesheets: config.timesheets_enabled ?? false,
    shift_schedule: config.shift_schedule_enabled ?? false,
    comp_off: config.comp_off_enabled ?? false,
    regularization: config.regularization_enabled ?? false,
    expenses: config.expenses_enabled ?? false,
    advances: config.advances_enabled ?? false,
    annual_statement: config.annual_statement_enabled ?? false,
    documents: config.documents_enabled ?? false,
    assets: config.assets_enabled ?? false,
    notices: config.notices_enabled ?? false,
    grievance: config.grievance_enabled ?? false,
    posh_complaint: config.posh_complaint_enabled ?? false,
    maternity_tracking: config.maternity_tracking_enabled ?? false,
    exit_request: config.exit_request_enabled ?? false,
  };
}

export function useESSFeatures() {
  const { data: features, isLoading, error } = useQuery({
    queryKey: ["ess_feature_config"],
    queryFn: fetchESSFeatures,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    features: features ?? DEFAULT_FEATURES,
    loading: isLoading,
    error,
  };
}
