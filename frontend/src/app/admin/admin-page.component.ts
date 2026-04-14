import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { AuthService, extractApiErrorMessage } from '../auth/auth.service';
import {
  AdminItemDetails,
  AdminListItem,
  AdminListQuery,
  AdminMetadataResponse,
  AdminStatus,
  AdminWritePayload,
} from './admin.models';
import { AdminService } from './admin.service';
import { PageHeroComponent } from '../shared/ui/page-hero/page-hero.component';

interface MediaItem {
  media_file_id?: number;
  file_url: string;
  is_primary: boolean;
  alt_text: string;
  is_new: boolean;
  to_delete: boolean;
  local_file?: File;
  local_preview?: string;
}

type CloseIntent = 'close' | 'cancel' | 'backdrop' | 'escape';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeroComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPageComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly filtersForm = this.formBuilder.nonNullable.group({
    q: '',
    status_ids: this.formBuilder.nonNullable.control<string[]>([]),
    category_ids: this.formBuilder.nonNullable.control<string[]>([]),
    area_ids: this.formBuilder.nonNullable.control<string[]>([]),
    city_ids: this.formBuilder.nonNullable.control<string[]>([]),
    is_active_values: this.formBuilder.nonNullable.control<string[]>([]),
  });

  readonly editorForm = this.formBuilder.nonNullable.group({
    content_type_id: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    short_description: [''],
    full_description: [''],
    audience_notes: [''],
    status_id: ['', Validators.required],
    published_at: [''],
    category_ids: this.formBuilder.nonNullable.control<number[]>([]),
    location_id: [''],
    location_place_name: [''],
    location_address_line: [''],
    location_accessibility_notes: [''],
    primary_media_file_id: [''],
    is_featured: false,
    is_active: true,
    duration_minutes: [''],
    min_participants: [''],
    max_participants: [''],
    price_type: [''],
    price_min: [''],
    price_max: [''],
    currency: ['ILS'],
    booking_required: false,
    security_benefit_available: false,
    security_benefit_notes: [''],
    website_url: [''],
    booking_url: [''],
    phone: [''],
    email: [''],
  });

  metadata: AdminMetadataResponse | null = null;
  items: AdminListItem[] = [];
  mediaItems: MediaItem[] = [];
  isDraggingOver = false;
  editorAreaId = '';
  editorCityId = '';
  editorCityName = '';
  showCitySuggestions = false;
  confirmDiscardVisible = false;
  closeIntent: CloseIntent | null = null;

  private initialEditorAreaId = '';
  private initialEditorCityId = '';
  private initialEditorCityName = '';
  private initialMediaSignature = '';

  selectedItem: AdminItemDetails | null = null;
  selectedItemId: number | null = null;
  editorMode: 'create' | 'edit' = 'create';
  editorVisible = false;
  showFilters = true;

  loadingMetadata = false;
  loadingItems = false;
  savingItem = false;

  listError = '';
  metadataError = '';
  saveError = '';
  aiFullDescriptionLoading = false;
  aiAccessibilityLoading = false;
  aiFullDescriptionError = '';
  aiAccessibilityError = '';

  page = 1;
  pageSize = 10;
  totalCount = 0;
  sortBy = 'title_asc';
  private initialListLoaded = false;

  ngOnInit(): void {
    this.filtersForm.controls.area_ids.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const currentCityIds = this.filtersForm.controls.city_ids.value;
        if (!currentCityIds.length) {
          return;
        }

        const allowedCityIds = new Set(this.availableCities.map((city) => String(city.id)));
        const nextCityIds = currentCityIds.filter((cityId) => allowedCityIds.has(cityId));

        if (nextCityIds.length !== currentCityIds.length) {
          this.filtersForm.controls.city_ids.setValue(nextCityIds);
        }
      });

    this.authService.ensureInitialized().then(() => {
      this.changeDetectorRef.markForCheck();
    });

    this.loadMetadataAndList();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, start + 4);

    for (let current = Math.max(1, end - 4); current <= end; current += 1) {
      pages.push(current);
    }

    return pages;
  }

  get availableCities() {
    if (!this.metadata) {
      return [];
    }

    const selectedAreaIds = this.selectedAreaIds();
    if (!selectedAreaIds?.length) {
      return this.metadata.cities;
    }

    const selectedSet = new Set(selectedAreaIds);
    return this.metadata.cities.filter((city) => selectedSet.has(city.area_id));
  }

  get statusChoices(): AdminStatus[] {
    return this.metadata?.statuses ?? [];
  }

  get canSubmitForApproval(): boolean {
    if (this.editorMode !== 'edit' || !this.selectedItemId || !this.selectedItem) {
      return false;
    }

    return this.hasSiteAdminPermission() && this.isDraftStatus(this.selectedItem.status);
  }

  get canApproveSelectedItem(): boolean {
    if (this.editorMode !== 'edit' || !this.selectedItemId || !this.selectedItem) {
      return false;
    }

    return this.hasApproverPermission() && this.isPendingApprovalStatus(this.selectedItem.status);
  }

  get selectedStatusName(): string {
    const fallback = this.selectedItem?.status?.name ?? '';
    const statusId = this.toNumberOrNull(this.editorForm.controls.status_id.value);
    if (statusId === null) {
      return fallback;
    }

    const status = this.statusChoices.find((item) => item.id === statusId);
    return status?.name ?? fallback;
  }

  get editorAvailableCities() {
    if (!this.metadata) {
      return [];
    }

    const areaId = this.toNumberOrNull(this.editorAreaId);
    if (areaId === null) {
      return this.metadata.cities;
    }

    return this.metadata.cities.filter((city) => city.area_id === areaId);
  }

  get editorCityOptions(): string[] {
    const names = this.editorAvailableCities.map((city) => city.name);

    return Array.from(new Set(names));
  }

  get visibleCityOptions(): string[] {
    const query = this.editorCityName.trim().toLowerCase();
    const options = this.editorCityOptions;

    if (!query) {
      return options.slice(0, 20);
    }

    return options
      .filter((cityName) => cityName.toLowerCase().includes(query))
      .slice(0, 20);
  }

  get editorAvailableLocations() {
    if (!this.metadata) {
      return [];
    }

    const areaId = this.toNumberOrNull(this.editorAreaId);
    const cityId = this.toNumberOrNull(this.editorCityId);
    const locations = this.metadata.locations ?? [];

    return locations.filter((location) => {
      if (areaId !== null && location.area_id !== areaId) {
        return false;
      }
      if (cityId !== null) {
        return location.city_id === cityId;
      }
      return true;
    });
  }

  trackByItem(_: number, item: AdminListItem): number {
    return item.id;
  }

  loadMetadataAndList(): void {
    this.loadMetadata();
  }

  applyFilters(): void {
    this.page = 1;
    this.loadList();
  }

  sortByTitle(): void {
    if (this.sortBy === 'title_asc') {
      this.sortBy = 'title_desc';
    } else {
      this.sortBy = 'title_asc';
    }
    this.page = 1;
    this.loadList();
  }

  get titleSortIcon(): string {
    if (this.sortBy === 'title_asc') return '↑';
    if (this.sortBy === 'title_desc') return '↓';
    return '↕';
  }

  clearFilters(): void {
    this.filtersForm.reset({
      q: '',
      status_ids: this.defaultStatusIdsExcludingArchive(),
      category_ids: [] as string[],
      area_ids: [] as string[],
      city_ids: [] as string[],
      is_active_values: [] as string[],
    });

    this.page = 1;
    this.loadList();
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) {
      return;
    }

    this.page = nextPage;
    this.loadList();
  }

  openCreate(): void {
    this.editorMode = 'create';
    this.selectedItem = null;
    this.selectedItemId = null;
    this.saveError = '';
    this.editorVisible = true;
    this.setBodyScrollLock(true);
    this.mediaItems = [];
    this.isDraggingOver = false;
    this.editorAreaId = '';
    this.editorCityId = '';
    this.editorCityName = '';
    this.showCitySuggestions = false;
    this.resetAiStates();
    this.resetEditorForm();
    this.captureEditorSnapshot();
  }

  openEdit(item: AdminListItem): void {
    this.editorMode = 'edit';
    this.selectedItem = null;
    this.selectedItemId = item.id;
    this.saveError = '';
    this.editorVisible = true;
    this.setBodyScrollLock(true);
    this.mediaItems = [];
    this.isDraggingOver = false;
    this.editorAreaId = '';
    this.editorCityId = '';
    this.editorCityName = '';
    this.showCitySuggestions = false;
    this.resetAiStates();
    this.resetEditorForm();
    this.captureEditorSnapshot();

    this.savingItem = true;
    this.adminService.getContentItemById(item.id)
      .pipe(
        finalize(() => {
          this.savingItem = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (details) => {
          this.selectedItem = details;
          this.patchEditorFromDetails(details);
          this.initMediaFromDetails(details);
          this.captureEditorSnapshot();
        },
        error: (error: unknown) => {
          this.saveError = extractApiErrorMessage(error, 'לא ניתן לטעון את פרטי הפריט לעריכה.');
        }
      });
  }

  closeEditor(): void {
    this.confirmDiscardVisible = false;
    this.closeIntent = null;
    this.editorVisible = false;
    this.saveError = '';
    this.editorAreaId = '';
    this.editorCityId = '';
    this.editorCityName = '';
    this.showCitySuggestions = false;
    this.setBodyScrollLock(false);
  }

  requestClose(intent: CloseIntent): void {
    if (this.savingItem) {
      return;
    }

    if (this.hasPendingEditorChanges()) {
      this.closeIntent = intent;
      this.confirmDiscardVisible = true;
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.closeEditor();
  }

  continueEditing(): void {
    this.confirmDiscardVisible = false;
    this.closeIntent = null;
    this.changeDetectorRef.markForCheck();
  }

  discardChangesAndClose(): void {
    this.closeEditor();
  }

  saveAndCloseFromPrompt(): void {
    this.closeIntent = 'close';
    this.confirmDiscardVisible = true;
    this.saveItem();
  }

  get canSaveFromClosePrompt(): boolean {
    return this.closeIntent === 'close';
  }

  onEditorAreaChange(rawAreaId: string): void {
    this.editorAreaId = rawAreaId || '';

    const selectedCity = this.toNumberOrNull(this.editorCityId);
    if (
      selectedCity !== null
      && !this.editorAvailableCities.some((city) => city.id === selectedCity)
    ) {
      this.editorCityId = '';
      this.editorCityName = '';
    }

    if (this.editorCityId) {
      const selectedCity = this.editorAvailableCities.find((city) => String(city.id) === this.editorCityId);
      this.editorCityName = selectedCity?.name ?? this.editorCityName;
    }

    this.syncLocationWithAreaCity();
    this.changeDetectorRef.markForCheck();
  }

  onEditorCityChange(rawValue: string): void {
    const normalized = rawValue.trim();
    this.editorCityName = normalized;
    this.showCitySuggestions = true;

    const matchedCity = this.editorAvailableCities.find((city) => city.name === normalized);
    this.editorCityId = matchedCity ? String(matchedCity.id) : '';

    this.syncLocationWithAreaCity();
    this.changeDetectorRef.markForCheck();
  }

  onEditorCityFocus(): void {
    this.showCitySuggestions = true;
    this.changeDetectorRef.markForCheck();
  }

  onEditorCityBlur(): void {
    setTimeout(() => {
      this.showCitySuggestions = false;
      this.changeDetectorRef.markForCheck();
    }, 150);
  }

  selectEditorCity(cityName: string): void {
    this.editorCityName = cityName;
    this.showCitySuggestions = false;

    const matchedCity = this.editorAvailableCities.find((city) => city.name === cityName);
    this.editorCityId = matchedCity ? String(matchedCity.id) : '';

    this.syncLocationWithAreaCity();
    this.changeDetectorRef.markForCheck();
  }

  onEditorLocationChange(rawLocationId: string): void {
    this.editorForm.controls.location_id.setValue(rawLocationId || '');

    const locationId = this.toNumberOrNull(rawLocationId);
    if (locationId === null || !this.metadata) {
      this.changeDetectorRef.markForCheck();
      return;
    }

    const selectedLocation = (this.metadata.locations ?? []).find((location) => location.id === locationId);
    if (!selectedLocation) {
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.editorAreaId = String(selectedLocation.area_id);
    this.editorCityId = selectedLocation.city_id ? String(selectedLocation.city_id) : '';
    this.editorCityName = this.editorAvailableCities.find((city) => String(city.id) === this.editorCityId)?.name ?? '';
    this.editorForm.controls.location_place_name.setValue(selectedLocation.place_name ?? '');
    this.editorForm.controls.location_address_line.setValue(selectedLocation.address_line ?? '');
    this.changeDetectorRef.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.editorVisible && !this.savingItem) {
      this.requestClose('escape');
    }
  }

  toggleCategory(categoryId: number, checked: boolean): void {
    const current = this.editorForm.controls.category_ids.value;

    if (checked) {
      if (!current.includes(categoryId)) {
        this.editorForm.controls.category_ids.setValue([...current, categoryId]);
      }
      return;
    }

    this.editorForm.controls.category_ids.setValue(current.filter((id) => id !== categoryId));
  }

  isCategoryChecked(categoryId: number): boolean {
    return this.editorForm.controls.category_ids.value.includes(categoryId);
  }

  saveItem(): void {
    if (this.editorForm.invalid || this.savingItem) {
      this.editorForm.markAllAsTouched();
      return;
    }

    this.savingItem = true;
    this.saveError = '';
    this.changeDetectorRef.markForCheck();

    this.uploadPendingLocalFiles()
      .pipe(
        switchMap(() => {
          const payload = this.buildWritePayload();
          return this.editorMode === 'create'
            ? this.adminService.createContentItem(payload)
            : this.adminService.updateContentItem(this.selectedItemId as number, payload);
        }),
        finalize(() => {
          this.savingItem = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.selectedItem = null;
          this.selectedItemId = null;
          this.closeEditor();
          queueMicrotask(() => this.loadList());
        },
        error: (error: unknown) => {
          this.saveError = extractApiErrorMessage(error, 'שמירת הפריט נכשלה.');
          if (this.closeIntent === 'close') {
            this.confirmDiscardVisible = true;
          }
        }
      });
  }

  generateAiForFullDescription(): void {
    if (this.aiFullDescriptionLoading || this.savingItem) {
      return;
    }

    const title = this.editorForm.controls.title.value.trim();
    if (!title) {
      this.aiFullDescriptionError = 'יש להזין כותרת לפני הפקת תוכן בעזרת AI.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.aiFullDescriptionLoading = true;
    this.aiFullDescriptionError = '';

    this.adminService.askAi(this.buildGeneralInfoPrompt(title))
      .pipe(
        finalize(() => {
          this.aiFullDescriptionLoading = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (payload) => {
          const answer = this.extractAiAnswer(payload);
          if (!answer) {
            this.aiFullDescriptionError = 'לא התקבלה תשובה תקינה ממנוע ה-AI.';
            return;
          }

          const existing = this.editorForm.controls.full_description.value.trim();
          this.editorForm.controls.full_description.setValue(existing ? `${existing}\n\n${answer}` : answer);
          this.editorForm.controls.full_description.markAsDirty();
        },
        error: () => {
          this.aiFullDescriptionError = 'לא ניתן לקבל כרגע תשובת AI. נסו שוב בעוד רגע.';
        }
      });
  }

  generateAiForAccessibilityNotes(): void {
    if (this.aiAccessibilityLoading || this.savingItem) {
      return;
    }

    const title = this.editorForm.controls.title.value.trim();
    if (!title) {
      this.aiAccessibilityError = 'יש להזין כותרת לפני הפקת תוכן בעזרת AI.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.aiAccessibilityLoading = true;
    this.aiAccessibilityError = '';

    this.adminService.askAi(this.buildAccessibilityPrompt(title))
      .pipe(
        finalize(() => {
          this.aiAccessibilityLoading = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (payload) => {
          const answer = this.extractAiAnswer(payload);
          if (!answer) {
            this.aiAccessibilityError = 'לא התקבלה תשובה תקינה ממנוע ה-AI.';
            return;
          }

          const existing = this.editorForm.controls.location_accessibility_notes.value.trim();
          this.editorForm.controls.location_accessibility_notes.setValue(existing ? `${existing}\n\n${answer}` : answer);
          this.editorForm.controls.location_accessibility_notes.markAsDirty();
        },
        error: () => {
          this.aiAccessibilityError = 'לא ניתן לקבל כרגע תשובת AI. נסו שוב בעוד רגע.';
        }
      });
  }

  submitForApproval(): void {
    if (!this.selectedItemId || this.savingItem || !this.canSubmitForApproval) {
      return;
    }

    this.savingItem = true;
    this.saveError = '';

    this.adminService.submitForApproval(this.selectedItemId)
      .pipe(
        finalize(() => {
          this.savingItem = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          this.selectedItem = updated;
          this.editorForm.controls.status_id.setValue(String(updated.status.id));
          this.captureEditorSnapshot();
          this.loadList();
        },
        error: (error: unknown) => {
          this.saveError = extractApiErrorMessage(error, 'שליחה לאישור נכשלה.');
        }
      });
  }

  approveSelectedItem(): void {
    if (!this.selectedItemId || this.savingItem || !this.canApproveSelectedItem) {
      return;
    }

    this.savingItem = true;
    this.saveError = '';

    this.adminService.approveContent(this.selectedItemId)
      .pipe(
        finalize(() => {
          this.savingItem = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          this.selectedItem = updated;
          this.editorForm.controls.status_id.setValue(String(updated.status.id));
          this.captureEditorSnapshot();
          this.loadList();
        },
        error: (error: unknown) => {
          this.saveError = extractApiErrorMessage(error, 'אישור התוכן נכשל.');
        }
      });
  }

  archiveItem(item: AdminListItem): void {
    if (this.savingItem) {
      return;
    }

    const archivedStatus = this.resolveArchivedStatus();
    if (!archivedStatus) {
      this.saveError = 'לא נמצא סטטוס ארכיון במערכת.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    if (item.status.id === archivedStatus.id) {
      return;
    }

    const previousStatus = { ...item.status };
    item.status = { id: archivedStatus.id, code: archivedStatus.code, name: archivedStatus.name };
    this.changeDetectorRef.markForCheck();

    this.savingItem = true;
    this.saveError = '';

    this.adminService.deactivateContentItem(item.id)
      .pipe(
        finalize(() => {
          this.savingItem = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          item.status = { id: updated.status.id, code: updated.status.code, name: updated.status.name };
          this.changeDetectorRef.markForCheck();
        },
        error: (error: unknown) => {
          item.status = previousStatus;
          this.saveError = extractApiErrorMessage(error, 'העברה לארכיון נכשלה.');
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  isArchivedStatus(item: AdminListItem): boolean {
    const code = (item.status.code || '').trim().toLowerCase();
    const name = (item.status.name || '').trim();
    return code === 'archived' || name === 'בארכיון';
  }

  toggleActive(item: AdminListItem): void {
    if (this.savingItem) {
      return;
    }

    const newIsActive = !item.is_active;

    // Optimistic update so the toggle reflects the change immediately.
    item.is_active = newIsActive;
    this.changeDetectorRef.markForCheck();

    this.savingItem = true;
    this.saveError = '';

    this.adminService.patchContentItemStatus(item.id, { status_id: item.status.id, is_active: newIsActive })
      .pipe(
        finalize(() => {
          this.savingItem = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          item.is_active = updated.is_active;
          this.changeDetectorRef.markForCheck();
        },
        error: (error: unknown) => {
          // Revert optimistic change on failure.
          item.is_active = !newIsActive;
          this.saveError = extractApiErrorMessage(error, 'עדכון מצב הפעילות נכשל.');
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  private loadMetadata(): void {
    this.loadingMetadata = true;
    this.metadataError = '';

    this.adminService.getMetadata()
      .pipe(
        finalize(() => {
          this.loadingMetadata = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.metadata = {
            ...response,
            locations: response.locations ?? [],
          };

          if (!this.initialListLoaded) {
            this.filtersForm.controls.status_ids.setValue(this.defaultStatusIdsExcludingArchive());
            this.initialListLoaded = true;
            this.loadList();
          }
        },
        error: (error: unknown) => {
          this.metadata = null;
          this.metadataError = extractApiErrorMessage(error, 'לא ניתן לטעון נתוני עזר לניהול.');

          if (!this.initialListLoaded) {
            this.initialListLoaded = true;
            this.loadList();
          }
        }
      });
  }

  private resolveArchivedStatus(): AdminStatus | null {
    const statuses = this.metadata?.statuses ?? [];
    const byCode = statuses.find((status) => (status.code || '').trim().toLowerCase() === 'archived');
    if (byCode) {
      return byCode;
    }

    const byName = statuses.find((status) => status.name.trim() === 'בארכיון');
    return byName ?? null;
  }

  private loadList(): void {
    this.loadingItems = true;
    this.listError = '';

    const query: AdminListQuery = {
      q: this.filtersForm.controls.q.value.trim() || undefined,
      status_ids: this.selectedStatusIds(),
      category_ids: this.selectedCategoryIds(),
      area_ids: this.selectedAreaIds(),
      city_ids: this.selectedCityIds(),
      is_active_values: this.selectedIsActiveValues(),
      page: this.page,
      page_size: this.pageSize,
      sort_by: this.sortBy,
    };

    this.adminService.listContentItems(query)
      .pipe(
        finalize(() => {
          this.loadingItems = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.items = response.items;
          this.page = response.page;
          this.pageSize = response.page_size;
          this.totalCount = response.total_count;
        },
        error: (error: unknown) => {
          this.items = [];
          this.totalCount = 0;
          this.listError = extractApiErrorMessage(error, 'לא ניתן לטעון את רשימת התכנים.');
        }
      });
  }

  private defaultStatusIdsExcludingArchive(): string[] {
    const statuses = this.metadata?.statuses ?? [];

    return statuses
      .filter((status) => (status.code || '').trim().toLowerCase() !== 'archived' && status.name.trim() !== 'בארכיון')
      .map((status) => String(status.id));
  }

  private selectedStatusIds(): number[] | null {
    return this.selectedNumberIds(this.filtersForm.controls.status_ids.value ?? []);
  }

  private selectedCategoryIds(): number[] | null {
    return this.selectedNumberIds(this.filtersForm.controls.category_ids.value ?? []);
  }

  private selectedAreaIds(): number[] | null {
    return this.selectedNumberIds(this.filtersForm.controls.area_ids.value ?? []);
  }

  private selectedCityIds(): number[] | null {
    return this.selectedNumberIds(this.filtersForm.controls.city_ids.value ?? []);
  }

  private selectedIsActiveValues(): boolean[] | null {
    const selected = this.filtersForm.controls.is_active_values.value ?? [];
    const values = selected
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value === 'true' || value === 'false')
      .map((value) => value === 'true');

    const uniqueValues = Array.from(new Set(values));
    return uniqueValues.length ? uniqueValues : null;
  }

  private selectedNumberIds(selected: string[]): number[] | null {
    const ids = selected
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    return ids.length ? ids : null;
  }

  private resetEditorForm(): void {
    const defaultStatus = this.resolveDraftStatusId() ?? this.metadata?.statuses?.[0]?.id;
    const defaultType = this.metadata?.content_types?.[0]?.id;

    this.editorForm.reset({
      content_type_id: defaultType ? String(defaultType) : '',
      title: '',
      short_description: '',
      full_description: '',
      audience_notes: '',
      status_id: defaultStatus ? String(defaultStatus) : '',
      published_at: '',
      category_ids: [] as number[],
      location_id: '',
      location_place_name: '',
      location_address_line: '',
      location_accessibility_notes: '',
      primary_media_file_id: '',
      is_featured: false,
      is_active: true,
      duration_minutes: '',
      min_participants: '',
      max_participants: '',
      price_type: '',
      price_min: '',
      price_max: '',
      currency: 'ILS',
      booking_required: false,
      security_benefit_available: false,
      security_benefit_notes: '',
      website_url: '',
      booking_url: '',
      phone: '',
      email: '',
    });
  }

  private patchEditorFromDetails(details: AdminItemDetails): void {
    this.editorForm.patchValue({
      content_type_id: String(details.content_type_id ?? ''),
      title: details.title ?? '',
      short_description: details.short_description ?? '',
      full_description: details.full_description ?? '',
      audience_notes: details.audience_notes ?? '',
      status_id: String(details.status?.id ?? ''),
      published_at: this.toInputDateTimeValue(details.published_at),
      category_ids: details.categories.map((category) => category.category_id),
      location_id: details.location?.location_id ? String(details.location.location_id) : '',
      location_place_name: details.location?.place_name ?? '',
      location_address_line: details.location?.address_line ?? '',
      location_accessibility_notes: details.location?.accessibility_notes ?? '',
      primary_media_file_id: details.media?.[0]?.media_file_id ? String(details.media[0].media_file_id) : '',
      is_featured: details.is_featured,
      is_active: details.is_active,
      duration_minutes: this.toText(details.operational_details?.duration_minutes),
      min_participants: this.toText(details.operational_details?.min_participants),
      max_participants: this.toText(details.operational_details?.max_participants),
      price_type: details.operational_details?.price_type ?? '',
      price_min: this.toText(details.operational_details?.price_min),
      price_max: this.toText(details.operational_details?.price_max),
      currency: details.operational_details?.currency ?? 'ILS',
      booking_required: this.toBoolean(details.operational_details?.booking_required),
      security_benefit_available: this.toBoolean(details.operational_details?.security_benefit_available),
      security_benefit_notes: details.operational_details?.security_benefit_notes ?? '',
      website_url: details.operational_details?.website_url ?? '',
      booking_url: details.operational_details?.booking_url ?? '',
      phone: details.operational_details?.phone ?? '',
      email: details.operational_details?.email ?? '',
    });

    this.editorAreaId = details.location?.area_id ? String(details.location.area_id) : '';
    this.editorCityId = details.location?.city_id ? String(details.location.city_id) : '';
    this.editorCityName = details.location?.city_name ?? '';
    this.syncLocationWithAreaCity();
  }

  private syncLocationWithAreaCity(): void {
    const selectedLocationId = this.toNumberOrNull(this.editorForm.controls.location_id.value);
    if (selectedLocationId === null) {
      return;
    }

    const isStillAvailable = this.editorAvailableLocations.some((location) => location.id === selectedLocationId);
    if (!isStillAvailable) {
      this.editorForm.controls.location_id.setValue('');
    }
  }

  private buildWritePayload(): AdminWritePayload {
    const mediaToAdd = this.mediaItems
      .filter((item) => item.is_new && !item.to_delete)
      .map((item) => ({ file_url: item.file_url, is_primary: item.is_primary, alt_text: item.alt_text }));

    const mediaToRemove = this.mediaItems
      .filter((item) => !item.is_new && item.to_delete && item.media_file_id !== undefined)
      .map((item) => item.media_file_id as number);

    const locationData = this.buildLocationData();

    return {
      content_type_id: this.requiredNumber(this.editorForm.controls.content_type_id.value),
      title: this.editorForm.controls.title.value.trim(),
      short_description: this.nullIfEmpty(this.editorForm.controls.short_description.value),
      full_description: this.nullIfEmpty(this.editorForm.controls.full_description.value),
      status_id: this.requiredNumber(this.editorForm.controls.status_id.value),
      audience_notes: this.nullIfEmpty(this.editorForm.controls.audience_notes.value),
      is_featured: this.editorForm.controls.is_featured.value,
      is_active: this.editorForm.controls.is_active.value,
      published_at: this.toDateTimePayload(this.editorForm.controls.published_at.value),
      category_ids: this.editorForm.controls.category_ids.value,
      location_id: this.toNumberOrNull(this.editorForm.controls.location_id.value),
      location_data: locationData ?? undefined,
      media_to_add: mediaToAdd.length ? mediaToAdd : undefined,
      media_to_remove: mediaToRemove.length ? mediaToRemove : undefined,
      operational_details: {
        duration_minutes: this.toNumberOrNull(this.editorForm.controls.duration_minutes.value),
        min_participants: this.toNumberOrNull(this.editorForm.controls.min_participants.value),
        max_participants: this.toNumberOrNull(this.editorForm.controls.max_participants.value),
        price_type: this.nullIfEmpty(this.editorForm.controls.price_type.value),
        price_min: this.toNumberOrNull(this.editorForm.controls.price_min.value),
        price_max: this.toNumberOrNull(this.editorForm.controls.price_max.value),
        currency: this.nullIfEmpty(this.editorForm.controls.currency.value),
        booking_required: this.editorForm.controls.booking_required.value,
        security_benefit_available: this.editorForm.controls.security_benefit_available.value,
        security_benefit_notes: this.nullIfEmpty(this.editorForm.controls.security_benefit_notes.value),
        website_url: this.nullIfEmpty(this.editorForm.controls.website_url.value),
        booking_url: this.nullIfEmpty(this.editorForm.controls.booking_url.value),
        phone: this.nullIfEmpty(this.editorForm.controls.phone.value),
        email: this.nullIfEmpty(this.editorForm.controls.email.value),
      }
    };
  }

  private resolveDraftStatusId(): number | null {
    const statuses = this.metadata?.statuses ?? [];
    const byCode = statuses.find((status) => (status.code || '').trim().toLowerCase() === 'draft');
    if (byCode) {
      return byCode.id;
    }

    const byName = statuses.find((status) => status.name.trim() === 'טיוטא');
    return byName?.id ?? null;
  }

  private hasSiteAdminPermission(): boolean {
    return this.authService.hasPermission('site_admin');
  }

  private hasApproverPermission(): boolean {
    return this.authService.hasPermission('approver');
  }

  private isDraftStatus(status: { id: number; code?: string; name?: string }): boolean {
    const code = (status.code || '').trim().toLowerCase();
    const name = (status.name || '').trim();
    return code === 'draft' || name === 'טיוטא';
  }

  private isPendingApprovalStatus(status: { id: number; code?: string; name?: string }): boolean {
    const code = (status.code || '').trim().toLowerCase();
    const name = (status.name || '').trim();
    return code === 'pending_approval' || code === 'awaiting_approval' || code === 'pending' || name === 'ממתין לאישור';
  }

  private hasPendingEditorChanges(): boolean {
    if (this.editorForm.dirty) {
      return true;
    }

    if (this.editorAreaId !== this.initialEditorAreaId || this.editorCityId !== this.initialEditorCityId) {
      return true;
    }

    if (this.editorCityName !== this.initialEditorCityName) {
      return true;
    }

    return this.currentMediaSignature() !== this.initialMediaSignature;
  }

  private captureEditorSnapshot(): void {
    this.editorForm.markAsPristine();
    this.initialEditorAreaId = this.editorAreaId;
    this.initialEditorCityId = this.editorCityId;
    this.initialEditorCityName = this.editorCityName;
    this.initialMediaSignature = this.currentMediaSignature();
  }

  private currentMediaSignature(): string {
    return this.mediaItems
      .map((item) => [
        item.media_file_id ?? '',
        item.file_url || '',
        item.is_primary ? 1 : 0,
        item.is_new ? 1 : 0,
        item.to_delete ? 1 : 0,
      ].join(':'))
      .join('|');
  }

  private buildLocationData(): AdminWritePayload['location_data'] | null {
    const areaId = this.toNumberOrNull(this.editorAreaId);
    const cityId = this.toNumberOrNull(this.editorCityId);
    const placeName = this.nullIfEmpty(this.editorForm.controls.location_place_name.value);
    const addressLine = this.nullIfEmpty(this.editorForm.controls.location_address_line.value);
    const accessibilityNotes = this.nullIfEmpty(this.editorForm.controls.location_accessibility_notes.value);

    if (!placeName && !addressLine && !accessibilityNotes) {
      return null;
    }

    return {
      area_id: areaId,
      city_id: cityId,
      place_name: placeName,
      address_line: addressLine,
      accessibility_notes: accessibilityNotes,
    };
  }

  initMediaFromDetails(details: AdminItemDetails): void {
    this.mediaItems = (details.media ?? []).map((m) => ({
      media_file_id: m.media_file_id,
      file_url: m.file_url ?? '',
      is_primary: m.is_primary === 1 || m.is_primary === true,
      alt_text: m.alt_text ?? '',
      is_new: false,
      to_delete: false,
    }));
    this.changeDetectorRef.markForCheck();
  }

  addMediaUrl(url: string): void {
    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }
    this.mediaItems = [
      ...this.mediaItems,
      {
        file_url: trimmed,
        is_primary: !this.hasActivePrimary(),
        alt_text: '',
        is_new: true,
        to_delete: false,
      },
    ];
    this.changeDetectorRef.markForCheck();
  }

  addLocalFiles(files: FileList): void {
    Array.from(files).forEach((file) => {
      const preview = URL.createObjectURL(file);
      this.mediaItems = [
        ...this.mediaItems,
        {
          file_url: '',
          is_primary: !this.hasActivePrimary(),
          alt_text: '',
          is_new: true,
          to_delete: false,
          local_file: file,
          local_preview: preview,
        },
      ];
    });
    this.changeDetectorRef.markForCheck();
  }

  onMediaFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.addLocalFiles(input.files);
      input.value = '';
    }
  }

  onMediaDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver = false;
    if (event.dataTransfer?.files?.length) {
      this.addLocalFiles(event.dataTransfer.files);
    }
    this.changeDetectorRef.markForCheck();
  }

  removeMedia(index: number): void {
    const item = this.mediaItems[index];
    if (!item) {
      return;
    }

    if (item.local_preview) {
      URL.revokeObjectURL(item.local_preview);
    }

    if (item.is_new) {
      this.mediaItems = this.mediaItems.filter((_, i) => i !== index);
    } else {
      this.mediaItems = this.mediaItems.map((m, i) =>
        i === index ? { ...m, to_delete: true } : m
      );
    }

    // If we removed the primary, promote the first remaining active item.
    if (item.is_primary && !this.hasActivePrimary()) {
      const firstActive = this.mediaItems.find((m) => !m.to_delete);
      if (firstActive) {
        firstActive.is_primary = true;
      }
    }

    this.changeDetectorRef.markForCheck();
  }

  setMediaPrimary(index: number): void {
    this.mediaItems = this.mediaItems.map((item, i) => ({ ...item, is_primary: i === index }));
    this.changeDetectorRef.markForCheck();
  }

  private hasActivePrimary(): boolean {
    return this.mediaItems.some((item) => !item.to_delete && item.is_primary);
  }

  private uploadPendingLocalFiles() {
    const pending = this.mediaItems.filter((item) => item.is_new && !item.to_delete && !!item.local_file);
    if (!pending.length) {
      return of(undefined as void);
    }
    const uploads$ = pending.map((item) =>
      this.adminService.uploadImage(item.local_file!).pipe(
        tap((response) => {
          item.file_url = response.url;
          item.local_file = undefined;
        })
      )
    );
    return forkJoin(uploads$).pipe(switchMap(() => of(undefined as void)));
  }

  private requiredNumber(value: unknown): number {
    return Number(value);
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toBooleanOrNull(value: string | null | undefined): boolean | null {
    if (!value) {
      return null;
    }

    if (value === '1' || value === 'true') {
      return true;
    }

    if (value === '0' || value === 'false') {
      return false;
    }

    return null;
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
  }

  private nullIfEmpty(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  private toText(value: number | string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private toDateTimePayload(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }

    // Expected from datetime-local input: YYYY-MM-DDTHH:mm
    const dateTimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    if (dateTimeLocalPattern.test(normalized)) {
      return `${normalized.replace('T', ' ')}:00`;
    }

    // Already in backend-friendly format.
    const backendPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (backendPattern.test(normalized)) {
      return normalized;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const seconds = String(parsed.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private toInputDateTimeValue(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const normalized = value.trim();
    if (!normalized) {
      return '';
    }

    // Backend format: YYYY-MM-DD HH:mm:ss
    const backendPattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(:\d{2})?$/;
    const backendMatch = normalized.match(backendPattern);
    if (backendMatch) {
      return `${backendMatch[1]}T${backendMatch[2]}`;
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private setBodyScrollLock(locked: boolean): void {
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  private resetAiStates(): void {
    this.aiFullDescriptionLoading = false;
    this.aiAccessibilityLoading = false;
    this.aiFullDescriptionError = '';
    this.aiAccessibilityError = '';
  }

  private buildAccessibilityPrompt(title: string): string {
    const normalizedTitle = title.replace(/\s+/g, ' ').trim();
    const prompt =
      `ענה בעברית בלבד וב MarkDown נקי ללא סימוני קוד. ` +
      `חפש באתרי אינטרנט רלוונטים וסכם מידע כללי על המקום ודגש על נגישות ל"${normalizedTitle}". ` +
      `ענה בדיוק במבנה : ## תמונת מצב ## נגישות ## מה לבדוק לפני שמגיעים ומתחת לכל כותרת 2 - 4 סעיפים קצרים ומעשיים.`;

    return prompt.length > 450 ? prompt.slice(0, 450) : prompt;
  }

  private buildGeneralInfoPrompt(title: string): string {
    const normalizedTitle = title.replace(/\s+/g, ' ').trim();
    const prompt =
      `ענה בעברית בלבד וב MarkDown נקי ללא סימוני קוד. ` +
      `חפש באתרי אינטרנט רלוונטים וסכם מידע כללי על המקום "${normalizedTitle}". ` +
      `ענה בדיוק במבנה : ## תמונת מצב ## מה כדאי לדעת לפני שמגיעים ומתחת לכל כותרת 2 - 4 סעיפים קצרים ומעשיים.`;

    return prompt.length > 450 ? prompt.slice(0, 450) : prompt;
  }

  private extractAiAnswer(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const response = payload as {
      answer?: unknown;
      response?: unknown;
      text?: unknown;
      result?: unknown;
      data?: { answer?: unknown; response?: unknown; text?: unknown };
    };

    const candidates = [
      response.answer,
      response.response,
      response.text,
      response.result,
      response.data?.answer,
      response.data?.response,
      response.data?.text,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return this.normalizeAiAnswer(candidate);
      }
    }

    return '';
  }

  private normalizeAiAnswer(answer: string): string {
    return answer
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .replace(/^```[a-zA-Z]*\s*$/gm, '')
      .trim();
  }
}
