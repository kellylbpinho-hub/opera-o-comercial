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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          is_kapazi_allowed: boolean | null
          name: string
          priority: string
          region_id: string
          uf: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_kapazi_allowed?: boolean | null
          name: string
          priority: string
          region_id: string
          uf?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_kapazi_allowed?: boolean | null
          name?: string
          priority?: string
          region_id?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          category: string
          channel: string | null
          city_id: string | null
          city_name: string | null
          company_name: string
          company_name_normalized: string | null
          contact_name: string | null
          created_at: string
          days_without_buying: number | null
          deleted_at: string | null
          id: string
          industry_id: string
          industry_mode_id: string | null
          instagram: string | null
          last_order_date: string | null
          neighborhood: string | null
          niche: string | null
          notes: string | null
          owner_user_id: string | null
          phone_normalized: string | null
          phone_raw: string | null
          region_name: string | null
          source: string | null
          status: string
          uf: string | null
          website: string | null
          whatsapp_link: string | null
        }
        Insert: {
          address?: string | null
          category: string
          channel?: string | null
          city_id?: string | null
          city_name?: string | null
          company_name: string
          company_name_normalized?: string | null
          contact_name?: string | null
          created_at?: string
          days_without_buying?: number | null
          deleted_at?: string | null
          id?: string
          industry_id: string
          industry_mode_id?: string | null
          instagram?: string | null
          last_order_date?: string | null
          neighborhood?: string | null
          niche?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          region_name?: string | null
          source?: string | null
          status?: string
          uf?: string | null
          website?: string | null
          whatsapp_link?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          channel?: string | null
          city_id?: string | null
          city_name?: string | null
          company_name?: string
          company_name_normalized?: string | null
          contact_name?: string | null
          created_at?: string
          days_without_buying?: number | null
          deleted_at?: string | null
          id?: string
          industry_id?: string
          industry_mode_id?: string | null
          instagram?: string | null
          last_order_date?: string | null
          neighborhood?: string | null
          niche?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          region_name?: string | null
          source?: string | null
          status?: string
          uf?: string | null
          website?: string | null
          whatsapp_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_industry_mode_id_fkey"
            columns: ["industry_mode_id"]
            isOneToOne: false
            referencedRelation: "industry_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_batch_items: {
        Row: {
          batch_id: string
          contact_id: string
          created_at: string
          id: string
          lane: string
          order_index: number
        }
        Insert: {
          batch_id: string
          contact_id: string
          created_at?: string
          id?: string
          lane?: string
          order_index?: number
        }
        Update: {
          batch_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          lane?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "daily_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_batch_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_batches: {
        Row: {
          batch_date: string
          city_id: string
          city_name: string | null
          created_at: string
          created_by: string | null
          id: string
          industry_id: string
          industry_mode_id: string | null
          notes: string | null
          target_active: number | null
          target_inactive: number | null
          target_new_maps: number | null
        }
        Insert: {
          batch_date?: string
          city_id: string
          city_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id: string
          industry_mode_id?: string | null
          notes?: string | null
          target_active?: number | null
          target_inactive?: number | null
          target_new_maps?: number | null
        }
        Update: {
          batch_date?: string
          city_id?: string
          city_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry_id?: string
          industry_mode_id?: string | null
          notes?: string | null
          target_active?: number | null
          target_inactive?: number | null
          target_new_maps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_batches_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_batches_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_batches_industry_mode_id_fkey"
            columns: ["industry_mode_id"]
            isOneToOne: false
            referencedRelation: "industry_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          key: string
          name: string
          territory_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          territory_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          territory_type?: string
        }
        Relationships: []
      }
      industry_modes: {
        Row: {
          id: string
          industry_id: string
          is_active: boolean | null
          key: string
          name: string
        }
        Insert: {
          id?: string
          industry_id: string
          is_active?: boolean | null
          key: string
          name: string
        }
        Update: {
          id?: string
          industry_id?: string
          is_active?: boolean | null
          key?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "industry_modes_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          id: string
          message_text: string | null
          next_action_at: string | null
          next_action_type: string | null
          notes: string | null
          outcome: string | null
          reply_at: string | null
          reply_text: string | null
          sent_at: string | null
          stage: string | null
          user_id: string
        }
        Insert: {
          channel: string
          contact_id: string
          created_at?: string
          id?: string
          message_text?: string | null
          next_action_at?: string | null
          next_action_type?: string | null
          notes?: string | null
          outcome?: string | null
          reply_at?: string | null
          reply_text?: string | null
          sent_at?: string | null
          stage?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          id?: string
          message_text?: string | null
          next_action_at?: string | null
          next_action_type?: string | null
          notes?: string | null
          outcome?: string | null
          reply_at?: string | null
          reply_text?: string | null
          sent_at?: string | null
          stage?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string
          created_at: string
          id: string
          industry_id: string
          industry_mode_id: string | null
          is_active: boolean | null
          stage: string
          template_text: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          industry_id: string
          industry_mode_id?: string | null
          is_active?: boolean | null
          stage: string
          template_text: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          industry_id?: string
          industry_mode_id?: string | null
          is_active?: boolean | null
          stage?: string
          template_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_industry_mode_id_fkey"
            columns: ["industry_mode_id"]
            isOneToOne: false
            referencedRelation: "industry_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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
