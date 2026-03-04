import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    /**
     * When true (default), shows a full-page crash screen.
     * When false, shows an inline error card — useful for wrapping
     * individual dashboard sections so only one section breaks,
     * not the whole app.
     */
    fullPage?: boolean;
    /** Optional label shown in the error card header */
    sectionName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorId: string | null;
}

/**
 * ErrorBoundary
 * ─────────────
 * Catches unhandled React render errors and displays a friendly
 * recovery UI instead of a blank white screen.
 *
 * Usage — full-page (wraps the whole app):
 *   <ErrorBoundary fullPage><App /></ErrorBoundary>
 *
 * Usage — section-level (wraps one dashboard page):
 *   <ErrorBoundary sectionName="Payroll">
 *     <Payroll />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    static defaultProps = { fullPage: false };

    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorId: null };
    }

    static getDerivedStateFromError(error: Error): State {
        // Generate a short ID for the error so users can quote it in support tickets
        const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
        return { hasError: true, error, errorId };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log to console — replace with your logging service (Sentry, LogRocket, etc.)
        console.error("[ErrorBoundary] Uncaught error:", error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorId: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        const { error, errorId } = this.state;
        const { fullPage, sectionName } = this.props;

        /* ── Full-page crash screen ─────────────────────────────────── */
        if (fullPage) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                    <div className="max-w-md w-full space-y-6">
                        <div className="flex justify-center">
                            <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="h-10 w-10 text-red-500" />
                            </div>
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
                            <p className="text-muted-foreground mt-2">
                                An unexpected error occurred. Your data is safe — this is only a display issue.
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-muted p-4 text-left text-sm">
                                <p className="font-medium text-foreground">Error details:</p>
                                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                                    {error.message}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Reference ID: <span className="font-mono font-medium">{errorId}</span>
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={this.handleReset} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Try Again
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => { window.location.href = "/dashboard"; }}
                            >
                                <Home className="h-4 w-4" />
                                Go to Dashboard
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        /* ── Section-level inline error card ──────────────────────────── */
        return (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 p-6 space-y-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-foreground">
                            {sectionName ? `${sectionName} failed to load` : "This section encountered an error"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {error?.message || "An unexpected error occurred. Please try refreshing."}
                        </p>
                        {errorId && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Ref: <span className="font-mono">{errorId}</span>
                            </p>
                        )}
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Retry
                </Button>
            </div>
        );
    }
}

export default ErrorBoundary;
