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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignment_submissions: {
        Row: {
          assignment_id: string
          created_at: string
          file_url: string | null
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          submission_text: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id?: string
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          cron_expression: string
          day_of_month: number
          day_of_week: number
          description: string
          enabled: boolean
          frequency: string
          id: string
          label: string
          task_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cron_expression?: string
          day_of_month?: number
          day_of_week?: number
          description?: string
          enabled?: boolean
          frequency?: string
          id?: string
          label: string
          task_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cron_expression?: string
          day_of_month?: number
          day_of_week?: number
          description?: string
          enabled?: boolean
          frequency?: string
          id?: string
          label?: string
          task_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      class_enrollments: {
        Row: {
          class_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room_location: string | null
          section: string | null
          start_time: string
          subject: string
          teacher_id: string | null
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room_location?: string | null
          section?: string | null
          start_time: string
          subject: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          class?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room_location?: string | null
          section?: string | null
          start_time?: string
          subject?: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          class: string | null
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          section: string | null
          stream: string | null
          title: string
          updated_at: string
          uploaded_by: string
          uploader_role: string
        }
        Insert: {
          class?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          section?: string | null
          stream?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
          uploader_role: string
        }
        Update: {
          class?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          section?: string | null
          stream?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
          uploader_role?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          admin_id: string | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          date?: string
          description: string
          id?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["fee_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["fee_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["fee_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_years: {
        Row: {
          created_at: string
          end_date: string
          frozen_at: string | null
          frozen_by: string | null
          id: string
          is_frozen: boolean
          label: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          is_frozen?: boolean
          label: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          is_frozen?: boolean
          label?: string
          start_date?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          archived: boolean | null
          archived_at: string | null
          archived_by: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          profile_completed: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          profile_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          profile_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recurring_templates: {
        Row: {
          admin_id: string | null
          amount: number
          category: string | null
          created_at: string
          created_by: string
          day_of_month: number
          id: string
          interval: string
          is_active: boolean
          last_generated: string | null
          notes: string | null
          student_id: string | null
          teacher_id: string | null
          type: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          created_by: string
          day_of_month?: number
          id?: string
          interval: string
          is_active?: boolean
          last_generated?: string | null
          notes?: string | null
          student_id?: string | null
          teacher_id?: string | null
          type: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string
          day_of_month?: number
          id?: string
          interval?: string
          is_active?: boolean
          last_generated?: string | null
          notes?: string | null
          student_id?: string | null
          teacher_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_templates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          class: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrollment_date: string
          father_name: string | null
          id: string
          section: string | null
          stream: string | null
          student_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          class?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string
          father_name?: string | null
          id?: string
          section?: string | null
          stream?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          class?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string
          father_name?: string | null
          id?: string
          section?: string | null
          stream?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          notes: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          teacher_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_salaries: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          expense_id: string | null
          id: string
          month: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          expense_id?: string | null
          id?: string
          month: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          expense_id?: string | null
          id?: string
          month?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_salaries_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_salaries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          designation: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string | null
          id: string
          joining_date: string
          subjects: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string | null
          id?: string
          joining_date?: string
          subjects?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string | null
          id?: string
          joining_date?: string
          subjects?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_profile: {
        Args: { _archived_by: string; _profile_id: string }
        Returns: undefined
      }
      generate_employee_id: {
        Args: { first_name: string; joining_date: string; last_name: string }
        Returns: string
      }
      generate_student_id: {
        Args: { enrollment_date: string; first_name: string; last_name: string }
        Returns: string
      }
      get_admin_dashboard_stats: {
        Args: never
        Returns: {
          pending_approvals: number
          pending_fees: number
          todays_classes: number
          total_students: number
        }[]
      }
      get_own_profile_protected_fields: {
        Args: never
        Returns: {
          approved: boolean
          approved_at: string
          approved_by: string
          archived: boolean
          archived_at: string
          archived_by: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_own_student_protected_fields: {
        Args: never
        Returns: {
          class: string
          section: string
          stream: string
          student_id: string
        }[]
      }
      get_teacher_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_co_admin: { Args: never; Returns: boolean }
      is_date_frozen: { Args: { _date: string }; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      is_user_archived: { Args: { _user_id: string }; Returns: boolean }
      restore_profile: { Args: { _profile_id: string }; Returns: undefined }
      teacher_has_class: { Args: { _class_id: string }; Returns: boolean }
      teacher_has_student: { Args: { _student_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "co_admin" | "teacher"
      assignment_status: "pending" | "submitted" | "completed"
      attendance_status: "present" | "absent"
      expense_category:
        | "rent"
        | "utilities"
        | "supplies"
        | "admin_personal"
        | "marketing"
        | "other"
      fee_status: "paid" | "pending" | "overdue"
      user_role: "admin" | "student" | "teacher"
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
    Enums: {
      app_role: ["admin", "moderator", "user", "co_admin", "teacher"],
      assignment_status: ["pending", "submitted", "completed"],
      attendance_status: ["present", "absent"],
      expense_category: [
        "rent",
        "utilities",
        "supplies",
        "admin_personal",
        "marketing",
        "other",
      ],
      fee_status: ["paid", "pending", "overdue"],
      user_role: ["admin", "student", "teacher"],
    },
  },
} as const
