import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calculator, Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const stats = [
  { label: "Total Employees", value: "0", icon: Users, color: "text-primary" },
  { label: "EPF Filed", value: "₹0", icon: Calculator, color: "text-success" },
  { label: "Upcoming Deadlines", value: "0", icon: Calendar, color: "text-accent" },
  { label: "Pending Actions", value: "0", icon: AlertTriangle, color: "text-destructive" },
];

const compliances = [
  {
    title: "EPF & ESIC",
    statusText: "Pending filing for current month",
    severity: "High",
    badgeVariant: "destructive",
    icon: AlertTriangle,
  },
  {
    title: "Professional Tax",
    statusText: "Up to date",
    severity: "Low",
    badgeVariant: "default",
    icon: CheckCircle,
  },
  {
    title: "LWF (Labour Welfare Fund)",
    statusText: "Due next month",
    severity: "Medium",
    badgeVariant: "secondary",
    icon: Clock,
  },
  {
    title: "TDS",
    statusText: "Up to date",
    severity: "Low",
    badgeVariant: "default",
    icon: CheckCircle,
  },
  {
    title: "Leaves",
    statusText: "3 pending requests",
    severity: "Medium",
    badgeVariant: "secondary",
    icon: Clock,
  },
  {
    title: "Maternity",
    statusText: "No active cases",
    severity: "Low",
    badgeVariant: "outline",
    icon: CheckCircle,
  },
];

const DashboardOverview = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="mt-1 text-muted-foreground">Monitor the status of all your core compliances.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {compliances.map((compliance, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${compliance.badgeVariant === 'destructive' ? 'bg-destructive/10 text-destructive' :
                      compliance.badgeVariant === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                        compliance.badgeVariant === 'default' ? 'bg-primary/10 text-primary' :
                          'bg-muted text-muted-foreground'
                    }`}>
                    <compliance.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{compliance.title}</h3>
                    <p className="text-sm text-muted-foreground">{compliance.statusText}</p>
                  </div>
                </div>
                <div>
                  <Badge variant={compliance.badgeVariant as any}>
                    {compliance.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;
