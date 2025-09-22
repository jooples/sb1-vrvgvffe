// Script to reset all filled counts to zero
// Run this with: node reset-filled-counts.js

import { createClient } from '@supabase/supabase-js';

// You'll need to replace these with your actual Supabase URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetFilledCounts() {
  try {
    console.log('Resetting all filled counts to zero...');
    
    const { data, error } = await supabase
      .from('volunteer_positions')
      .update({ filled: 0 })
      .select('id, name, filled');
    
    if (error) {
      console.error('Error resetting filled counts:', error);
      return;
    }
    
    console.log('Successfully reset filled counts for positions:', data);
    console.log(`Updated ${data.length} positions`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

resetFilledCounts();
