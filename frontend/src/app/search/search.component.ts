import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, NgZone, OnDestroy, QueryList, ViewChild, ViewChildren, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { finalize } from 'rxjs';
import { MapItemCardComponent } from '../home/components/map-item-card/map-item-card.component';
import { HomeApiFeaturedItem } from '../home/home-api.models';
import { MapColorLegendItem } from '../home/home.models';
import { PageHeroComponent } from '../shared/ui/page-hero/page-hero.component';
import { SearchFiltersSidebarComponent } from './components/search-filters-sidebar/search-filters-sidebar.component';
import { SearchResultCardComponent } from './components/search-result-card/search-result-card.component';
import { SearchCityOption, SearchFiltersResponse, SearchRequest, SearchResponse, SearchResultItem, SearchSortOption } from './search.models';
import { SearchService } from './search.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, PageHeroComponent, SearchFiltersSidebarComponent, SearchResultCardComponent, MapItemCardComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly searchService = inject(SearchService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  @ViewChild('mapContainer')
  private set mapContainerRef(value: ElementRef<HTMLDivElement> | undefined) {
    this.mapContainer = value;

    if (value && this.currentView === 'map') {
      this.scheduleMapRefresh();
    }
  }

  @ViewChild('mapBoard')
  private set mapBoardRef(value: ElementRef<HTMLElement> | undefined) {
    this.mapBoard = value;

    if (value && this.currentView === 'map') {
      this.observeMapBoardHeight();
      this.scheduleMapSidepanelHeightSync();
    }
  }

  @ViewChild('mapSidepanelList') private mapSidepanelList?: ElementRef<HTMLDivElement>;
  @ViewChildren('mapSidepanelItem') private mapSidepanelItems?: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChild('filtersSidebar')
  private set filtersSidebarRef(value: ElementRef<HTMLElement> | undefined) {
    this.filtersSidebar = value;

    if (value) {
      this.observeResultsLayout();
    }
  }

  private mapContainer?: ElementRef<HTMLDivElement>;
  private mapHostElement?: HTMLDivElement;
  private mapBoard?: ElementRef<HTMLElement>;
  private filtersSidebar?: ElementRef<HTMLElement>;
  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private resizeObserver?: ResizeObserver;
  private layoutResizeObserver?: ResizeObserver;
  private resultsLayoutResizeObserver?: ResizeObserver;
  private observedMapBoard?: HTMLElement;
  private observedFiltersSidebar?: HTMLElement;
  private readonly markersById = new Map<number, L.CircleMarker>();
  private selectedMapItemId: number | null = null;
  private hoveredMapItemId: number | null = null;

  readonly filterForm = this.formBuilder.nonNullable.group({
    q: '',
    area_id: '',
    city: '',
    age_group: '',
    status: '',
    activity_type: '',
    category_ids: this.formBuilder.nonNullable.control<number[]>([]),
    audience_ids: this.formBuilder.nonNullable.control<number[]>([]),
    day_of_week: '',
    time_of_day: '',
  });

  readonly loadingPlaceholders = [1, 2, 3];
  readonly sortOptions: SearchSortOption[] = [
    { value: 'recommended', label: 'מומלץ' },
    { value: 'newest', label: 'החדש ביותר' },
    { value: 'closest', label: 'לפי מיקום (צפון-דרום)' },
    { value: 'south_to_north', label: 'לפי מיקום (דרום - צפון)' },
  ];

  filtersMetadata: SearchFiltersResponse | null = null;
  results: SearchResultItem[] = [];
  mapPanelItems: SearchResultItem[] = [];
  mapPanelCards: HomeApiFeaturedItem[] = [];
  mapColorLegendItems: MapColorLegendItem[] = [];
  totalCount = 0;
  page = 1;
  pageSize = 12;
  sortBy = 'recommended';
  currentView: 'results' | 'map' = 'results';
  loadingFilters = false;
  loadingResults = false;
  filtersError = '';
  resultsError = '';
  mobileFiltersOpen = false;
  mapSidepanelHeight: number | null = null;
  mapPanelVersion = 0;
  resultsSectionHeight: number | null = null;

  ngOnInit(): void {
    this.filterForm.controls.area_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const selectedCity = this.filterForm.controls.city.value;

        if (selectedCity && !this.availableCities.some((city) => String(city.id) === selectedCity)) {
          this.filterForm.controls.city.setValue('');
        }
      });

    this.loadFilters();
    this.loadResults();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.layoutResizeObserver?.disconnect();
    this.resultsLayoutResizeObserver?.disconnect();
    this.map?.remove();
  }

  get availableCities(): SearchCityOption[] {
    const selectedAreaId = this.toNumberOrNull(this.filterForm.controls.area_id.value);

    if (!this.filtersMetadata) {
      return [];
    }

    if (selectedAreaId === null) {
      return this.filtersMetadata.cities;
    }

    return this.filtersMetadata.cities.filter((city) => city.area_id === selectedAreaId);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get visiblePages(): number[] {
    const totalPages = this.totalPages;
    const start = Math.max(1, this.page - 2);
    const end = Math.min(totalPages, start + 4);
    const pages: number[] = [];

    for (let currentPage = Math.max(1, end - 4); currentPage <= end; currentPage += 1) {
      pages.push(currentPage);
    }

    return pages;
  }

  trackByResult(_: number, item: SearchResultItem): number {
    return item.id;
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  trackByMapPanelCard(_: number, item: { id: number }): string {
    return `${this.mapPanelVersion}-${item.id}`;
  }

  setView(view: 'results' | 'map'): void {
    if (this.currentView === view) {
      return;
    }

    this.currentView = view;
    this.changeDetectorRef.markForCheck();

    if (view === 'map') {
      this.scheduleMapRefresh();
      this.resultsSectionHeight = null;
    } else {
      this.scheduleResultsHeightSync();
    }
  }

  toggleMobileFilters(): void {
    this.mobileFiltersOpen = !this.mobileFiltersOpen;
  }

  applyFilters(): void {
    this.page = 1;
    this.loadResults();
    this.mobileFiltersOpen = false;
  }

  clearFilters(): void {
    this.filterForm.reset({
      q: '',
      area_id: '',
      city: '',
      age_group: '',
      status: '',
      activity_type: '',
      category_ids: [] as number[],
      audience_ids: [] as number[],
      day_of_week: '',
      time_of_day: '',
    });
    this.sortBy = 'recommended';
    this.page = 1;
    this.loadResults();
  }

  resetAgeGroup(): void {
    this.filterForm.controls.age_group.setValue('');
    this.applyFilters();
  }

  resetStatus(): void {
    this.filterForm.controls.status.setValue('');
    this.applyFilters();
  }

  resetArea(): void {
    this.filterForm.patchValue({ area_id: '', city: '' });
    this.applyFilters();
  }

  changeSort(sortBy: string): void {
    if (!sortBy || this.sortBy === sortBy) {
      return;
    }

    this.sortBy = sortBy;
    this.page = 1;
    this.loadResults();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    this.page = page;
    this.loadResults();
  }

  hoverMapItem(itemId: number): void {
    this.hoveredMapItemId = itemId;
    this.syncActiveMarkerState();
    this.changeDetectorRef.markForCheck();
  }

  clearHoveredMapItem(itemId: number): void {
    if (this.hoveredMapItemId !== itemId) {
      return;
    }

    this.hoveredMapItemId = null;
    this.syncActiveMarkerState();
    this.changeDetectorRef.markForCheck();
  }

  focusMapItem(itemId: number): void {
    const marker = this.markersById.get(itemId);

    if (!marker || !this.map) {
      return;
    }

    this.selectedMapItemId = itemId;
    this.hoveredMapItemId = null;
    this.syncActiveMarkerState();
    this.scrollMapPanelItemIntoView(itemId);
    this.map.panTo(marker.getLatLng(), { animate: true });
    this.changeDetectorRef.markForCheck();
  }

  isHoveredMapItem(itemId: number): boolean {
    return this.hoveredMapItemId === itemId;
  }

  isSelectedMapItem(itemId: number): boolean {
    return this.selectedMapItemId === itemId;
  }

  toMapPanelCard(item: SearchResultItem): HomeApiFeaturedItem {
    const primaryCategory = item.categories[0];

    return {
      id: item.id,
      title: item.title,
      short_description: item.short_description,
      full_description: item.full_description,
      is_featured: item.is_featured ?? false,
      content_type: item.activity_type ?? '',
      published_at: item.published_at,
      category_id: primaryCategory?.id ?? null,
      category_name: primaryCategory?.name ?? null,
      category_color: item.marker_color ?? item.primary_category_color ?? primaryCategory?.color_code ?? null,
      primary_image_url: item.primary_image_url,
      location_name: item.metadata.area,
      address: item.metadata.city ?? item.metadata.area,
      region_name: item.metadata.area,
      latitude: item.coordinates?.latitude ?? null,
      longitude: item.coordinates?.longitude ?? null,
    };
  }

  get activeMapItemId(): number | null {
    return this.hoveredMapItemId ?? this.selectedMapItemId;
  }

  private loadFilters(): void {
    this.loadingFilters = true;
    this.filtersError = '';

    console.log('[SearchPage] Requesting filters metadata', {
      endpoint: '/api/search/filters',
    });

    this.searchService.getFilters()
      .pipe(
        finalize(() => {
          this.loadingFilters = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('[SearchPage] Filters metadata response JSON', response);
          this.filtersMetadata = response;
        },
        error: (error) => {
          console.error('[SearchPage] Filters metadata request failed', error);
          this.filtersMetadata = null;
          this.filtersError = 'לא ניתן לטעון את אפשרויות הסינון כרגע.';
        },
      });
  }

  private loadResults(): void {
    this.loadingResults = true;
    this.resultsError = '';

    const requestPayload = this.buildRequest();

    console.log('[SearchPage] Requesting search results', {
      endpoint: '/api/search',
      payload: requestPayload,
    });

    this.searchService.search(requestPayload)
      .pipe(
        finalize(() => {
          this.loadingResults = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (response: SearchResponse) => {
          console.log('[SearchPage] Search results response JSON', response);
          this.results = response.items;
          this.syncMapCollections(response.items);
          this.totalCount = response.total_count;
          this.page = response.page;
          this.pageSize = response.page_size;
          this.changeDetectorRef.detectChanges();
          this.scheduleMapRefresh();
        },
        error: (error) => {
          console.error('[SearchPage] Search results request failed', error);
          this.results = [];
          this.syncMapCollections([]);
          this.totalCount = 0;
          this.resultsError = 'אירעה שגיאה בעת טעינת תוצאות החיפוש.';
          this.changeDetectorRef.detectChanges();
          this.scheduleMapRefresh();
        },
      });
  }

  private syncMapCollections(items: SearchResultItem[]): void {
    this.mapPanelVersion += 1;
    this.mapPanelItems = items.filter((item) => this.parseCoordinate(item.coordinates?.latitude ?? null) !== null
      && this.parseCoordinate(item.coordinates?.longitude ?? null) !== null);
    this.mapPanelCards = this.mapPanelItems.map((item) => this.toMapPanelCard(item));

    const groupedItems = new Map<string, MapColorLegendItem>();

    for (const item of this.mapPanelItems) {
      const label = item.categories[0]?.name?.trim() || item.activity_type?.trim() || 'ללא קטגוריה מוגדרת';
      const color = this.getMarkerColor(item);
      const groupKey = `${label}::${color}`;
      const existingEntry = groupedItems.get(groupKey);

      if (existingEntry) {
        existingEntry.count += 1;
        continue;
      }

      groupedItems.set(groupKey, {
        id: groupedItems.size + 1,
        label,
        color,
        count: 1,
      });
    }

    this.mapColorLegendItems = Array.from(groupedItems.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, 'he');
    });

    if (this.activeMapItemId !== null && !this.mapPanelItems.some((item) => item.id === this.activeMapItemId)) {
      this.selectedMapItemId = null;
      this.hoveredMapItemId = null;
    }

    this.scheduleResultsHeightSync();
  }

  private observeResultsLayout(): void {
    const sidebar = this.filtersSidebar?.nativeElement;

    if (!sidebar || this.observedFiltersSidebar === sidebar) {
      return;
    }

    this.resultsLayoutResizeObserver?.disconnect();
    this.resultsLayoutResizeObserver = new ResizeObserver(() => {
      this.syncResultsHeight();
    });
    this.resultsLayoutResizeObserver.observe(sidebar);
    this.observedFiltersSidebar = sidebar;
    this.syncResultsHeight();
  }

  private scheduleResultsHeightSync(): void {
    requestAnimationFrame(() => {
      this.syncResultsHeight();
    });
  }

  private syncResultsHeight(): void {
    const sidebar = this.filtersSidebar?.nativeElement;

    if (!sidebar || this.currentView !== 'results' || window.innerWidth <= 768) {
      if (this.resultsSectionHeight !== null) {
        this.resultsSectionHeight = null;
        this.changeDetectorRef.markForCheck();
      }
      return;
    }

    const sidebarTopOffset = 76;
    const resultsBarTopOffset = 20;
    const nextHeight = Math.max(sidebar.offsetHeight + (sidebarTopOffset - resultsBarTopOffset), 320);

    if (this.resultsSectionHeight === nextHeight) {
      return;
    }

    this.resultsSectionHeight = nextHeight;
    this.changeDetectorRef.markForCheck();
  }

  private scheduleMapRefresh(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.currentView !== 'map') {
          return;
        }

        this.initializeMap();
        this.observeMapBoardHeight();
        this.renderMapMarkers();
        this.map?.invalidateSize(false);
        this.scheduleMapSidepanelHeightSync();
      });
    });
  }

  private observeMapBoardHeight(): void {
    const board = this.mapBoard?.nativeElement;

    if (!board || this.observedMapBoard === board) {
      return;
    }

    this.layoutResizeObserver?.disconnect();
    this.layoutResizeObserver = new ResizeObserver(() => {
      this.ngZone.run(() => {
        this.syncMapSidepanelHeight();
      });
    });
    this.layoutResizeObserver.observe(board);
    this.observedMapBoard = board;
    this.syncMapSidepanelHeight();
  }

  private scheduleMapSidepanelHeightSync(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.ngZone.run(() => {
          this.syncMapSidepanelHeight();
        });
      });
    });
  }

  private syncMapSidepanelHeight(): void {
    const board = this.mapBoard?.nativeElement;

    if (!board) {
      return;
    }

    const nextHeight = window.innerWidth <= 768 ? null : Math.ceil(board.getBoundingClientRect().height);

    if (this.mapSidepanelHeight === nextHeight) {
      return;
    }

    this.mapSidepanelHeight = nextHeight;
    this.changeDetectorRef.detectChanges();
  }

  private initializeMap(): void {
    const host = this.mapContainer?.nativeElement;

    if (!host) {
      return;
    }

    if (this.map && this.mapHostElement && this.mapHostElement !== host) {
      this.resizeObserver?.disconnect();
      this.map.remove();
      this.map = undefined;
      this.markerLayer = undefined;
      this.markersById.clear();
      this.mapHostElement = undefined;
    }

    if (!this.map) {
      this.map = L.map(host, {
        center: [31.4117, 35.0818],
        zoom: 8,
        minZoom: 6,
        maxZoom: 16,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 16,
      }).addTo(this.map);

      this.markerLayer = L.layerGroup().addTo(this.map);
      this.mapHostElement = host;

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        this.map?.invalidateSize(false);
      });
      this.resizeObserver.observe(host);
    }

    this.map.invalidateSize(false);
  }

  private renderMapMarkers(): void {
    if (!this.map || !this.markerLayer) {
      return;
    }

    this.markerLayer.clearLayers();
    this.markersById.clear();

    const markers = this.mapPanelItems
      .map((item) => this.createMarker(item))
      .filter((marker): marker is L.CircleMarker => marker !== null);

    for (const marker of markers) {
      marker.addTo(this.markerLayer);
    }

    if (this.activeMapItemId !== null && !this.markersById.has(this.activeMapItemId)) {
      this.selectedMapItemId = null;
      this.hoveredMapItemId = null;
    }

    this.syncActiveMarkerState();

    if (markers.length === 0) {
      this.map.setView([31.4117, 35.0818], 8);
      return;
    }

    const bounds = L.featureGroup(markers).getBounds();
    this.map.fitBounds(bounds, {
      padding: [32, 32],
      maxZoom: 16,
    });
  }

  private createMarker(item: SearchResultItem): L.CircleMarker | null {
    const latitude = this.parseCoordinate(item.coordinates?.latitude ?? null);
    const longitude = this.parseCoordinate(item.coordinates?.longitude ?? null);

    if (latitude === null || longitude === null) {
      return null;
    }

    const marker = L.circleMarker([latitude, longitude], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: this.getMarkerColor(item),
      fillOpacity: 1,
    });

    const tooltipContent = this.buildMarkerLabel(item);
    const bindTooltip = (): void => {
      marker.unbindTooltip();
      marker.bindTooltip(tooltipContent, this.buildMarkerTooltipOptions(this.getMarkerTooltipDirection(marker)));
    };

    bindTooltip();

    marker.on('mouseover', () => {
      this.ngZone.run(() => {
        this.hoverMapMarker(item.id);
        bindTooltip();
        marker.openTooltip();
      });
    });

    marker.on('mouseout', () => {
      this.ngZone.run(() => {
        this.clearHoveredMapItem(item.id);
      });
    });

    marker.on('click', () => {
      this.ngZone.run(() => {
        this.focusMapItem(item.id);
      });
    });

    this.markersById.set(item.id, marker);

    return marker;
  }

  private hoverMapMarker(itemId: number): void {
    this.hoverMapItem(itemId);
    this.scrollMapPanelItemIntoView(itemId);
  }

  private buildMarkerTooltipOptions(direction: 'top' | 'bottom'): L.TooltipOptions {
    return {
      direction,
      offset: direction === 'bottom' ? [0, 10] : [0, -8],
      className: 'map-marker-tooltip',
      opacity: 0.95,
    };
  }

  private getMarkerTooltipDirection(marker: L.CircleMarker): 'top' | 'bottom' {
    if (!this.map) {
      return 'top';
    }

    const markerPoint = this.map.latLngToContainerPoint(marker.getLatLng());

    return markerPoint.y < 120 ? 'bottom' : 'top';
  }

  private buildMarkerLabel(item: SearchResultItem): string {
    const safeTitle = this.escapeHtml(item.title);
    const safeDescription = this.escapeHtml(this.buildTooltipDescription(item));
    const safeMeta = this.buildTooltipMeta(item);
    const safeImageUrl = this.sanitizeImageUrl(item.primary_image_url);
    const imageMarkup = safeImageUrl
      ? `<img class="map-marker-tooltip__image" src="${this.escapeHtml(safeImageUrl)}" alt="${safeTitle}">`
      : '';
    const metaMarkup = safeMeta
      ? `<p class="map-marker-tooltip__meta">${this.escapeHtml(safeMeta)}</p>`
      : '';

    return `
      <article class="map-marker-tooltip__card">
        ${imageMarkup}
        <div class="map-marker-tooltip__body">
          <h4 class="map-marker-tooltip__title">${safeTitle}</h4>
          ${metaMarkup}
          <p class="map-marker-tooltip__description">${safeDescription}</p>
        </div>
      </article>
    `;
  }

  private buildTooltipDescription(item: SearchResultItem): string {
    const normalizedDescription = item.short_description?.trim();

    if (normalizedDescription) {
      return normalizedDescription;
    }

    return this.buildTooltipMeta(item) || 'ללא תיאור זמין';
  }

  private buildTooltipMeta(item: SearchResultItem): string {
    return [item.metadata.city, item.metadata.area].filter((value): value is string => Boolean(value?.trim())).join(' · ');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private sanitizeImageUrl(imageUrl: string | null): string | null {
    if (!imageUrl) {
      return null;
    }

    const normalizedImageUrl = imageUrl.trim();

    if (normalizedImageUrl === '') {
      return null;
    }

    try {
      const parsedUrl = new URL(normalizedImageUrl);

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return null;
      }

      return parsedUrl.toString();
    } catch {
      return null;
    }
  }

  private updateMarkerHighlight(marker: L.CircleMarker, active: boolean): void {
    marker.setStyle({
      radius: active ? 12 : 9,
      weight: active ? 4 : 3,
      color: active ? '#0f172a' : '#ffffff',
      fillOpacity: 1,
    });

    if (active) {
      marker.bringToFront();
    }
  }

  private syncActiveMarkerState(): void {
    for (const [itemId, marker] of this.markersById.entries()) {
      const isActive = this.activeMapItemId === itemId;

      this.updateMarkerHighlight(marker, isActive);

      if (isActive) {
        marker.openTooltip();
      } else {
        marker.closeTooltip();
      }
    }
  }

  private scrollMapPanelItemIntoView(itemId: number): void {
    const container = this.mapSidepanelList?.nativeElement;

    if (!container) {
      return;
    }

    const target = this.mapSidepanelItems
      ?.find((itemRef) => itemRef.nativeElement.dataset['itemId'] === String(itemId))
      ?.nativeElement;

    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const targetTop = targetRect.top - containerRect.top + containerTop;
      const targetBottom = targetTop + targetRect.height;
      const containerBottom = containerTop + containerHeight;

      if (targetTop >= containerTop && targetBottom <= containerBottom) {
        return;
      }

      container.scrollTo({
        top: Math.max(targetTop - 12, 0),
        behavior: 'smooth',
      });
    });
  }

  private getMarkerColor(item: SearchResultItem): string {
    return item.marker_color?.trim()
      || item.primary_category_color?.trim()
      || item.categories[0]?.color_code?.trim()
      || '#2563eb';
  }

  private buildRequest(): SearchRequest {
    return {
      q: this.emptyToNull(this.filterForm.controls.q.value),
      area_id: this.toNumberOrNull(this.filterForm.controls.area_id.value),
      region: null,
      city: this.toNumberOrNull(this.filterForm.controls.city.value),
      age_group: this.normalizeSingleValue(this.filterForm.controls.age_group.value),
      status: this.emptyToNull(this.filterForm.controls.status.value),
      activity_type: this.emptyToNull(this.filterForm.controls.activity_type.value),
      category_ids: this.filterForm.controls.category_ids.value,
      audience_ids: this.filterForm.controls.audience_ids.value,
      day_of_week: this.toNumberOrNull(this.filterForm.controls.day_of_week.value),
      time_of_day: this.normalizeSingleValue(this.filterForm.controls.time_of_day.value),
      page: this.page,
      page_size: this.pageSize,
      sort_by: this.sortBy,
    };
  }

  private emptyToNull(value: string): string | null {
    const normalizedValue = value.trim();
    return normalizedValue === '' ? null : normalizedValue;
  }

  private toNumberOrNull(value: string): number | null {
    if (value.trim() === '') {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private normalizeSingleValue(value: string): string | number | null {
    if (value.trim() === '') {
      return null;
    }

    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? parsedNumber : value.trim();
  }

  private parseCoordinate(value: number | string | null): number | null {
    if (value === null || value === '') {
      return null;
    }

    const parsedValue = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }
}