import { useState } from "react";
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

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val) {
      const result = validatePassword(val);
      setPasswordErrors(result.valid ? [] : result.errors);
    } else {
      setPasswordErrors([]);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validatePassword(password);
    if (!result.valid) {
      setPasswordErrors(result.errors);
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast({ title: "Account created!", description: "Please check your email to verify your account." });
      navigate("/verify-email");
    } catch (error: any) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
      setGoogleLoading(false);
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
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Start your free trial — no credit card required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting..." : "Sign up with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
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
            <Button
              type="submit"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={loading || passwordErrors.length > 0}
            >
              {loading ? "Creating account..." : "Start Free Trial"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignUp;
