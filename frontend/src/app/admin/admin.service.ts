import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, timeout } from 'rxjs';
import { apiConfig } from '../api.config';
import {
  AdminImageSuggestion,
  AdminImageSuggestionsResponse,
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
  private readonly imageSuggestionsUrl = `${apiConfig.baseUrl}/api/admin/image-suggestions`;

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

  getImageSuggestions(query: string, limit = 10): Observable<AdminImageSuggestionsResponse> {
    const safeLimit = Math.min(Math.max(limit, 1), 10);

    const params = new HttpParams()
      .set('q', query)
      .set('limit', String(safeLimit));

    return this.http
      .get<AdminImageSuggestionsResponse>(this.imageSuggestionsUrl, { params, withCredentials: true })
      .pipe(
        timeout(12000),
        catchError(() => this.getImageSuggestionsFromWikimedia(query, safeLimit))
      );
  }

  private getImageSuggestionsFromWikimedia(query: string, limit: number): Observable<AdminImageSuggestionsResponse> {
    const params = new HttpParams()
      .set('action', 'query')
      .set('format', 'json')
      .set('origin', '*')
      .set('generator', 'search')
      .set('gsrsearch', `filetype:bitmap ${query}`)
      .set('gsrnamespace', '6')
      .set('gsrlimit', String(limit))
      .set('prop', 'imageinfo')
      .set('iiprop', 'url|extmetadata')
      .set('iiurlwidth', '800');

    return this.http
      .get<{ query?: { pages?: Record<string, any> } }>('https://commons.wikimedia.org/w/api.php', { params })
      .pipe(
        timeout(12000),
        map((response) => {
          const pages = response?.query?.pages ?? {};
          const items = Object.values(pages).reduce<AdminImageSuggestion[]>((acc, page: any) => {
              const imageInfo = page?.imageinfo?.[0] ?? {};
              const extmetadata = imageInfo?.extmetadata ?? {};
              const fileUrl = String(imageInfo?.url ?? '').trim();
              const previewUrl = String(imageInfo?.thumburl ?? fileUrl).trim();
              if (!fileUrl) {
                return acc;
              }

              const license = String(extmetadata?.LicenseShortName?.value ?? '').trim() || null;
              const author = String(extmetadata?.Artist?.value ?? '').trim() || null;

              acc.push({
                title: String(page?.title ?? '').replace('File:', ''),
                file_url: fileUrl,
                preview_url: previewUrl,
                license,
                author,
                source: 'Wikimedia Commons',
              });

              return acc;
            }, [])
            .slice(0, limit);

          return {
            query,
            items,
          };
        })
      );
  }
}
