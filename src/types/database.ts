export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      mentor_profiles: {
        Row: {
          company: string | null
          created_at: string
          expertise: string[]
          job_title: string | null
          professional_summary: string | null
          updated_at: string
          user_id: string
          years_of_experience: number | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          expertise?: string[]
          job_title?: string | null
          professional_summary?: string | null
          updated_at?: string
          user_id: string
          years_of_experience?: number | null
        }
        Update: {
          company?: string | null
          created_at?: string
          expertise?: string[]
          job_title?: string | null
          professional_summary?: string | null
          updated_at?: string
          user_id?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          created_at: string
          description: string | null
          logo_path: string | null
          organization_name: string | null
          support_types: string[]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          logo_path?: string | null
          organization_name?: string | null
          support_types?: string[]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          logo_path?: string | null
          organization_name?: string | null
          support_types?: string[]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarding_completed: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          academic_level: string | null
          created_at: string
          github_url: string | null
          interests: string[]
          major: string | null
          skills: string[]
          university_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_level?: string | null
          created_at?: string
          github_url?: string | null
          interests?: string[]
          major?: string | null
          skills?: string[]
          university_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_level?: string | null
          created_at?: string
          github_url?: string | null
          interests?: string[]
          major?: string | null
          skills?: string[]
          university_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      university_email_domains: {
        Row: {
          active: boolean
          created_at: string
          domain: string
          id: string
          university_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain: string
          id?: string
          university_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domain?: string
          id?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_email_domains_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_requests: {
        Row: {
          created_at: string
          email_domain: string
          id: string
          requested_name: string
          requester_email: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_domain: string
          id?: string
          requested_name: string
          requester_email: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_domain?: string
          id?: string
          requested_name?: string
          requester_email?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      verification_reviews: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          id: string
          reason: string | null
          reviewer_id: string
          subject_id: string
          subject_role: Database["public"]["Enums"]["user_role"]
          submitted_snapshot: Json
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["review_decision"]
          id?: string
          reason?: string | null
          reviewer_id: string
          subject_id: string
          subject_role: Database["public"]["Enums"]["user_role"]
          submitted_snapshot?: Json
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          id?: string
          reason?: string | null
          reviewer_id?: string
          subject_id?: string
          subject_role?: Database["public"]["Enums"]["user_role"]
          submitted_snapshot?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_student_email: {
        Args: { p_email: string; p_university_id: string }
        Returns: boolean
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_my_contact: {
        Args: never
        Returns: {
          contact_email: string
          contact_email_verified_at: string
          linkedin_url: string
          pending_contact_email: string
          phone: string
          share_linkedin: boolean
          share_phone: boolean
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_verified: { Args: never; Returns: boolean }
      resubmit_verification: { Args: never; Returns: undefined }
      review_verification: {
        Args: {
          p_decision: Database["public"]["Enums"]["review_decision"]
          p_reason?: string
          p_subject_id: string
        }
        Returns: string
      }
      update_my_contact: {
        Args: {
          p_linkedin_url: string
          p_phone: string
          p_share_linkedin: boolean
          p_share_phone: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      project_status:
        | "draft"
        | "pending_review"
        | "changes_requested"
        | "published"
        | "rejected"
        | "unpublished"
      request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "cancelled"
        | "expired"
      request_type:
        | "team_invitation"
        | "join_request"
        | "position_application"
        | "org_project_request"
        | "mentor_invitation"
        | "mentorship_request"
      review_decision: "approved" | "changes_requested" | "rejected"
      user_role: "student" | "organization" | "mentor" | "admin"
      verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
        | "suspended"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      project_status: [
        "draft",
        "pending_review",
        "changes_requested",
        "published",
        "rejected",
        "unpublished",
      ],
      request_status: [
        "pending",
        "accepted",
        "declined",
        "withdrawn",
        "cancelled",
        "expired",
      ],
      request_type: [
        "team_invitation",
        "join_request",
        "position_application",
        "org_project_request",
        "mentor_invitation",
        "mentorship_request",
      ],
      review_decision: ["approved", "changes_requested", "rejected"],
      user_role: ["student", "organization", "mentor", "admin"],
      verification_status: [
        "unverified",
        "pending",
        "verified",
        "rejected",
        "suspended",
      ],
    },
  },
} as const

