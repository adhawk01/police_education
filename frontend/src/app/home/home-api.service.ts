import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { apiConfig } from '../api.config';
import { HomeApiResponse } from './home-api.models';

@Injectable({
  providedIn: 'root'
})
export class HomeApiService {
  private readonly http = inject(HttpClient);
  private readonly homeApiUrl = `${apiConfig.baseUrl}/api/home`;

  getHomeData(): Observable<HomeApiResponse> {
    return this.http.get<HomeApiResponse>(this.homeApiUrl).pipe(
      tap((response) => {
        console.log('GET /api/home response:', response);
      })
    );
  }
}