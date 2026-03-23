-- Migration: add priority ordering to content_categories
-- MySQL 8 compatible

START TRANSACTION;

-- 1) Add the new column as NULL first so existing rows can be backfilled safely.
ALTER TABLE content_categories
    ADD COLUMN priority INT NULL AFTER category_id;

-- 2) Backfill existing rows with deterministic per-item order.
--    Lowest category_id gets priority = 1, then 2, 3, ...
UPDATE content_categories cc
JOIN (
    SELECT
        content_item_id,
        category_id,
        ROW_NUMBER() OVER (
            PARTITION BY content_item_id
            ORDER BY category_id
        ) AS priority_value
    FROM content_categories
) ranked
    ON ranked.content_item_id = cc.content_item_id
   AND ranked.category_id = cc.category_id
SET cc.priority = ranked.priority_value;

-- 3) Enforce final column contract for new/updated rows.
ALTER TABLE content_categories
    MODIFY COLUMN priority INT NOT NULL DEFAULT 1;

-- 4) Add index + uniqueness for fast ordering and deterministic per-item priority.
ALTER TABLE content_categories
    ADD KEY idx_content_categories_item_priority (content_item_id, priority),
    ADD UNIQUE KEY uq_content_categories_item_priority (content_item_id, priority);

COMMIT;

