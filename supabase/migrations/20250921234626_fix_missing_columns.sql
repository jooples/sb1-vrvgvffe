/*
  # Fix Missing Columns in volunteer_signups table

  This migration ensures the other_notes and organization columns exist
  in the volunteer_signups table, even if previous migrations didn't apply correctly.
*/

-- Add other_notes column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'volunteer_signups' 
        AND column_name = 'other_notes'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE volunteer_signups ADD COLUMN other_notes text;
        RAISE NOTICE 'Added other_notes column to volunteer_signups table';
    ELSE
        RAISE NOTICE 'other_notes column already exists in volunteer_signups table';
    END IF;
END $$;

-- Add organization column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'volunteer_signups' 
        AND column_name = 'organization'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE volunteer_signups ADD COLUMN organization text;
        RAISE NOTICE 'Added organization column to volunteer_signups table';
    ELSE
        RAISE NOTICE 'organization column already exists in volunteer_signups table';
    END IF;
END $$;

-- Verify the columns exist
DO $$
DECLARE
    other_notes_exists boolean;
    organization_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'volunteer_signups' 
        AND column_name = 'other_notes'
        AND table_schema = 'public'
    ) INTO other_notes_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'volunteer_signups' 
        AND column_name = 'organization'
        AND table_schema = 'public'
    ) INTO organization_exists;
    
    IF other_notes_exists AND organization_exists THEN
        RAISE NOTICE 'SUCCESS: Both other_notes and organization columns now exist in volunteer_signups table';
    ELSE
        RAISE EXCEPTION 'FAILED: Columns still missing - other_notes: %, organization: %', other_notes_exists, organization_exists;
    END IF;
END $$;
