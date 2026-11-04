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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      canteen_applications: {
        Row: {
          campus_location: string
          canteen_name: string
          contact_email: string
          created_at: string
          fssai_license: string
          id: string
          notes: string | null
          owner_id_proof: string
          owner_name: string
          owner_phone: string
          reviewed_at: string | null
          status: string
          university_name: string
        }
        Insert: {
          campus_location: string
          canteen_name: string
          contact_email: string
          created_at?: string
          fssai_license: string
          id?: string
          notes?: string | null
          owner_id_proof: string
          owner_name: string
          owner_phone: string
          reviewed_at?: string | null
          status?: string
          university_name: string
        }
        Update: {
          campus_location?: string
          canteen_name?: string
          contact_email?: string
          created_at?: string
          fssai_license?: string
          id?: string
          notes?: string | null
          owner_id_proof?: string
          owner_name?: string
          owner_phone?: string
          reviewed_at?: string | null
          status?: string
          university_name?: string
        }
        Relationships: []
      }
      canteen_owner_credentials: {
        Row: {
          canteen_id: string
          code_hash: string
          code_salt: string
          created_at: string
          login_id: string
        }
        Insert: {
          canteen_id: string
          code_hash: string
          code_salt: string
          created_at?: string
          login_id: string
        }
        Update: {
          canteen_id?: string
          code_hash?: string
          code_salt?: string
          created_at?: string
          login_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_owner_credentials_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: true
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_owner_login_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          key_hash: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key_hash: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      canteen_templates: {
        Row: {
          banner_crop_x: number
          banner_crop_y: number
          banner_crop_zoom: number
          banner_image_url: string | null
          canteen_id: string
          description: string
          heading: string
          id: string
          updated_at: string
        }
        Insert: {
          banner_crop_x?: number
          banner_crop_y?: number
          banner_crop_zoom?: number
          banner_image_url?: string | null
          canteen_id: string
          description?: string
          heading?: string
          id?: string
          updated_at?: string
        }
        Update: {
          banner_crop_x?: number
          banner_crop_y?: number
          banner_crop_zoom?: number
          banner_image_url?: string | null
          canteen_id?: string
          description?: string
          heading?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_templates_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: true
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      canteens: {
        Row: {
          application_id: string | null
          availability_mode: string
          campus_location: string
          code: string
          contact_email: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          operating_hours: Json
          owner_user_id: string | null
          timezone: string
          university_name: string
          visibility: string
        }
        Insert: {
          application_id?: string | null
          availability_mode?: string
          campus_location: string
          code: string
          contact_email: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          operating_hours?: Json
          owner_user_id?: string | null
          timezone?: string
          university_name: string
          visibility?: string
        }
        Update: {
          application_id?: string | null
          availability_mode?: string
          campus_location?: string
          code?: string
          contact_email?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          operating_hours?: Json
          owner_user_id?: string | null
          timezone?: string
          university_name?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "canteen_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount: number
          id: string
          order_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount: number
          id?: string
          order_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount?: number
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          canteen_id: string | null
          code: string
          created_at: string
          description: string
          discount_type: string
          discount_value: number
          eligible_roles: string[] | null
          expires_at: string | null
          first_order_only: boolean
          id: string
          max_discount: number | null
          min_order_value: number
          per_user_limit: number
          starts_at: string | null
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          canteen_id?: string | null
          code: string
          created_at?: string
          description?: string
          discount_type: string
          discount_value: number
          eligible_roles?: string[] | null
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          max_discount?: number | null
          min_order_value?: number
          per_user_limit?: number
          starts_at?: string | null
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          canteen_id?: string | null
          code?: string
          created_at?: string
          description?: string
          discount_type?: string
          discount_value?: number
          eligible_roles?: string[] | null
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          max_discount?: number | null
          min_order_value?: number
          per_user_limit?: number
          starts_at?: string | null
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          kind: string
          recipient: string
          ref_id: string | null
          status: string
          subject: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          recipient: string
          ref_id?: string | null
          status: string
          subject: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          recipient?: string
          ref_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      food_scans: {
        Row: {
          calories: number | null
          carbs_g: number | null
          confidence: string
          created_at: string
          fat_g: number | null
          fibre_g: number | null
          fdc_id: number | null
          food_name: string
          id: string
          notes: string
          portion: string
          portion_g: number | null
          nutrition_reference: string | null
          nutrition_source: string | null
          protein_g: number | null
          scan_group_id: string | null
          sugar_g: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          confidence?: string
          created_at?: string
          fat_g?: number | null
          fibre_g?: number | null
          fdc_id?: number | null
          food_name: string
          id?: string
          notes?: string
          portion?: string
          portion_g?: number | null
          nutrition_reference?: string | null
          nutrition_source?: string | null
          protein_g?: number | null
          scan_group_id?: string | null
          sugar_g?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          confidence?: string
          created_at?: string
          fat_g?: number | null
          fibre_g?: number | null
          fdc_id?: number | null
          food_name?: string
          id?: string
          notes?: string
          portion?: string
          portion_g?: number | null
          nutrition_reference?: string | null
          nutrition_source?: string | null
          protein_g?: number | null
          scan_group_id?: string | null
          sugar_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          canteen_id: string
          category: string
          counter: string
          created_at: string
          description: string
          id: string
          image: string
          name: string
          prep_minutes: number
          price: number
          stock: number | null
          tag: string | null
          updated_at: string
          veg: boolean
        }
        Insert: {
          available?: boolean
          canteen_id: string
          category?: string
          counter?: string
          created_at?: string
          description?: string
          id?: string
          image?: string
          name: string
          prep_minutes?: number
          price: number
          stock?: number | null
          tag?: string | null
          updated_at?: string
          veg?: boolean
        }
        Update: {
          available?: boolean
          canteen_id?: string
          category?: string
          counter?: string
          created_at?: string
          description?: string
          id?: string
          image?: string
          name?: string
          prep_minutes?: number
          price?: number
          stock?: number | null
          tag?: string | null
          updated_at?: string
          veg?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      order_print_events: {
        Row: {
          bill_snapshot: Json
          canteen_id: string
          confirmed_at: string
          created_at: string
          id: string
          order_id: string
          order_number: string
          order_status: string
          order_type: string
          owner_user_id: string
          paper_width: string
          payment_method: string
          payment_status: string
        }
        Insert: {
          bill_snapshot: Json
          canteen_id: string
          confirmed_at?: string
          created_at?: string
          id?: string
          order_id: string
          order_number: string
          order_status: string
          order_type: string
          owner_user_id: string
          paper_width: string
          payment_method: string
          payment_status: string
        }
        Update: {
          bill_snapshot?: Json
          canteen_id?: string
          confirmed_at?: string
          created_at?: string
          id?: string
          order_id?: string
          order_number?: string
          order_status?: string
          order_type?: string
          owner_user_id?: string
          paper_width?: string
          payment_method?: string
          payment_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_print_events_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_print_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          canteen_id: string
          completion_workflow: string | null
          food_received_confirmed_at: string | null
          collection_thank_you_seen_at: string | null
          bill_print_confirmed_at: string | null
          bill_print_thank_you_seen_at: string | null
          confirmation_email_sent_at: string | null
          counter: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_name: string
          discount: number
          id: string
          idempotency_key: string | null
          lines: Json
          order_number: string
          order_type: string
          paid_at: string | null
          payment: string
          payment_method: string
          payment_status: string
          pickup_code: string
          prep_minutes: number
          razorpay_order_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          canteen_id: string
          completion_workflow?: string | null
          food_received_confirmed_at?: string | null
          collection_thank_you_seen_at?: string | null
          bill_print_confirmed_at?: string | null
          bill_print_thank_you_seen_at?: string | null
          confirmation_email_sent_at?: string | null
          counter: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_name: string
          discount?: number
          id?: string
          idempotency_key?: string | null
          lines: Json
          order_number: string
          order_type?: string
          paid_at?: string | null
          payment: string
          payment_method?: string
          payment_status?: string
          pickup_code: string
          prep_minutes: number
          razorpay_order_id?: string | null
          status?: string
          subtotal?: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          canteen_id?: string
          completion_workflow?: string | null
          food_received_confirmed_at?: string | null
          collection_thank_you_seen_at?: string | null
          bill_print_confirmed_at?: string | null
          bill_print_thank_you_seen_at?: string | null
          confirmation_email_sent_at?: string | null
          counter?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_name?: string
          discount?: number
          id?: string
          idempotency_key?: string | null
          lines?: Json
          order_number?: string
          order_type?: string
          paid_at?: string | null
          payment?: string
          payment_method?: string
          payment_status?: string
          pickup_code?: string
          prep_minutes?: number
          razorpay_order_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          payload: Json
          processed_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          received_at: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          payload: Json
          processed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          received_at?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          payload?: Json
          processed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          received_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string | null
          order_id: string
          provider: string
          razorpay_order_id: string
          razorpay_payment_id: string
          signature_verified: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id: string
          provider?: string
          razorpay_order_id: string
          razorpay_payment_id: string
          signature_verified?: boolean
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string | null
          order_id?: string
          provider?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string
          signature_verified?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_canteen_id: string | null
          email: string
          full_name: string
          id: string
          registration_number: string | null
          role: string
          welcome_email_sent_at: string | null
        }
        Insert: {
          created_at?: string
          current_canteen_id?: string | null
          email: string
          full_name: string
          id: string
          registration_number?: string | null
          role: string
          welcome_email_sent_at?: string | null
        }
        Update: {
          created_at?: string
          current_canteen_id?: string | null
          email?: string
          full_name?: string
          id?: string
          registration_number?: string | null
          role?: string
          welcome_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_canteen_id_fkey"
            columns: ["current_canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_id: string | null
          razorpay_refund_id: string | null
          reason: string
          requested_by: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          order_id: string
          payment_id?: string | null
          razorpay_refund_id?: string | null
          reason: string
          requested_by?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_id?: string | null
          razorpay_refund_id?: string | null
          reason?: string
          requested_by?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      scanner_access: {
        Row: {
          expires_at: string
          started_at: string
          user_id: string
          version: string
        }
        Insert: {
          expires_at: string
          started_at?: string
          user_id: string
          version?: string
        }
        Update: {
          expires_at?: string
          started_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          canteen_id: string | null
          category: string
          created_at: string
          description: string
          email_sent_at: string | null
          email_status: string
          id: string
          order_number: string
          rating: number | null
          sender_email: string
          sender_name: string
          sender_role: string
          submission_id: string
          user_id: string
        }
        Insert: {
          canteen_id?: string | null
          category: string
          created_at?: string
          description: string
          email_sent_at?: string | null
          email_status?: string
          id?: string
          order_number?: string
          rating?: number | null
          sender_email?: string
          sender_name: string
          sender_role: string
          submission_id: string
          user_id: string
        }
        Update: {
          canteen_id?: string | null
          category?: string
          created_at?: string
          description?: string
          email_sent_at?: string | null
          email_status?: string
          id?: string
          order_number?: string
          rating?: number | null
          sender_email?: string
          sender_name?: string
          sender_role?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_canteen_id_fkey"
            columns: ["canteen_id"]
            isOneToOne: false
            referencedRelation: "canteens"
            referencedColumns: ["id"]
          },
        ]
      }
      user_language_preferences: {
        Row: {
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          language?: string
          updated_at?: string
          user_id?: string
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
      faculty_events: {
        Row: { id: string; faculty_user_id: string; canteen_id: string; name: string; event_code: string; token_prefix: string; description: string; food_requirements: Json; food_request_message: string; food_confirmation: Json; canteen_note: string; initial_capacity: number; approved_capacity: number; next_token_sequence: number; status: string; created_at: string; updated_at: string }
        Insert: { id?: string; faculty_user_id: string; canteen_id: string; name: string; event_code: string; token_prefix: string; description?: string; food_requirements?: Json; food_request_message?: string; food_confirmation?: Json; canteen_note?: string; initial_capacity: number; approved_capacity: number; next_token_sequence?: number; status?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; faculty_user_id?: string; canteen_id?: string; name?: string; event_code?: string; token_prefix?: string; description?: string; food_requirements?: Json; food_request_message?: string; food_confirmation?: Json; canteen_note?: string; initial_capacity?: number; approved_capacity?: number; next_token_sequence?: number; status?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      faculty_event_capacity_requests: {
        Row: { id: string; event_id: string; faculty_user_id: string; additional_tokens: number; proposed_capacity: number; revised_food_quantities: Json; confirmed_food_quantities: Json; confirmed_food_prices: Json; status: string; canteen_note: string; responded_by: string | null; created_at: string; responded_at: string | null }
        Insert: { id?: string; event_id: string; faculty_user_id: string; additional_tokens: number; proposed_capacity: number; revised_food_quantities?: Json; confirmed_food_quantities?: Json; confirmed_food_prices?: Json; status?: string; canteen_note?: string; responded_by?: string | null; created_at?: string; responded_at?: string | null }
        Update: { id?: string; event_id?: string; faculty_user_id?: string; additional_tokens?: number; proposed_capacity?: number; revised_food_quantities?: Json; confirmed_food_quantities?: Json; confirmed_food_prices?: Json; status?: string; canteen_note?: string; responded_by?: string | null; created_at?: string; responded_at?: string | null }
        Relationships: []
      }
      faculty_event_tokens: {
        Row: { id: string; event_id: string; sequence_number: number; token_number: string; customer_id: string; canteen_id: string; order_id: string; status: string; created_at: string; collected_at: string | null; cancelled_at: string | null }
        Insert: { id?: string; event_id: string; sequence_number: number; token_number: string; customer_id: string; canteen_id: string; order_id: string; status?: string; created_at?: string; collected_at?: string | null; cancelled_at?: string | null }
        Update: { id?: string; event_id?: string; sequence_number?: number; token_number?: string; customer_id?: string; canteen_id?: string; order_id?: string; status?: string; created_at?: string; collected_at?: string | null; cancelled_at?: string | null }
        Relationships: []
      }
      faculty_event_audit: {
        Row: { id: number; event_id: string; actor_id: string | null; action: string; details: Json; created_at: string }
        Insert: { id?: number; event_id: string; actor_id?: string | null; action: string; details?: Json; created_at?: string }
        Update: { id?: number; event_id?: string; actor_id?: string | null; action?: string; details?: Json; created_at?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_canteen: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hungry_allow_canteen_owner_login: {
        Args: { p_ip_key: string; p_owner_key: string }
        Returns: boolean
      }
      hungry_expire_stale_orders: {
        Args: { p_minutes?: number }
        Returns: number
      }
      hungry_mark_order_paid: { Args: { p_order: string }; Returns: string }
      hungry_confirm_order_bill_print: { Args: { p_order_id: string; p_owner_user_id: string; p_paper_width: string }; Returns: { confirmed_at: string; already_confirmed: boolean }[] }
      hungry_acknowledge_bill_print_thank_you: { Args: { p_order_id: string; p_customer_user_id: string }; Returns: boolean }
      hungry_acknowledge_collected_order_thank_you: { Args: { p_order_id: string; p_customer_user_id: string }; Returns: boolean }
      hungry_confirm_printed_order_food_received: { Args: { p_order_id: string; p_customer_user_id: string }; Returns: { confirmed_at: string; already_confirmed: boolean }[] }
      hungry_resolve_faculty_event_capacity_request: { Args: { p_request_id: string; p_canteen_owner_id: string; p_approve: boolean; p_confirmed_food_quantities?: Json; p_confirmed_food_prices?: Json; p_note?: string }; Returns: string }
      hungry_review_faculty_event_request: { Args: { p_event_id: string; p_canteen_owner_id: string; p_accept: boolean; p_note?: string }; Returns: string }
      hungry_publish_faculty_event: { Args: { p_event_id: string; p_canteen_owner_id: string; p_confirmed_food_quantities: Json; p_confirmed_food_prices: Json; p_note?: string }; Returns: string }
      hungry_place_event_order: {
        Args: { p_event_id: string; p_event_code: string; p_user: string; p_canteen: string; p_customer_name: string; p_lines: Json; p_order_type: string; p_payment_method: string; p_expected_subtotal: number; p_coupon_id: string; p_discount: number; p_idempotency_key: string; p_order_number: string; p_pickup_code: string }
        Returns: { order_id: string; already_existed: boolean; token_number: string }[]
      }
      hungry_get_event_capacity: { Args: { p_event_id: string }; Returns: { approved_capacity: number; issued_tokens: number; tokens_remaining: number; collected_tokens: number; cancelled_tokens: number }[] }
      hungry_place_order: {
        Args: {
          p_canteen: string
          p_coupon_id: string
          p_customer_name: string
          p_discount: number
          p_expected_subtotal: number
          p_idempotency_key: string
          p_lines: Json
          p_order_number: string
          p_order_type: string
          p_payment_method: string
          p_pickup_code: string
          p_user: string
        }
        Returns: {
          already_existed: boolean
          order_id: string
        }[]
      }
      hungry_release_order: {
        Args: { p_order: string; p_payment_status?: string }
        Returns: boolean
      }
      hungry_start_scanner_trial: {
        Args: never
        Returns: {
          expires_at: string
          started_at: string
          user_id: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "scanner_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_canteen: { Args: { _canteen: string }; Returns: boolean }
      valid_canteen_hours: { Args: { p_hours: Json }; Returns: boolean }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
