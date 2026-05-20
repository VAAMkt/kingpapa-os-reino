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
      categorias_master: {
        Row: {
          activo: boolean
          created_at: string
          descripcion_override: string | null
          id: string
          nombre: string
          nombre_override: string | null
          orden: number
          rp_id: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion_override?: string | null
          id?: string
          nombre: string
          nombre_override?: string | null
          orden?: number
          rp_id: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion_override?: string | null
          id?: string
          nombre?: string
          nombre_override?: string | null
          orden?: number
          rp_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          cliente: Json
          created_at: string
          id: string
          items: Json
          notas: string | null
          pago: string
          rp_payload: Json
          rp_pedido_id: string | null
          rp_response: Json | null
          sede_id: string
          status: string
          subtotal: number
          tipo: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cliente: Json
          created_at?: string
          id?: string
          items: Json
          notas?: string | null
          pago: string
          rp_payload: Json
          rp_pedido_id?: string | null
          rp_response?: Json | null
          sede_id: string
          status?: string
          subtotal?: number
          tipo: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cliente?: Json
          created_at?: string
          id?: string
          items?: Json
          notas?: string | null
          pago?: string
          rp_payload?: Json
          rp_pedido_id?: string | null
          rp_response?: Json | null
          sede_id?: string
          status?: string
          subtotal?: number
          tipo?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          autor_id: string | null
          categoria: string
          contenido_html: string | null
          created_at: string
          extracto: string
          fecha: string
          id: string
          imagen_url: string
          link_original: string | null
          publicado: boolean
          slug: string
          titulo: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          autor_id?: string | null
          categoria: string
          contenido_html?: string | null
          created_at?: string
          extracto?: string
          fecha?: string
          id?: string
          imagen_url: string
          link_original?: string | null
          publicado?: boolean
          slug: string
          titulo: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          autor_id?: string | null
          categoria?: string
          contenido_html?: string | null
          created_at?: string
          extracto?: string
          fecha?: string
          id?: string
          imagen_url?: string
          link_original?: string | null
          publicado?: boolean
          slug?: string
          titulo?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      productos_master: {
        Row: {
          almacen_id: number | null
          categoria_id: string | null
          clasificacion_me: string | null
          created_at: string
          descripcion: string | null
          descripcion_override: string | null
          destacado: boolean
          disponible: boolean
          es_mas_vendido: boolean
          es_nuevo: boolean
          es_recomendado: boolean
          etiqueta_custom: string | null
          id: string
          imagen_url: string | null
          margen_pct: number | null
          modificadores: Json
          modificadores_raw: Json
          nombre: string
          nombre_override: string | null
          orden: number
          precio: number
          rp_id: number
          updated_at: string
        }
        Insert: {
          almacen_id?: number | null
          categoria_id?: string | null
          clasificacion_me?: string | null
          created_at?: string
          descripcion?: string | null
          descripcion_override?: string | null
          destacado?: boolean
          disponible?: boolean
          es_mas_vendido?: boolean
          es_nuevo?: boolean
          es_recomendado?: boolean
          etiqueta_custom?: string | null
          id?: string
          imagen_url?: string | null
          margen_pct?: number | null
          modificadores?: Json
          modificadores_raw?: Json
          nombre: string
          nombre_override?: string | null
          orden?: number
          precio?: number
          rp_id: number
          updated_at?: string
        }
        Update: {
          almacen_id?: number | null
          categoria_id?: string | null
          clasificacion_me?: string | null
          created_at?: string
          descripcion?: string | null
          descripcion_override?: string | null
          destacado?: boolean
          disponible?: boolean
          es_mas_vendido?: boolean
          es_nuevo?: boolean
          es_recomendado?: boolean
          etiqueta_custom?: string | null
          id?: string
          imagen_url?: string | null
          margen_pct?: number | null
          modificadores?: Json
          modificadores_raw?: Json
          nombre?: string
          nombre_override?: string | null
          orden?: number
          precio?: number
          rp_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_master_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_master"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arquetipo: string | null
          ciudad: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          arquetipo?: string | null
          ciudad?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          arquetipo?: string | null
          ciudad?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      rp_sync_log: {
        Row: {
          created_at: string
          id: string
          mensaje: string | null
          ok: boolean
          payload: Json | null
          sede_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensaje?: string | null
          ok?: boolean
          payload?: Json | null
          sede_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          mensaje?: string | null
          ok?: boolean
          payload?: Json | null
          sede_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_sync_log_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      sede_producto_overrides: {
        Row: {
          created_at: string
          disponible: boolean
          id: string
          precio_override: number | null
          producto_id: string
          sede_id: string
          stock_cache: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          disponible?: boolean
          id?: string
          precio_override?: number | null
          producto_id: string
          sede_id: string
          stock_cache?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          disponible?: boolean
          id?: string
          precio_override?: number | null
          producto_id?: string
          sede_id?: string
          stock_cache?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sede_producto_overrides_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sede_producto_overrides_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      sedes: {
        Row: {
          abierta_ahora: boolean
          barrio: string | null
          ciudad: string
          cobertura_radio_km: number
          created_at: string
          delivery: boolean
          direccion: string
          horario: string
          id: string
          lat: number | null
          lng: number | null
          mall: string | null
          maps_url: string | null
          nombre: string
          orden: number
          pickup: boolean
          publicado: boolean
          qr_mesa: boolean
          rp_local_id: number | null
          slug: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          abierta_ahora?: boolean
          barrio?: string | null
          ciudad: string
          cobertura_radio_km?: number
          created_at?: string
          delivery?: boolean
          direccion: string
          horario?: string
          id?: string
          lat?: number | null
          lng?: number | null
          mall?: string | null
          maps_url?: string | null
          nombre: string
          orden?: number
          pickup?: boolean
          publicado?: boolean
          qr_mesa?: boolean
          rp_local_id?: number | null
          slug: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          abierta_ahora?: boolean
          barrio?: string | null
          ciudad?: string
          cobertura_radio_km?: number
          created_at?: string
          delivery?: boolean
          direccion?: string
          horario?: string
          id?: string
          lat?: number | null
          lng?: number | null
          mall?: string | null
          maps_url?: string | null
          nombre?: string
          orden?: number
          pickup?: boolean
          publicado?: boolean
          qr_mesa?: boolean
          rp_local_id?: number | null
          slug?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          sede_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          sede_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sede_id?: string | null
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
      app_role:
        | "super_admin"
        | "editor"
        | "marketing"
        | "franquiciado"
        | "cliente"
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
      app_role: [
        "super_admin",
        "editor",
        "marketing",
        "franquiciado",
        "cliente",
      ],
    },
  },
} as const
