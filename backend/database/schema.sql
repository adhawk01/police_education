-- ============================================================
-- Education Department App — MySQL 8 Schema
-- Source of truth: backend/docs/data-model.md
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- roles
-- Purpose: define role types.
-- ------------------------------------------------------------
CREATE TABLE roles (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(100) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    description  TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- permissions
-- Purpose: define available permissions.
-- ------------------------------------------------------------
CREATE TABLE permissions (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(100) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    description  TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- users_statuses
-- Purpose: lookup table for users.status_id.
-- ------------------------------------------------------------
CREATE TABLE users_statuses (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(100) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    description  VARCHAR(500) NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_statuses_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_item_statuses
-- Purpose: lookup table for content item status domains.
-- ------------------------------------------------------------
CREATE TABLE content_item_statuses (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(100) NOT NULL,
    name         VARCHAR(150) NOT NULL,
    description  VARCHAR(500) NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_item_statuses_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_types
-- Purpose: define content types handled by the central content model.
-- ------------------------------------------------------------
CREATE TABLE content_types (
    id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code  VARCHAR(100) NOT NULL,
    name  VARCHAR(150) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- regions
-- Purpose: support search and filters by region.
-- ------------------------------------------------------------
CREATE TABLE regions (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150) NOT NULL,
    sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_regions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- time_of_day_options
-- Purpose: lookup table for time filters.
-- ------------------------------------------------------------
CREATE TABLE time_of_day_options (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code        VARCHAR(100) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_time_of_day_options_code (code),
    UNIQUE KEY uq_time_of_day_options_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- audience_types
-- Purpose: define audiences.
-- ------------------------------------------------------------
CREATE TABLE audience_types (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150) NOT NULL,
    sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_audience_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- accessibility_features
-- Purpose: define accessibility capabilities.
-- ------------------------------------------------------------
CREATE TABLE accessibility_features (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150) NOT NULL,
    sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_accessibility_features_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- users
-- Purpose: store system users.
-- Note: status is normalized via users_statuses.
-- ------------------------------------------------------------
CREATE TABLE users (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name      VARCHAR(150) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    phone          VARCHAR(30) NULL,
    password_hash  VARCHAR(255) NOT NULL,
    status_id      BIGINT UNSIGNED NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_status_id (status_id),
    CONSTRAINT fk_users_status
        FOREIGN KEY (status_id) REFERENCES users_statuses (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- categories
-- Purpose: main and sub categories.
-- ------------------------------------------------------------
CREATE TABLE categories (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    parent_id   INT UNSIGNED NULL,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(150) NOT NULL,
    icon_name   VARCHAR(20) NULL,
    description VARCHAR(50 NULL,
    color_code  VARCHAR(20) NULL,
    sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug),
    KEY idx_categories_parent_id (parent_id),
    KEY idx_categories_is_active (is_active),
    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id) REFERENCES categories (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- tags
-- Purpose: free or managed tags.
-- ------------------------------------------------------------
CREATE TABLE tags (
    id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name  VARCHAR(100) NOT NULL,
    slug  VARCHAR(150) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tags_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- cities
-- Purpose: optional future city-level filtering.
-- ------------------------------------------------------------
CREATE TABLE cities (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    region_id  INT UNSIGNED NOT NULL,
    name       VARCHAR(150) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cities_region_name (region_id, name),
    KEY idx_cities_region_id (region_id),
    CONSTRAINT fk_cities_region
        FOREIGN KEY (region_id) REFERENCES regions (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- locations
-- Purpose: store physical locations for map and detail pages.
-- ------------------------------------------------------------
CREATE TABLE locations (
    id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    region_id            INT UNSIGNED NOT NULL,
    city_id              INT UNSIGNED NULL,
    place_name           VARCHAR(255) NOT NULL,
    address_line         VARCHAR(255) NULL,
    latitude             DECIMAL(10,8) NULL,
    longitude            DECIMAL(11,8) NULL,
    waze_url             VARCHAR(2048) NULL,
    google_maps_url      VARCHAR(2048) NULL,
    parking_notes        TEXT NULL,
    accessibility_notes  TEXT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_locations_region_id (region_id),
    KEY idx_locations_city_id (city_id),
    KEY idx_locations_latitude (latitude),
    KEY idx_locations_longitude (longitude),
    CONSTRAINT fk_locations_region
        FOREIGN KEY (region_id) REFERENCES regions (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_locations_city
        FOREIGN KEY (city_id) REFERENCES cities (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT chk_locations_latitude
        CHECK (latitude IS NULL OR latitude BETWEEN -90.00000000 AND 90.00000000),
    CONSTRAINT chk_locations_longitude
        CHECK (longitude IS NULL OR longitude BETWEEN -180.00000000 AND 180.00000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_items
-- Purpose: central table for all content entities.
-- Note: status is normalized via content_item_statuses.
-- ------------------------------------------------------------
CREATE TABLE content_items (
    id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    content_type_id      INT UNSIGNED NOT NULL,
    title                VARCHAR(255) NOT NULL,
    short_description    VARCHAR(500) NULL,
    full_description     LONGTEXT NULL,
    status_id            BIGINT UNSIGNED NOT NULL,
    audience_notes       TEXT NULL,
    is_featured          TINYINT(1) NOT NULL DEFAULT 0,
    is_active            TINYINT(1) NOT NULL DEFAULT 1,
    created_by_user_id   INT UNSIGNED NOT NULL,
    approved_by_user_id  INT UNSIGNED NULL,
    published_at         DATETIME NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_content_items_content_type_id (content_type_id),
    KEY idx_content_items_status_id (status_id),
    KEY idx_content_items_is_featured (is_featured),
    KEY idx_content_items_is_active (is_active),
    KEY idx_content_items_published_at (published_at),
    KEY idx_content_items_created_by_user_id (created_by_user_id),
    KEY idx_content_items_approved_by_user_id (approved_by_user_id),
    CONSTRAINT fk_content_items_content_type
        FOREIGN KEY (content_type_id) REFERENCES content_types (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_items_status
        FOREIGN KEY (status_id) REFERENCES content_item_statuses (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_items_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_items_approved_by_user
        FOREIGN KEY (approved_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- media_files
-- Purpose: store uploaded media references.
-- ------------------------------------------------------------
CREATE TABLE media_files (
    id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    file_name            VARCHAR(255) NOT NULL,
    file_url             VARCHAR(2048) NOT NULL,
    mime_type            VARCHAR(255) NOT NULL,
    alt_text             VARCHAR(255) NULL,
    uploaded_by_user_id  INT UNSIGNED NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_media_files_uploaded_by_user_id (uploaded_by_user_id),
    CONSTRAINT fk_media_files_uploaded_by_user
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- user_roles
-- Purpose: many-to-many between users and roles.
-- ------------------------------------------------------------
CREATE TABLE user_roles (
    user_id  INT UNSIGNED NOT NULL,
    role_id  INT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, role_id),
    KEY idx_user_roles_role_id (role_id),
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- role_permissions
-- Purpose: many-to-many between roles and permissions.
-- ------------------------------------------------------------
CREATE TABLE role_permissions (
    role_id        INT UNSIGNED NOT NULL,
    permission_id  INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    KEY idx_role_permissions_permission_id (permission_id),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_categories
-- Purpose: many-to-many between content and categories.
-- ------------------------------------------------------------
CREATE TABLE content_categories (
    content_item_id  INT UNSIGNED NOT NULL,
    category_id      INT UNSIGNED NOT NULL,
    priority         INT NOT NULL DEFAULT 1,
    PRIMARY KEY (content_item_id, category_id),
    KEY idx_content_categories_item_priority (content_item_id, priority),
    UNIQUE KEY uq_content_categories_item_priority (content_item_id, priority),
    KEY idx_content_categories_category_id (category_id),
    CONSTRAINT fk_content_categories_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_categories_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_tags
-- Purpose: many-to-many between content and tags.
-- ------------------------------------------------------------
CREATE TABLE content_tags (
    content_item_id  INT UNSIGNED NOT NULL,
    tag_id           INT UNSIGNED NOT NULL,
    PRIMARY KEY (content_item_id, tag_id),
    KEY idx_content_tags_tag_id (tag_id),
    CONSTRAINT fk_content_tags_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_locations
-- Purpose: link content items to one or more locations.
-- ------------------------------------------------------------
CREATE TABLE content_locations (
    content_item_id  INT UNSIGNED NOT NULL,
    location_id      INT UNSIGNED NOT NULL,
    is_primary       TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (content_item_id, location_id),
    KEY idx_content_locations_location_id (location_id),
    KEY idx_content_locations_is_primary (is_primary),
    CONSTRAINT fk_content_locations_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_locations_location
        FOREIGN KEY (location_id) REFERENCES locations (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_operational_details
-- Purpose: operational and booking details shown on the detail card.
-- ------------------------------------------------------------
CREATE TABLE content_operational_details (
    content_item_id               INT UNSIGNED NOT NULL,
    duration_minutes              SMALLINT UNSIGNED NULL,
    min_participants              INT UNSIGNED NULL,
    max_participants              INT UNSIGNED NULL,
    price_type                    VARCHAR(50) NULL,
    price_min                     DECIMAL(10,2) NULL,
    price_max                     DECIMAL(10,2) NULL,
    currency                      CHAR(3) NOT NULL DEFAULT 'ILS',
    booking_required              TINYINT(1) NOT NULL DEFAULT 0,
    security_benefit_available    TINYINT(1) NOT NULL DEFAULT 0,
    security_benefit_notes        TEXT NULL,
    website_url                   VARCHAR(2048) NULL,
    booking_url                   VARCHAR(2048) NULL,
    phone                         VARCHAR(30) NULL,
    email                         VARCHAR(255) NULL,
    created_at                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (content_item_id),
    CONSTRAINT fk_content_operational_details_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_content_operational_details_participants
        CHECK (
            min_participants IS NULL
            OR max_participants IS NULL
            OR max_participants >= min_participants
        ),
    CONSTRAINT chk_content_operational_details_prices
        CHECK (
            price_min IS NULL
            OR price_max IS NULL
            OR price_max >= price_min
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- opening_hours
-- Purpose: store opening hours by day.
-- day_of_week uses 1-7.
-- ------------------------------------------------------------
CREATE TABLE opening_hours (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    content_item_id  INT UNSIGNED NOT NULL,
    day_of_week      TINYINT UNSIGNED NOT NULL,
    open_time        TIME NULL,
    close_time       TIME NULL,
    notes            VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_opening_hours_content_item_id (content_item_id),
    KEY idx_opening_hours_day_of_week (day_of_week),
    CONSTRAINT fk_opening_hours_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_opening_hours_day_of_week
        CHECK (day_of_week BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_time_of_day
-- Purpose: many-to-many between content and time-of-day suitability.
-- ------------------------------------------------------------
CREATE TABLE content_time_of_day (
    content_item_id  INT UNSIGNED NOT NULL,
    time_of_day_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (content_item_id, time_of_day_id),
    KEY idx_content_time_of_day_time_of_day_id (time_of_day_id),
    CONSTRAINT fk_content_time_of_day_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_time_of_day_option
        FOREIGN KEY (time_of_day_id) REFERENCES time_of_day_options (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_audiences
-- Purpose: many-to-many between content and audiences.
-- ------------------------------------------------------------
CREATE TABLE content_audiences (
    content_item_id    INT UNSIGNED NOT NULL,
    audience_type_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (content_item_id, audience_type_id),
    KEY idx_content_audiences_audience_type_id (audience_type_id),
    CONSTRAINT fk_content_audiences_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_audiences_audience_type
        FOREIGN KEY (audience_type_id) REFERENCES audience_types (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_accessibility
-- Purpose: many-to-many between content and accessibility features.
-- ------------------------------------------------------------
CREATE TABLE content_accessibility (
    content_item_id           INT UNSIGNED NOT NULL,
    accessibility_feature_id  INT UNSIGNED NOT NULL,
    PRIMARY KEY (content_item_id, accessibility_feature_id),
    KEY idx_content_accessibility_feature_id (accessibility_feature_id),
    CONSTRAINT fk_content_accessibility_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_accessibility_feature
        FOREIGN KEY (accessibility_feature_id) REFERENCES accessibility_features (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_media
-- Purpose: link content items to media files.
-- ------------------------------------------------------------
CREATE TABLE content_media (
    content_item_id  INT UNSIGNED NOT NULL,
    media_file_id    INT UNSIGNED NOT NULL,
    media_type       VARCHAR(50) NULL,
    is_primary       TINYINT(1) NOT NULL DEFAULT 0,
    sort_order       INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (content_item_id, media_file_id),
    KEY idx_content_media_media_file_id (media_file_id),
    KEY idx_content_media_media_type (media_type),
    KEY idx_content_media_is_primary (is_primary),
    CONSTRAINT fk_content_media_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_media_media_file
        FOREIGN KEY (media_file_id) REFERENCES media_files (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- favorites
-- Purpose: allow users to save content items.
-- ------------------------------------------------------------
CREATE TABLE favorites (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id          INT UNSIGNED NOT NULL,
    content_item_id  INT UNSIGNED NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_favorites_user_content_item (user_id, content_item_id),
    KEY idx_favorites_content_item_id (content_item_id),
    CONSTRAINT fk_favorites_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_favorites_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- saved_lists
-- Purpose: named user lists such as day trip ideas.
-- ------------------------------------------------------------
CREATE TABLE saved_lists (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    name        VARCHAR(150) NOT NULL,
    description TEXT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_saved_lists_user_id_name (user_id, name),
    KEY idx_saved_lists_user_id (user_id),
    CONSTRAINT fk_saved_lists_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- saved_list_items
-- Purpose: items inside a saved list.
-- ------------------------------------------------------------
CREATE TABLE saved_list_items (
    saved_list_id     INT UNSIGNED NOT NULL,
    content_item_id   INT UNSIGNED NOT NULL,
    sort_order        INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (saved_list_id, content_item_id),
    KEY idx_saved_list_items_content_item_id (content_item_id),
    KEY idx_saved_list_items_sort_order (sort_order),
    CONSTRAINT fk_saved_list_items_saved_list
        FOREIGN KEY (saved_list_id) REFERENCES saved_lists (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_saved_list_items_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- content_status_history
-- Purpose: track status changes and approval workflow.
-- ------------------------------------------------------------
CREATE TABLE content_status_history (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    content_item_id     INT UNSIGNED NOT NULL,
    old_status_id       BIGINT UNSIGNED NULL,
    new_status_id       BIGINT UNSIGNED NOT NULL,
    changed_by_user_id  INT UNSIGNED NOT NULL,
    changed_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes               TEXT NULL,
    PRIMARY KEY (id),
    KEY idx_content_status_history_content_item_id (content_item_id),
    KEY idx_content_status_history_old_status_id (old_status_id),
    KEY idx_content_status_history_new_status_id (new_status_id),
    KEY idx_content_status_history_changed_by_user_id (changed_by_user_id),
    KEY idx_content_status_history_changed_at (changed_at),
    CONSTRAINT fk_content_status_history_content_item
        FOREIGN KEY (content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_status_history_old_status
        FOREIGN KEY (old_status_id) REFERENCES content_item_statuses (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_status_history_new_status
        FOREIGN KEY (new_status_id) REFERENCES content_item_statuses (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_content_status_history_changed_by_user
        FOREIGN KEY (changed_by_user_id) REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- audit_logs
-- Purpose: track important admin actions.
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_type           VARCHAR(100) NOT NULL,
    entity_id             BIGINT UNSIGNED NOT NULL,
    action_type           VARCHAR(100) NOT NULL,
    performed_by_user_id  INT UNSIGNED NULL,
    performed_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details_json          JSON NULL,
    PRIMARY KEY (id),
    KEY idx_audit_logs_entity_type (entity_type),
    KEY idx_audit_logs_entity_id (entity_id),
    KEY idx_audit_logs_action_type (action_type),
    KEY idx_audit_logs_performed_by_user_id (performed_by_user_id),
    KEY idx_audit_logs_performed_at (performed_at),
    CONSTRAINT fk_audit_logs_performed_by_user
        FOREIGN KEY (performed_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- related_content
-- Purpose: support similar or recommended items.
-- ------------------------------------------------------------
CREATE TABLE related_content (
    source_content_item_id  INT UNSIGNED NOT NULL,
    target_content_item_id  INT UNSIGNED NOT NULL,
    relation_type           VARCHAR(50) NOT NULL,
    PRIMARY KEY (source_content_item_id, target_content_item_id, relation_type),
    KEY idx_related_content_target_content_item_id (target_content_item_id),
    KEY idx_related_content_relation_type (relation_type),
    CONSTRAINT fk_related_content_source_content_item
        FOREIGN KEY (source_content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_related_content_target_content_item
        FOREIGN KEY (target_content_item_id) REFERENCES content_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

