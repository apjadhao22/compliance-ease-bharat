import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";

const VerifyEmail = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No email found. Please sign in again.");
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      toast({ title: "Email sent!", description: "Check your inbox for the verification link." });
    } catch (error: any) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Link to="/" className="mx-auto mb-4 flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-secondary">OpticompBharat</span>
          </Link>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email address. Click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Didn't receive the email? Check your spam folder or request a new one.</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button onClick={handleResend} variant="outline" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Resend verification email"}
          </Button>
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerifyEmail;
