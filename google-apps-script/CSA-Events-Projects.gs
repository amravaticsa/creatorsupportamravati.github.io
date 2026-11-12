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

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return ContentService.createTextOutput(JSON.stringify({items:[]}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift().map(h => String(h).trim());
  const items = values.filter(row => row.some(cell => String(cell).trim() !== "")).map(row => {
    const item = {};
    headers.forEach((header, i) => item[header] = row[i] || "");
    return item;
  }).filter(item => String(item.visible).toLowerCase() === "true");
  return ContentService.createTextOutput(JSON.stringify({items:items}))
    .setMimeType(ContentService.MimeType.JSON);
}
