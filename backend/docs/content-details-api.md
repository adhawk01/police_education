# Content Details API

## Endpoint

- **Method:** `GET`
- **Path:** `/api/content-items/<id>`
- **Purpose:** Return all data needed for the content details page.

## Visibility Rules

The endpoint returns data only for content items that are:

- `content_items.is_active = 1`
- `content_item_statuses.code = 'published'`

If the item does not exist or is not publicly visible, the API returns `404`.

## Path Parameter

- `id` (integer, required): content item id

## Success Response (`200`)

```json
{
  "id": 101,
  "title": "מרכז מורשת לוחמים",
  "short_description": "תיאור קצר",
  "full_description": "תיאור מלא",
  "primary_image_url": "/media/content/101/main.jpg",
  "gallery_images": [
    { "id": 1, "url": "/media/content/101/1.jpg", "alt": "image 1" }
  ],
  "categories": [
    { "id": 1, "name": "מורשת", "color": "#1E88E5", "priority": 1 }
  ],
  "badges": ["פתוח", "מומלץ"],
  "location": {
    "area": "מרכז",
    "city": "רמלה",
    "address": "כתובת מלאה",
    "lat": 31.9,
    "lng": 34.8
  },
  "details": {
    "price_text": "עד 25 ₪",
    "age_text": "מגיל 25 ומעלה",
    "participants_text": "עד 50 משתתפים",
    "schedule_text": "Days: 1,2,3 | בוקר, צהריים",
    "activity_type": "סיור",
    "status_text": "פתוח"
  },
  "accessibility": {
    "has_accessibility_info": true,
    "text": "טקסט נגישות אם קיים",
    "features": ["גישה לנכים"]
  },
  "contact": {
    "phone": null,
    "email": null,
    "website": null,
    "booking_url": null
  },
  "recommended_items": [
    {
      "id": 202,
      "title": "סיור נוסף",
      "image_url": "/media/content/202/main.jpg",
      "short_description": "תיאור קצר"
    }
  ]
}
```

## Error Responses

### Not Found (`404`)

```json
{
  "error": "Content item not found"
}
```

### Server Error (`500`)

```json
{
  "error": "Failed to load content item details: ..."
}
```

## Response Field Notes

- `primary_image_url`: first media item by priority (`is_primary DESC`, then `sort_order`).
- `gallery_images`: additional media items (excluding the selected primary image).
- `categories`: includes category `name`, `color`, and per-item `priority` from `content_categories`.
- `badges`: currently mapped from `tags.name`.
- `details.age_text`: from `content_items.audience_notes`; fallback to joined audience type names.
- `accessibility.text`: from `locations.accessibility_notes` of primary location.
- `accessibility.features`: from `content_accessibility` + `accessibility_features`.
- `recommended_items`: from `related_content` where `relation_type = 'recommended'`.

## Source Tables

- Core item: `content_items`
- Type/status labels: `content_types`, `content_item_statuses`
- Media: `content_media`, `media_files`
- Categories: `content_categories`, `categories`
- Tags: `content_tags`, `tags`
- Location: `content_locations`, `locations`, `regions`, `cities`
- Operational details/contact: `content_operational_details`
- Schedule: `opening_hours`, `content_time_of_day`, `time_of_day_options`
- Audience fallback: `content_audiences`, `audience_types`
- Accessibility: `content_accessibility`, `accessibility_features`
- Recommendations: `related_content`

## Null/Placeholder Behavior

- If optional fields do not exist in DB rows, API returns `null` (or empty arrays) while keeping response shape stable.
- No schema columns are invented by this endpoint.
- `schedule_text`, `price_text`, `participants_text`, and `age_text` are computed display fields built from existing schema values.

## Frontend Integration Notes

Use this endpoint when navigating from:

- home page cards
- search result cards
- map markers

Suggested Angular route patterns:

- `/content/:id`
- `/details/:id`

