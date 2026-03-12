import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EmployeeProfile {
  id: string;
  name: string;
  emp_code: string;
  department: string | null;
  designation: string | null;
  date_of_joining: string | null;
  uan: string | null;
  esic_number: string | null;
  pan: string | null;
  bank_account: string | null;
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  phone: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  address: string | null;
}

const maskPAN = (pan: string | null) =>
  pan ? pan.slice(0, -4).replace(/./g, "•") + pan.slice(-4) : "—";

const maskAccount = (acc: string | null) =>
  acc ? "••••" + acc.slice(-4) : "—";

const ESSProfile = () => {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  // Editable fields
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp, error } = await supabase
        .from("employees")
        .select(`
          id, name, emp_code, department, designation, date_of_joining,
          uan, esic_number, pan, bank_account,
          basic, hra, da, allowances,
          phone, emergency_contact, emergency_phone, address
        `)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (emp) {
        setProfile(emp as EmployeeProfile);
        setPhone(emp.phone ?? "");
        setEmergencyContact(emp.emergency_contact ?? "");
        setEmergencyPhone(emp.emergency_phone ?? "");
        setAddress(emp.address ?? "");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({ phone, emergency_contact: emergencyContact, emergency_phone: emergencyPhone, address })
        .eq("id", profile.id);
      if (error) throw error;
      toast({ title: "Profile updated", description: "Your contact details have been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password set", description: "Your password has been updated." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Employee profile not found.
      </div>
    );
  }

  const gross = (profile.basic ?? 0) + (profile.hra ?? 0) + (profile.da ?? 0) + (profile.allowances ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* Read-only employment info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment Details</CardTitle>
          <CardDescription>These fields are managed by HR and cannot be edited here</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Name", value: profile.name },
              { label: "Employee Code", value: profile.emp_code },
              { label: "Department", value: profile.department ?? "—" },
              { label: "Designation", value: profile.designation ?? "—" },
              {
                label: "Date of Joining",
                value: profile.date_of_joining
                  ? format(new Date(profile.date_of_joining), "dd MMM yyyy")
                  : "—",
              },
              { label: "UAN", value: profile.uan ?? "—" },
              { label: "ESIC Number", value: profile.esic_number ?? "—" },
              { label: "PAN", value: maskPAN(profile.pan) },
              { label: "Bank Account", value: maskAccount(profile.bank_account) },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</dt>
                <dd className="mt-1 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <Separator className="my-4" />

          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Salary Structure</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Basic", value: profile.basic },
              { label: "HRA", value: profile.hra },
              { label: "DA", value: profile.da },
              { label: "Allowances", value: profile.allowances },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold">₹{(value ?? 0).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-md bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">Gross Pay</span>
            <span className="font-bold text-primary">₹{gross.toLocaleString("en-IN")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Editable contact details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact & Emergency Details</CardTitle>
          <CardDescription>You can update these fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9999999999"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emergency_contact">Emergency Contact Name</Label>
              <Input
                id="emergency_contact"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emergency_phone">Emergency Contact Phone</Label>
              <Input
                id="emergency_phone"
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+91 9999999999"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Set password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Set Password
          </CardTitle>
          <CardDescription>If you signed in via magic link, you can set a password for future logins</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleSetPassword} disabled={changingPassword}>
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ESSProfile;
