import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface Notice {
  id: string;
  title: string;
  body: string;
  priority: "high" | "normal" | "low";
  posted_at: string;
  isRead: boolean;
}

const priorityConfig = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-700 border-blue-200" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const ESSNotices = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, company_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp) return;
      setEmployeeId(emp.id);

      // Fetch notices for employee's company
      const { data: noticeData } = await supabase
        .from("notices")
        .select("id, title, body, priority, posted_at")
        .eq("company_id", emp.company_id)
        .order("posted_at", { ascending: false });

      if (!noticeData) return;

      // Fetch read status
      const { data: readData } = await supabase
        .from("notice_reads")
        .select("notice_id")
        .eq("employee_id", emp.id);

      const readSet = new Set((readData ?? []).map((r: any) => r.notice_id));

      setNotices(
        noticeData.map((n: any) => ({
          ...n,
          isRead: readSet.has(n.id),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (noticeId: string) => {
    const isNowExpanding = !expanded.has(noticeId);
    setExpanded((prev) => {
      const next = new Set(prev);
      isNowExpanding ? next.add(noticeId) : next.delete(noticeId);
      return next;
    });

    // Mark as read if expanding for the first time
    if (isNowExpanding && employeeId) {
      const notice = notices.find((n) => n.id === noticeId);
      if (notice && !notice.isRead) {
        await supabase.from("notice_reads").upsert(
          { notice_id: noticeId, employee_id: employeeId },
          { onConflict: "notice_id,employee_id" }
        );
        setNotices((prev) =>
          prev.map((n) => (n.id === noticeId ? { ...n, isRead: true } : n))
        );
      }
    }
  };

  const unreadCount = notices.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="notices">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Notice Board</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>

        {notices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              No notices posted yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <Card
                key={notice.id}
                className={notice.isRead ? "" : "border-primary/40 bg-primary/5"}
              >
                <CardHeader
                  className="cursor-pointer select-none py-4"
                  onClick={() => toggleExpand(notice.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {!notice.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div>
                        <CardTitle
                          className={`text-base leading-snug ${!notice.isRead ? "font-bold" : "font-medium"}`}
                        >
                          {notice.title}
                        </CardTitle>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(notice.posted_at), "dd MMM yyyy")}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-xs font-medium ${priorityConfig[notice.priority].className}`}
                          >
                            {priorityConfig[notice.priority].label}
                          </span>
                        </div>
                      </div>
                    </div>
                    {expanded.has(notice.id) ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>

                {expanded.has(notice.id) && (
                  <CardContent className="pt-0">
                    <div className="rounded-md bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                      {notice.body}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </ESSFeatureGate>
  );
};

export default ESSNotices;
