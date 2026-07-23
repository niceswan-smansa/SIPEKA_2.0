export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      auth_rate_limit_buckets: {
        Row: {
          attempt_count: number;
          expires_at: string;
          key_hash: string;
          scope: string;
          window_started_at: string;
        };
        Insert: {
          attempt_count: number;
          expires_at: string;
          key_hash: string;
          scope: string;
          window_started_at: string;
        };
        Update: {
          attempt_count?: number;
          expires_at?: string;
          key_hash?: string;
          scope?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
      academic_years: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          is_active: boolean;
          name: string;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          is_active?: boolean;
          name: string;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance_batches: {
        Row: {
          attendance_date: string;
          class_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          request_id: string;
          status: Database["public"]["Enums"]["batch_status"];
          summary: Json;
        };
        Insert: {
          attendance_date: string;
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          request_id: string;
          status?: Database["public"]["Enums"]["batch_status"];
          summary?: Json;
        };
        Update: {
          attendance_date?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          request_id?: string;
          status?: Database["public"]["Enums"]["batch_status"];
          summary?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_batches_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_preview_tokens: {
        Row: {
          actor_id: string;
          attendance_date: string;
          class_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          payload_hash: string;
          snapshot_hash: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          actor_id: string;
          attendance_date: string;
          class_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          payload_hash: string;
          snapshot_hash: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          actor_id?: string;
          attendance_date?: string;
          class_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload_hash?: string;
          snapshot_hash?: string;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_preview_tokens_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_preview_tokens_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          attendance_date: string;
          class_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          period_number: number;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          attendance_date: string;
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          period_number: number;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          attendance_date?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          period_number?: number;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_period_number_fkey";
            columns: ["period_number"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["number"];
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_revisions: {
        Row: {
          actor_id: string | null;
          after_data: Json | null;
          attendance_id: string | null;
          before_data: Json | null;
          created_at: string;
          id: string;
          operation: Database["public"]["Enums"]["revision_operation"];
          request_id: string;
          student_id: string;
        };
        Insert: {
          actor_id?: string | null;
          after_data?: Json | null;
          attendance_id?: string | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          operation: Database["public"]["Enums"]["revision_operation"];
          request_id: string;
          student_id: string;
        };
        Update: {
          actor_id?: string | null;
          after_data?: Json | null;
          attendance_id?: string | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          operation?: Database["public"]["Enums"]["revision_operation"];
          request_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_revisions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_revisions_attendance_id_fkey";
            columns: ["attendance_id"];
            isOneToOne: false;
            referencedRelation: "attendance_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_revisions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name_snapshot: string;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          request_id: string;
          scope: Database["public"]["Enums"]["audit_scope"];
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name_snapshot: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          request_id?: string;
          scope: Database["public"]["Enums"]["audit_scope"];
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name_snapshot?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          request_id?: string;
          scope?: Database["public"]["Enums"]["audit_scope"];
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          academic_year_id: string;
          class_number: number;
          created_at: string;
          grade: Database["public"]["Enums"]["grade_level"];
          homeroom_teacher: string | null;
          id: string;
          is_active: boolean;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          academic_year_id: string;
          class_number: number;
          created_at?: string;
          grade: Database["public"]["Enums"]["grade_level"];
          homeroom_teacher?: string | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string;
          class_number?: number;
          created_at?: string;
          grade?: Database["public"]["Enums"]["grade_level"];
          homeroom_teacher?: string | null;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          file_name: string;
          id: string;
          row_count: number;
          status: Database["public"]["Enums"]["batch_status"];
          summary: Json;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          file_name: string;
          id?: string;
          row_count: number;
          status?: Database["public"]["Enums"]["batch_status"];
          summary?: Json;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_name?: string;
          id?: string;
          row_count?: number;
          status?: Database["public"]["Enums"]["batch_status"];
          summary?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      periods: {
        Row: {
          is_active: boolean;
          label: string;
          number: number;
        };
        Insert: {
          is_active?: boolean;
          label: string;
          number: number;
        };
        Update: {
          is_active?: boolean;
          label?: string;
          number?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          last_login_at: string | null;
          must_change_password: boolean;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          id: string;
          is_active?: boolean;
          last_login_at?: string | null;
          must_change_password?: boolean;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          must_change_password?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      promotion_batch_items: {
        Row: {
          after_class_id: string | null;
          after_enrollment_id: string | null;
          after_grade: Database["public"]["Enums"]["grade_level"];
          batch_id: string;
          before_class_id: string | null;
          before_enrollment_id: string | null;
          before_grade: Database["public"]["Enums"]["grade_level"];
          student_id: string;
        };
        Insert: {
          after_class_id?: string | null;
          after_enrollment_id?: string | null;
          after_grade: Database["public"]["Enums"]["grade_level"];
          batch_id: string;
          before_class_id?: string | null;
          before_enrollment_id?: string | null;
          before_grade: Database["public"]["Enums"]["grade_level"];
          student_id: string;
        };
        Update: {
          after_class_id?: string | null;
          after_enrollment_id?: string | null;
          after_grade?: Database["public"]["Enums"]["grade_level"];
          batch_id?: string;
          before_class_id?: string | null;
          before_enrollment_id?: string | null;
          before_grade?: Database["public"]["Enums"]["grade_level"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_batch_items_after_class_id_fkey";
            columns: ["after_class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batch_items_after_enrollment_id_fkey";
            columns: ["after_enrollment_id"];
            isOneToOne: false;
            referencedRelation: "student_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batch_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "promotion_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batch_items_before_class_id_fkey";
            columns: ["before_class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batch_items_before_enrollment_id_fkey";
            columns: ["before_enrollment_id"];
            isOneToOne: false;
            referencedRelation: "student_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batch_items_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      promotion_batches: {
        Row: {
          created_at: string;
          created_by: string | null;
          from_academic_year_id: string;
          id: string;
          reverted_at: string | null;
          reverted_by: string | null;
          status: Database["public"]["Enums"]["batch_status"];
          to_academic_year_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          from_academic_year_id: string;
          id?: string;
          reverted_at?: string | null;
          reverted_by?: string | null;
          status?: Database["public"]["Enums"]["batch_status"];
          to_academic_year_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          from_academic_year_id?: string;
          id?: string;
          reverted_at?: string | null;
          reverted_by?: string | null;
          status?: Database["public"]["Enums"]["batch_status"];
          to_academic_year_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batches_from_academic_year_id_fkey";
            columns: ["from_academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batches_reverted_by_fkey";
            columns: ["reverted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_batches_to_academic_year_id_fkey";
            columns: ["to_academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
        ];
      };
      student_enrollments: {
        Row: {
          academic_year_id: string;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          ended_on: string | null;
          grade: Database["public"]["Enums"]["grade_level"];
          id: string;
          is_current: boolean;
          started_on: string;
          student_id: string;
        };
        Insert: {
          academic_year_id: string;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          ended_on?: string | null;
          grade: Database["public"]["Enums"]["grade_level"];
          id?: string;
          is_current?: boolean;
          started_on: string;
          student_id: string;
        };
        Update: {
          academic_year_id?: string;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          ended_on?: string | null;
          grade?: Database["public"]["Enums"]["grade_level"];
          id?: string;
          is_current?: boolean;
          started_on?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_enrollments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          current_class_id: string | null;
          current_grade: Database["public"]["Enums"]["grade_level"];
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
          graduation_year: number | null;
          id: string;
          is_active: boolean;
          nis: string | null;
          nisn: string | null;
          normalized_name: string;
          updated_at: string;
          updated_by: string | null;
          year_entered: number | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_class_id?: string | null;
          current_grade: Database["public"]["Enums"]["grade_level"];
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
          graduation_year?: number | null;
          id?: string;
          is_active?: boolean;
          nis?: string | null;
          nisn?: string | null;
          normalized_name: string;
          updated_at?: string;
          updated_by?: string | null;
          year_entered?: number | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_class_id?: string | null;
          current_grade?: Database["public"]["Enums"]["grade_level"];
          full_name?: string;
          gender?: Database["public"]["Enums"]["gender"];
          graduation_year?: number | null;
          id?: string;
          is_active?: boolean;
          nis?: string | null;
          nisn?: string | null;
          normalized_name?: string;
          updated_at?: string;
          updated_by?: string | null;
          year_entered?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_current_class_id_fkey";
            columns: ["current_class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_auth_rate_limit: {
        Args: {
          p_key_hash: string;
          p_limit: number;
          p_scope: string;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      admin_create_account_profile: {
        Args: {
          p_actor_id: string;
          p_email: string;
          p_full_name: string;
          p_is_active: boolean;
          p_must_change_password: boolean;
          p_request_id?: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_target_id: string;
          p_username: string;
        };
        Returns: Json;
      };
      admin_mark_account_password_reset: {
        Args: { p_actor_id: string; p_request_id?: string; p_target_id: string };
        Returns: Json;
      };
      admin_tombstone_account: {
        Args: {
          p_actor_id: string;
          p_request_id?: string;
          p_target_id: string;
          p_tombstone_username: string;
        };
        Returns: Json;
      };
      admin_update_account_profile: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_email: string;
          p_full_name: string;
          p_is_active: boolean;
          p_request_id?: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_target_id: string;
          p_username: string;
        };
        Returns: Json;
      };
      complete_password_change: { Args: never; Returns: undefined };
      phase10_get_student_report: {
        Args: { p_end_date: string; p_start_date: string; p_student_id: string };
        Returns: Json;
      };
      phase10_list_classes: {
        Args: {
          p_academic_year_id?: string;
          p_grade?: Database["public"]["Enums"]["grade_level"];
        };
        Returns: {
          academic_year_active: boolean;
          academic_year_id: string;
          academic_year_name: string;
          active_student_count: number;
          class_number: number;
          grade: Database["public"]["Enums"]["grade_level"];
          homeroom_teacher: string | null;
          id: string;
          is_active: boolean;
          notes: string | null;
        }[];
      };
      phase10_preview_promotion: {
        Args: { p_to_academic_year_id: string };
        Returns: Json;
      };
      phase3_activate_academic_year: {
        Args: { p_id: string; p_request_id?: string };
        Returns: Json;
      };
      phase3_change_student_academic: {
        Args: {
          p_class_id: string;
          p_grade: Database["public"]["Enums"]["grade_level"];
          p_id: string;
          p_is_active: boolean;
          p_request_id?: string;
        };
        Returns: Json;
      };
      phase3_create_academic_year: {
        Args: {
          p_end_date: string;
          p_is_active?: boolean;
          p_name: string;
          p_request_id?: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      phase3_create_student: {
        Args: {
          p_class_id: string;
          p_full_name: string;
          p_gender: Database["public"]["Enums"]["gender"];
          p_grade: Database["public"]["Enums"]["grade_level"];
          p_is_active?: boolean;
          p_nis: string;
          p_nisn: string;
          p_request_id?: string;
          p_year_entered: number;
        };
        Returns: Json;
      };
      phase3_search_students: {
        Args: {
          p_class_id?: string;
          p_grade?: Database["public"]["Enums"]["grade_level"];
          p_is_active?: boolean;
          p_page?: number;
          p_page_size?: number;
          p_search?: string;
          p_year_entered?: number;
        };
        Returns: Json;
      };
      phase3_update_academic_year: {
        Args: {
          p_end_date: string;
          p_id: string;
          p_name: string;
          p_request_id?: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      phase3_update_class: {
        Args: {
          p_homeroom_teacher: string;
          p_id: string;
          p_is_active: boolean;
          p_notes: string;
          p_request_id?: string;
        };
        Returns: Json;
      };
      phase3_update_student_identity: {
        Args: {
          p_full_name: string;
          p_gender: Database["public"]["Enums"]["gender"];
          p_id: string;
          p_nis: string;
          p_nisn: string;
          p_request_id?: string;
          p_year_entered: number;
        };
        Returns: Json;
      };
      phase4_apply_attendance: {
        Args: {
          p_attendance_date: string;
          p_class_id: string;
          p_payload: Json;
          p_request_id?: string;
          p_token: string;
        };
        Returns: Json;
      };
      phase4_get_class_attendance: {
        Args: {
          p_attendance_date: string;
          p_class_id: string;
          p_search?: string;
        };
        Returns: Json;
      };
      phase4_preview_attendance: {
        Args: {
          p_attendance_date: string;
          p_class_id: string;
          p_payload: Json;
          p_request_id?: string;
        };
        Returns: Json;
      };
      phase5_get_dashboard: { Args: { p_selected_date: string }; Returns: Json };
      phase6_get_student_attendance: {
        Args: { p_month: string; p_selected_date: string; p_student_id: string };
        Returns: Json;
      };
      phase6_get_student_report: {
        Args: { p_end_date: string; p_start_date: string; p_student_id: string };
        Returns: Json;
      };
      phase6_record_student_export: {
        Args: {
          p_end_date: string;
          p_request_id?: string;
          p_row_count: number;
          p_start_date: string;
          p_student_id: string;
        };
        Returns: undefined;
      };
      phase7_archive_alumni: {
        Args: { p_request_id?: string; p_student_id: string };
        Returns: Json;
      };
      phase7_import_students: {
        Args: {
          p_class_id: string;
          p_file_name: string;
          p_request_id?: string;
          p_rows: Json;
          p_year_entered: number;
        };
        Returns: Json;
      };
      phase7_promote_academic_year: {
        Args: { p_request_id?: string; p_to_academic_year_id: string };
        Returns: Json;
      };
      phase7_rollback_promotion: {
        Args: { p_batch_id: string; p_request_id?: string };
        Returns: Json;
      };
      phase7_tombstone_alumni: {
        Args: { p_request_id?: string; p_student_id: string };
        Returns: Json;
      };
      phase9_import_existing_students: {
        Args: { p_batch_key: string; p_rows: Json };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "USER";
      attendance_status: "IZIN" | "SAKIT" | "TANPA_KETERANGAN";
      audit_scope: "OPERATIONAL" | "ACCOUNT";
      batch_status: "PREVIEWED" | "COMPLETED" | "REVERTED" | "FAILED";
      gender: "L" | "P";
      grade_level: "X" | "XI" | "XII" | "ALUMNI";
      revision_operation: "CREATE" | "UPDATE" | "DELETE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["SUPER_ADMIN", "ADMIN", "USER"],
      attendance_status: ["IZIN", "SAKIT", "TANPA_KETERANGAN"],
      audit_scope: ["OPERATIONAL", "ACCOUNT"],
      batch_status: ["PREVIEWED", "COMPLETED", "REVERTED", "FAILED"],
      gender: ["L", "P"],
      grade_level: ["X", "XI", "XII", "ALUMNI"],
      revision_operation: ["CREATE", "UPDATE", "DELETE"],
    },
  },
} as const;
