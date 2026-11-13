/**
 * Creator Support Amravati — Events & Projects public feed
 *
 * SETUP
 * 1. Create a Google Sheet named "CSA Events & Projects".
 * 2. Rename the first tab to "Events".
 * 3. Put these exact headers in row 1:
 * id | title | type | status | date | location | description | image | action_url | action_label | visible | featured
 * 4. Add one event/project per row. Use visible=TRUE to publish; FALSE to hide.
 * 5. Open Extensions > Apps Script, paste this file, save.
 * 6. Deploy > New deployment > Web app; Execute as: Me; Who has access: Anyone.
 * 7. Copy the /exec URL into CSA_EVENTS_API_URL in assets/js/events-projects.js.
 *
 * Only the Events sheet is exposed. Do not put private/customer data in it.
 */
const SHEET_NAME = 'Events';
const HEADERS = ['id','title','type','status','date','location','description','image','action_url','action_label','visible','featured'];

function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Missing sheet tab: ' + SHEET_NAME);
    const values = sheet.getDataRange().getDisplayValues();
    if (!values.length) throw new Error('Add the header row to the Events sheet.');
    const headers = values.shift().map(v => String(v).trim().toLowerCase());
    const missing = HEADERS.filter(h => !headers.includes(h));
    if (missing.length) throw new Error('Missing columns: ' + missing.join(', '));
    const rows = values.filter(row => row.some(cell => String(cell).trim() !== ''));
    const items = rows.map(row => {
      const item = {};
      headers.forEach((header, i) => { item[header] = row[i] == null ? '' : String(row[i]).trim(); });
      return item;
    }).filter(item => item.title && String(item.visible).toLowerCase() === 'true');
    return output({items: items, updatedAt: new Date().toISOString()}, callback);
  } catch (err) {
    return output({items: [], error: String(err && err.message || err)}, callback);
  }
}

function output(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the Apps Script editor to create the correctly headed tab. */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, HEADERS.length);
}
