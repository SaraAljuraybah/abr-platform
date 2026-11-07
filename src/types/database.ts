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
      interest_signups: {
        Row: {
          consent_at: string
          consent_contact: boolean
          consent_version: string
          created_at: string
          email: string
          experience: string | null
          expertise: string | null
          field_of_study: string | null
          field_of_study_other: string | null
          full_name: string
          graduation_year: string | null
          heard_from: string
          heard_from_other: string | null
          id: string
          locale: string
          looking_for: string[] | null
          org_size: string | null
          organization_name: string | null
          project_stage: string | null
          role: string
          sector: string | null
          submission_count: number
          university_code: string | null
          university_other: string | null
          updated_at: string
        }
        Insert: {
          consent_at?: string
          consent_contact: boolean
          consent_version: string
          created_at?: string
          email: string
          experience?: string | null
          expertise?: string | null
          field_of_study?: string | null
          field_of_study_other?: string | null
          full_name: string
          graduation_year?: string | null
          heard_from: string
          heard_from_other?: string | null
          id?: string
          locale: string
          looking_for?: string[] | null
          org_size?: string | null
          organization_name?: string | null
          project_stage?: string | null
          role: string
          sector?: string | null
          submission_count?: number
          university_code?: string | null
          university_other?: string | null
          updated_at?: string
        }
        Update: {
          consent_at?: string
          consent_contact?: boolean
          consent_version?: string
          created_at?: string
          email?: string
          experience?: string | null
          expertise?: string | null
          field_of_study?: string | null
          field_of_study_other?: string | null
          full_name?: string
          graduation_year?: string | null
          heard_from?: string
          heard_from_other?: string | null
          id?: string
          locale?: string
          looking_for?: string[] | null
          org_size?: string | null
          organization_name?: string | null
          project_stage?: string | null
          role?: string
          sector?: string | null
          submission_count?: number
          university_code?: string | null
          university_other?: string | null
          updated_at?: string
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
          onboarding_step: number
          privacy_accepted_at: string | null
          privacy_version: string | null
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string | null
          terms_version: string | null
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
          onboarding_step?: number
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          terms_version?: string | null
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
          onboarding_step?: number
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          member_role: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_role: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_role?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reviews: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          id: string
          notes: string | null
          project_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["review_decision"]
          id?: string
          notes?: string | null
          project_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          id?: string
          notes?: string | null
          project_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          academic_year: string | null
          created_at: string
          demo_url: string | null
          description: string | null
          document_path: string | null
          id: string
          image_path: string | null
          looking_for_members: boolean
          needs: string[]
          owner_id: string
          published_at: string | null
          repo_url: string | null
          sectors: string[]
          stage: string | null
          status: Database["public"]["Enums"]["project_status"]
          submitted_at: string | null
          summary: string | null
          team_size: number
          title: string
          track: string | null
          university_id: string
          updated_at: string
          video_url: string | null
          wanted_specializations: string[]
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          document_path?: string | null
          id?: string
          image_path?: string | null
          looking_for_members?: boolean
          needs?: string[]
          owner_id: string
          published_at?: string | null
          repo_url?: string | null
          sectors?: string[]
          stage?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          submitted_at?: string | null
          summary?: string | null
          team_size?: number
          title: string
          track?: string | null
          university_id: string
          updated_at?: string
          video_url?: string | null
          wanted_specializations?: string[]
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          document_path?: string | null
          id?: string
          image_path?: string | null
          looking_for_members?: boolean
          needs?: string[]
          owner_id?: string
          published_at?: string | null
          repo_url?: string | null
          sectors?: string[]
          stage?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          submitted_at?: string | null
          summary?: string | null
          team_size?: number
          title?: string
          track?: string | null
          university_id?: string
          updated_at?: string
          video_url?: string | null
          wanted_specializations?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          academic_level: string | null
          created_at: string
          github_url: string | null
          graduation_year: string | null
          interests: string[]
          major: string | null
          major_other: string | null
          skills: string[]
          university_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_level?: string | null
          created_at?: string
          github_url?: string | null
          graduation_year?: string | null
          interests?: string[]
          major?: string | null
          major_other?: string | null
          skills?: string[]
          university_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_level?: string | null
          created_at?: string
          github_url?: string | null
          graduation_year?: string | null
          interests?: string[]
          major?: string | null
          major_other?: string | null
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
      admin_project_counts: {
        Args: never
        Returns: {
          count: number
          status: Database["public"]["Enums"]["project_status"]
        }[]
      }
      admin_project_reviews: {
        Args: { p_project_id: string }
        Returns: {
          created_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          id: string
          notes: string
          reviewer_name: string
        }[]
      }
      check_student_email: {
        Args: { p_email: string; p_university_id: string }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_key: string
          p_max: number
          p_window: string
        }
        Returns: boolean
      }
      create_project: { Args: { p_title: string }; Returns: string }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_project: { Args: { p_project_id: string }; Returns: undefined }
      get_interest_stats: {
        Args: never
        Returns: {
          count: number
          dimension: string
          value: string
        }[]
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
      review_project: {
        Args: {
          p_decision: Database["public"]["Enums"]["review_decision"]
          p_notes?: string
          p_project_id: string
        }
        Returns: string
      }
      review_verification: {
        Args: {
          p_decision: Database["public"]["Enums"]["review_decision"]
          p_reason?: string
          p_subject_id: string
        }
        Returns: string
      }
      submit_interest: { Args: { p_payload: Json }; Returns: undefined }
      submit_project: { Args: { p_project_id: string }; Returns: undefined }
      update_my_contact: {
        Args: {
          p_linkedin_url: string
          p_phone: string
          p_share_linkedin: boolean
          p_share_phone: boolean
        }
        Returns: undefined
      }
      withdraw_submission: {
        Args: { p_project_id: string }
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

