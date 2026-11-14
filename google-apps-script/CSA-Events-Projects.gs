/**
 * Creator Support Amravati — Events & Projects Google Sheets feed
 * 1) Create a Google Sheet named "CSA Events & Projects".
 * 2) Extensions → Apps Script. Paste this entire file and save.
 * 3) Run setupSheet() once and approve permissions.
 * 4) Deploy → New deployment → Web app; Execute as Me; access Anyone.
 * 5) Copy the web app URL into assets/js/events-projects.js as CSA_EVENTS_API_URL.
 *
 * Sheet columns: title, type, status, date, location, description, image,
 * action_label, action_url, featured, visible
 */
const SHEET_NAME = "Events";

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const headers = ["title","type","status","date","location","description","image","action_label","action_url","featured","visible"];
  sheet.clear();
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,headers.length).setFontWeight("bold").setBackground("#101b35").setFontColor("#ffffff");
  sheet.autoResizeColumns(1, headers.length);
  sheet.getRange(2,1,1,headers.length).setValues([[
    "Example: Business Promotional Shoot","Project","Upcoming","","Amravati",
    "Replace this sample row with a confirmed CSA event or project. Do not publish unconfirmed dates.",
    "","Know More","","TRUE","FALSE"
  ]]);
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return respond_({items:[]}, e);
  }
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift().map(h => String(h).trim());
  const items = values.filter(row => row.some(cell => String(cell).trim() !== "")).map(row => {
    const item = {};
    headers.forEach((header, i) => item[header] = row[i] || "");
    return item;
  }).filter(item => String(item.visible).toLowerCase() === "true");
  return respond_({items:items}, e);
}

// The website loads this public, read-only feed as JSONP to avoid browser CORS issues.
// Only allow a simple JavaScript identifier as the callback name.
function respond_(payload, e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || params.prefix || "");
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
