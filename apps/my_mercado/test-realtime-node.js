import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aidqtgttlyddcfgqibso.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XMBAvUo1iiDOkREkWRXvBg_ieWSYEGW';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const listId = '3620958f-287d-41da-ab7b-12dce30a3b2b'; // Note: I need the actual list UUID. Let's find it.
const code = 'K8XL97';

async function run() {
  console.log('Fetching list details...');
  const { data: list, error } = await supabase
    .from('collaborative_lists')
    .select('id')
    .eq('code', code)
    .single();

  if (error) {
    console.error('Error fetching list:', error);
    return;
  }
  const currentListId = list.id;
  console.log('List ID:', currentListId);

  // Subscribe WITHOUT filter
  supabase
    .channel(`shared-list-all`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collaborative_list_items',
        // filter: `list_id=eq.${currentListId}`,
      },
      (payload) => {
        console.log('[Realtime UNFILTERED]', payload.eventType, payload.new?.name, payload);
      }
    )
    .subscribe((status, err) => {
        console.log('[Status UNFILTERED]', status, err);
    });

  // Subscribe WITH filter
  supabase
    .channel(`shared-list-filtered`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collaborative_list_items',
        filter: `list_id=eq.${currentListId}`,
      },
      (payload) => {
        console.log('[Realtime FILTERED]', payload.eventType, payload.new?.name, payload);
      }
    )
    .subscribe((status, err) => {
        console.log('[Status FILTERED]', status, err);
    });

  console.log('Waiting 3 seconds before mutating...');
  await new Promise(r => setTimeout(r, 3000));

  console.log('Fetching the newly inserted item...');
  const { data: items } = await supabase
    .from('collaborative_list_items')
    .select('*')
    .eq('list_id', currentListId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (items && items.length > 0) {
    const item = items[0];
    console.log('Toggling item:', item.name, 'current checked:', item.checked);
    const { error: updateErr } = await supabase
      .from('collaborative_list_items')
      .update({ checked: !item.checked, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (updateErr) {
        console.error('Update Error:', updateErr);
    } else {
        console.log('Update executed successfully via REST.');
    }
  } else {
    console.log('No items found in list.');
  }

  console.log('Waiting 10 seconds to observe events...');
  await new Promise(r => setTimeout(r, 10000));
  process.exit(0);
}

run();
