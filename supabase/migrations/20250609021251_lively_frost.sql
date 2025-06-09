/*
  # Add custom_map_url column to events table

  1. Changes
    - Add `custom_map_url` column to `events` table to store custom map image URLs
    - Column is nullable to allow events without custom maps
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'custom_map_url'
  ) THEN
    ALTER TABLE events ADD COLUMN custom_map_url text;
  END IF;
END $$;