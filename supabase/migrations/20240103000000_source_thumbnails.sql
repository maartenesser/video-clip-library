-- Add thumbnail columns to sources table
ALTER TABLE sources ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(500);
