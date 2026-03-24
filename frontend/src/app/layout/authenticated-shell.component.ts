import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, extractApiErrorMessage } from '../auth/auth.service';

@Component({
  selector: 'app-authenticated-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './authenticated-shell.component.html',
  styleUrl: './authenticated-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthenticatedShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoggingOut = signal(false);
  readonly errorMessage = signal('');
  readonly currentUser = this.authService.currentUser;
  readonly displayName = computed(() => {
    const user = this.currentUser();

    if (!user) {
      return '';
    }

    return user.full_name || user.fullName || user.name || user.email;
  });

  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.errorMessage.set('');
    this.isLoggingOut.set(true);

    this.authService.logout().pipe(
      finalize(() => {
        this.isLoggingOut.set(false);
      })
    ).subscribe({
      next: () => {
        void this.router.navigate(['/login']);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'ההתנתקות נכשלה. נסו שוב.'));
      }
    });
  }
}