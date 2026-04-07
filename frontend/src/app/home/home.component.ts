import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, QueryList, ViewChild, ViewChildren, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { MapItemCardComponent } from './components/map-item-card/map-item-card.component';
import { CategoryCardComponent } from '../shared/ui/category-card/category-card.component';
import { FeaturedCardComponent } from '../shared/ui/featured-card/featured-card.component';
import { PageHeroComponent } from '../shared/ui/page-hero/page-hero.component';
import { SectionHeaderComponent } from '../shared/ui/section-header/section-header.component';
import { HomeCategoryCardPresentation, mapHomeApiCategoryToPresentation, normalizePresentationColor } from './category-card.presentation';
import { HomeApiCategoryItem, HomeApiContentType, HomeApiFeaturedItem } from './home-api.models';
import { HomeApiService } from './home-api.service';
import { FeaturedItem, MapColorLegendItem } from './home.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeroComponent,
    SectionHeaderComponent,
    CategoryCardComponent,
    FeaturedCardComponent,
    MapItemCardComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private static readonly allRegionsOption = 'כל הארץ';
  private static readonly allContentTypesOption = 'כל סוגי התוכן';
  private static readonly defaultMarkerColor = '#2563eb';

  private readonly homeApiService = inject(HomeApiService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);

  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('mapBoard') private mapBoard?: ElementRef<HTMLElement>;
  @ViewChild('mapSidepanelList') private mapSidepanelList?: ElementRef<HTMLDivElement>;
  @ViewChildren('mapSidepanelItem') private mapSidepanelItems?: QueryList<ElementRef<HTMLDivElement>>;

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private resizeObserver?: ResizeObserver;
  private layoutResizeObserver?: ResizeObserver;
  private readonly markersById = new Map<number, L.CircleMarker>();

  showSmartSearch = true;
  searchText = '';
  selectedRegion = HomeComponent.allRegionsOption;
  selectedContentType = HomeComponent.allContentTypesOption;
  selectedCategoryIds: number[] = [];
  appliedSearchText = '';
  appliedSelectedRegion = HomeComponent.allRegionsOption;
  appliedSelectedContentType = HomeComponent.allContentTypesOption;
  appliedSelectedCategoryIds: number[] = [];
  categoriesLoading = true;
  categoriesError = '';
  mapSidepanelHeight: number | null = null;
  private selectedMapItemId: number | null = null;
  private hoveredMapItemId: number | null = null;

  regions: string[] = [HomeComponent.allRegionsOption];

  categories: HomeApiCategoryItem[] = [];
  categoryCards: HomeCategoryCardPresentation[] = [];
  contentTypes: HomeApiContentType[] = [];
  mapFeaturedItems: HomeApiFeaturedItem[] = [];

  ngOnInit(): void {
    this.loadCategories();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    this.observeMapBoardHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.layoutResizeObserver?.disconnect();
    this.map?.remove();
  }

  loadCategories(): void {
    this.categoriesLoading = true;
    this.categoriesError = '';

    this.homeApiService.getHomeData().subscribe({
      next: (response) => {
        this.categories = response.categories;
        this.categoryCards = response.categories.map((category) => mapHomeApiCategoryToPresentation(category));
        this.contentTypes = response.content_types;
        this.mapFeaturedItems = response.featured_items;
        this.regions = this.buildRegionOptions(response.regions.map((region) => region.name));

        this.selectedCategoryIds = this.filterExistingCategoryIds(this.selectedCategoryIds);
        this.appliedSelectedCategoryIds = this.filterExistingCategoryIds(this.appliedSelectedCategoryIds);

        if (!this.regions.includes(this.selectedRegion)) {
          this.selectedRegion = HomeComponent.allRegionsOption;
        }

        if (!this.regions.includes(this.appliedSelectedRegion)) {
          this.appliedSelectedRegion = HomeComponent.allRegionsOption;
        }

        if (!this.contentTypeOptions.includes(this.selectedContentType)) {
          this.selectedContentType = HomeComponent.allContentTypesOption;
        }

        if (!this.contentTypeOptions.includes(this.appliedSelectedContentType)) {
          this.appliedSelectedContentType = HomeComponent.allContentTypesOption;
        }

        this.categoriesLoading = false;
        this.selectedMapItemId = null;
        this.hoveredMapItemId = null;
        this.renderMapMarkers();
        this.scheduleMapSidepanelHeightSync();
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.categories = [];
        this.categoryCards = [];
        this.contentTypes = [];
        this.mapFeaturedItems = [];
        this.regions = [HomeComponent.allRegionsOption];
        this.selectedContentType = HomeComponent.allContentTypesOption;
        this.appliedSelectedContentType = HomeComponent.allContentTypesOption;
        this.selectedCategoryIds = [];
        this.appliedSelectedCategoryIds = [];
        this.categoriesError = 'לא ניתן לטעון את הקטגוריות כרגע.';
        this.categoriesLoading = false;
        this.selectedMapItemId = null;
        this.hoveredMapItemId = null;
        this.renderMapMarkers();
        this.scheduleMapSidepanelHeightSync();
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  toggleSmartSearch(): void {
    this.showSmartSearch = !this.showSmartSearch;
  }

  clearSearchText(): void {
    this.searchText = '';
  }

  selectCategory(categoryId: number): void {
    this.selectedCategoryIds = this.toggleCategoryId(this.selectedCategoryIds, categoryId);
  }

  executeSearch(): void {
    this.appliedSearchText = this.searchText;
    this.appliedSelectedRegion = this.selectedRegion;
    this.appliedSelectedContentType = this.selectedContentType;
    this.appliedSelectedCategoryIds = [...this.selectedCategoryIds];
    this.selectedMapItemId = null;
    this.hoveredMapItemId = null;
    this.renderMapMarkers();
    this.scheduleMapSidepanelHeightSync();
  }

  private observeMapBoardHeight(): void {
    const board = this.mapBoard?.nativeElement;

    if (!board) {
      return;
    }

    this.layoutResizeObserver = new ResizeObserver(() => {
      this.syncMapSidepanelHeight();
    });

    this.layoutResizeObserver.observe(board);
    this.syncMapSidepanelHeight();
  }

  private scheduleMapSidepanelHeightSync(): void {
    requestAnimationFrame(() => {
      this.syncMapSidepanelHeight();
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
    this.changeDetectorRef.markForCheck();
  }

  applyCategoryFilter(categoryId: number): void {
    this.selectCategory(categoryId);
    this.executeSearch();
  }

  private initializeMap(): void {
    const host = this.mapContainer?.nativeElement;

    if (!host || this.map) {
      console.warn('Map initialization skipped.', {
        hasHost: Boolean(host),
        mapAlreadyExists: Boolean(this.map)
      });
      return;
    }

    console.log('Initializing Leaflet map.', {
      width: host.clientWidth,
      height: host.clientHeight
    });

    this.map = L.map(host, {
      center: [31.4117, 35.0818],
      zoom: 8,
      minZoom: 6,
      maxZoom: 16,
      scrollWheelZoom: true,
      attributionControl: false
    });

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16
    });

    tileLayer.on('loading', () => {
      console.log('Map tiles loading started.');
    });

    tileLayer.on('load', () => {
      console.log('Map tiles loaded successfully.');
    });

    tileLayer.on('tileerror', (event) => {
      console.error('Map tile failed to load.', event);
    });

    tileLayer.addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.renderMapMarkers();

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize(false);
    });
    this.resizeObserver.observe(host);

    requestAnimationFrame(() => {
      this.map?.invalidateSize(false);
      console.log('Leaflet map size invalidated after first render.');
    });
  }

  private renderMapMarkers(): void {
    if (!this.map || !this.markerLayer) {
      return;
    }

    this.markerLayer.clearLayers();
    this.markersById.clear();

    const markers = this.filteredMapFeaturedItems
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
      maxZoom: 16
    });
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

  private buildTooltipDescription(item: HomeApiFeaturedItem): string {
    const normalizedDescription = item.short_description?.trim();

    if (normalizedDescription) {
      return normalizedDescription;
    }

    return item.address?.trim() || 'ללא תיאור זמין';
  }

  private buildMarkerTooltipOptions(direction: 'top' | 'bottom'): L.TooltipOptions {
    return {
      direction,
      offset: direction === 'bottom' ? [0, 10] : [0, -8],
      className: 'map-marker-tooltip',
      opacity: 0.95
    };
  }

  private getMarkerTooltipDirection(marker: L.CircleMarker): 'top' | 'bottom' {
    if (!this.map) {
      return 'top';
    }

    const markerPoint = this.map.latLngToContainerPoint(marker.getLatLng());

    return markerPoint.y < 120 ? 'bottom' : 'top';
  }

  private updateMarkerHighlight(marker: L.CircleMarker, active: boolean): void {
    marker.setStyle({
      radius: active ? 12 : 9,
      weight: active ? 4 : 3,
      color: active ? '#0f172a' : '#ffffff',
      fillOpacity: 1
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
        behavior: 'smooth'
      });
    });
  }

  hoverMapItem(itemId: number): void {
    this.hoveredMapItemId = itemId;
    this.syncActiveMarkerState();
    this.changeDetectorRef.markForCheck();
  }

  hoverMapMarker(itemId: number): void {
    this.hoverMapItem(itemId);
    this.scrollMapPanelItemIntoView(itemId);
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

  openContentDetails(contentItemId: number): void {
    void this.router.navigate(['/content', contentItemId]);
  }

  private createMarker(item: HomeApiFeaturedItem): L.CircleMarker | null {
    const latitude = this.parseCoordinate(item.latitude);
    const longitude = this.parseCoordinate(item.longitude);

    if (latitude === null || longitude === null) {
      return null;
    }

    const marker = L.circleMarker([latitude, longitude], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: this.getMarkerColor(item.category_color),
      fillOpacity: 1
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
        this.openContentDetails(item.id);
      });
    });

    this.markersById.set(item.id, marker);

    return marker;
  }

  private buildMarkerLabel(item: HomeApiFeaturedItem): string {
    const safeTitle = this.escapeHtml(item.title);
    const safeDescription = this.escapeHtml(this.buildTooltipDescription(item));
    const safeAddress = item.address?.trim() ? this.escapeHtml(item.address.trim()) : '';
    const safeImageUrl = this.sanitizeImageUrl(item.primary_image_url);
    const imageMarkup = safeImageUrl
      ? `<img class="map-marker-tooltip__image" src="${this.escapeHtml(safeImageUrl)}" alt="${safeTitle}">`
      : '';
    const metaMarkup = safeAddress
      ? `<p class="map-marker-tooltip__meta">${safeAddress}</p>`
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

  private buildRegionOptions(regionNames: string[]): string[] {
    const uniqueRegions = regionNames.filter((region, index) => regionNames.indexOf(region) === index);

    return [HomeComponent.allRegionsOption, ...uniqueRegions];
  }

  private getMarkerColor(categoryColor: string | null): string {
    return normalizePresentationColor(categoryColor, HomeComponent.defaultMarkerColor);
  }

  private getContentTypeName(contentTypeCode: string | null): string {
    const normalizedCode = contentTypeCode?.trim().toLowerCase() ?? '';

    if (normalizedCode === '') {
      return HomeComponent.allContentTypesOption;
    }

    const matchedContentType = this.contentTypes.find((contentType) => contentType.code.trim().toLowerCase() === normalizedCode);

    if (matchedContentType) {
      return matchedContentType.name;
    }

    return contentTypeCode?.trim() || HomeComponent.allContentTypesOption;
  }

  private matchesSelectedContentType(itemContentType: string, selectedContentType: string): boolean {
    if (selectedContentType === HomeComponent.allContentTypesOption) {
      return true;
    }

    const normalizedItemContentType = itemContentType.trim().toLowerCase();
    const normalizedSelectedContentType = selectedContentType.trim().toLowerCase();

    return (
      normalizedItemContentType === normalizedSelectedContentType ||
      normalizedItemContentType.includes(normalizedSelectedContentType) ||
      normalizedSelectedContentType.includes(normalizedItemContentType)
    );
  }

  private filterExistingCategoryIds(categoryIds: number[]): number[] {
    return categoryIds.filter((categoryId) => this.categories.some((category) => category.id === categoryId));
  }

  private toggleCategoryId(categoryIds: number[], categoryId: number): number[] {
    return categoryIds.includes(categoryId)
      ? categoryIds.filter((currentCategoryId) => currentCategoryId !== categoryId)
      : [...categoryIds, categoryId];
  }

  private parseCoordinate(value: number | string | null): number | null {
    if (value === null || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  get activeMapItemId(): number | null {
    return this.hoveredMapItemId ?? this.selectedMapItemId;
  }

  isHoveredMapItem(itemId: number): boolean {
    return this.hoveredMapItemId === itemId;
  }

  isSelectedMapItem(itemId: number): boolean {
    return this.selectedMapItemId === itemId;
  }

  get mapColorLegendItems(): MapColorLegendItem[] {
    const groupedItems = new Map<string, MapColorLegendItem>();

    for (const item of this.filteredMapFeaturedItems) {
      if (this.parseCoordinate(item.latitude) === null || this.parseCoordinate(item.longitude) === null) {
        continue;
      }

      const label = item.category_name?.trim() || 'ללא קטגוריה מוגדרת';
      const color = this.getMarkerColor(item.category_color);
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
        count: 1
      });
    }

    return Array.from(groupedItems.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, 'he');
    });
  }

  get mapPanelItems(): HomeApiFeaturedItem[] {
    return this.filteredMapFeaturedItems.filter(
      (item) => this.parseCoordinate(item.latitude) !== null && this.parseCoordinate(item.longitude) !== null
    );
  }

  get filteredFeaturedItems(): FeaturedItem[] {
    return this.filteredMapFeaturedItems
      .filter((item) => item.is_featured === 1 || item.is_featured === true)
      .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.short_description?.trim() || item.full_description?.trim() || 'ללא תיאור זמין',
      category: item.category_name?.trim() || 'ללא קטגוריה',
      region: item.region_name?.trim() || 'ללא אזור',
      contentType: this.getContentTypeName(item.content_type),
      isFeatured: item.is_featured === 1 || item.is_featured === true,
      tags: [
        this.getContentTypeName(item.content_type),
        item.address?.trim() || item.location_name?.trim() || item.region_name?.trim() || ''
      ].filter((tag, index, items) => tag !== '' && items.indexOf(tag) === index)
    }));
  }

  get contentTypeOptions(): string[] {
    const contentTypes = this.contentTypes
      .map((contentType) => contentType.name)
      .filter((contentType, index, items) => contentType !== HomeComponent.allContentTypesOption && items.indexOf(contentType) === index);

    return [HomeComponent.allContentTypesOption, ...contentTypes];
  }

  get filteredMapFeaturedItems(): HomeApiFeaturedItem[] {
    const term = this.appliedSearchText.trim();

    return this.mapFeaturedItems.filter((item) => {
      const matchesRegion =
        this.appliedSelectedRegion === HomeComponent.allRegionsOption ||
        item.region_name === this.appliedSelectedRegion;

      const matchesCategory =
        this.appliedSelectedCategoryIds.length === 0 ||
        (item.category_id !== null && this.appliedSelectedCategoryIds.includes(item.category_id));

      const matchesContentType =
        this.matchesSelectedContentType(this.getContentTypeName(item.content_type), this.appliedSelectedContentType);

      const matchesText =
        term === '' ||
        item.title.includes(term) ||
        (item.short_description?.includes(term) ?? false) ||
        (item.location_name?.includes(term) ?? false) ||
        (item.address?.includes(term) ?? false) ||
        (item.region_name?.includes(term) ?? false) ||
        (item.category_name?.includes(term) ?? false);

      return matchesRegion && matchesCategory && matchesContentType && matchesText;
    });
  }

}