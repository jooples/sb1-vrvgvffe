# Volunteer Counter Update Test Plan

## Overview
This document outlines the test plan for verifying that volunteer counters update correctly across all pages when volunteers are assigned, removed, or check in.

## Implementation Summary

### Database Functions
- `increment_filled_count(position_id)` - Safely increments the filled count for a position
- `decrement_filled_count(position_id)` - Safely decrements the filled count for a position (minimum 0)

### Pages That Display Volunteer Counts
1. **EventsOverviewPage** - Shows total positions, filled positions, and positions needing volunteers
2. **EventOverviewPage** - Shows individual position status with filled/needed counts
3. **VolunteerPositionsPage** - Shows volunteers count for each position (filled/needed)
4. **CheckInPage** - Shows volunteers available for check-in
5. **AssignVolunteersPage** - Shows volunteer assignments

## Test Scenarios

### 1. Assigning a Volunteer
**Location**: AssignVolunteersPage
**Action**: Create a new volunteer assignment
**Expected Behavior**:
- `increment_filled_count` is called for the position
- Position's `filled` count increases by 1
- All pages showing volunteer counts update automatically via query invalidation
- Success toast shows "Volunteer assigned successfully"

### 2. Removing a Volunteer
**Location**: AssignVolunteersPage
**Action**: Delete a volunteer assignment
**Expected Behavior**:
- `decrement_filled_count` is called for the position
- Position's `filled` count decreases by 1 (minimum 0)
- All pages showing volunteer counts update automatically
- Success toast shows "Volunteer removed successfully"

### 3. Moving a Volunteer Between Positions
**Location**: AssignVolunteersPage
**Action**: Edit a volunteer and change their position
**Expected Behavior**:
- `decrement_filled_count` is called for the old position
- `increment_filled_count` is called for the new position
- Both positions' counts update correctly
- Success toast shows "Volunteer updated successfully"

### 4. Volunteer Check-in
**Location**: CheckInPage
**Action**: A volunteer checks in via QR code
**Expected Behavior**:
- `increment_filled_count` is called for the position
- Position's `filled` count increases by 1
- All pages showing volunteer counts update automatically
- Success toast shows "Check-in successful!"

## Query Invalidation Coverage

### CheckInPage
- ✅ `['volunteers', positionId]` - Updates volunteer list for the position
- ✅ `['positions']` - Updates all position data
- ✅ `['positions', eventId]` - Updates positions for the specific event

### AssignVolunteersPage
- ✅ `['volunteers']` - Updates all volunteer assignments
- ✅ `['positions']` - Updates all position data (for create/delete operations)

## Error Handling
- All database function calls include proper error handling
- Errors are logged to console for debugging
- User-friendly error messages are displayed via toast notifications
- Failed operations don't leave the system in an inconsistent state

## Verification Steps
1. Open the application in multiple browser tabs/windows
2. Navigate to different pages that show volunteer counts
3. Perform volunteer assignment/removal/check-in operations
4. Verify that counts update in real-time across all open pages
5. Check browser console for any errors
6. Verify that database counts match UI displays

## Success Criteria
- ✅ Volunteer counts update immediately after any operation
- ✅ All pages show consistent count data
- ✅ No console errors during operations
- ✅ Database functions are called correctly
- ✅ Query invalidations trigger UI updates
- ✅ Error handling works properly
