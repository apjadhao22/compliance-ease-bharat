import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PendingCounts {
  total: number;
  leaves: number;
  timesheets: number;
  expenses: number;
  advances: number;
  comp_off: number;
  regularizations: number;
  exits: number;
}

async function fetchPendingCounts(): Promise<PendingCounts> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { total: 0, leaves: 0, timesheets: 0, expenses: 0, advances: 0, comp_off: 0, regularizations: 0, exits: 0 };

  const { data: cm } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!cm) return { total: 0, leaves: 0, timesheets: 0, expenses: 0, advances: 0, comp_off: 0, regularizations: 0, exits: 0 };

  const companyId = cm.company_id;

  const [
    { count: leaves },
    { count: timesheets },
    { count: expenses },
    { count: advances },
    { count: comp_off },
    { count: regularizations },
    { count: exits },
  ] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("company_id", companyId),
    supabase.from("timesheets").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("company_id", companyId),
    supabase.from("expenses").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("company_id", companyId),
    supabase.from("advances").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("company_id", companyId),
    supabase.from("comp_off_requests").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("company_id", companyId),
    supabase.from("regularization_requests").select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("company_id", companyId),
    supabase.from("exit_requests").select("id", { count: "exact", head: true })
      .eq("status", "submitted").eq("company_id", companyId),
  ]);

  const l = leaves ?? 0, t = timesheets ?? 0, e = expenses ?? 0,
    a = advances ?? 0, c = comp_off ?? 0, r = regularizations ?? 0, x = exits ?? 0;

  return { total: l + t + e + a + c + r + x, leaves: l, timesheets: t, expenses: e, advances: a, comp_off: c, regularizations: r, exits: x };
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: fetchPendingCounts,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
