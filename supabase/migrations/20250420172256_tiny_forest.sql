/*
  # Add Custom Map Support for Events

  1. Changes
    - Add `custom_map_url` column to `events` table to store the custom map image URL
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