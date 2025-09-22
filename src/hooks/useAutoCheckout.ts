import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Volunteer {
  id: string;
  position_id: string;
  volunteer_name: string;
  start_time: string;
  end_time: string;
  arrived: boolean;
}

interface UseAutoCheckoutOptions {
  volunteers?: Volunteer[];
  enabled?: boolean;
  checkInterval?: number; // in milliseconds
  bufferMinutes?: number; // buffer before auto check-out
  maxLateCheckoutWindow?: number; // maximum minutes after shift end to allow check-out
}

export function useAutoCheckout({
  volunteers = [],
  enabled = true,
  checkInterval = 60000, // Check every minute
  bufferMinutes = 1,
  maxLateCheckoutWindow = 30 // 30 minutes after shift end
}: UseAutoCheckoutOptions = {}) {
  const queryClient = useQueryClient();
  const processedVolunteersRef = useRef<Set<string>>(new Set());

  const checkForExpiredShifts = useCallback(async () => {
    if (!volunteers || volunteers.length === 0 || !enabled) return;

    // Clean up processed volunteers that are no longer in the current volunteer list
    const currentVolunteerIds = new Set(volunteers.map(v => v.id));
    const processedIds = Array.from(processedVolunteersRef.current);
    processedIds.forEach(id => {
      if (!currentVolunteerIds.has(id)) {
        processedVolunteersRef.current.delete(id);
      }
    });

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Find volunteers who are checked in but whose shifts have ended
    // Only check out volunteers whose shift ended recently (within a reasonable window)
    // This prevents checking out volunteers who checked in late
    const volunteersToCheckOut = volunteers.filter(volunteer => {
      if (!volunteer.arrived) return false; // Only check out volunteers who are currently checked in
      
      // Skip if we've already processed this volunteer
      if (processedVolunteersRef.current.has(volunteer.id)) return false;
      
      const [endHour, endMin] = volunteer.end_time.split(':').map(Number);
      const endTime = endHour * 60 + endMin;
      
      // Only check out if:
      // 1. Shift has ended (with buffer)
      // 2. Current time is within a reasonable window after shift end
      // This prevents checking out volunteers who checked in late
      const timeSinceShiftEnd = currentTime - (endTime + bufferMinutes);
      return timeSinceShiftEnd >= 0 && timeSinceShiftEnd <= maxLateCheckoutWindow;
    });

    if (volunteersToCheckOut.length === 0) return;

    console.log(`Auto-checkout: Found ${volunteersToCheckOut.length} volunteers to check out`);

    // Process each volunteer
    const checkOutPromises = volunteersToCheckOut.map(async (volunteer) => {
      try {
        console.log(`Auto-checking out volunteer ${volunteer.volunteer_name} - shift ended`);
        
        // Update volunteer signup arrival status
        const { error: signupError } = await supabase
          .from('volunteer_signups')
          .update({ arrived: false })
          .eq('id', volunteer.id);
          
        if (signupError) {
          console.error('Error auto-checking out volunteer:', signupError);
          return { success: false, volunteer: volunteer.volunteer_name, error: signupError };
        }

        // Decrement the filled count for the position
        const { error: decrementError } = await supabase
          .rpc('decrement_filled_count', { position_id: volunteer.position_id });
          
        if (decrementError) {
          console.error('Error decrementing filled count during auto check-out:', decrementError);
          // Don't fail the entire operation for this error
        }

        console.log(`Successfully auto-checked out volunteer ${volunteer.volunteer_name}`);
        
        // Mark this volunteer as processed to avoid duplicate processing
        processedVolunteersRef.current.add(volunteer.id);
        
        return { success: true, volunteer: volunteer.volunteer_name };
      } catch (error) {
        console.error(`Failed to auto-check out volunteer ${volunteer.volunteer_name}:`, error);
        return { success: false, volunteer: volunteer.volunteer_name, error };
      }
    });

    // Wait for all check-outs to complete
    const results = await Promise.all(checkOutPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Show appropriate notifications
    if (successful.length > 0) {
      toast.success(
        `${successful.length} volunteer${successful.length > 1 ? 's' : ''} automatically checked out - shift${successful.length > 1 ? 's' : ''} ended`,
        { duration: 5000 }
      );
    }

    if (failed.length > 0) {
      console.error(`Failed to auto-check out ${failed.length} volunteers:`, failed);
      toast.error(
        `Failed to auto-check out ${failed.length} volunteer${failed.length > 1 ? 's' : ''}`,
        { duration: 5000 }
      );
    }

    // If any volunteers were checked out, refresh the data
    if (successful.length > 0) {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      
      // Also invalidate specific position queries if we have position IDs
      const positionIds = [...new Set(volunteersToCheckOut.map(v => v.position_id))];
      positionIds.forEach(positionId => {
        queryClient.invalidateQueries({ queryKey: ['volunteers', positionId] });
        queryClient.invalidateQueries({ queryKey: ['positions', positionId] });
      });
    }
  }, [volunteers, enabled, bufferMinutes, maxLateCheckoutWindow, queryClient]);

  // Set up the interval
  useEffect(() => {
    if (!enabled) return;

    // Run immediately on mount
    checkForExpiredShifts();

    // Set up interval
    const interval = setInterval(checkForExpiredShifts, checkInterval);

    return () => clearInterval(interval);
  }, [checkForExpiredShifts, enabled, checkInterval]);

  return {
    checkForExpiredShifts
  };
}
