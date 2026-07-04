import { createClient } from '@supabase/supabase-js';
const url = 'https://aosweyggyalowhogjatz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3dleWdneWFsb3dob2dqYXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjQzOTUsImV4cCI6MjA5ODQ0MDM5NX0.od5Zg10H_EflslfXYksolRAu81nFi2zd0vZRXDeqrcs';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('menu_planner').select('*').limit(1);
  if(error) console.log("Error:", error);
  else {
    console.log("Rows:", data);
    // Let's get column info via RPC or just from the error if we select non-existent column
    const { error: e2 } = await supabase.from('menu_planner').select('non_existent_column_for_error').limit(1);
    console.log("Schema Error:", e2?.message);
  }
}
run();
