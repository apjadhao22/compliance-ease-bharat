import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeComboboxProps {
    companyId: string | null;
    value: string;                        // selected employee ID
    onSelect: (employeeId: string) => void;
    placeholder?: string;
    statusFilter?: string[];              // e.g., ["Active", "active"] or ["Terminated"]
    disabled?: boolean;
    className?: string;
}

interface EmployeeOption {
    id: string;
    name: string;
    emp_code: string;
}

const EmployeeCombobox = ({
    companyId,
    value,
    onSelect,
    placeholder = "Select employee...",
    statusFilter = ["Active", "active"],
    disabled = false,
    className,
}: EmployeeComboboxProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<EmployeeOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // Fetch employees with server-side search
    const fetchEmployees = useCallback(
        async (term: string) => {
            if (!companyId) return;
            setLoading(true);
            try {
                let query = supabase
                    .from("employees")
                    .select("id, name, emp_code")
                    .eq("company_id", companyId)
                    .in("status", statusFilter)
                    .order("name", { ascending: true })
                    .limit(30);

                if (term.trim()) {
                    // Search by name or emp_code
                    query = query.or(`name.ilike.%${term.trim()}%,emp_code.ilike.%${term.trim()}%`);
                }

                const { data } = await query;
                setOptions(data || []);
            } catch {
                setOptions([]);
            } finally {
                setLoading(false);
            }
        },
        [companyId, JSON.stringify(statusFilter)]
    );

    // Debounced search
    useEffect(() => {
        if (!open) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchEmployees(search);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search, open, fetchEmployees]);

    // Load initial options when dropdown opens
    useEffect(() => {
        if (open && options.length === 0) {
            fetchEmployees("");
        }
    }, [open, fetchEmployees]);

    // Resolve selected employee name
    useEffect(() => {
        if (!value) {
            setSelectedLabel("");
            return;
        }
        const found = options.find((o) => o.id === value);
        if (found) {
            setSelectedLabel(`${found.name} (${found.emp_code})`);
            return;
        }
        // Fetch individual employee if not in current options
        const fetchOne = async () => {
            const { data } = await supabase
                .from("employees")
                .select("id, name, emp_code")
                .eq("id", value)
                .maybeSingle();
            if (data) setSelectedLabel(`${data.name} (${data.emp_code})`);
        };
        fetchOne();
    }, [value, options]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || !companyId}
                    className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
                >
                    {value ? selectedLabel || "Loading..." : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search by name or code..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        {loading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : options.length === 0 ? (
                            <CommandEmpty>No employees found.</CommandEmpty>
                        ) : (
                            <CommandGroup>
                                {options.map((emp) => (
                                    <CommandItem
                                        key={emp.id}
                                        value={emp.id}
                                        onSelect={() => {
                                            onSelect(emp.id);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                    >
                                        <Check
                                            className={cn("mr-2 h-4 w-4", value === emp.id ? "opacity-100" : "opacity-0")}
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{emp.name}</span>
                                            <span className="text-xs text-muted-foreground">{emp.emp_code}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default EmployeeCombobox;
