import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiConfig } from '../api.config';
import { SearchFiltersResponse, SearchRequest, SearchResponse } from './search.models';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly searchUrl = `${apiConfig.baseUrl}/api/search`;
  private readonly filtersUrl = `${apiConfig.baseUrl}/api/search/filters`;

  getFilters(): Observable<SearchFiltersResponse> {
    return this.http.get<SearchFiltersResponse>(this.filtersUrl);
  }

  search(payload: SearchRequest): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(this.searchUrl, payload);
  }
}