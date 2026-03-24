import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, tap, throwError } from 'rxjs';
import { apiConfig } from '../api.config';
import { AuthApiResponse, AuthUser, LoginPayload, RegisterPayload } from './auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly loginUrl = `${apiConfig.baseUrl}/api/auth/login`;
  private readonly registerUrl = `${apiConfig.baseUrl}/api/auth/register`;
  private readonly logoutUrl = `${apiConfig.baseUrl}/api/auth/logout`;
  private readonly meUrl = `${apiConfig.baseUrl}/api/auth/me`;
  private readonly userState = signal<AuthUser | null>(null);
  private readonly initializedState = signal(false);

  readonly currentUser = computed(() => this.userState());
  readonly authenticated = computed(() => this.userState() !== null);
  readonly initialized = computed(() => this.initializedState());

  ensureInitialized(): Promise<void> {
    if (this.initializedState()) {
      return Promise.resolve();
    }

    return firstValueFrom(this.fetchCurrentUser()).then(() => undefined).catch(() => undefined);
  }

  login(payload: LoginPayload): Observable<AuthUser> {
    return this.http.post<AuthApiResponse | AuthUser>(this.loginUrl, payload, { withCredentials: true }).pipe(
      map((response) => this.requireUser(response, { email: payload.email })),
      tap((user) => {
        this.userState.set(user);
        this.initializedState.set(true);
      }),
      catchError((error) => this.throwFriendlyError(error, 'ההתחברות נכשלה. נסו שוב.'))
    );
  }

  register(payload: RegisterPayload): Observable<void> {
    return this.http.post<unknown>(
      this.registerUrl,
      {
        full_name: payload.fullName,
        email: payload.email,
        password: payload.password
      },
      { withCredentials: true }
    ).pipe(
      map(() => undefined),
      catchError((error) => this.throwFriendlyError(error, 'ההרשמה נכשלה. נסו שוב.'))
    );
  }

  logout(): Observable<void> {
    return this.http.post<unknown>(this.logoutUrl, {}, { withCredentials: true }).pipe(
      map(() => undefined),
      tap(() => {
        this.userState.set(null);
        this.initializedState.set(true);
      }),
      catchError((error) => this.throwFriendlyError(error, 'ההתנתקות נכשלה. נסו שוב.'))
    );
  }

  getCurrentUser(forceRefresh = false): Observable<AuthUser | null> {
    if (!forceRefresh && this.initializedState()) {
      return of(this.userState());
    }

    return this.fetchCurrentUser();
  }

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  private fetchCurrentUser(): Observable<AuthUser | null> {
    return this.http.get<AuthApiResponse | AuthUser | null>(this.meUrl, { withCredentials: true }).pipe(
      map((response) => this.extractUser(response)),
      tap((user) => {
        this.userState.set(user);
        this.initializedState.set(true);
      }),
      catchError((error) => {
        if (this.isUnauthorized(error)) {
          this.userState.set(null);
          this.initializedState.set(true);
          return of(null);
        }

        this.userState.set(null);
        this.initializedState.set(true);
        return throwError(() => error);
      })
    );
  }

  private extractUser(response: AuthApiResponse | AuthUser | null | undefined): AuthUser | null {
    if (!response) {
      return null;
    }

    const directUser = this.normalizeUser(response);

    if (directUser) {
      return directUser;
    }

    if ('user' in response) {
      return this.normalizeUser(response.user);
    }

    if ('data' in response) {
      return this.normalizeUser(response.data?.user);
    }

    return null;
  }

  private requireUser(response: AuthApiResponse | AuthUser, fallback: Pick<AuthUser, 'email'>): AuthUser {
    return this.extractUser(response) ?? { email: fallback.email };
  }

  private normalizeUser(value: unknown): AuthUser | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const email = typeof candidate['email'] === 'string' ? candidate['email'].trim() : '';

    if (!email) {
      return null;
    }

    return {
      id: typeof candidate['id'] === 'number' ? candidate['id'] : undefined,
      email,
      full_name: typeof candidate['full_name'] === 'string' ? candidate['full_name'] : null,
      fullName: typeof candidate['fullName'] === 'string' ? candidate['fullName'] : null,
      name: typeof candidate['name'] === 'string' ? candidate['name'] : null
    };
  }

  private isUnauthorized(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }

  private throwFriendlyError(error: unknown, fallbackMessage: string): Observable<never> {
    return throwError(() => new Error(extractApiErrorMessage(error, fallbackMessage)));
  }
}

export function extractApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error instanceof HttpErrorResponse) {
    const payload = error.error;

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const candidate = payload as Record<string, unknown>;
      const nestedMessage = candidate['message'] ?? candidate['error'] ?? candidate['detail'];

      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage;
      }
    }
  }

  return fallbackMessage;
}