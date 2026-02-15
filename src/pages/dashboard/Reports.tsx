import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const reports = [
  { name: "Monthly Compliance Summary", description: "EPF, ESIC, PT, TDS overview for the current month", icon: FileText },
  { name: "ECR File (EPF)", description: "Electronic Challan cum Return for EPFO portal upload", icon: Download },
  { name: "Form D (ESIC)", description: "ESIC contribution statement", icon: Download },
  { name: "Form 16", description: "Annual TDS certificate for employees", icon: Download },
  { name: "Employee-wise Breakdown", description: "Detailed salary and deduction report per employee", icon: FileText },
  { name: "Compliance Audit Report", description: "Summary of all filings and pending actions", icon: FileText },
];

const Reports = () => {
  const { toast } = useToast();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Reports & Forms</h1>
      <p className="mt-1 text-muted-foreground">Generate compliance reports and statutory forms</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.name} className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{r.name}</CardTitle>
              <CardDescription className="text-sm">{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toast({ title: "Coming soon", description: "Enable Lovable Cloud to generate reports." })}
              >
                <Download className="mr-2 h-4 w-4" /> Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reports;
