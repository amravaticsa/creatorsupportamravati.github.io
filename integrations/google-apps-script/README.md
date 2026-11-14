# CSA Blog Manager — Google Docs + Google Sheets

This integration sends approved Google Docs articles from the **Blog Posts** tab into the existing `content/blog_queue.json`. The existing GitHub Actions publisher then creates the article HTML, updates `blog.html`, `content/blog_published.json`, and `sitemap.xml`.

## 1. Create the Google Sheet

Create a Google Sheet named **CSA Blog Manager**. Rename its first tab to **Blog Posts**.

Add these exact headers in row 1:

| Title | Category | Description | Google Doc URL | Publish Date | Status | Website URL |
|---|---|---|---|---|---|---|

In Google Sheets, open **Extensions → Apps Script**. Copy the contents of [Code.gs](./Code.gs) into the editor and save.

## 2. Add GitHub access securely

Create a GitHub fine-grained personal access token for only this repository:
- Repository access: **Only select repositories** → `creatorsupportamravati.github.io`
- Repository permissions: **Contents: Read and write**
- No other permissions are needed.

In Apps Script, open **Project Settings → Script Properties → Add script property**:
- Property: `GITHUB_TOKEN`
- Value: paste the token

Do not put the token in a cell, document, source file, or chat. Keep it private.

## 3. Prepare an article in Google Docs

- Create a Google Doc and write the article.
- Use **Heading 2** for each section heading.
- Put normal paragraph text under each Heading 2.
- Keep the article title, category and short description in the Sheet.
- Share the Doc with the Google account that owns/runs the Apps Script (or make sure that account has access).

Example row:
- Title: `How to Plan Business Reels`
- Category: `Video Production`
- Description: `A practical guide to planning and shooting business reels.`
- Google Doc URL: paste the full Docs URL
- Publish Date: choose the date
- Status: `Draft` or `Ready`

## 4. Connect and run

1. Reload the Google Sheet.
2. Select **CSA Blog Manager → Set up Blog Posts sheet** if the headers are not already present.
3. Select **CSA Blog Manager → Queue READY blogs now** for a first test. Google will ask you to authorize Sheets, Docs and external requests.
4. After the first successful test, choose **CSA Blog Manager → Enable daily auto-queue (7 AM)**.
5. Mark an article `Ready` only after it has been reviewed. The script queues it around 7 AM India time; the existing GitHub publisher runs around 9 AM India time.

## AdSense editorial quality check

The blog manager now holds short drafts instead of sending them to the publishing queue. Before an article can be queued, it must contain:
- At least 650 words across the title, description and article body.
- At least 6 distinct sections.
- At least 45 words in every section.
- Original explanations, examples, practical steps or observations relevant to the topic.

These are CSA's internal editorial safeguards, not a Google-published word-count rule and not a guarantee of AdSense approval. Word count alone is not enough: review facts, usefulness, originality, spelling, links, image rights and reader experience before marking an article **Ready**.

Five existing queued drafts are currently below this threshold and will remain unpublished until they are expanded and reviewed. Do not mark a short draft Ready just to keep the daily schedule running.

## Status meanings

- `Draft`: not sent to the website.
- `Ready`: eligible for the next queue run.
- `Queued`: sent to GitHub's article queue.
- `Published`: reserved for a later manual status update after verifying the live article URL.

The current script sets a row to **Queued** when the GitHub queue update succeeds. It deliberately does not mark it Published because the website publishing workflow runs later and may still fail. Add the live URL to Website URL and change the status to Published after verifying the page.

## Safety notes

- Only rows marked `Ready` are sent.
- Each article must have a title, category, description and valid Google Docs URL.
- Duplicate slugs are checked against queued and published articles.
- Keep the existing daily GitHub Actions publisher enabled.
- Google Docs text is treated as plain text. Heading 2 creates section headings; normal paragraphs become section content. Images, tables and embedded media are not imported by this first version.
