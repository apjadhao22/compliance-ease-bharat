import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { motion, useAnimation, useMotionValue, useTransform, animate } from "framer-motion";
import { Users, Clock, IndianRupee } from "lucide-react";

const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
    const animatedValue = useMotionValue(0);
    const displayValue = useTransform(animatedValue, (latest) =>
        `${prefix}${Math.round(latest).toLocaleString('en-IN')}${suffix}`
    );

    useEffect(() => {
        const controls = animate(animatedValue, value, {
            duration: 0.8,
            ease: "easeOut"
        });
        return controls.stop;
    }, [value, animatedValue]);

    return <motion.span>{displayValue}</motion.span>;
};

export const ROICalculator = () => {
    const [employees, setEmployees] = useState([50]);

    // Calculations based on employee count
    // Assume:
    // 1 hr per employee per month saved on EPF, ESIC, PT, Gratuity, Bonus
    // Average hourly HR cost ~ ₹200
    // Avoided penalties ~ ₹500 per error, estimate 10% error rate manually
    const hoursSaved = employees[0] * 1.5;
    const hrCostSaved = hoursSaved * 200;
    const penaltiesAvoided = employees[0] * 0.1 * 500;
    const totalMoneySaved = hrCostSaved + penaltiesAvoided;

    return (
        <Card className="max-w-3xl mx-auto mt-16 shadow-2xl border bg-card/50 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />

            <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
                    Calculate Your ROI
                </CardTitle>
                <CardDescription>
                    See how much time and money you save every month by automating compliance.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Number of Employees
                        </span>
                        <span className="font-bold text-lg text-primary">{employees[0]}</span>
                    </div>
                    <Slider
                        value={employees}
                        onValueChange={setEmployees}
                        max={1000}
                        min={5}
                        step={5}
                        className="w-full cursor-pointer"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-xl border border-white/5">
                        <Clock className="w-8 h-8 text-accent mb-3" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Time Saved (Monthly)</h4>
                        <div className="text-3xl font-bold text-foreground">
                            <AnimatedNumber value={hoursSaved} suffix=" hrs" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Frees up your HR to focus on culture & growth
                        </p>
                    </div>

                    <div className="flex flex-col items-center justify-center p-6 bg-primary/5 rounded-xl border border-primary/20 relative overflow-hidden">
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-transparent"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />
                        <IndianRupee className="w-8 h-8 text-success mb-3" />
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Estimated Savings (Monthly)</h4>
                        <div className="text-3xl font-extrabold text-success">
                            <AnimatedNumber value={totalMoneySaved} prefix="₹" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Operational costs + Avoided non-compliance penalties
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
