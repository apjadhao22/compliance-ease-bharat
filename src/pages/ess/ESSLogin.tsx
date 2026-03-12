import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ESSLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPasswordMode, setShowPasswordMode] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in as employee, redirect to ESS
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (session.user.user_metadata?.role !== "employee") {
          navigate("/dashboard");
        } else {
          navigate("/ess");
        }
      }
    });
  }, [navigate]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/ess` },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user?.user_metadata?.role !== "employee") {
        await supabase.auth.signOut();
        toast({ variant: "destructive", title: "Access denied", description: "This portal is for employees only." });
        return;
      }
      navigate("/ess");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sign-in failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Employee Portal</CardTitle>
          <CardDescription>OpticompBharat · Sign in to access your portal</CardDescription>
        </CardHeader>
        <CardContent>
          {magicLinkSent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Mail className="h-7 w-7 text-green-600" />
              </div>
              <p className="font-medium">Check your email</p>
              <p className="text-sm text-muted-foreground">
                We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setMagicLinkSent(false); setEmail(""); }}>
                Try a different email
              </Button>
            </div>
          ) : showPasswordMode ? (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => setShowPasswordMode(false)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Use magic link instead
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send magic link
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => setShowPasswordMode(true)}
              >
                <Lock className="mr-2 h-4 w-4" />
                Sign in with password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ESSLogin;
