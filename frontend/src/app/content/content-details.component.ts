import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { PageHeroComponent } from '../shared/ui/page-hero/page-hero.component';
import { ContentDetailsResponse } from './content-details.models';
import { ContentService } from './content.service';

interface GalleryImageViewModel {
  id: number;
  url: string;
  alt: string;
  isPrimary: boolean;
}

@Component({
  selector: 'app-content-details',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeroComponent],
  templateUrl: './content-details.component.html',
  styleUrl: './content-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contentService = inject(ContentService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  contentItem: ContentDetailsResponse | null = null;
  loading = true;
  notFound = false;
  errorMessage = '';
  private readonly selectedImageIndex = signal(0);

  readonly galleryImages = computed(() => {
    if (!this.contentItem) {
      return [] as GalleryImageViewModel[];
    }

    const images: GalleryImageViewModel[] = [];
    const seenUrls = new Set<string>();

    if (this.contentItem.primary_image_url?.trim()) {
      const primaryUrl = this.contentItem.primary_image_url.trim();
      seenUrls.add(primaryUrl);
      images.push({
        id: 0,
        url: primaryUrl,
        alt: this.contentItem.title,
        isPrimary: true
      });
    }

    for (const image of this.contentItem.gallery_images) {
      const normalizedUrl = image.url?.trim();

      if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
        continue;
      }

      seenUrls.add(normalizedUrl);
      images.push({
        id: image.id,
        url: normalizedUrl,
        alt: image.alt?.trim() || this.contentItem.title,
        isPrimary: false
      });
    }

    return images;
  });

  readonly activeImage = computed(() => {
    const images = this.galleryImages();

    if (!images.length) {
      return null;
    }

    const normalizedIndex = Math.max(0, Math.min(this.selectedImageIndex(), images.length - 1));

    return images[normalizedIndex] ?? images[0];
  });

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => Number(params.get('id')))
      )
      .subscribe((id) => {
        if (!Number.isInteger(id) || id <= 0) {
          this.loading = false;
          this.notFound = true;
          this.errorMessage = '';
          this.contentItem = null;
          this.changeDetectorRef.markForCheck();
          return;
        }

        this.loadContent(id);
      });
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  nextImage(): void {
    const total = this.galleryImages().length;
    if (total > 1) {
      this.selectedImageIndex.set((this.selectedImageIndex() + 1) % total);
    }
  }

  prevImage(): void {
    const total = this.galleryImages().length;
    if (total > 1) {
      this.selectedImageIndex.set((this.selectedImageIndex() - 1 + total) % total);
    }
  }

  openContent(contentId: number): void {
    void this.router.navigate(['/content', contentId]);
  }

  get mapLink(): string | null {
    if (!this.contentItem) {
      return null;
    }

    const latitude = Number(this.contentItem.location.lat);
    const longitude = Number(this.contentItem.location.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  }

  private loadContent(contentId: number): void {
    this.loading = true;
    this.notFound = false;
    this.errorMessage = '';
    this.contentItem = null;
    this.selectedImageIndex.set(0);

    this.contentService
      .getContentItemById(contentId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (item) => {
          console.log('[ContentDetails] GET /api/content-items response JSON', item);
          this.contentItem = item;
          this.notFound = false;
        },
        error: (error: unknown) => {
          this.contentItem = null;

          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.notFound = true;
            this.errorMessage = '';
            return;
          }

          this.notFound = false;
          this.errorMessage = 'אירעה שגיאה בטעינת פרטי התוכן. נסו שוב מאוחר יותר.';
        }
      });
  }
}