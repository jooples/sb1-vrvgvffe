/*
  # Add Database Functions for Volunteer Count Management

  1. New Functions
    - increment_filled_count: Safely increments the filled count for a position
    - decrement_filled_count: Safely decrements the filled count for a position

  2. Security
    - Functions are accessible to authenticated users only
*/

-- Function to increment the filled count
CREATE OR REPLACE FUNCTION increment_filled_count(position_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE volunteer_positions
  SET filled = filled + 1
  WHERE id = position_id;
END;
$$;

-- Function to decrement the filled count
CREATE OR REPLACE FUNCTION decrement_filled_count(position_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE volunteer_positions
  SET filled = GREATEST(0, filled - 1)
  WHERE id = position_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_filled_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_filled_count(uuid) TO authenticated;