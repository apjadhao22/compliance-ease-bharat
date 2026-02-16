export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          company_id: string
          created_at: string | null
          daily_marks: string[] | null
          days_present: number
          employee_id: string | null
          id: string
          month: string
          overtime_hours: number | null
          paid_leaves: number | null
          payroll_run_id: string | null
          unpaid_leaves: number | null
          working_days: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          daily_marks?: string[] | null
          days_present: number
          employee_id?: string | null
          id?: string
          month: string
          overtime_hours?: number | null
          paid_leaves?: number | null
          payroll_run_id?: string | null
          unpaid_leaves?: number | null
          working_days?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          daily_marks?: string[] | null
          days_present?: number
          employee_id?: string | null
          id?: string
          month?: string
          overtime_hours?: number | null
          paid_leaves?: number | null
          payroll_run_id?: string | null
          unpaid_leaves?: number | null
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_calculations: {
        Row: {
          bonus_amount: number | null
          bonus_percent: number | null
          bonus_wages: number | null
          company_id: string
          created_at: string | null
          eligible_months: number | null
          employee_id: string
          financial_year: string
          id: string
          payment_date: string | null
          payment_status: string | null
        }
        Insert: {
          bonus_amount?: number | null
          bonus_percent?: number | null
          bonus_wages?: number | null
          company_id: string
          created_at?: string | null
          eligible_months?: number | null
          employee_id: string
          financial_year: string
          id?: string
          payment_date?: string | null
          payment_status?: string | null
        }
        Update: {
          bonus_amount?: number | null
          bonus_percent?: number | null
          bonus_wages?: number | null
          company_id?: string
          created_at?: string | null
          eligible_months?: number | null
          employee_id?: string
          financial_year?: string
          id?: string
          payment_date?: string | null
          payment_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_calculations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_calculations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          compliance_regime: string | null
          created_at: string | null
          epf_code: string | null
          esic_code: string | null
          id: string
          lwf_number: string | null
          name: string
          pan: string | null
          pt_rc_number: string | null
          state: string | null
          tan: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          compliance_regime?: string | null
          created_at?: string | null
          epf_code?: string | null
          esic_code?: string | null
          id?: string
          lwf_number?: string | null
          name: string
          pan?: string | null
          pt_rc_number?: string | null
          state?: string | null
          tan?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          compliance_regime?: string | null
          created_at?: string | null
          epf_code?: string | null
          esic_code?: string | null
          id?: string
          lwf_number?: string | null
          name?: string
          pan?: string | null
          pt_rc_number?: string | null
          state?: string | null
          tan?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          allowances: number | null
          basic: number
          bonus_applicable: boolean | null
          company_id: string
          created_at: string | null
          da: number | null
          date_of_joining: string
          date_of_leaving: string | null
          dob: string | null
          emp_code: string
          employment_type: string | null
          epf_applicable: boolean | null
          esic_applicable: boolean | null
          esic_number: string | null
          gender: string | null
          gross: number
          hra: number | null
          id: string
          name: string
          pan: string | null
          pt_applicable: boolean | null
          retaining_allowance: number | null
          status: string | null
          uan: string | null
          updated_at: string | null
        }
        Insert: {
          allowances?: number | null
          basic: number
          bonus_applicable?: boolean | null
          company_id: string
          created_at?: string | null
          da?: number | null
          date_of_joining?: string
          date_of_leaving?: string | null
          dob?: string | null
          emp_code: string
          employment_type?: string | null
          epf_applicable?: boolean | null
          esic_applicable?: boolean | null
          esic_number?: string | null
          gender?: string | null
          gross: number
          hra?: number | null
          id?: string
          name: string
          pan?: string | null
          pt_applicable?: boolean | null
          retaining_allowance?: number | null
          status?: string | null
          uan?: string | null
          updated_at?: string | null
        }
        Update: {
          allowances?: number | null
          basic?: number
          bonus_applicable?: boolean | null
          company_id?: string
          created_at?: string | null
          da?: number | null
          date_of_joining?: string
          date_of_leaving?: string | null
          dob?: string | null
          emp_code?: string
          employment_type?: string | null
          epf_applicable?: boolean | null
          esic_applicable?: boolean | null
          esic_number?: string | null
          gender?: string | null
          gross?: number
          hra?: number | null
          id?: string
          name?: string
          pan?: string | null
          pt_applicable?: boolean | null
          retaining_allowance?: number | null
          status?: string | null
          uan?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gratuity_calculations: {
        Row: {
          company_id: string
          created_at: string | null
          date_of_leaving: string
          employee_id: string
          gratuity_amount: number | null
          id: string
          last_drawn_basic: number | null
          payment_date: string | null
          payment_status: string | null
          years_of_service: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          date_of_leaving: string
          employee_id: string
          gratuity_amount?: number | null
          id?: string
          last_drawn_basic?: number | null
          payment_date?: string | null
          payment_status?: string | null
          years_of_service?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          date_of_leaving?: string
          employee_id?: string
          gratuity_amount?: number | null
          id?: string
          last_drawn_basic?: number | null
          payment_date?: string | null
          payment_status?: string | null
          years_of_service?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gratuity_calculations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gratuity_calculations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_details: {
        Row: {
          allowances_paid: number | null
          basic_paid: number | null
          created_at: string | null
          days_present: number | null
          employee_id: string
          epf_employee: number | null
          epf_employer: number | null
          eps_employer: number | null
          esic_employee: number | null
          esic_employer: number | null
          gross_earnings: number | null
          hra_paid: number | null
          id: string
          lwf_employee: number | null
          lwf_employer: number | null
          net_pay: number | null
          overtime_hours: number | null
          overtime_pay: number | null
          paid_leaves: number | null
          payroll_run_id: string
          pt: number | null
          tds: number | null
          total_deductions: number | null
          unpaid_leaves: number | null
        }
        Insert: {
          allowances_paid?: number | null
          basic_paid?: number | null
          created_at?: string | null
          days_present?: number | null
          employee_id: string
          epf_employee?: number | null
          epf_employer?: number | null
          eps_employer?: number | null
          esic_employee?: number | null
          esic_employer?: number | null
          gross_earnings?: number | null
          hra_paid?: number | null
          id?: string
          lwf_employee?: number | null
          lwf_employer?: number | null
          net_pay?: number | null
          overtime_hours?: number | null
          overtime_pay?: number | null
          paid_leaves?: number | null
          payroll_run_id: string
          pt?: number | null
          tds?: number | null
          total_deductions?: number | null
          unpaid_leaves?: number | null
        }
        Update: {
          allowances_paid?: number | null
          basic_paid?: number | null
          created_at?: string | null
          days_present?: number | null
          employee_id?: string
          epf_employee?: number | null
          epf_employer?: number | null
          eps_employer?: number | null
          esic_employee?: number | null
          esic_employer?: number | null
          gross_earnings?: number | null
          hra_paid?: number | null
          id?: string
          lwf_employee?: number | null
          lwf_employer?: number | null
          net_pay?: number | null
          overtime_hours?: number | null
          overtime_pay?: number | null
          paid_leaves?: number | null
          payroll_run_id?: string
          pt?: number | null
          tds?: number | null
          total_deductions?: number | null
          unpaid_leaves?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_details_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          month: string
          processed_at: string | null
          status: string | null
          working_days: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          month: string
          processed_at?: string | null
          status?: string | null
          working_days?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          month?: string
          processed_at?: string | null
          status?: string | null
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
