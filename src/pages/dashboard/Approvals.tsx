import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Loader2, ClipboardList, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useESSFeatures } from "@/hooks/useESSFeatures";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────
type RequestType = "leave" | "timesheet" | "expense" | "advance" | "comp_off" | "regularization" | "exit";

interface PendingItem {
  id: string;
  type: RequestType;
  employeeName: string;
  empCode?: string;
  date: string;
  summary: string;
  amount?: number;
  detail?: Record<string, string>;
}

// ─── helpers ─────────────────────────────────────────────────
const typeBadge: Record<RequestType, string> = {
  leave: "bg-blue-100 text-blue-800",
  timesheet: "bg-purple-100 text-purple-800",
  expense: "bg-orange-100 text-orange-800",
  advance: "bg-yellow-100 text-yellow-800",
  comp_off: "bg-teal-100 text-teal-800",
  regularization: "bg-pink-100 text-pink-800",
  exit: "bg-red-100 text-red-800",
};

const typeLabelMap: Record<RequestType, string> = {
  leave: "Leave", timesheet: "Timesheet", expense: "Expense",
  advance: "Advance", comp_off: "Comp-Off", regularization: "Regularization", exit: "Exit",
};

// ─── Approve/Reject dialog ────────────────────────────────────
interface ActionDialogProps {
  item: PendingItem | null;
  action: "approved" | "rejected" | null;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}

const ActionDialog = ({ item, action, onClose, onConfirm }: ActionDialogProps) => {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setComment(""); }, [item, action]);

  if (!item || !action) return null;

  const handle = async () => {
    setLoading(true);
    await onConfirm(comment);
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "approved" ? "Approve" : "Reject"} Request</DialogTitle>
          <DialogDescription>
            {typeLabelMap[item.type]} — {item.employeeName} — {item.summary}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Comment (optional)</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={action === "rejected" ? "Reason for rejection..." : "Any notes..."}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={action === "approved" ? "default" : "destructive"}
            onClick={handle}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm {action === "approved" ? "Approval" : "Rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Row component ────────────────────────────────────────────
const ItemRow = ({
  item,
  onAction,
}: {
  item: PendingItem;
  onAction: (item: PendingItem, action: "approved" | "rejected") => void;
}) => (
  <div className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
      {item.employeeName.slice(0, 2)}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.employeeName}</span>
        {item.empCode && <span className="text-xs text-muted-foreground">{item.empCode}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge[item.type]}`}>
          {typeLabelMap[item.type]}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{item.summary}</p>
      <p className="text-xs text-muted-foreground">{format(new Date(item.date), "dd MMM yyyy")}</p>
    </div>
    <div className="flex shrink-0 gap-2">
      <Button size="sm" variant="outline" className="h-7 border-green-300 text-green-700 hover:bg-green-50" onClick={() => onAction(item, "approved")}>
        <CheckCircle2 className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="outline" className="h-7 border-red-300 text-red-700 hover:bg-red-50" onClick={() => onAction(item, "rejected")}>
        <XCircle className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────
const Approvals = () => {
  const { features } = useESSFeatures();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<PendingItem | null>(null);
  const [activeAction, setActiveAction] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cm } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (cm) { setCompanyId(cm.company_id); }
  };

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId]);

  const fetchAll = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const all: PendingItem[] = [];

      // Leaves
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, days, reason, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "pending")
        .eq("employees.company_id", companyId);

      (leaves ?? []).forEach((l: any) => {
        all.push({
          id: l.id, type: "leave",
          employeeName: l.employees.name, empCode: l.employees.emp_code,
          date: l.created_at,
          summary: `${l.leave_type} leave: ${format(new Date(l.start_date), "dd MMM")} – ${format(new Date(l.end_date), "dd MMM")} (${l.days}d)`,
        });
      });

      // Timesheets
      const { data: timesheets } = await supabase
        .from("timesheets")
        .select("id, week_start, total_hours, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "pending")
        .eq("employees.company_id", companyId);

      (timesheets ?? []).forEach((t: any) => {
        all.push({
          id: t.id, type: "timesheet",
          employeeName: t.employees.name, empCode: t.employees.emp_code,
          date: t.created_at,
          summary: `Week of ${format(new Date(t.week_start), "dd MMM")} — ${t.total_hours ?? 0}h`,
        });
      });

      // Expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, category, amount, description, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "pending")
        .eq("employees.company_id", companyId);

      (expenses ?? []).forEach((e: any) => {
        all.push({
          id: e.id, type: "expense",
          employeeName: e.employees.name, empCode: e.employees.emp_code,
          date: e.created_at,
          summary: `${e.category} — ₹${Number(e.amount).toLocaleString("en-IN")}`,
          amount: e.amount,
        });
      });

      // Advances
      const { data: advances } = await supabase
        .from("advances")
        .select("id, amount, reason, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "pending")
        .eq("employees.company_id", companyId);

      (advances ?? []).forEach((a: any) => {
        all.push({
          id: a.id, type: "advance",
          employeeName: a.employees.name, empCode: a.employees.emp_code,
          date: a.created_at,
          summary: `Advance ₹${Number(a.amount).toLocaleString("en-IN")}${a.reason ? ` — ${a.reason}` : ""}`,
          amount: a.amount,
        });
      });

      // Comp-off
      const { data: compoffs } = await supabase
        .from("comp_off_requests")
        .select("id, worked_date, avail_date, reason, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "pending")
        .eq("employees.company_id", companyId);

      (compoffs ?? []).forEach((c: any) => {
        all.push({
          id: c.id, type: "comp_off",
          employeeName: c.employees.name, empCode: c.employees.emp_code,
          date: c.created_at,
          summary: `Worked: ${format(new Date(c.worked_date), "dd MMM")}${c.avail_date ? ` → Avail: ${format(new Date(c.avail_date), "dd MMM")}` : ""}`,
        });
      });

      // Regularization
      const { data: regs } = await supabase
        .from("regularization_requests")
        .select("id, request_date, original_status, requested_status, reason, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "pending")
        .eq("employees.company_id", companyId);

      (regs ?? []).forEach((r: any) => {
        all.push({
          id: r.id, type: "regularization",
          employeeName: r.employees.name, empCode: r.employees.emp_code,
          date: r.created_at,
          summary: `${format(new Date(r.request_date), "dd MMM")}: ${r.original_status} → ${r.requested_status}`,
        });
      });

      // Exit requests
      const { data: exits } = await supabase
        .from("exit_requests")
        .select("id, resignation_date, last_working_date, created_at, employees!inner(name, emp_code, company_id)")
        .eq("status", "submitted")
        .eq("employees.company_id", companyId);

      (exits ?? []).forEach((ex: any) => {
        all.push({
          id: ex.id, type: "exit",
          employeeName: ex.employees.name, empCode: ex.employees.emp_code,
          date: ex.created_at,
          summary: `Resignation ${format(new Date(ex.resignation_date), "dd MMM")} · LWD ${format(new Date(ex.last_working_date), "dd MMM yyyy")}`,
        });
      });

      // Sort newest first
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(all);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (item: PendingItem, action: "approved" | "rejected") => {
    setActiveItem(item);
    setActiveAction(action);
  };

  const confirmAction = async (comment: string) => {
    if (!activeItem || !activeAction) return;
    const { id, type } = activeItem;
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();

    const tableMap: Record<RequestType, string> = {
      leave: "leave_requests",
      timesheet: "timesheets",
      expense: "expenses",
      advance: "advances",
      comp_off: "comp_off_requests",
      regularization: "regularization_requests",
      exit: "exit_requests",
    };

    const updatePayload: Record<string, unknown> = {
      status: activeAction,
      reviewed_at: now,
      reviewed_by: user?.id,
      review_comment: comment || null,
    };

    if (type === "exit") {
      updatePayload.status = activeAction === "approved" ? "acknowledged" : "withdrawn";
      updatePayload.acknowledged_by = user?.id;
      updatePayload.acknowledged_at = activeAction === "approved" ? now : null;
      delete updatePayload.reviewed_at;
      delete updatePayload.reviewed_by;
      delete updatePayload.review_comment;
    }

    const { error } = await supabase
      .from(tableMap[type])
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      // Audit log
      await supabase.from("audit_logs").insert({
        event_type: "approval",
        user_id: user?.id,
        details: { request_type: type, request_id: id, action: activeAction, comment },
      }).then(() => {});

      // Approval comment record
      if (comment) {
        await supabase.from("approval_comments").insert({
          request_type: type,
          request_id: id,
          comment,
          commented_by: user?.id,
        }).then(() => {});
      }

      toast({
        title: activeAction === "approved" ? "Approved" : "Rejected",
        description: `${typeLabelMap[type]} request ${activeAction}.`,
      });
      setActiveItem(null);
      setActiveAction(null);
      await fetchAll();
    }
  };

  const filterItems = (type?: RequestType) =>
    type ? items.filter((i) => i.type === type) : items;

  const tabConfig: Array<{ value: string; label: string; type?: RequestType; feature?: keyof typeof features }> = [
    { value: "all", label: "All" },
    { value: "leave", label: "Leaves", type: "leave", feature: "leave_requests" },
    { value: "timesheet", label: "Timesheets", type: "timesheet", feature: "timesheets" },
    { value: "expense", label: "Expenses", type: "expense", feature: "expenses" },
    { value: "advance", label: "Advances", type: "advance", feature: "advances" },
    { value: "comp_off", label: "Comp-Off", type: "comp_off", feature: "comp_off" },
    { value: "regularization", label: "Regularize", type: "regularization", feature: "regularization" },
    { value: "exit", label: "Exit", type: "exit", feature: "exit_request" },
  ];

  const visibleTabs = tabConfig.filter(
    (t) => !t.feature || features[t.feature as keyof typeof features]
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-muted-foreground">Review and approve pending employee requests</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto gap-1">
            {visibleTabs.map((t) => {
              const count = filterItems(t.type).length;
              return (
                <TabsTrigger key={t.value} value={t.value} className="relative">
                  {t.label}
                  {count > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {visibleTabs.map((t) => {
            const tabItems = filterItems(t.type);
            return (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4" />
                      {t.label === "All" ? "All Pending Requests" : `Pending ${t.label}`}
                      {tabItems.length > 0 && (
                        <span className="ml-auto text-sm font-normal text-muted-foreground">{tabItems.length} pending</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {tabItems.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No pending requests</p>
                      </div>
                    ) : (
                      tabItems.map((item) => (
                        <ItemRow key={`${item.type}-${item.id}`} item={item} onAction={handleAction} />
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <ActionDialog
        item={activeItem}
        action={activeAction}
        onClose={() => { setActiveItem(null); setActiveAction(null); }}
        onConfirm={confirmAction}
      />
    </div>
  );
};

export default Approvals;
