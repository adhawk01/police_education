export interface AuthUser {
  id?: number;
  email: string;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface AuthApiResponse {
  user?: unknown;
  data?: {
    user?: unknown;
  };
  message?: string;
  error?: string;
}