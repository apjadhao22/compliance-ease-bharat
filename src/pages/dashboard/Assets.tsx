import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
    Laptop, Smartphone, Monitor, Keyboard, Mouse,
    Plus, Search, Edit, Trash2, ShieldAlert, Loader2
} from "lucide-react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";

// Data Types
type AssetStatus = "Available" | "Allocated" | "Maintenance" | "Retired";
type AssetCategory = "Laptop" | "Mobile" | "Monitor" | "Peripherals" | "Other";

interface Asset {
    id: string;
    asset_code: string;
    name: string;
    category: AssetCategory;
    serial_number: string;
    purchase_date: string;
    status: AssetStatus;
    assigned_to?: string | null; // Employee UUID
    notes?: string;
    employees?: { name: string }; // joined data from supabase
}

interface Employee {
    id: string;
    name: string;
}

const Assets = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newAsset, setNewAsset] = useState<Partial<Asset>>({
        status: "Available",
        category: "Laptop"
    });

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: company } = await supabase
                    .from("companies")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (company) {
                    setCompanyId(company.id);

                    // Fetch Employees
                    const { data: emps } = await supabase
                        .from("employees")
                        .select("id, name")
                        .eq("company_id", company.id);

                    if (emps) setEmployees(emps);

                    // Fetch Assets explicitly listing relation mapping to be safe
                    const { data: asts, error: astsError } = await supabase
                        .from("assets")
                        .select("*, employees(name)")
                        .eq("company_id", company.id)
                        .order("created_at", { ascending: false });

                    if (astsError) {
                        console.error("fetch constraints:", astsError);
                        toast({ title: "Warning", description: "Failed to load assets properly.", variant: "destructive" });
                    } else if (asts) {
                        setAssets(asts as any[]);
                    }
                }
            } catch (e: any) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const getCategoryIcon = (category: AssetCategory) => {
        switch (category) {
            case "Laptop": return <Laptop className="w-4 h-4 text-blue-500" />;
            case "Mobile": return <Smartphone className="w-4 h-4 text-green-500" />;
            case "Monitor": return <Monitor className="w-4 h-4 text-purple-500" />;
            case "Peripherals": return <Keyboard className="w-4 h-4 text-yellow-500" />;
            default: return <Laptop className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusBadge = (status: AssetStatus) => {
        switch (status) {
            case "Available": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available</Badge>;
            case "Allocated": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Allocated</Badge>;
            case "Maintenance": return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Maintenance</Badge>;
            case "Retired": return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Retired</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const generateAssetCode = () => {
        return `AST-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    };

    const handleAddAsset = async () => {
        if (!companyId) {
            toast({ title: "Setup needed", description: "Company not found.", variant: "destructive" });
            return;
        }

        if (!newAsset.name || !newAsset.serial_number || !newAsset.purchase_date) {
            toast({
                title: "Missing Information",
                description: "Please fill in all mandatory fields.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        const assigned_to = newAsset.assigned_to && newAsset.assigned_to !== "none" ? newAsset.assigned_to : null;
        const computedStatus = assigned_to ? "Allocated" : (newAsset.status || "Available");

        try {
            const assetCode = generateAssetCode();
            const { data, error } = await supabase
                .from("assets")
                .insert({
                    company_id: companyId,
                    asset_code: assetCode,
                    name: newAsset.name,
                    category: newAsset.category,
                    serial_number: newAsset.serial_number,
                    purchase_date: newAsset.purchase_date,
                    status: computedStatus,
                    assigned_to: assigned_to,
                    notes: newAsset.notes
                })
                .select("*, employees(name)")
                .single();

            if (error) throw error;

            setAssets([{ ...data, employees: assigned_to ? { name: employees.find(e => e.id === assigned_to)?.name } : null } as any, ...assets]);
            setIsAddDialogOpen(false);
            setNewAsset({ status: "Available", category: "Laptop" });

            toast({
                title: "Asset Added",
                description: `${data.name} has been successfully added to inventory.`
            });
        } catch (error: any) {
            toast({
                title: "Failed to add asset",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;

        try {
            const { error } = await supabase.from("assets").delete().eq("id", id);
            if (error) throw error;

            setAssets(assets.filter(a => a.id !== id));
            toast({
                title: "Asset Removed",
                description: "The asset has been successfully deleted from your database."
            });
        } catch (error: any) {
            toast({
                title: "Failed to delete asset",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const filteredAssets = assets.filter(a => {
        const term = searchTerm.toLowerCase();
        const assName = a.employees && !Array.isArray(a.employees) ? a.employees.name : "";
        return a.name.toLowerCase().includes(term) ||
            a.serial_number.toLowerCase().includes(term) ||
            (a.asset_code || "").toLowerCase().includes(term) ||
            (assName && assName.toLowerCase().includes(term));
    });

    const stats = {
        total: assets.length,
        allocated: assets.filter(a => a.status === "Allocated").length,
        available: assets.filter(a => a.status === "Available").length,
        maintenance: assets.filter(a => a.status === "Maintenance").length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-50" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Asset Management</h1>
                    <p className="text-muted-foreground mt-1">Track and assign company devices and equipment.</p>
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add Asset
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Asset</DialogTitle>
                            <DialogDescription>
                                Register a new device or equipment into the company inventory.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. MacBook Pro M3"
                                    className="col-span-3"
                                    value={newAsset.name || ""}
                                    onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="category" className="text-right">Category</Label>
                                <div className="col-span-3">
                                    <Select
                                        value={newAsset.category}
                                        onValueChange={(val) => setNewAsset({ ...newAsset, category: val as AssetCategory })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Laptop">Laptop</SelectItem>
                                            <SelectItem value="Mobile">Mobile/Tablet</SelectItem>
                                            <SelectItem value="Monitor">Monitor</SelectItem>
                                            <SelectItem value="Peripherals">Peripherals (Keyboard/Mouse)</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="serial" className="text-right">Serial / IMEI</Label>
                                <Input
                                    id="serial"
                                    placeholder="Device serial number"
                                    className="col-span-3"
                                    value={newAsset.serial_number || ""}
                                    onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="date" className="text-right">Purchase</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    className="col-span-3"
                                    value={newAsset.purchase_date || ""}
                                    onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="assign" className="text-right">Assign To</Label>
                                <div className="col-span-3">
                                    <Select
                                        value={newAsset.assigned_to || "none"}
                                        onValueChange={(val) => setNewAsset({ ...newAsset, assigned_to: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Leave Unassigned" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Unassigned --</SelectItem>
                                            {employees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" onClick={handleAddAsset} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Asset
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                        <Laptop className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-blue-600">Allocated</CardTitle>
                        <Smartphone className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{stats.allocated}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-green-600">Available</CardTitle>
                        <Monitor className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.available}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-orange-600">In Maintenance</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{stats.maintenance}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="px-6 py-4 border-b">
                    <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                        <CardTitle className="text-lg">Inventory List</CardTitle>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by name, serial, or employee..."
                                className="pl-9 bg-background w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Asset Code</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAssets.length > 0 ? (
                                filteredAssets.map((asset) => (
                                    <TableRow key={asset.id} className="hover:bg-muted/30">
                                        <TableCell className="font-medium text-xs font-mono">{asset.asset_code}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getCategoryIcon(asset.category)}
                                                <span className="font-medium text-sm">{asset.name}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Purchased: {asset.purchase_date ? format(new Date(asset.purchase_date), "PP") : "N/A"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-muted-foreground">
                                            {asset.serial_number}
                                        </TableCell>
                                        <TableCell>
                                            {asset.employees && !Array.isArray(asset.employees) && asset.employees.name ? (
                                                <span className="text-sm">{asset.employees.name}</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(asset.id, asset.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No assets found. {searchTerm && "Try adjusting your search criteria."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default Assets;
