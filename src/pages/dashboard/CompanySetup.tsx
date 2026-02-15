import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const CompanySetup = () => {
  const { toast } = useToast();
  const [company, setCompany] = useState({
    name: "", pan: "", tan: "", state: "Maharashtra", city: "Pune",
    epf_code: "", esic_code: "", pt_rc_number: "", lwf_number: "",
  });

  const handleSave = () => {
    toast({ title: "Backend not connected", description: "Enable Lovable Cloud to save company data.", variant: "destructive" });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Company Setup</h1>
      <p className="mt-1 text-muted-foreground">Enter your company details and registration numbers</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Basic details and statutory registration numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Company Name", key: "name", placeholder: "Acme Pvt Ltd" },
              { label: "PAN", key: "pan", placeholder: "AAACA1234A" },
              { label: "TAN", key: "tan", placeholder: "PNEA12345A" },
              { label: "State", key: "state", placeholder: "Maharashtra" },
              { label: "City", key: "city", placeholder: "Pune" },
              { label: "EPF Code", key: "epf_code", placeholder: "MH/PUN/12345" },
              { label: "ESIC Code", key: "esic_code", placeholder: "31000123456789" },
              { label: "PT RC Number", key: "pt_rc_number", placeholder: "PT/MH/123456" },
              { label: "LWF Number", key: "lwf_number", placeholder: "LWF/MH/123" },
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  placeholder={field.placeholder}
                  value={company[field.key as keyof typeof company]}
                  onChange={(e) => setCompany({ ...company, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSave} className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
            Save Company Details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySetup;
