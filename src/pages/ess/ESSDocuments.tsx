import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileArchive, FileText, Download, ChevronRight, PiggyBank, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface EmployeeDoc {
  id: string;
  type: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface InvestmentDecl {
  id: string;
  financial_year: string;
  regime: string;
  updated_at: string;
}

const ESSDocuments = () => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [declaration, setDeclaration] = useState<InvestmentDecl | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
      setCompanyId(emp.company_id);

      // Employee documents
      const { data: docData } = await supabase
        .from("documents")
        .select("id, type, file_name, file_url, created_at")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false });

      if (docData) setDocs(docData as any[]);

      // Latest investment declaration for current FY
      const currentYear = new Date().getFullYear();
      const fyStart = new Date().getMonth() >= 3 ? currentYear : currentYear - 1;
      const fy = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

      const { data: declData } = await supabase
        .from("investment_declarations")
        .select("id, financial_year, regime, updated_at")
        .eq("employee_id", emp.id)
        .eq("financial_year", fy)
        .maybeSingle();

      if (declData) setDeclaration(declData as any);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.click();
  };

  const docTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      offer_letter: "Offer Letter",
      appointment_letter: "Appointment Letter",
      salary_revision: "Salary Revision Letter",
      nda: "NDA / Agreement",
      relieving_letter: "Relieving Letter",
      experience_letter: "Experience Letter",
    };
    return map[type] ?? type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="documents">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Documents</h1>

        {/* My Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5" />
              My Documents
            </CardTitle>
            <CardDescription>Offer letters, appointment letters, and other HR documents</CardDescription>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No documents shared yet. Contact your HR team.
              </p>
            ) : (
              <div className="divide-y">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{docTypeLabel(doc.type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_name} · {format(new Date(doc.created_at), "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    {doc.file_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc.file_url, doc.file_name)}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Download
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Tax Documents
            </CardTitle>
            <CardDescription>Form 16, Form 12BB, and investment declarations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {declaration ? (
              <div className="flex items-center justify-between rounded-md border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Form 12BB Draft</p>
                  <p className="text-xs text-muted-foreground">
                    FY {declaration.financial_year} · {declaration.regime === "new" ? "New Regime" : "Old Regime"} ·
                    Updated {format(new Date(declaration.updated_at), "dd MMM yyyy")}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/ess/tax">
                    View Declaration <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border px-4 py-3">
                <p className="text-sm font-medium">Form 12BB</p>
                <p className="text-xs text-muted-foreground">No declaration submitted for the current FY.</p>
                <Button variant="link" size="sm" className="mt-1 px-0" asChild>
                  <Link to="/ess/tax">Submit Tax Declaration →</Link>
                </Button>
              </div>
            )}

            <div className="rounded-md border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">Form 16</p>
              <p className="text-xs text-muted-foreground">
                Form 16 will be available after FY-end TDS processing. Contact HR for the latest copy.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payslip Archive */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip Archive
            </CardTitle>
            <CardDescription>Download monthly payslips</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/ess/payslips">
                Go to Payslips <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSDocuments;
