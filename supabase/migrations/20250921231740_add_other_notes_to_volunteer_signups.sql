/*
  # Add other_notes field to volunteer_signups table

  1. Add `other_notes` column to `volunteer_signups` table
     - `other_notes` (text, nullable) - Free-response field for additional volunteer notes
*/

-- Add other_notes column to volunteer_signups table
ALTER TABLE volunteer_signups 
ADD COLUMN other_notes text;
