import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calculator, Calendar, AlertTriangle } from "lucide-react";

const stats = [
  { label: "Total Employees", value: "0", icon: Users, color: "text-primary" },
  { label: "EPF Filed", value: "₹0", icon: Calculator, color: "text-success" },
  { label: "Upcoming Deadlines", value: "0", icon: Calendar, color: "text-accent" },
  { label: "Pending Actions", value: "0", icon: AlertTriangle, color: "text-destructive" },
];

const DashboardOverview = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Welcome to ComplianceEngine. Set up your company to get started.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
            <li>Set up your <strong className="text-foreground">Company Profile</strong> with PAN, TAN & registration numbers</li>
            <li>Add your <strong className="text-foreground">Employees</strong> with salary details</li>
            <li>Run <strong className="text-foreground">EPF, ESIC & PT calculations</strong> for the current month</li>
            <li>Check the <strong className="text-foreground">Compliance Calendar</strong> for upcoming deadlines</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;
