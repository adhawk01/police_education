import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureInitialized();

  return authService.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

export const guestOnlyGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureInitialized();

  return authService.isAuthenticated() ? router.createUrlTree(['/home']) : true;
};

export const adminRoleGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureInitialized();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return authService.canAccessAdmin() ? true : router.createUrlTree(['/home']);
};