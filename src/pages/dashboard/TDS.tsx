import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle } from "lucide-react";
import { calculateTDS } from "@/lib/calculations";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FY_OPTIONS = ["2023-24", "2024-25", "2025-26", "2026-27"];

interface Declaration {
  id: string;
  financial_year: string;
  regime: string;
  proof_status: string;
  section_80c: number;
  section_80d: number;
  section_80ccd_nps: number;
  submitted_at: string | null;
  verified_at: string | null;
  employee_name?: string;
}

const staticEmployees = [
  { id: "1", name: "Rajesh Kumar", gross: 40000 },
  { id: "2", name: "Priya Sharma", gross: 28200 },
  { id: "3", name: "Amit Patel", gross: 18800 },
];

const TDSPage = () => {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loadingDecl, setLoadingDecl] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFY, setFilterFY] = useState("2025-26");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  const tdsData = staticEmployees.map((e) => {
    const tds = calculateTDS(e.gross * 12);
    return { ...e, ...tds };
  });

  useEffect(() => {
    fetchCompany();
  }, []);

  useEffect(() => {
    if (companyId) fetchDeclarations();
  }, [companyId, filterFY, filterStatus]);

  const fetchCompany = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (data) setCompanyId(data.company_id);
  };

  const fetchDeclarations = async () => {
    if (!companyId) return;
    setLoadingDecl(true);
    try {
      let query = supabase
        .from("investment_declarations")
        .select(`
          id, financial_year, regime, proof_status,
          section_80c, section_80d, section_80ccd_nps,
          submitted_at, verified_at,
          employees ( name, company_id )
        `)
        .eq("financial_year", filterFY);

      if (filterStatus !== "all") {
        query = query.eq("proof_status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data ?? []).filter(
        (d: any) => d.employees?.company_id === companyId
      );
      setDeclarations(
        filtered.map((d: any) => ({
          ...d,
          employee_name: d.employees?.name ?? "—",
        }))
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoadingDecl(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("investment_declarations")
        .update({
          proof_status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Declaration verified" });
      fetchDeclarations();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setVerifying(null);
    }
  };

  const proofBadge = (s: string) => {
    switch (s) {
      case "verified": return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case "submitted": return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
      default: return <Badge variant="secondary">Declared</Badge>;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">TDS on Salaries</h1>
      <p className="mt-1 text-muted-foreground">New Tax Regime — FY 2025-26 · Standard Deduction ₹75,000</p>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="verify">Verify Declarations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { slab: "₹0 – ₹4L", rate: "Nil" },
              { slab: "₹4L – ₹8L", rate: "5%" },
              { slab: "₹8L – ₹12L", rate: "10%" },
              { slab: "₹12L – ₹16L", rate: "15%" },
            ].map((s) => (
              <Card key={s.slab}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{s.slab}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-foreground">{s.rate}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Employee-wise TDS</CardTitle>
              <CardDescription>Monthly TDS deduction with 4% Health & Education Cess</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Annual Gross</TableHead>
                    <TableHead className="text-right">Taxable Income</TableHead>
                    <TableHead className="text-right">Annual Tax</TableHead>
                    <TableHead className="text-right">Monthly TDS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tdsData.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-right">₹{(e.gross * 12).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{e.taxableIncome.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{e.annualTax.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right font-semibold">₹{e.monthlyTDS.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify" className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-3">
            <Select value={filterFY} onValueChange={setFilterFY}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="FY" />
              </SelectTrigger>
              <SelectContent>
                {FY_OPTIONS.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="declared">Declared</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingDecl ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : declarations.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No declarations found for the selected filters.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>FY</TableHead>
                      <TableHead>Regime</TableHead>
                      <TableHead className="text-right">80C</TableHead>
                      <TableHead className="text-right">80D</TableHead>
                      <TableHead className="text-right">NPS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {declarations.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.employee_name}</TableCell>
                        <TableCell>{d.financial_year}</TableCell>
                        <TableCell className="capitalize">{d.regime}</TableCell>
                        <TableCell className="text-right">₹{(d.section_80c ?? 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{(d.section_80d ?? 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{(d.section_80ccd_nps ?? 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{proofBadge(d.proof_status)}</TableCell>
                        <TableCell>
                          {d.proof_status !== "verified" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={verifying === d.id}
                              onClick={() => handleVerify(d.id)}
                            >
                              {verifying === d.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Verify
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {d.verified_at ? new Date(d.verified_at).toLocaleDateString("en-IN") : "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TDSPage;
