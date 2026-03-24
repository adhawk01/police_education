import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiConfig } from '../api.config';
import { ContentDetailsResponse } from './content-details.models';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly contentApiUrl = `${apiConfig.baseUrl}/api/content-items`;

  getContentItemById(id: number | string): Observable<ContentDetailsResponse> {
    return this.http.get<ContentDetailsResponse>(`${this.contentApiUrl}/${encodeURIComponent(String(id))}`);
  }
}