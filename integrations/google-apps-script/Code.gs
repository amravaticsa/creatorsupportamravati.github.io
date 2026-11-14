/**
 * CSA Blog Manager — Google Sheets + Google Docs -> GitHub blog queue.
 * Sheet tab: Blog Posts
 * Required columns: Title, Category, Description, Google Doc URL, Publish Date, Status, Website URL
 *
 * Store a GitHub fine-grained PAT in Apps Script > Project Settings > Script Properties:
 *   GITHUB_TOKEN = <token with Contents: Read and write on this repository>
 */
const CSA_BLOG = {
  owner: 'amravaticsa',
  repo: 'creatorsupportamravati.github.io',
  branch: 'main',
  sheetName: 'Blog Posts',
  timezone: 'Asia/Kolkata',
  headers: ['Title', 'Category', 'Description', 'Google Doc URL', 'Publish Date', 'Status', 'Website URL']
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CSA Blog Manager')
    .addItem('Set up Blog Posts sheet', 'setupBlogSheet')
    .addItem('Queue READY blogs now', 'enqueueReadyBlogs')
    .addSeparator()
    .addItem('Enable daily auto-queue (7 AM)', 'installDailyTrigger')
    .addToUi();
}

function setupBlogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CSA_BLOG.sheetName);
  if (!sh) sh = ss.insertSheet(CSA_BLOG.sheetName);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, CSA_BLOG.headers.length).setValues([CSA_BLOG.headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, CSA_BLOG.headers.length).setFontWeight('bold');
    sh.setColumnWidths(1, CSA_BLOG.headers.length, 190);
    sh.setColumnWidth(4, 320);
    sh.setColumnWidth(7, 320);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Draft', 'Ready', 'Queued', 'Published'], true)
      .setAllowInvalid(false).build();
    sh.getRange(2, 6, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  }
  SpreadsheetApp.getUi().alert('CSA Blog Posts sheet is ready. Add one row per article.');
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'enqueueReadyBlogs')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('enqueueReadyBlogs').timeBased().everyDays(1).atHour(7).create();
  SpreadsheetApp.getUi().alert('Daily auto-queue enabled. READY blogs will be sent to GitHub around 7 AM IST; the website publisher runs at 9 AM IST.');
}

function enqueueReadyBlogs() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Missing GITHUB_TOKEN. Add it in Project Settings > Script Properties.');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CSA_BLOG.sheetName);
  if (!sh || sh.getLastRow() < 2) return;
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(v => String(v).trim());
  const col = {};
  CSA_BLOG.headers.forEach(h => {
    const i = headers.indexOf(h);
    if (i < 0) throw new Error('Missing column: ' + h);
    col[h] = i;
  });

  const queueFile = githubGet('content/blog_queue.json', token);
  const queue = JSON.parse(queueFile.text || '[]');
  const publishedFile = githubGet('content/blog_published.json', token);
  const published = JSON.parse(publishedFile.text || '[]');
  const known = {};
  queue.concat(published).forEach(p => { if (p.slug) known[p.slug] = true; });

  let added = 0;
  const queuedRows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[col.Status]).trim().toLowerCase() !== 'ready') continue;
    const title = String(row[col.Title] || '').trim();
    const category = String(row[col.Category] || '').trim();
    const description = String(row[col.Description] || '').trim();
    const docUrl = String(row[col['Google Doc URL']] || '').trim();
    if (!title || !category || !description || !docUrl) {
      sh.getRange(r + 1, col.Status + 1).setNote('Required: Title, Category, Description and Google Doc URL.');
      continue;
    }
    const docId = extractGoogleDocId(docUrl);
    const doc = DocumentApp.openById(docId);
    const sections = readDocSections(doc);
    if (!sections.length) {
      sh.getRange(r + 1, col.Status + 1).setNote('Add article text in Google Docs. Use Heading 2 for section headings.');
      continue;
    }
    // Editorial safeguard: do not queue short or lightly structured drafts.
    const articleText = [title, description].concat(sections.map(s => s[0] + ' ' + s[1])).join(' ');
    const wordCount = articleText.trim().split(/\\s+/).filter(Boolean).length;
    const sectionWordCounts = sections.map(s => String(s[1]).trim().split(/\\s+/).filter(Boolean).length);
    if (wordCount < 650 || sections.length < 6 || sectionWordCounts.some(n => n < 45)) {
      sh.getRange(r + 1, col.Status + 1).setNote('Article held for editorial review: currently ' + wordCount + ' words across ' + sections.length + ' sections. Target at least 650 words, 6 sections and 45 words per section. Add original examples, steps or practical detail in Google Docs, then mark Ready again.');
      continue;
    }
    const rawDate = row[col['Publish Date']];
    const dateValue = rawDate instanceof Date && !isNaN(rawDate.getTime()) ? rawDate : (rawDate ? new Date(rawDate) : new Date());
    if (isNaN(dateValue.getTime())) throw new Error('Invalid Publish Date in sheet row ' + (r + 1));
    const date = Utilities.formatDate(dateValue, CSA_BLOG.timezone, 'yyyy-MM-dd');
    let slug = makeSlug(title);
    if (known[slug]) slug = slug + '-' + date;
    if (known[slug]) slug = slug + '-' + (r + 1);
    const post = {slug, title, category, description, date, sections, source_doc_id: docId};
    queue.push(post);
    known[slug] = true;
    queuedRows.push(r + 1);
    added++;
  }
  if (added) {
    githubPut('content/blog_queue.json', JSON.stringify(queue, null, 2) + '\n', queueFile.sha, token,
      'Queue blog articles from Google Sheets');
    queuedRows.forEach(rowNum => sh.getRange(rowNum, col.Status + 1).setValue('Queued').setNote('Added to GitHub queue. It will be published by the scheduled website workflow.'));
    SpreadsheetApp.getActive().toast(added + ' article(s) added to the website publishing queue.', 'CSA Blog Manager', 8);
  } else {
    SpreadsheetApp.getActive().toast('No READY articles found.', 'CSA Blog Manager', 5);
  }
}

function readDocSections(doc) {
  const body = doc.getBody();
  const sections = [];
  let current = null;
  for (let i = 0; i < body.getNumChildren(); i++) {
    const el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    const p = el.asParagraph();
    const text = p.getText().trim();
    if (!text) continue;
    if (p.getHeading() === DocumentApp.ParagraphHeading.HEADING2) {
      current = [text, ''];
      sections.push(current);
    } else if (p.getHeading() === DocumentApp.ParagraphHeading.TITLE ||
               p.getHeading() === DocumentApp.ParagraphHeading.HEADING1) {
      continue;
    } else {
      if (!current) {
        current = ['Introduction', ''];
        sections.push(current);
      }
      current[1] += (current[1] ? '\n\n' : '') + text;
    }
  }
  return sections.filter(s => s[1].trim());
}

function extractGoogleDocId(url) {
  const match = String(url).match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Invalid Google Docs URL: ' + url);
  return match[1];
}

function makeSlug(value) {
  return String(value).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'csa-blog-' + Date.now();
}

function githubGet(path, token) {
  const url = githubApiUrl(path) + '?ref=' + encodeURIComponent(CSA_BLOG.branch);
  const res = UrlFetchApp.fetch(url, {method: 'get', headers: githubHeaders(token), muteHttpExceptions: true});
  const status = res.getResponseCode();
  if (status === 404) return {sha: null, text: '[]'};
  if (status < 200 || status >= 300) throw new Error('GitHub read failed (' + status + '): ' + res.getContentText());
  const obj = JSON.parse(res.getContentText());
  const bytes = Utilities.base64Decode(String(obj.content || '').replace(/\s/g, ''));
  return {sha: obj.sha, text: Utilities.newBlob(bytes).getDataAsString('UTF-8')};
}

function githubPut(path, content, sha, token, message) {
  const payload = {message, branch: CSA_BLOG.branch,
    content: Utilities.base64Encode(Utilities.newBlob(content, 'application/json').getBytes())};
  if (sha) payload.sha = sha;
  const res = UrlFetchApp.fetch(githubApiUrl(path), {
    method: 'put', contentType: 'application/json', headers: githubHeaders(token),
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('GitHub update failed (' + status + '): ' + res.getContentText());
}

function githubApiUrl(path) {
  return 'https://api.github.com/repos/' + CSA_BLOG.owner + '/' + CSA_BLOG.repo + '/contents/' + path;
}

function githubHeaders(token) {
  return {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
}
