import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const deadlines = [
  { name: "EPF Payment", date: "15th of every month", type: "epf", status: "upcoming" },
  { name: "EPF Return (ECR)", date: "15th of every month", type: "epf", status: "upcoming" },
  { name: "ESIC Payment", date: "15th of every month", type: "esic", status: "upcoming" },
  { name: "ESIC Return", date: "21st of every month (half-yearly)", type: "esic", status: "upcoming" },
  { name: "Professional Tax", date: "Last day of every month", type: "pt", status: "upcoming" },
  { name: "TDS Payment", date: "7th of next month", type: "tds", status: "upcoming" },
  { name: "TDS Return (Form 24Q)", date: "Quarterly — 31st July, Oct, Jan, May", type: "tds", status: "upcoming" },
  { name: "LWF Contribution", date: "30th June & 31st December", type: "lwf", status: "upcoming" },
  { name: "Bonus Payment", date: "Within 8 months of closing FY", type: "bonus", status: "upcoming" },
  { name: "Form 16 Issuance", date: "15th June", type: "tds", status: "upcoming" },
];

const statusColors: Record<string, string> = {
  upcoming: "bg-accent text-accent-foreground",
  completed: "bg-success text-success-foreground",
  overdue: "bg-destructive text-destructive-foreground",
};

const typeColors: Record<string, string> = {
  epf: "bg-primary/10 text-primary",
  esic: "bg-primary/10 text-primary",
  pt: "bg-accent/10 text-accent",
  tds: "bg-success/10 text-success",
  lwf: "bg-secondary/10 text-secondary",
  bonus: "bg-destructive/10 text-destructive",
};

const ComplianceCalendar = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Compliance Calendar</h1>
      <p className="mt-1 text-muted-foreground">Track all statutory filing deadlines</p>

      <div className="mt-6 grid gap-3">
        {deadlines.map((d, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Badge className={typeColors[d.type]}>{d.type.toUpperCase()}</Badge>
                <div>
                  <p className="font-medium text-foreground">{d.name}</p>
                  <p className="text-sm text-muted-foreground">{d.date}</p>
                </div>
              </div>
              <Badge className={statusColors[d.status]}>
                {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ComplianceCalendar;
