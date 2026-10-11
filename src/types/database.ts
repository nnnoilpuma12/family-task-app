export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          household_id: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_recommendations: {
        Row: {
          created_at: string
          dismissed_by: string | null
          dismissed_until: string
          household_id: string
          id: string
          normalized_title: string
        }
        Insert: {
          created_at?: string
          dismissed_by?: string | null
          dismissed_until: string
          household_id: string
          id?: string
          normalized_title: string
        }
        Update: {
          created_at?: string
          dismissed_by?: string | null
          dismissed_until?: string
          household_id?: string
          id?: string
          normalized_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_recommendations_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_recommendations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          invite_code_expires_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string | null
          invite_code_expires_at?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string | null
          invite_code_expires_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          household_id: string | null
          id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          household_id?: string | null
          id: string
          nickname?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          household_id?: string | null
          id?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staple_items: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          default_quantity: number | null
          default_unit: string | null
          household_id: string
          icon: string | null
          id: string
          last_used_at: string | null
          name: string
          note: string | null
          sort_order: number
          updated_at: string
          use_count: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          default_quantity?: number | null
          default_unit?: string | null
          household_id: string
          icon?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          note?: string | null
          sort_order?: number
          updated_at?: string
          use_count?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          default_quantity?: number | null
          default_unit?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          note?: string | null
          sort_order?: number
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "staple_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staple_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          profile_id: string
          task_id: string
        }
        Insert: {
          profile_id: string
          task_id: string
        }
        Update: {
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_images: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_images_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          household_id: string
          id: string
          is_done: boolean
          memo: string | null
          sort_order: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          household_id: string
          id?: string
          is_done?: boolean
          memo?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          household_id?: string
          id?: string
          is_done?: boolean
          memo?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_categories: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      create_household_with_defaults: {
        Args: { p_name: string }
        Returns: string
      }
      delete_category_with_fallback: {
        Args: { p_category_id: string; p_fallback_id: string }
        Returns: undefined
      }
      generate_invite_code: {
        Args: { p_household_id: string }
        Returns: string
      }
      get_my_household_id: { Args: never; Returns: string }
      get_recurring_recommendations: {
        Args: never
        Returns: {
          completion_count: number
          days_since_last: number
          last_completed_at: string
          latest_category_id: string
          latest_memo: string
          latest_title: string
          median_interval_days: number
          normalized_title: string
        }[]
      }
      join_household_with_code: { Args: { p_code: string }; Returns: string }
      record_staple_usage: {
        Args: { p_item_id: string }
        Returns: {
          last_used_at: string
          use_count: number
        }[]
      }
      reorder_categories: {
        Args: { p_category_ids: string[]; p_sort_orders: number[] }
        Returns: undefined
      }
      reorder_staple_items: {
        Args: { p_item_ids: string[]; p_sort_orders: number[] }
        Returns: undefined
      }
      reorder_tasks: {
        Args: { p_sort_orders: number[]; p_task_ids: string[] }
        Returns: undefined
      }
      verify_invite_code: { Args: { p_code: string }; Returns: string }
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
