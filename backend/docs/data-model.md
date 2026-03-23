# Data Model - Education Department App

## 1. Purpose
This document defines the database model for the Israel Police Education Department application.

The system supports:
- home page
- search page
- interactive map
- content detail page
- favorites
- admin content management
- roles and permissions

The schema must support both MVP and future expansion.

---

## 2. General Design Principles
- MySQL 8
- snake_case for all table and column names
- InnoDB engine
- utf8mb4 charset
- primary key for every table
- foreign keys for relations
- junction tables for many-to-many relationships
- indexes for filterable and searchable fields
- created_at and updated_at where relevant
- normalized but practical schema
- central content model for all content types

---

## 3. Main Design Approach
The database should use a central table called `content_items`.

All main entities shown in the application should be represented as content items, including:
- places
- activities
- lectures
- books
- exhibitions
- articles
- routes

Specialized details can be added through related detail tables when needed.

---

## 4. Table Groups

### 4.1 Users and Authorization
Tables:
- users
- roles
- permissions
- user_roles
- role_permissions

#### users
Purpose: store system users.

Columns:
- id PK
- full_name
- email UNIQUE
- phone
- password_hash
- status
- created_at
- updated_at

#### roles
Purpose: define role types.

Columns:
- id PK
- code UNIQUE
- name
- description

#### permissions
Purpose: define available permissions.

Columns:
- id PK
- code UNIQUE
- name
- description

#### user_roles
Purpose: many-to-many between users and roles.

Columns:
- user_id FK
- role_id FK

Unique:
- (user_id, role_id)

#### role_permissions
Purpose: many-to-many between roles and permissions.

Columns:
- role_id FK
- permission_id FK

Unique:
- (role_id, permission_id)

---

### 4.2 Content Core
Tables:
- content_types
- categories
- content_items
- content_categories
- tags
- content_tags

#### content_types
Purpose: define content types.

Examples:
- place
- activity
- lecture
- book
- exhibition
- article
- route

Columns:
- id PK
- code UNIQUE
- name

#### categories
Purpose: main and sub categories.

Columns:
- id PK
- parent_id FK nullable -> categories.id
- name
- slug UNIQUE
- icon_name
- color_code
- sort_order
- is_active
- created_at
- updated_at

#### content_items
Purpose: central table for all content entities.

Columns:
- id PK
- content_type_id FK
- title
- short_description
- full_description
- status
- audience_notes
- is_featured
- is_active
- created_by_user_id FK
- approved_by_user_id FK nullable
- published_at nullable
- created_at
- updated_at

Recommended indexes:
- content_type_id
- status
- is_featured
- is_active
- published_at

#### content_categories
Purpose: many-to-many between content and categories.

Columns:
- content_item_id FK
- category_id FK

Unique:
- (content_item_id, category_id)

#### tags
Purpose: free or managed tags.

Columns:
- id PK
- name
- slug UNIQUE

#### content_tags
Purpose: many-to-many between content and tags.

Columns:
- content_item_id FK
- tag_id FK

Unique:
- (content_item_id, tag_id)

---

### 4.3 Location and Map
Tables:
- regions
- cities
- locations
- content_locations

#### regions
Purpose: support search and filters by region.

Values should support:
- צפון
- חיפה והסביבה
- מרכז
- ירושלים והסביבה
- דרום
- אילת והערבה

Columns:
- id PK
- name UNIQUE
- sort_order

#### cities
Purpose: optional future city-level filtering.

Columns:
- id PK
- region_id FK
- name

Unique:
- (region_id, name)

#### locations
Purpose: store physical locations for map and detail pages.

Columns:
- id PK
- region_id FK
- city_id FK nullable
- place_name
- address_line
- latitude
- longitude
- waze_url
- google_maps_url
- parking_notes
- accessibility_notes
- created_at
- updated_at

Indexes:
- region_id
- city_id
- latitude
- longitude

#### content_locations
Purpose: link content items to one or more locations.

Columns:
- content_item_id FK
- location_id FK
- is_primary

Unique:
- (content_item_id, location_id)

---

### 4.4 Content Details
Tables:
- content_operational_details
- opening_hours
- time_of_day_options
- content_time_of_day
- audience_types
- content_audiences
- accessibility_features
- content_accessibility

#### content_operational_details
Purpose: operational and booking details shown on the detail card.

Columns:
- content_item_id PK/FK
- duration_minutes
- min_participants
- max_participants
- price_type
- price_min
- price_max
- currency
- booking_required
- security_benefit_available
- security_benefit_notes
- website_url
- booking_url
- phone
- email
- created_at
- updated_at

#### opening_hours
Purpose: store opening hours by day.

Columns:
- id PK
- content_item_id FK
- day_of_week
- open_time
- close_time
- notes

Indexes:
- content_item_id
- day_of_week

#### time_of_day_options
Purpose: lookup table for time filters.

Expected values:
- בוקר
- צהריים
- ערב

Columns:
- id PK
- code UNIQUE
- name UNIQUE
- sort_order

#### content_time_of_day
Purpose: many-to-many between content and time-of-day suitability.

Columns:
- content_item_id FK
- time_of_day_id FK

Unique:
- (content_item_id, time_of_day_id)

#### audience_types
Purpose: define audiences.

Examples:
- קציני הדרכה
- משקי חינוך
- שוטרים
- מפקדים
- קבוצות קטנות
- קבוצות בינוניות

Columns:
- id PK
- name UNIQUE
- sort_order

#### content_audiences
Purpose: many-to-many between content and audiences.

Columns:
- content_item_id FK
- audience_type_id FK

Unique:
- (content_item_id, audience_type_id)

#### accessibility_features
Purpose: define accessibility capabilities.

Columns:
- id PK
- name UNIQUE
- sort_order

#### content_accessibility
Purpose: many-to-many between content and accessibility features.

Columns:
- content_item_id FK
- accessibility_feature_id FK

Unique:
- (content_item_id, accessibility_feature_id)

---

### 4.5 Media
Tables:
- media_files
- content_media

#### media_files
Purpose: store uploaded media references.

Columns:
- id PK
- file_name
- file_url
- mime_type
- alt_text
- uploaded_by_user_id FK nullable
- created_at

#### content_media
Purpose: link content items to media files.

Columns:
- content_item_id FK
- media_file_id FK
- media_type
- is_primary
- sort_order

Unique:
- (content_item_id, media_file_id)

---

### 4.6 User Features
Tables:
- favorites
- saved_lists
- saved_list_items

#### favorites
Purpose: allow users to save content items.

Columns:
- id PK
- user_id FK
- content_item_id FK
- created_at

Unique:
- (user_id, content_item_id)

#### saved_lists
Purpose: named user lists such as “day trip ideas”.

Columns:
- id PK
- user_id FK
- name
- description
- created_at
- updated_at

#### saved_list_items
Purpose: items inside a saved list.

Columns:
- saved_list_id FK
- content_item_id FK
- sort_order

Unique:
- (saved_list_id, content_item_id)

---

### 4.7 Admin / Workflow
Tables:
- content_status_history
- audit_logs
- related_content

#### content_status_history
Purpose: track status changes and approval workflow.

Columns:
- id PK
- content_item_id FK
- old_status
- new_status
- changed_by_user_id FK
- changed_at
- notes

Indexes:
- content_item_id
- changed_by_user_id
- changed_at

#### audit_logs
Purpose: track important admin actions.

Columns:
- id PK
- entity_type
- entity_id
- action_type
- performed_by_user_id FK nullable
- performed_at
- details_json

Indexes:
- entity_type
- entity_id
- action_type
- performed_by_user_id
- performed_at

#### related_content
Purpose: support similar/recommended items.

Columns:
- source_content_item_id FK
- target_content_item_id FK
- relation_type

Unique:
- (source_content_item_id, target_content_item_id, relation_type)

---

## 5. Business Rules
- A content item can belong to multiple categories.
- A content item can have multiple tags.
- A content item can have one or more locations.
- A content item can have multiple media files.
- A user can save many favorites.
- A user can have multiple roles.
- A role can have multiple permissions.
- The system must support content approval workflow.
- The search page must support filtering by:
  - category
  - region
  - time of day
  - budget
  - participants
  - accessibility
  - audience

---

## 6. SQL Generation Requirements
When generating `schema.sql` from this document:
- create tables in valid dependency order
- add comments before each table
- include PK, FK, UNIQUE, and INDEX definitions
- use ON DELETE / ON UPDATE thoughtfully
- do not add seed data
- do not omit any table listed here
- generate one complete runnable MySQL 8 schema.sql file