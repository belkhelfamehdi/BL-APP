import { API_BASE_URL } from '@/services/config';
import { emitAuthExpired } from '@/services/auth-events';
import {
  AdminReportDetail,
  AdminReportSummary,
  Article,
  ArticleBL,
  ArticleSearchResponse,
  LoginResponse,
  RawBLProductsResponse,
  SelectionResponse,
  SubmitPreparationPayload,
} from '@/types/app';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

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
      const rawDetail =
        typeof parsed === 'object' && parsed !== null && 'detail' in parsed
          ? String((parsed as { detail: unknown }).detail)
          : '';

      if (response.status === 401) {
        if (!path.startsWith('/auth/login')) emitAuthExpired();
        throw new ApiError(401, rawDetail || 'Session expirée — veuillez vous reconnecter.');
      }
      if (response.status === 403) {
        throw new ApiError(403, rawDetail || 'Vous n\'avez pas l\'autorisation pour cette action.');
      }
      if (response.status === 404) {
        throw new ApiError(404, rawDetail || 'Ressource introuvable.');
      }
      if (response.status >= 500) {
        throw new ApiError(response.status, rawDetail || 'Erreur serveur — réessayez dans un instant.');
      }
      throw new ApiError(response.status, rawDetail || `HTTP ${response.status}`);
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Délai dépassé — vérifiez votre connexion.');
      }
      if (error.message.toLowerCase().includes('network request failed')) {
        throw new Error('Connexion impossible — vérifiez votre réseau.');
      }
      throw error;
    }
    throw new Error('Erreur réseau inconnue');
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

  searchArticles(query: string) {
    return request<ArticleSearchResponse>(`/articles/search?q=${encodeURIComponent(query)}`);
  },

  getArticleByCode(code: string) {
    return request<Article>(`/articles/${encodeURIComponent(code)}`);
  },
};
