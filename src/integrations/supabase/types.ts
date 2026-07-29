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
      caixa_diario: {
        Row: {
          aberto_em: string
          data: string
          estado: string
          fechado_em: string | null
          id: string
          num_fechos: number
          observacoes: string | null
          reaberta: boolean
          reaberta_em: string | null
          reaberta_motivo: string | null
          reaberta_por: string | null
          saldo_final: number | null
          saldo_inicial: number
          utilizador_abertura_id: string
          utilizador_fecho_id: string | null
        }
        Insert: {
          aberto_em?: string
          data: string
          estado?: string
          fechado_em?: string | null
          id?: string
          num_fechos?: number
          observacoes?: string | null
          reaberta?: boolean
          reaberta_em?: string | null
          reaberta_motivo?: string | null
          reaberta_por?: string | null
          saldo_final?: number | null
          saldo_inicial?: number
          utilizador_abertura_id: string
          utilizador_fecho_id?: string | null
        }
        Update: {
          aberto_em?: string
          data?: string
          estado?: string
          fechado_em?: string | null
          id?: string
          num_fechos?: number
          observacoes?: string | null
          reaberta?: boolean
          reaberta_em?: string | null
          reaberta_motivo?: string | null
          reaberta_por?: string | null
          saldo_final?: number | null
          saldo_inicial?: number
          utilizador_abertura_id?: string
          utilizador_fecho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_diario_aberto_por_fkey"
            columns: ["utilizador_abertura_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_diario_fechado_por_fkey"
            columns: ["utilizador_fecho_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_diario_reaberta_por_fkey"
            columns: ["reaberta_por"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          preco: number
          preco2: number
          tipo: string
          unidade: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          preco?: number
          preco2?: number
          tipo: string
          unidade?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          preco?: number
          preco2?: number
          tipo?: string
          unidade?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          id: string
          nif: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nif?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nif?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          contacto: string | null
          email: string | null
          id: boolean
          logo_url: string | null
          morada: string | null
          nif: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          contacto?: string | null
          email?: string | null
          id?: boolean
          logo_url?: string | null
          morada?: string | null
          nif?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          contacto?: string | null
          email?: string | null
          id?: boolean
          logo_url?: string | null
          morada?: string | null
          nif?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          caixa_diario_id: string | null
          data: string
          id: string
          liquidado: boolean
          liquidado_em: string | null
          liquidado_por: string | null
          metodo: string
          notas: string | null
          registo_id: string
          valor: number
        }
        Insert: {
          caixa_diario_id?: string | null
          data?: string
          id?: string
          liquidado?: boolean
          liquidado_em?: string | null
          liquidado_por?: string | null
          metodo: string
          notas?: string | null
          registo_id: string
          valor: number
        }
        Update: {
          caixa_diario_id?: string | null
          data?: string
          id?: string
          liquidado?: boolean
          liquidado_em?: string | null
          liquidado_por?: string | null
          metodo?: string
          notas?: string | null
          registo_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_caixa_diario_id_fkey"
            columns: ["caixa_diario_id"]
            isOneToOne: false
            referencedRelation: "caixa_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_liquidado_por_fkey"
            columns: ["liquidado_por"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_registo_id_fkey"
            columns: ["registo_id"]
            isOneToOne: false
            referencedRelation: "registos"
            referencedColumns: ["id"]
          },
        ]
      }
      registo_itens: {
        Row: {
          catalogo_id: string | null
          descricao: string
          id: string
          preco_unitario: number
          quantidade: number
          registo_id: string
          subtotal: number | null
        }
        Insert: {
          catalogo_id?: string | null
          descricao: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          registo_id: string
          subtotal?: number | null
        }
        Update: {
          catalogo_id?: string | null
          descricao?: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          registo_id?: string
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registo_itens_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registo_itens_registo_id_fkey"
            columns: ["registo_id"]
            isOneToOne: false
            referencedRelation: "registos"
            referencedColumns: ["id"]
          },
        ]
      }
      registos: {
        Row: {
          anulado: boolean
          anulado_em: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          caixa_diario_id: string | null
          cliente_id: string | null
          data: string
          editado_em: string | null
          editado_por: string | null
          faturado: boolean
          faturado_em: string | null
          faturado_por: string | null
          id: string
          notas: string | null
          numero: number
          total: number
          utilizador_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          anulado?: boolean
          anulado_em?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          caixa_diario_id?: string | null
          cliente_id?: string | null
          data?: string
          editado_em?: string | null
          editado_por?: string | null
          faturado?: boolean
          faturado_em?: string | null
          faturado_por?: string | null
          id?: string
          notas?: string | null
          numero?: number
          total?: number
          utilizador_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          anulado?: boolean
          anulado_em?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          caixa_diario_id?: string | null
          cliente_id?: string | null
          data?: string
          editado_em?: string | null
          editado_por?: string | null
          faturado?: boolean
          faturado_em?: string | null
          faturado_por?: string | null
          id?: string
          notas?: string | null
          numero?: number
          total?: number
          utilizador_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registos_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_caixa_diario_id_fkey"
            columns: ["caixa_diario_id"]
            isOneToOne: false
            referencedRelation: "caixa_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_editado_por_fkey"
            columns: ["editado_por"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_faturado_por_fkey"
            columns: ["faturado_por"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_utilizador_id_fkey"
            columns: ["utilizador_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      saidas_caixa: {
        Row: {
          caixa_id: string
          criado_em: string
          descricao: string
          id: string
          tipo: string
          utilizador_id: string
          valor: number
        }
        Insert: {
          caixa_id: string
          criado_em?: string
          descricao: string
          id?: string
          tipo?: string
          utilizador_id: string
          valor: number
        }
        Update: {
          caixa_id?: string
          criado_em?: string
          descricao?: string
          id?: string
          tipo?: string
          utilizador_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saidas_caixa_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixa_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saidas_caixa_criado_por_fkey"
            columns: ["utilizador_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
        ]
      }
      utilizadores: {
        Row: {
          acesso_loja: boolean
          acesso_oficina: boolean
          ativo: boolean
          created_at: string
          id: string
          nome: string
          papel: string
          password_hash: string
        }
        Insert: {
          acesso_loja?: boolean
          acesso_oficina?: boolean
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          papel: string
          password_hash: string
        }
        Update: {
          acesso_loja?: boolean
          acesso_oficina?: boolean
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          papel?: string
          password_hash?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          pin_hash: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          pin_hash: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          pin_hash?: string
        }
        Relationships: []
      }
      work_order_itens: {
        Row: {
          catalogo_id: string | null
          descricao: string
          id: string
          preco_unitario: number
          quantidade: number
          subtotal: number | null
          work_order_id: string
        }
        Insert: {
          catalogo_id?: string | null
          descricao: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          subtotal?: number | null
          work_order_id: string
        }
        Update: {
          catalogo_id?: string | null
          descricao?: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          subtotal?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_itens_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_itens_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          acessorios: Json
          anexos: Json
          aprovado_por: string | null
          assinatura_entrega: string | null
          assinatura_rececao: string | null
          auto_status_locked: boolean
          checklist: Json
          cliente_id: string | null
          cliente_nome: string | null
          cliente_rapido: boolean
          contacto: string | null
          created_at: string
          data_aprovacao: string | null
          data_entrega: string | null
          data_rececao: string
          diagnostico_tecnico: string | null
          equipamento: string | null
          id: string
          limpeza_efetuada: boolean
          marca_modelo: string | null
          meio_aprovacao: string | null
          num_serie: string | null
          numero: number
          observacoes: string | null
          observacoes_incluir_pdf: boolean
          password_pin: string | null
          prazo_estimado: string | null
          relatorio_intervencao: string | null
          sintomas_cliente: string | null
          status: string
          tecnico_id: string | null
          testes_finais_ok: boolean
          updated_at: string
          valor_estimado: number | null
          valor_total_pago: number | null
        }
        Insert: {
          acessorios?: Json
          anexos?: Json
          aprovado_por?: string | null
          assinatura_entrega?: string | null
          assinatura_rececao?: string | null
          auto_status_locked?: boolean
          checklist?: Json
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_rapido?: boolean
          contacto?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_entrega?: string | null
          data_rececao?: string
          diagnostico_tecnico?: string | null
          equipamento?: string | null
          id?: string
          limpeza_efetuada?: boolean
          marca_modelo?: string | null
          meio_aprovacao?: string | null
          num_serie?: string | null
          numero?: number
          observacoes?: string | null
          observacoes_incluir_pdf?: boolean
          password_pin?: string | null
          prazo_estimado?: string | null
          relatorio_intervencao?: string | null
          sintomas_cliente?: string | null
          status?: string
          tecnico_id?: string | null
          testes_finais_ok?: boolean
          updated_at?: string
          valor_estimado?: number | null
          valor_total_pago?: number | null
        }
        Update: {
          acessorios?: Json
          anexos?: Json
          aprovado_por?: string | null
          assinatura_entrega?: string | null
          assinatura_rececao?: string | null
          auto_status_locked?: boolean
          checklist?: Json
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_rapido?: boolean
          contacto?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_entrega?: string | null
          data_rececao?: string
          diagnostico_tecnico?: string | null
          equipamento?: string | null
          id?: string
          limpeza_efetuada?: boolean
          marca_modelo?: string | null
          meio_aprovacao?: string | null
          num_serie?: string | null
          numero?: number
          observacoes?: string | null
          observacoes_incluir_pdf?: boolean
          password_pin?: string | null
          prazo_estimado?: string | null
          relatorio_intervencao?: string | null
          sintomas_cliente?: string | null
          status?: string
          tecnico_id?: string | null
          testes_finais_ok?: boolean
          updated_at?: string
          valor_estimado?: number | null
          valor_total_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
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
