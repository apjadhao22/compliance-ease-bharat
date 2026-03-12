import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { validatePassword } from "@/lib/validations";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    const result = validatePassword(val);
    setPasswordErrors(result.valid ? [] : result.errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validatePassword(password);
    if (!result.valid) {
      setPasswordErrors(result.errors);
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      navigate("/sign-in");
    } catch (error: any) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-secondary">OpticompBharat</span>
          </Link>
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account</CardDescription>
        </CardHeader>
        {!ready ? (
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Waiting for password reset confirmation… If you arrived here from a reset email link, please wait a moment.
            </p>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                />
                {passwordErrors.length > 0 && (
                  <ul className="space-y-1">
                    {passwordErrors.map((err) => (
                      <li key={err} className="text-xs text-destructive">• {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading || passwordErrors.length > 0}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
