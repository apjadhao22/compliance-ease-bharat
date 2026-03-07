import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export type LeadIntent = "SME Trial" | "Enterprise Quote";

interface LeadFormModalProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    intent: LeadIntent;
}

export function LeadFormModal({ isOpen, setIsOpen, intent }: LeadFormModalProps) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        // Web3Forms access key
        data.access_key = "7c6f80d4-9ae9-49b3-9379-b4975c652f6f";
        data.subject = `New Lead: ${intent} from ${data.company}`;
        data.intent = intent; // ensure intent is logged
        data.from_name = "ComplianceEngine Website Lead";

        try {
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (result.success) {
                toast.success("Request received!", {
                    description: "Our team will be in touch with you shortly."
                });
                setIsOpen(false);
            } else {
                toast.error("Something went wrong", {
                    description: "Please try again later or email us directly at amar.jadhao@gmail.com."
                });
            }
        } catch (error) {
            toast.error("Connection error", {
                description: "Please check your internet connection and try again."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {intent === "SME Trial" ? "Apply for a Free 1-Year Trial" : "Request Enterprise Quote"}
                    </DialogTitle>
                    <DialogDescription>
                        {intent === "SME Trial"
                            ? "Leave your details and we'll set up your free account immediately."
                            : "Tell us about your organization and we'll prepare a custom proposal."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" name="name" required placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" name="email" type="email" required placeholder="john@example.com" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="company">Company Name</Label>
                        <Input id="company" name="company" required placeholder="Acme Inc." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number (Optional)</Label>
                        <Input id="phone" name="phone" type="tel" placeholder="+91 98765 43210" />
                    </div>
                    <Button type="submit" className="w-full h-11 mt-4" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {intent === "SME Trial" ? "Claim Free Trial" : "Request Quote"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
