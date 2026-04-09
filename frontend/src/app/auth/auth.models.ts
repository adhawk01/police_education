export interface AuthUser {
  id?: number;
  email: string;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  roles?: string[];
  permissions?: string[];
  status?: {
    id?: number;
    code?: string;
    name?: string;
    is_active?: boolean;
  };
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