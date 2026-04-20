import { API_BASE_URL } from '@/services/config';
import {
  AdminReportDetail,
  AdminReportSummary,
  ArticleBL,
  LoginResponse,
  RawBLProductsResponse,
  SelectionResponse,
  SubmitPreparationPayload,
} from '@/types/app';

type Method = 'GET' | 'POST';

interface RequestOptions {
  method?: Method;
  token?: string | null;
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const detail =
        typeof parsed === 'object' && parsed !== null && 'detail' in parsed
          ? String((parsed as { detail: unknown }).detail)
          : `HTTP ${response.status}`;
      throw new Error(detail);
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Delai depasse vers le serveur API');
      }
      if (error.message.toLowerCase().includes('network request failed')) {
        throw new Error(`Connexion impossible vers API (${API_BASE_URL}). Verifiez .env et que l'API tourne.`);
      }
      throw error;
    }
    throw new Error('Erreur reseau inconnue');
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  login(username: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  },

  me(token: string) {
    return request('/auth/me', { token });
  },

  logout(token: string) {
    return request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      token,
    });
  },

  listArticles(days = 2) {
    return request<{ count: number; data: ArticleBL[] }>(`/articles?days=${days}`);
  },

  createSelections(token: string, targetDate: string, blIds: number[]) {
    return request('/selections', {
      method: 'POST',
      token,
      body: { target_date: targetDate, bl_ids: blIds },
    });
  },

  listSelections(token: string, targetDate: string) {
    return request<SelectionResponse>(`/selections?target_date=${targetDate}`, { token });
  },

  listPreparationBls(token: string, targetDate: string) {
    return request<SelectionResponse>(`/preparation/bls?target_date=${targetDate}`, { token });
  },

  getBlProducts(blId: number) {
    return request<RawBLProductsResponse>(`/bl/${blId}/produits`);
  },

  sendPreparationReport(token: string, payload: SubmitPreparationPayload) {
    return request('/preparation/reports', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  listAdminReports(token: string, reportDate: string) {
    return request<{ report_date: string; count: number; data: AdminReportSummary[] }>(
      `/admin/reports?report_date=${reportDate}`,
      { token }
    );
  },

  getAdminReportDetail(token: string, reportId: number) {
    return request<AdminReportDetail>(`/admin/reports/${reportId}`, { token });
  },
};
