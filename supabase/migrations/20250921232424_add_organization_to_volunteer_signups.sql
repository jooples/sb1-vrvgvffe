/*
  # Add organization field to volunteer_signups table

  1. Add `organization` column to `volunteer_signups` table
     - `organization` (text, nullable) - Optional organization name for the volunteer
*/

-- Add organization column to volunteer_signups table
ALTER TABLE volunteer_signups 
ADD COLUMN organization text;
