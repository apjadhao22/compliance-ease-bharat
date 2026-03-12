import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";
import { useESSFeatures, type ESSFeatures } from "@/hooks/useESSFeatures";
import { Skeleton } from "@/components/ui/skeleton";

interface ESSFeatureGateProps {
  feature: keyof ESSFeatures;
  children: ReactNode;
}

const ESSFeatureGate = ({ feature, children }: ESSFeatureGateProps) => {
  const { features, loading } = useESSFeatures();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!features[feature]) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Feature Not Available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This feature is not enabled by your organization. Contact your HR administrator.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/ess")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};

export default ESSFeatureGate;
