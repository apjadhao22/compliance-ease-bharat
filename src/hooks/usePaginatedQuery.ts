import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaginatedQueryOptions {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  inFilters?: Record<string, any[]>;
  gteFilters?: Record<string, any>;
  lteFilters?: Record<string, any>;
  orderBy?: { column: string; ascending: boolean };
  pageSize?: number;
  searchColumn?: string;
  searchColumns?: string[];
  enabled?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

export function usePaginatedQuery<T = any>(
  options: PaginatedQueryOptions
): PaginatedResult<T> {
  const {
    table,
    select = "*",
    filters = {},
    inFilters = {},
    gteFilters = {},
    lteFilters = {},
    orderBy,
    pageSize = 50,
    searchColumn,
    searchColumns,
    enabled = true,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTermState] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);

    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = (supabase as any)
        .from(table)
        .select(select, { count: "exact" });

      // Apply eq filters
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }

      // Apply in filters
      for (const [key, values] of Object.entries(inFilters)) {
        if (values && values.length > 0) {
          query = query.in(key, values);
        }
      }

      // Apply gte filters
      for (const [key, value] of Object.entries(gteFilters)) {
        if (value !== undefined && value !== null) {
          query = query.gte(key, value);
        }
      }

      // Apply lte filters
      for (const [key, value] of Object.entries(lteFilters)) {
        if (value !== undefined && value !== null) {
          query = query.lte(key, value);
        }
      }

      // Apply search
      if (searchColumns && searchColumns.length > 0 && searchTerm.trim()) {
        const term = searchTerm.trim();
        const orQuery = searchColumns.map(col => `${col}.ilike.%${term}%`).join(',');
        query = query.or(orQuery);
      } else if (searchColumn && searchTerm.trim()) {
        query = query.ilike(searchColumn, `%${searchTerm.trim()}%`);
      }

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }

      // Apply pagination
      query = query.range(from, to);

      const { data: result, count, error: queryError } = await query;

      if (queryError) throw queryError;

      setData(result || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [table, select, JSON.stringify(filters), JSON.stringify(inFilters), JSON.stringify(gteFilters), JSON.stringify(lteFilters), orderBy?.column, orderBy?.ascending, page, pageSize, searchColumn, JSON.stringify(searchColumns), searchTerm, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 0 when search changes
  const setSearchTerm = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTermState(term);
      setPage(0);
    }, 300);
  }, []);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setPage((prev) => Math.min(prev + 1, totalPages - 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((prev) => Math.max(prev - 1, 0));
  }, []);

  return {
    data,
    page,
    pageSize,
    totalCount,
    totalPages,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    goToPage,
    nextPage,
    prevPage,
    refresh: fetchData,
  };
}
