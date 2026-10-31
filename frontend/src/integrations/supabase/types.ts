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
      app_settings: {
        Row: {
          alerts_email: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          notification_template_agent: string | null
          notification_template_student: string | null
          updated_at: string
          value: string | null
          warning_delay_days: number | null
        }
        Insert: {
          alerts_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          notification_template_agent?: string | null
          notification_template_student?: string | null
          updated_at?: string
          value?: string | null
          warning_delay_days?: number | null
        }
        Update: {
          alerts_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          notification_template_agent?: string | null
          notification_template_student?: string | null
          updated_at?: string
          value?: string | null
          warning_delay_days?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          performed_by: string | null
          route: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          route?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          route?: string | null
        }
        Relationships: []
      }
      chronologies: {
        Row: {
          blocked_reason: string | null
          comment: string | null
          completed_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          milestone_id: string
          performed_by: string | null
          started_at: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          blocked_reason?: string | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          milestone_id: string
          performed_by?: string | null
          started_at?: string | null
          status?: string
          ticket_id: string
        }
        Update: {
          blocked_reason?: string | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          milestone_id?: string
          performed_by?: string | null
          started_at?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chronologies_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronologies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      departements: {
        Row: {
          chef_professor_id: string | null
          created_at: string
          departement_name: string
          id: string
        }
        Insert: {
          chef_professor_id?: string | null
          created_at?: string
          departement_name: string
          id?: string
        }
        Update: {
          chef_professor_id?: string | null
          created_at?: string
          departement_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_departements_chef_professor"
            columns: ["chef_professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          file_url: string | null
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["document_status"]
          ticket_id: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          ticket_id: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          ticket_id?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_types: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      formations: {
        Row: {
          contact_professor_id: string | null
          created_at: string
          description: string | null
          formation_name: string
          formation_type_id: string
          id: string
          professor_responsible_id: string
        }
        Insert: {
          contact_professor_id?: string | null
          created_at?: string
          description?: string | null
          formation_name: string
          formation_type_id: string
          id?: string
          professor_responsible_id: string
        }
        Update: {
          contact_professor_id?: string | null
          created_at?: string
          description?: string | null
          formation_name?: string
          formation_type_id?: string
          id?: string
          professor_responsible_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formations_contact_professor_id_fkey"
            columns: ["contact_professor_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_formation_type_id_fkey"
            columns: ["formation_type_id"]
            isOneToOne: false
            referencedRelation: "formation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formations_professor_responsible_id_fkey"
            columns: ["professor_responsible_id"]
            isOneToOne: false
            referencedRelation: "professors"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          code: Database["public"]["Enums"]["ticket_status"]
          created_at: string
          delai_max: number
          description: string | null
          id: string
          is_terminal: boolean | null
          label: string
          ordre: number
        }
        Insert: {
          code: Database["public"]["Enums"]["ticket_status"]
          created_at?: string
          delai_max?: number
          description?: string | null
          id?: string
          is_terminal?: boolean | null
          label: string
          ordre: number
        }
        Update: {
          code?: Database["public"]["Enums"]["ticket_status"]
          created_at?: string
          delai_max?: number
          description?: string | null
          id?: string
          is_terminal?: boolean | null
          label?: string
          ordre?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          ticket_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          ticket_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          ticket_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      professors: {
        Row: {
          created_at: string
          departement_id: string | null
          email: string | null
          first_name: string
          grade_id: string | null
          id: string
          last_name: string
          phone: string | null
          speciality: string | null
        }
        Insert: {
          created_at?: string
          departement_id?: string | null
          email?: string | null
          first_name: string
          grade_id?: string | null
          id?: string
          last_name: string
          phone?: string | null
          speciality?: string | null
        }
        Update: {
          created_at?: string
          departement_id?: string | null
          email?: string | null
          first_name?: string
          grade_id?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          speciality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professors_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professors_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          must_reset_password: boolean | null
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          must_reset_password?: boolean | null
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          must_reset_password?: boolean | null
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          academic_year: string
          created_at: string
          email: string
          formation_id: number | null
          id: number
          last_name: string
          num_apogee: string
          phone: string | null
          first_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          email: string
          formation_id?: number | null
          id?: number
          last_name: string
          num_apogee: string
          phone?: string | null
          first_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          email?: string
          formation_id?: number | null
          id?: number
          last_name?: string
          num_apogee?: string
          phone?: string | null
          first_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_milestone_history: {
        Row: {
          changed_at: string
          changed_by: string
          from_milestone_id: string | null
          id: string
          notes: string | null
          ticket_id: string
          to_milestone_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_milestone_id?: string | null
          id?: string
          notes?: string | null
          ticket_id: string
          to_milestone_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_milestone_id?: string | null
          id?: string
          notes?: string | null
          ticket_id?: string
          to_milestone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_milestone_history_from_milestone_id_fkey"
            columns: ["from_milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_milestone_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_milestone_history_to_milestone_id_fkey"
            columns: ["to_milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          current_milestone_id: string | null
          id: string
          reference: string
          status: Database["public"]["Enums"]["ticket_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_milestone_id?: string | null
          id?: string
          reference: string
          status?: Database["public"]["Enums"]["ticket_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_milestone_id?: string | null
          id?: string
          reference?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_current_milestone_id_fkey"
            columns: ["current_milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      get_days_in_current_milestone: {
        Args: { p_ticket_id: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "agent" | "admin"
      document_status: "PENDING" | "VALIDATED" | "REJECTED"
      document_type:
        | "BAC"
        | "BAC_PLUS_2"
        | "CIN"
        | "CONTRAT"
        | "RECU_PAIEMENT"
        | "RETOUR_CFC"
        | "PV_DIPLOME"
        | "ATTESTATION_INSC"
      formation_type: "LUS" | "MUS"
      ticket_status:
        | "CREATED"
        | "DOSSIER_EN_COURS"
        | "PIECES_COMPLETES"
        | "VALIDATION_CFC"
        | "ENVOYE_DEPARTEMENT_DIPLOMES"
        | "EN_ATTENTE_REPONSE"
        | "REPONSE_RECUE"
        | "DOSSIER_CLOTURE"
        | "BLOQUE_PIECE_MANQUANTE"
        | "REJETE"
        | "ARCHIVE"
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
      app_role: ["student", "agent", "admin"],
      document_status: ["PENDING", "VALIDATED", "REJECTED"],
      document_type: [
        "BAC",
        "BAC_PLUS_2",
        "CIN",
        "CONTRAT",
        "RECU_PAIEMENT",
        "RETOUR_CFC",
        "PV_DIPLOME",
        "ATTESTATION_INSC",
      ],
      formation_type: ["LUS", "MUS"],
      ticket_status: [
        "CREATED",
        "DOSSIER_EN_COURS",
        "PIECES_COMPLETES",
        "VALIDATION_CFC",
        "ENVOYE_DEPARTEMENT_DIPLOMES",
        "EN_ATTENTE_REPONSE",
        "REPONSE_RECUE",
        "DOSSIER_CLOTURE",
        "BLOQUE_PIECE_MANQUANTE",
        "REJETE",
        "ARCHIVE",
      ],
    },
  },
} as const
