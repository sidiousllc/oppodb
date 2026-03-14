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
      candidate_profiles: {
        Row: {
          content: string
          created_at: string
          github_path: string
          id: string
          is_subpage: boolean
          name: string
          parent_slug: string | null
          slug: string
          subpage_title: string | null
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          github_path: string
          id?: string
          is_subpage?: boolean
          name: string
          parent_slug?: string | null
          slug: string
          subpage_title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          github_path?: string
          id?: string
          is_subpage?: boolean
          name?: string
          parent_slug?: string | null
          slug?: string
          subpage_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      candidate_versions: {
        Row: {
          author: string
          commit_date: string
          commit_message: string
          commit_sha: string
          content: string
          created_at: string
          github_path: string
          id: string
        }
        Insert: {
          author?: string
          commit_date: string
          commit_message?: string
          commit_sha: string
          content?: string
          created_at?: string
          github_path: string
          id?: string
        }
        Update: {
          author?: string
          commit_date?: string
          commit_message?: string
          commit_sha?: string
          content?: string
          created_at?: string
          github_path?: string
          id?: string
        }
        Relationships: []
      }
      district_profiles: {
        Row: {
          asian_pct: number | null
          avg_household_size: number | null
          black_pct: number | null
          created_at: string
          district_id: string
          education_bachelor_pct: number | null
          foreign_born_pct: number | null
          hispanic_pct: number | null
          id: string
          median_age: number | null
          median_home_value: number | null
          median_income: number | null
          median_rent: number | null
          owner_occupied_pct: number | null
          population: number | null
          poverty_rate: number | null
          raw_data: Json | null
          state: string
          top_issues: string[]
          total_households: number | null
          unemployment_rate: number | null
          uninsured_pct: number | null
          updated_at: string
          veteran_pct: number | null
          voting_patterns: Json | null
          white_pct: number | null
        }
        Insert: {
          asian_pct?: number | null
          avg_household_size?: number | null
          black_pct?: number | null
          created_at?: string
          district_id: string
          education_bachelor_pct?: number | null
          foreign_born_pct?: number | null
          hispanic_pct?: number | null
          id?: string
          median_age?: number | null
          median_home_value?: number | null
          median_income?: number | null
          median_rent?: number | null
          owner_occupied_pct?: number | null
          population?: number | null
          poverty_rate?: number | null
          raw_data?: Json | null
          state?: string
          top_issues?: string[]
          total_households?: number | null
          unemployment_rate?: number | null
          uninsured_pct?: number | null
          updated_at?: string
          veteran_pct?: number | null
          voting_patterns?: Json | null
          white_pct?: number | null
        }
        Update: {
          asian_pct?: number | null
          avg_household_size?: number | null
          black_pct?: number | null
          created_at?: string
          district_id?: string
          education_bachelor_pct?: number | null
          foreign_born_pct?: number | null
          hispanic_pct?: number | null
          id?: string
          median_age?: number | null
          median_home_value?: number | null
          median_income?: number | null
          median_rent?: number | null
          owner_occupied_pct?: number | null
          population?: number | null
          poverty_rate?: number | null
          raw_data?: Json | null
          state?: string
          top_issues?: string[]
          total_households?: number | null
          unemployment_rate?: number | null
          uninsured_pct?: number | null
          updated_at?: string
          veteran_pct?: number | null
          voting_patterns?: Json | null
          white_pct?: number | null
        }
        Relationships: []
      }
      local_impacts: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          state: string
          summary: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slug: string
          state: string
          summary?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          state?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      maga_files: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      narrative_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      polling_data: {
        Row: {
          approve_pct: number | null
          candidate_or_topic: string
          created_at: string
          date_conducted: string
          disapprove_pct: number | null
          end_date: string | null
          favor_pct: number | null
          id: string
          margin: number | null
          margin_of_error: number | null
          methodology: string | null
          oppose_pct: number | null
          partisan_lean: string | null
          poll_type: string
          question: string | null
          raw_data: Json | null
          sample_size: number | null
          sample_type: string | null
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          approve_pct?: number | null
          candidate_or_topic: string
          created_at?: string
          date_conducted: string
          disapprove_pct?: number | null
          end_date?: string | null
          favor_pct?: number | null
          id?: string
          margin?: number | null
          margin_of_error?: number | null
          methodology?: string | null
          oppose_pct?: number | null
          partisan_lean?: string | null
          poll_type?: string
          question?: string | null
          raw_data?: Json | null
          sample_size?: number | null
          sample_type?: string | null
          source: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          approve_pct?: number | null
          candidate_or_topic?: string
          created_at?: string
          date_conducted?: string
          disapprove_pct?: number | null
          end_date?: string | null
          favor_pct?: number | null
          id?: string
          margin?: number | null
          margin_of_error?: number | null
          methodology?: string | null
          oppose_pct?: number | null
          partisan_lean?: string | null
          poll_type?: string
          question?: string | null
          raw_data?: Json | null
          sample_size?: number | null
          sample_type?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_metadata: {
        Row: {
          id: number
          last_commit_sha: string | null
          last_synced_at: string | null
        }
        Insert: {
          id?: number
          last_commit_sha?: string | null
          last_synced_at?: string | null
        }
        Update: {
          id?: number
          last_commit_sha?: string | null
          last_synced_at?: string | null
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
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
      app_role: ["admin", "user", "moderator"],
    },
  },
} as const
