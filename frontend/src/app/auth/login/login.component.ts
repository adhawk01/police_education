import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { PageHeroComponent } from '../../shared/ui/page-hero/page-hero.component';
import { AuthService, extractApiErrorMessage } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeroComponent],
  templateUrl: './login.component.html',
  styleUrl: '../auth-form.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isSubmitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal(
    this.route.snapshot.queryParamMap.get('registered') === '1'
      ? 'ההרשמה הושלמה בהצלחה. אפשר להתחבר למערכת.'
      : ''
  );

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  submit(): void {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.authService.login(this.form.getRawValue()).pipe(
      finalize(() => {
        this.isSubmitting.set(false);
      })
    ).subscribe({
      next: () => {
        void this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'ההתחברות נכשלה. נסו שוב.'));
      }
    });
  }

  shouldShowControlError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  emailErrorMessage(): string {
    const control = this.form.controls.email;

    if (control.hasError('required')) {
      return 'יש להזין כתובת דוא"ל.';
    }

    if (control.hasError('email')) {
      return 'יש להזין כתובת דוא"ל תקינה.';
    }

    return '';
  }

  passwordErrorMessage(): string {
    if (this.form.controls.password.hasError('required')) {
      return 'יש להזין סיסמה.';
    }

    return '';
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }
}