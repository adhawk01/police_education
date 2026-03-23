import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchCategoryOption, SearchCityOption, SearchFiltersResponse, SearchOption } from '../../search.models';

@Component({
  selector: 'app-search-filters-sidebar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-filters-sidebar.component.html',
  styleUrl: './search-filters-sidebar.component.css'
})
export class SearchFiltersSidebarComponent {
  readonly form = input.required<FormGroup>();
  readonly filters = input<SearchFiltersResponse | null>(null);
  readonly availableCities = input<SearchCityOption[]>([]);
  readonly loading = input(false);

  readonly apply = output<void>();
  readonly clear = output<void>();

  clearSearchText(): void {
    const control = this.form().get('q');

    if (!control) {
      return;
    }

    control.setValue('');
    control.markAsDirty();
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  trackByValue(_: number, item: SearchOption): string | number {
    return item.id ?? item.value;
  }

  trackByCategory(_: number, item: SearchCategoryOption): number {
    return item.id;
  }

  isMultiSelected(controlName: 'category_ids' | 'audience_ids', value: number): boolean {
    const values = (this.form().get(controlName)?.value as number[] | null) ?? [];

    return values.includes(value);
  }

  toggleMultiValue(controlName: 'category_ids' | 'audience_ids', value: number, autoApply = false): void {
    const control = this.form().get(controlName);

    if (!control) {
      return;
    }

    const currentValues = ((control.value as number[] | null) ?? []).slice();
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((currentValue) => currentValue !== value)
      : [...currentValues, value];

    control.setValue(nextValues);
    control.markAsDirty();

    if (autoApply) {
      this.apply.emit();
    }
  }
}