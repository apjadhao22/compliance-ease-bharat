import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationControlsProps {
    page: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onNext: () => void;
    onPrev: () => void;
    isLoading?: boolean;
}

const PaginationControls = ({
    page,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    onNext,
    onPrev,
    isLoading = false,
}: PaginationControlsProps) => {
    const from = page * pageSize + 1;
    const to = Math.min((page + 1) * pageSize, totalCount);

    if (totalCount <= pageSize) return null;

    // Generate visible page numbers (show max 5 around current)
    const getVisiblePages = () => {
        const pages: number[] = [];
        const start = Math.max(0, page - 2);
        const end = Math.min(totalPages - 1, page + 2);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 px-2">
            <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount.toLocaleString("en-IN")}</span>
            </p>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onPageChange(0)}
                    disabled={page === 0 || isLoading}
                    title="First page"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onPrev}
                    disabled={page === 0 || isLoading}
                    title="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {getVisiblePages().map((p) => (
                    <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8 text-xs"
                        onClick={() => onPageChange(p)}
                        disabled={isLoading}
                    >
                        {p + 1}
                    </Button>
                ))}

                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onNext}
                    disabled={page >= totalPages - 1 || isLoading}
                    title="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onPageChange(totalPages - 1)}
                    disabled={page >= totalPages - 1 || isLoading}
                    title="Last page"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default PaginationControls;
