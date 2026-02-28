-- Add uan_number and esic_number to employees table
ALTER TABLE public.employees
ADD COLUMN uan_number text,
ADD COLUMN esic_number text;

-- Create asset_history table to track assignments and returns
CREATE TABLE IF NOT EXISTS public.asset_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_date date NOT NULL,
    returned_date date,
    status text NOT NULL CHECK (status IN ('Allocated', 'Returned', 'Lost', 'Damaged')),
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for asset_history
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's asset history"
    ON public.asset_history FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.assets a 
        JOIN public.companies c ON a.company_id = c.id 
        WHERE a.id = asset_history.asset_id 
        AND c.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert their company's asset history"
    ON public.asset_history FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.assets a 
        JOIN public.companies c ON a.company_id = c.id 
        WHERE a.id = asset_history.asset_id 
        AND c.user_id = auth.uid()
    ));

CREATE POLICY "Users can update their company's asset history"
    ON public.asset_history FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.assets a 
        JOIN public.companies c ON a.company_id = c.id 
        WHERE a.id = asset_history.asset_id 
        AND c.user_id = auth.uid()
    ));
