import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiConfig } from '../api.config';
import {
  AdminItemDetails,
  AdminListQuery,
  AdminListResponse,
  AdminMetadataResponse,
  AdminStatusPatchPayload,
  AdminWritePayload,
} from './admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly adminBaseUrl = `${apiConfig.baseUrl}/api/admin/content-items`;
  private readonly metadataUrl = `${apiConfig.baseUrl}/api/admin/content-metadata`;
  private readonly aiAskUrl = `${apiConfig.baseUrl}/api/ai/ask`;

  listContentItems(query: AdminListQuery): Observable<AdminListResponse> {
    let params = new HttpParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        if (!value.length) {
          return;
        }
        params = params.set(key, value.join(','));
        return;
      }

      params = params.set(key, String(value));
    });

    return this.http.get<AdminListResponse>(this.adminBaseUrl, { params, withCredentials: true });
  }

  getContentItemById(id: number): Observable<AdminItemDetails> {
    return this.http.get<AdminItemDetails>(`${this.adminBaseUrl}/${id}`, { withCredentials: true });
  }

  createContentItem(payload: AdminWritePayload): Observable<AdminItemDetails> {
    return this.http.post<AdminItemDetails>(this.adminBaseUrl, payload, { withCredentials: true });
  }

  updateContentItem(id: number, payload: AdminWritePayload): Observable<AdminItemDetails> {
    return this.http.put<AdminItemDetails>(`${this.adminBaseUrl}/${id}`, payload, { withCredentials: true });
  }

  patchContentItemStatus(id: number, payload: AdminStatusPatchPayload): Observable<AdminItemDetails> {
    return this.http.patch<AdminItemDetails>(`${this.adminBaseUrl}/${id}/status`, payload, { withCredentials: true });
  }

  submitForApproval(id: number): Observable<AdminItemDetails> {
    return this.http.post<AdminItemDetails>(`${this.adminBaseUrl}/${id}/submit-for-approval`, {}, { withCredentials: true });
  }

  approveContent(id: number): Observable<AdminItemDetails> {
    return this.http.post<AdminItemDetails>(`${this.adminBaseUrl}/${id}/approve`, {}, { withCredentials: true });
  }

  deactivateContentItem(id: number): Observable<AdminItemDetails> {
    return this.http.delete<AdminItemDetails>(`${this.adminBaseUrl}/${id}`, { withCredentials: true });
  }

  getMetadata(): Observable<AdminMetadataResponse> {
    return this.http.get<AdminMetadataResponse>(this.metadataUrl, { withCredentials: true });
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${apiConfig.baseUrl}/api/admin/upload-image`, formData, { withCredentials: true });
  }

  askAi(prompt: string): Observable<unknown> {
    return this.http.post<unknown>(this.aiAskUrl, { prompt }, { withCredentials: true });
  }
}
