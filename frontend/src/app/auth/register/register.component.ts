import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PageHeroComponent } from '../../shared/ui/page-hero/page-hero.component';
import { AuthService, extractApiErrorMessage } from '../auth.service';

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword || password === confirmPassword) {
    return null;
  }

  return { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeroComponent],
  templateUrl: './register.component.html',
  styleUrl: '../auth-form.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.formBuilder.nonNullable.group(
    {
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    {
      validators: passwordMatchValidator
    }
  );

  submit(): void {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);

    this.authService.register({ fullName, email, password }).pipe(
      finalize(() => {
        this.isSubmitting.set(false);
      })
    ).subscribe({
      next: () => {
        void this.router.navigate(['/login'], { queryParams: { registered: '1' } });
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'ההרשמה נכשלה. נסו שוב.'));
      }
    });
  }

  shouldShowControlError(controlName: 'fullName' | 'email' | 'password' | 'confirmPassword'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  fullNameErrorMessage(): string {
    if (this.form.controls.fullName.hasError('required')) {
      return 'יש להזין שם מלא.';
    }

    return '';
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
    const control = this.form.controls.password;

    if (control.hasError('required')) {
      return 'יש להזין סיסמה.';
    }

    if (control.hasError('minlength')) {
      return 'הסיסמה חייבת להכיל לפחות 8 תווים.';
    }

    return '';
  }

  confirmPasswordErrorMessage(): string {
    const control = this.form.controls.confirmPassword;

    if (control.hasError('required')) {
      return 'יש לאשר את הסיסמה.';
    }

    if (this.form.hasError('passwordMismatch') && (control.touched || control.dirty)) {
      return 'אימות הסיסמה אינו תואם לסיסמה שהוזנה.';
    }

    return '';
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible.update((visible) => !visible);
  }
}