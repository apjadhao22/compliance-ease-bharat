import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Laptop, Smartphone, Monitor, Package, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  serial_number: string | null;
  purchase_date: string | null;
  status: string;
  acknowledged: boolean | null;
  acknowledged_at: string | null;
}

const categoryIcon = (cat: string) => {
  switch (cat?.toLowerCase()) {
    case "laptop": return <Laptop className="h-4 w-4" />;
    case "mobile": return <Smartphone className="h-4 w-4" />;
    case "monitor": return <Monitor className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
};

const ESSAssets = () => {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!emp) { setLoading(false); return; }
    setEmployeeId(emp.id);

    const { data } = await supabase
      .from("assets")
      .select("id, asset_code, name, category, serial_number, purchase_date, status, acknowledged, acknowledged_at")
      .eq("assigned_to", emp.id);
    setAssets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const acknowledge = async (assetId: string) => {
    setAcknowledging(assetId);
    try {
      const { error } = await supabase
        .from("assets")
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq("id", assetId);
      if (error) throw error;
      toast({ title: "Asset acknowledged", description: "You have confirmed receipt of this asset." });
      await load();
    } catch (err) {
      toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setAcknowledging(null);
    }
  };

  const pendingAck = assets.filter((a) => !a.acknowledged);
  const acknowledgedAssets = assets.filter((a) => a.acknowledged);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="assets">
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Assets</h1>
          <p className="text-muted-foreground text-sm">Assets assigned to you by your organization.</p>
        </div>

        {/* Pending Acknowledgments */}
        {pendingAck.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base text-amber-800">
                Pending Acknowledgments ({pendingAck.length})
              </CardTitle>
              <CardDescription className="text-amber-700">
                Please acknowledge receipt of the following assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingAck.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                        {categoryIcon(asset.category)}
                      </div>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {asset.asset_code} · {asset.category}
                          {asset.serial_number && ` · S/N: ${asset.serial_number}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => acknowledge(asset.id)}
                      disabled={acknowledging === asset.id}
                    >
                      {acknowledging === asset.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Acknowledge Receipt
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Assigned Assets</CardTitle>
            <CardDescription>Read-only view of all assets assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No assets assigned to you.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acknowledged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          {categoryIcon(asset.category)}
                          <span className="text-sm">{asset.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{asset.asset_code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{asset.serial_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {asset.acknowledged ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">
                              {asset.acknowledged_at
                                ? format(new Date(asset.acknowledged_at), "d MMM yyyy")
                                : "Yes"}
                            </span>
                          </div>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSAssets;
