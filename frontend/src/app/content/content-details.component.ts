import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { map } from 'rxjs';
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
export class ContentDetailsComponent implements OnDestroy {
  @ViewChild('locationMapContainer') private locationMapContainer?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contentService = inject(ContentService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  private locationMap?: L.Map;

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

  get fullDescriptionText(): string {
    return this.contentItem?.full_description?.trim() || 'לא הוזן תיאור מלא עבור תוכן זה.';
  }

  get fullDescriptionHtml(): SafeHtml {
    return this.renderSimpleMarkdown(this.fullDescriptionText);
  }

  get accessibilityTextHtml(): SafeHtml {
    const text = this.contentItem?.accessibility.text?.trim() || '';
    return this.renderSimpleMarkdown(text);
  }

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

  ngOnDestroy(): void {
    this.locationMap?.remove();
  }

  openContent(contentId: number): void {
    void this.router.navigate(['/content', contentId]);
  }

  private initLocationMap(): void {
    const host = this.locationMapContainer?.nativeElement;

    if (!host || this.locationMap || !this.contentItem) {
      return;
    }

    const lat = Number(this.contentItem.location.lat);
    const lng = Number(this.contentItem.location.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const markerColor = this.contentItem.categories[0]?.color ?? '#2563eb';

    this.locationMap = L.map(host, {
      center: [lat, lng],
      zoom: 14,
      scrollWheelZoom: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16 }).addTo(this.locationMap);

    L.circleMarker([lat, lng], {
      radius: 12,
      color: '#ffffff',
      weight: 3,
      fillColor: markerColor,
      fillOpacity: 1
    }).addTo(this.locationMap);

    requestAnimationFrame(() => {
      this.locationMap?.invalidateSize(false);
    });
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

  get wazeLink(): string | null {
    if (!this.contentItem) {
      return null;
    }

    const latitude = Number(this.contentItem.location.lat);
    const longitude = Number(this.contentItem.location.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
  }

  private loadContent(contentId: number): void {
    // Destroy previous map instance when navigating to a new content item
    this.locationMap?.remove();
    this.locationMap = undefined;

    this.loading = true;
    this.notFound = false;
    this.errorMessage = '';
    this.contentItem = null;
    this.selectedImageIndex.set(0);

    this.contentService
      .getContentItemById(contentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          console.log('[ContentDetails] GET /api/content-items response JSON', item);
          this.contentItem = item;
          this.notFound = false;
          this.loading = false;
          // detectChanges forces a synchronous render so the map container element
          // exists in the DOM before initLocationMap() tries to access it.
          this.changeDetectorRef.detectChanges();
          this.initLocationMap();
        },
        error: (error: unknown) => {
          this.locationMap?.remove();
          this.locationMap = undefined;
          this.contentItem = null;
          this.loading = false;

          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.notFound = true;
            this.errorMessage = '';
          } else {
            this.notFound = false;
            this.errorMessage = 'אירעה שגיאה בטעינת פרטי התוכן. נסו שוב מאוחר יותר.';
          }

          this.changeDetectorRef.markForCheck();
        }
      });
  }

  private renderSimpleMarkdown(markdown: string): SafeHtml {
    const escapeHtml = (value: string): string =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const formatInline = (value: string): string =>
      value
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    const lines = markdown.split(/\r?\n/);
    const html: string[] = [];
    let inList = false;

    const closeList = (): void => {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    };

    for (const rawLine of lines) {
      const line = escapeHtml(rawLine.trim());

      if (!line) {
        closeList();
        continue;
      }

      if (line.startsWith('## ')) {
        closeList();
        html.push(`<h4>${formatInline(line.slice(3))}</h4>`);
        continue;
      }

      if (line.startsWith('- ')) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }

        html.push(`<li>${formatInline(line.slice(2))}</li>`);
        continue;
      }

      closeList();
      html.push(`<p>${formatInline(line)}</p>`);
    }

    closeList();

    return this.sanitizer.bypassSecurityTrustHtml(html.join(''));
  }
}