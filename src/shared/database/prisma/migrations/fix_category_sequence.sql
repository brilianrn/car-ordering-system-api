-- Fix Category Sequence Issue
-- This migration fixes the sequence for category table if it's out of sync
-- Run this if you get "Unique constraint failed on the fields: (`id`)" error

-- Step 1: Check current state
SELECT 
  'Current Sequence Value' as info,
  currval('category_id_seq') as value
UNION ALL
SELECT 
  'Max ID in Table' as info,
  (SELECT MAX(id) FROM category)::text as value;

-- Step 2: Reset sequence to max id + 1
-- This will set sequence to 7 (since max id is 6)
SELECT setval('category_id_seq', COALESCE((SELECT MAX(id) FROM category), 0) + 1, true);

-- Step 3: Verify the fix
SELECT 
  currval('category_id_seq') as current_sequence_value,
  (SELECT MAX(id) FROM category) as max_id_in_table,
  CASE 
    WHEN currval('category_id_seq') > (SELECT MAX(id) FROM category) THEN 'Sequence is OK - Ready for next insert'
    WHEN currval('category_id_seq') = (SELECT MAX(id) FROM category) THEN 'Sequence equals max id - Will work but next id will be max+1'
    ELSE 'Sequence needs to be higher'
  END as status;

-- Note: After running this, the next category created will have id = 7

