import { useState, useRef } from "react";
import { format } from "date-fns";
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, XCircle, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { read, utils } from "xlsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";

type ValidationError = {
    rowNumber: number;
    employeeCode: string;
    name: string;
    issue: string;
};

interface Props {
    companyId: string;
    onRefresh: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function EmployeeBulkUpload({ companyId, onRefresh, open, onOpenChange }: Props) {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mapper State
    const [showMapper, setShowMapper] = useState(false);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);

    const [mapping, setMapping] = useState({
        emp_code: "",
        name: "",
        gender: "",
        dob: "",
        bank_account: "",
        ifsc: "",
        payment_mode: "",
        basic: "",
        hra: "",
        allowances: "",
        gross: "",
        uan_number: "",
        esic_number: ""
    });

    // Validation State
    const [showValidation, setShowValidation] = useState(false);
    const [validRecords, setValidRecords] = useState<any[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyId) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const wb = read(data, { cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawJson = utils.sheet_to_json(ws, { defval: "" }) as any[];

            if (rawJson.length === 0) throw new Error("File is empty.");

            const headers = Object.keys(rawJson[0]);
            setFileHeaders(headers);
            setParsedData(rawJson);

            const findHeader = (keywords: string[]) => {
                return headers.find(h => keywords.some(k => h.toLowerCase().includes(k))) || "";
            }

            setMapping({
                emp_code: findHeader(['emp code', 'employee id', 'emp_code']),
                name: findHeader(['name', 'employee name']),
                gender: findHeader(['gender', 'sex']),
                dob: findHeader(['dob', 'date of birth']),
                bank_account: findHeader(['bank a/c', 'account', 'bank account']),
                ifsc: findHeader(['ifsc']),
                payment_mode: findHeader(['payment mode', 'pay mode']),
                basic: findHeader(['basic']),
                hra: findHeader(['hra']),
                allowances: findHeader(['allowance', 'conveyance', 'special allowance']),
                gross: findHeader(['gross']),
                uan_number: findHeader(['uan']),
                esic_number: findHeader(['esic'])
            });
            setShowMapper(true);

        } catch (error: any) {
            toast({ title: "Read Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const runValidation = async () => {
        if (!mapping.emp_code || !mapping.name) {
            toast({ title: "Incomplete Mapping", description: "Employee Code and Name must be mapped.", variant: "destructive" });
            return;
        }

        setUploading(true);
        try {
            // Fetch existing employees to detect upserts
            const { data: emps } = await supabase.from('employees').select('id, emp_code').eq('company_id', companyId);
            const empMap = new Map((emps || []).map(e => [String(e.emp_code).toUpperCase().trim().replace(/\s+/g, ''), e.id]));

            const newValid = [];
            const newErrors: ValidationError[] = [];

            for (let i = 0; i < parsedData.length; i++) {
                const row = parsedData[i];
                const displayRow = i + 2;

                const rawEmpCode = String(row[mapping.emp_code] || "").trim();
                const rawName = String(row[mapping.name] || "").trim();

                if (!rawEmpCode) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: "BLANK", name: rawName, issue: "Employee code is missing" });
                    continue;
                }

                if (!rawName) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, name: "BLANK", issue: "Name is missing" });
                    continue;
                }

                const cleanEmpCode = rawEmpCode.replace(/\s+/g, '').replace(/\./g, '').toUpperCase();
                const existingId = empMap.get(cleanEmpCode);

                // Safely parse dates
                const parseDate = (dateVal: any) => {
                    if (!dateVal) return null;
                    if (dateVal instanceof Date) return format(dateVal, "yyyy-MM-dd");
                    if (typeof dateVal === "number") {
                        const dateObj = new Date((dateVal - (25569)) * 86400 * 1000);
                        return format(dateObj, "yyyy-MM-dd");
                    }
                    if (typeof dateVal === "string") {
                        try {
                            const d = new Date(dateVal.trim().replace(/\//g, '-'));
                            if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
                        } catch (e) { }
                    }
                    return null;
                };

                const parseNum = (val: any) => {
                    if (!val) return 0;
                    if (typeof val === "number") return val;
                    const clean = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
                    const n = parseFloat(clean);
                    return isNaN(n) ? 0 : n;
                };

                const basic = parseNum(mapping.basic ? row[mapping.basic] : 0);
                const hra = parseNum(mapping.hra ? row[mapping.hra] : 0);
                let allowances = parseNum(mapping.allowances ? row[mapping.allowances] : 0);
                let gross = parseNum(mapping.gross ? row[mapping.gross] : 0);

                // If gross isn't mapped but basic/hra/allowances are, calculate it. 
                if (!gross && (basic || hra || allowances)) {
                    gross = basic + hra + allowances;
                }

                // If gross is mapped but allowances isn't, back-calculate allowances
                if (gross && !allowances && basic) {
                    allowances = gross - basic - hra;
                }

                const uan = mapping.uan_number ? String(row[mapping.uan_number] || "").trim() : null;
                const esic = mapping.esic_number ? String(row[mapping.esic_number] || "").trim() : null;

                if (uan && uan.length > 12) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, name: rawName, issue: "UAN exceeds 12 characters" });
                    continue;
                }

                if (esic && esic.length > 17) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, name: rawName, issue: "ESIC exceeds 17 characters" });
                    continue;
                }

                const action = existingId ? "UPDATE" : "NEW";

                newValid.push({
                    id: existingId || uuidv4(), // Fix 23502 Constraint: Provide UUID for NEW records securely
                    action,
                    company_id: companyId,
                    emp_code: rawEmpCode,
                    name: rawName,
                    gender: mapping.gender ? String(row[mapping.gender] || "").trim().toLowerCase() : null,
                    dob: mapping.dob ? parseDate(row[mapping.dob]) : null,
                    bank_account: mapping.bank_account ? String(row[mapping.bank_account] || "").trim() : null,
                    ifsc: mapping.ifsc ? String(row[mapping.ifsc] || "").trim() : null,
                    payment_mode: mapping.payment_mode ? String(row[mapping.payment_mode] || "").trim() : null,
                    basic,
                    hra,
                    allowances,
                    gross,
                    uan_number: uan,
                    esic_number: esic,
                    employment_type: 'permanent', // default
                    epf_applicable: !!uan || basic > 0, // simple heuristic
                    esic_applicable: !!esic || gross <= 21000,
                    pt_applicable: true,
                    status: 'active'
                });
            }

            setValidationErrors(newErrors);
            setValidRecords(newValid);
            setShowMapper(false);
            setShowValidation(true);

        } catch (error: any) {
            toast({ title: "Validation Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleFinalUpload = async () => {
        setUploading(true);
        try {
            // Upsert into Supabase. If `id` is present, it will update that row.
            // If `id` is not present, it inserts. But to be safe with upsert without ID, we can upsert by emp_code + company_id constraint if one exists.
            // Currently, uniqueness is likely on emp_code per company or just ID. 
            // Passing the existing `id` forces an update perfectly.

            // Map out the 'action' property since it doesn't belong in the DB
            const dbPayload = validRecords.map(r => {
                const copy = { ...r };
                delete copy.action;
                delete copy.uan_number; // Database schema doesn't have this yet
                delete copy.esic_number; // Database schema doesn't have this yet
                return copy;
            });

            const { error } = await supabase.from('employees').upsert(dbPayload);

            if (error) throw error;

            toast({ title: "Success", description: `Successfully processed ${dbPayload.length} employee records.` });
            setShowValidation(false);
            onOpenChange(false);
            onRefresh();

        } catch (error: any) {
            toast({ title: "Upload Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleCancel = () => {
        setShowMapper(false);
        setShowValidation(false);
        setParsedData([]);
        setValidRecords([]);
        setValidationErrors([]);
        onOpenChange(false);
    };

    const renderMapperRow = (label: string, field: string, required: boolean = false) => (
        <div className="grid grid-cols-[1fr_2fr] items-center gap-4 py-2 border-b last:border-0">
            <Label className={required ? "font-bold" : ""}>{label} {required && <span className="text-destructive">*</span>}</Label>
            <Select value={mapping[field as keyof typeof mapping]} onValueChange={(val) => setMapping(prev => ({ ...prev, [field]: val === "ignore" ? "" : val }))}>
                <SelectTrigger>
                    <SelectValue placeholder="Ignore (Do not map)" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ignore" className="text-muted-foreground italic">-- Ignore --</SelectItem>
                    {fileHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Bulk Upload Employees</DialogTitle>
                    <DialogDescription>
                        Map your Excel/CSV columns to our database. Updates existing records based on Employee Code unharmed.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 pt-2">
                    {!showMapper && !showValidation && (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-slate-50 relative h-full">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={uploading}
                            />
                            {uploading ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                    <h3 className="text-lg font-medium">Parsing sheet...</h3>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center">
                                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-medium mb-1">Click or drag Excel/CSV file here</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                                        Must include Employee Code and Name. Uploading existing Employee Codes will neatly update their salaries & info.
                                    </p>
                                    <Button type="button" variant="secondary">Select File</Button>
                                </div>
                            )}
                        </div>
                    )}

                    {showMapper && (
                        <div className="flex flex-col h-full space-y-4">
                            <div className="bg-primary/5 p-4 rounded-md border flex justify-between items-center">
                                <div>
                                    <h4 className="font-semibold text-primary">Column Mapping</h4>
                                    <p className="text-sm text-muted-foreground">We detected {fileHeaders.length} columns in your file.</p>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 border rounded-md p-4">
                                {renderMapperRow("Employee Code", "emp_code", true)}
                                {renderMapperRow("Employee Name", "name", true)}
                                {renderMapperRow("Gender", "gender")}
                                {renderMapperRow("Date of Birth", "dob")}
                                {renderMapperRow("Bank Account No.", "bank_account")}
                                {renderMapperRow("IFSC Code", "ifsc")}
                                {renderMapperRow("Payment Mode", "payment_mode")}
                                {renderMapperRow("Basic Salary", "basic")}
                                {renderMapperRow("HRA", "hra")}
                                {renderMapperRow("Allowances", "allowances")}
                                {renderMapperRow("Gross Salary", "gross")}
                                {renderMapperRow("UAN Number", "uan_number")}
                                {renderMapperRow("ESIC Number", "esic_number")}
                            </ScrollArea>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                                <Button onClick={runValidation} disabled={uploading}>
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Review & Validate
                                </Button>
                            </div>
                        </div>
                    )}

                    {showValidation && (
                        <div className="flex flex-col h-full space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="bg-green-50 border-green-200">
                                    <CardHeader className="py-3 px-4">
                                        <div className="flex items-center gap-2 text-green-700">
                                            <CheckCircle className="h-5 w-5" />
                                            <CardTitle className="text-lg">Ready to Import / Update</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="py-2 px-4">
                                        <span className="text-2xl font-bold text-green-700">{validRecords.length}</span> rows
                                    </CardContent>
                                </Card>

                                <Card className="bg-red-50 border-red-200">
                                    <CardHeader className="py-3 px-4">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <XCircle className="h-5 w-5" />
                                            <CardTitle className="text-lg">Skipped (Errors)</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="py-2 px-4">
                                        <span className="text-2xl font-bold text-red-700">{validationErrors.length}</span> rows
                                    </CardContent>
                                </Card>
                            </div>

                            <ScrollArea className="flex-1 border rounded-md">
                                {validationErrors.length > 0 && (
                                    <div className="p-4 border-b bg-red-50/50">
                                        <h4 className="font-semibold text-red-700 mb-2">Validation Errors (These will be skipped)</h4>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-16">Row</TableHead>
                                                    <TableHead>Emp Code</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Issue</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {validationErrors.map((e, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium text-red-600">{e.rowNumber}</TableCell>
                                                        <TableCell>{e.employeeCode}</TableCell>
                                                        <TableCell>{e.name}</TableCell>
                                                        <TableCell className="text-red-600">{e.issue}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}

                                <div className="p-4">
                                    <h4 className="font-semibold text-green-700 mb-2">Valid Records Preview</h4>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Emp Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="text-right">Gross</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {validRecords.map((r, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        {r.action === "UPDATE" ? (
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Update</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">New</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{r.emp_code}</TableCell>
                                                    <TableCell>{r.name}</TableCell>
                                                    <TableCell className="text-right">₹{r.gross?.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                            {validRecords.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                                        No valid records to import.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </ScrollArea>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                                <Button onClick={handleFinalUpload} disabled={uploading || validRecords.length === 0}>
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirm Upsert ({validRecords.length})
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
