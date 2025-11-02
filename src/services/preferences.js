const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE = 'user_workflow_prefs';
const WORKFLOW_KEY = 'invoice';

async function getInvoicePrefs(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('drive_folder_id, spreadsheet_id, range')
    .eq('user_id', userId)
    .eq('workflow', WORKFLOW_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function upsertInvoicePrefs(userId, prefs) {
  const row = {
    user_id: userId,
    workflow: WORKFLOW_KEY,
    drive_folder_id: prefs.drive_folder_id || null,
    spreadsheet_id: prefs.spreadsheet_id || null,
    range: prefs.range || null,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,workflow' });
  if (error) throw new Error(error.message);
  return { success: true };
}

module.exports = { getInvoicePrefs, upsertInvoicePrefs };
