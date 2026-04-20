export type UserRole = 'responsable' | 'preparateur' | 'admin';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface ArticleBL {
  IDBL: number;
  Destinataire: string;
  DateBL: string;
  references_count?: number;
  references?: string[];
}

export interface SelectionRow {
  bl_id: number;
  target_date: string;
  selected_at: string;
  selector_username: string;
  selector_name: string;
  destinataire?: string | null;
  date_bl?: string | null;
}

export interface SelectionResponse {
  target_date: string;
  count: number;
  data: SelectionRow[];
}

export interface RawBLProductsResponse {
  idbl: number;
  table: string;
  link_column: string;
  count: number;
  data: Record<string, unknown>[];
}

export type ProductStatus = 'available' | 'not_available' | 'partial';

export interface PreparationItemPayload {
  reference: string;
  status: ProductStatus;
  quantity_expected?: number;
  quantity_prepared?: number;
  note?: string;
}

export interface SubmitPreparationPayload {
  report_date: string;
  bl_id: number;
  overall_comment?: string;
  items: PreparationItemPayload[];
}

export interface AdminReportSummary {
  report_id: number;
  report_date: string;
  bl_id: number;
  destinataire?: string | null;
  sent_at: string;
  overall_comment?: string;
  preparer_username: string;
  preparer_name: string;
  summary: {
    available: number;
    partial: number;
    not_available: number;
    items: number;
    quantity_missing_total: number;
  };
}

export interface AdminReportDetailItem {
  reference: string;
  status: ProductStatus;
  quantity_expected?: number;
  quantity_prepared?: number;
  quantity_missing?: number;
  note?: string;
}

export interface AdminReportDetail {
  report_id: number;
  report_date: string;
  bl_id: number;
  destinataire?: string | null;
  sent_at: string;
  overall_comment?: string;
  preparer_username: string;
  preparer_name: string;
  items_count: number;
  items: AdminReportDetailItem[];
}
