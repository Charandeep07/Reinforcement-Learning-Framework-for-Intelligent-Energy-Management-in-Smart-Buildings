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
      alerts: {
        Row: {
          building_id: string
          created_at: string
          equipment: string | null
          id: string
          message: string
          rule: string
          severity: string
          status: string
          ts: string
          updated_at: string
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          equipment?: string | null
          id?: string
          message: string
          rule: string
          severity: string
          status?: string
          ts?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          equipment?: string | null
          id?: string
          message?: string
          rule?: string
          severity?: string
          status?: string
          ts?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: never
          user_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          area_m2: number
          battery_kw: number
          battery_kwh: number
          building_type: string
          close_hour: number
          comfort_max: number
          comfort_min: number
          created_at: string
          energy_target_kwh: number
          floors: number
          id: string
          location: string
          name: string
          open_hour: number
          solar_kw: number
          updated_at: string
          user_id: string
          weather_profile: string
        }
        Insert: {
          area_m2?: number
          battery_kw?: number
          battery_kwh?: number
          building_type?: string
          close_hour?: number
          comfort_max?: number
          comfort_min?: number
          created_at?: string
          energy_target_kwh?: number
          floors?: number
          id?: string
          location?: string
          name: string
          open_hour?: number
          solar_kw?: number
          updated_at?: string
          user_id?: string
          weather_profile?: string
        }
        Update: {
          area_m2?: number
          battery_kw?: number
          battery_kwh?: number
          building_type?: string
          close_hour?: number
          comfort_max?: number
          comfort_min?: number
          created_at?: string
          energy_target_kwh?: number
          floors?: number
          id?: string
          location?: string
          name?: string
          open_hour?: number
          solar_kw?: number
          updated_at?: string
          user_id?: string
          weather_profile?: string
        }
        Relationships: []
      }
      energy_prices: {
        Row: {
          created_at: string
          hour: number
          id: number
          price: number
          tariff: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hour: number
          id?: never
          price: number
          tariff: string
          user_id?: string
        }
        Update: {
          created_at?: string
          hour?: number
          id?: never
          price?: number
          tariff?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_readings: {
        Row: {
          appliance_kw: number
          battery_kw: number
          building_id: string
          cost: number
          created_at: string
          grid_kw: number
          hvac_kw: number
          id: number
          lighting_kw: number
          price: number
          soc: number
          solar_kw: number
          source: string
          total_kw: number
          ts: string
          user_id: string
        }
        Insert: {
          appliance_kw: number
          battery_kw?: number
          building_id: string
          cost: number
          created_at?: string
          grid_kw: number
          hvac_kw: number
          id?: never
          lighting_kw: number
          price: number
          soc: number
          solar_kw?: number
          source?: string
          total_kw: number
          ts: string
          user_id?: string
        }
        Update: {
          appliance_kw?: number
          battery_kw?: number
          building_id?: string
          cost?: number
          created_at?: string
          grid_kw?: number
          hvac_kw?: number
          id?: never
          lighting_kw?: number
          price?: number
          soc?: number
          solar_kw?: number
          source?: string
          total_kw?: number
          ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "energy_readings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_readings: {
        Row: {
          building_id: string
          created_at: string
          id: number
          indoor_c: number
          occupancy: number
          outdoor_c: number
          setpoint: number
          ts: string
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: never
          indoor_c: number
          occupancy: number
          outdoor_c: number
          setpoint: number
          ts: string
          user_id?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: never
          indoor_c?: number
          occupancy?: number
          outdoor_c?: number
          setpoint?: number
          ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "environmental_readings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          building_id: string
          created_at: string
          id: string
          is_on: boolean
          kind: string
          level: number | null
          name: string
          rated_kw: number
          setpoint: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          is_on?: boolean
          kind: string
          level?: number | null
          name: string
          rated_kw?: number
          setpoint?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          is_on?: boolean
          kind?: string
          level?: number | null
          name?: string
          rated_kw?: number
          setpoint?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      model_artifacts: {
        Row: {
          algorithm: string
          config: Json
          created_at: string
          experiment_id: string | null
          id: string
          is_active: boolean
          name: string
          user_id: string
          weights: Json
        }
        Insert: {
          algorithm: string
          config?: Json
          created_at?: string
          experiment_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          user_id?: string
          weights: Json
        }
        Update: {
          algorithm?: string
          config?: Json
          created_at?: string
          experiment_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "model_artifacts_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "rl_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          comfort_max: number
          comfort_min: number
          created_at: string
          demo_seeded: boolean
          display_name: string | null
          flat_price: number
          id: string
          notify_alerts: boolean
          sim_seed: number
          tariff: string
          timezone: string
          units: string
          updated_at: string
        }
        Insert: {
          comfort_max?: number
          comfort_min?: number
          created_at?: string
          demo_seeded?: boolean
          display_name?: string | null
          flat_price?: number
          id: string
          notify_alerts?: boolean
          sim_seed?: number
          tariff?: string
          timezone?: string
          units?: string
          updated_at?: string
        }
        Update: {
          comfort_max?: number
          comfort_min?: number
          created_at?: string
          demo_seeded?: boolean
          display_name?: string | null
          flat_price?: number
          id?: string
          notify_alerts?: boolean
          sim_seed?: number
          tariff?: string
          timezone?: string
          units?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          applied: boolean
          applied_at: string | null
          building_id: string
          created_at: string
          current_state: Json
          id: string
          predicted: Json
          recommended: Json
          result: Json | null
          source: string
          user_id: string
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          building_id: string
          created_at?: string
          current_state: Json
          id?: string
          predicted?: Json
          recommended: Json
          result?: Json | null
          source: string
          user_id?: string
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          building_id?: string
          created_at?: string
          current_state?: Json
          id?: string
          predicted?: Json
          recommended?: Json
          result?: Json | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      rl_experiments: {
        Row: {
          algorithm: string
          building_id: string | null
          config: Json
          created_at: string
          curve: Json
          id: string
          metrics: Json
          name: string
          status: string
          train_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm: string
          building_id?: string | null
          config?: Json
          created_at?: string
          curve?: Json
          id?: string
          metrics?: Json
          name: string
          status?: string
          train_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          algorithm?: string
          building_id?: string | null
          config?: Json
          created_at?: string
          curve?: Json
          id?: string
          metrics?: Json
          name?: string
          status?: string
          train_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rl_experiments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      whatif_scenarios: {
        Row: {
          building_id: string | null
          created_at: string
          id: string
          name: string
          params: Json
          results: Json
          user_id: string
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          id?: string
          name: string
          params: Json
          results: Json
          user_id?: string
        }
        Update: {
          building_id?: string | null
          created_at?: string
          id?: string
          name?: string
          params?: Json
          results?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatif_scenarios_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
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
    Enums: {},
  },
} as const
