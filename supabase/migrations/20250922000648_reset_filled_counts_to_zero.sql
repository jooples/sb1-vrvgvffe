-- Reset all filled counts to zero
-- This migration resets all volunteer position filled counts to 0
-- The filled count should only reflect volunteers who are actually checked in (arrived = true)

UPDATE volunteer_positions 
SET filled = 0;
