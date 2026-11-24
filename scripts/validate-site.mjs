import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sitemapPath = path.join(root, "sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
  console.error("FAIL: sitemap.xml is missing");
  process.exit(1);
}

const sitemap = fs.readFileSync(sitemapPath, "utf8");
const urls = [...sitemap.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map(match => match[1]);
if (urls.length === 0) {
  console.error("FAIL: sitemap.xml contains no <loc> URLs");
  process.exit(1);
}

const errors = [];
const seen = new Set();

for (const rawUrl of urls) {
  let pathname;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    errors.push(`Invalid sitemap URL: ${rawUrl}`);
    continue;
  }

  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.join(root, relative.endsWith("/") ? relative + "index.html" : relative || "index.html");
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    errors.push(`Sitemap target missing: ${pathname}`);
    continue;
  }
  if (seen.has(file)) {
    errors.push(`Duplicate sitemap target: ${pathname}`);
    continue;
  }
  seen.add(file);

  if (!file.toLowerCase().endsWith(".html")) continue;
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  const robots = (html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || "";
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const canonicalCount = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)].length;
  const h1Count = [...html.matchAll(/<h1\b/gi)].length;
  const missingAlt = [...html.matchAll(/<img\b[^>]*>/gi)].filter(match => !/\balt\s*=/i.test(match[0])).length;

  if (!title || title[1].replace(/<[^>]*>/g, "").trim().length < 8) errors.push(`${rel}: missing or too-short title`);
  if (!description || description[1].trim().length < 30) errors.push(`${rel}: missing or too-short meta description`);
  if (canonicalCount !== 1) errors.push(`${rel}: expected exactly one canonical URL, found ${canonicalCount}`);
  if (!robots.toLowerCase().includes("noindex") && h1Count !== 1) errors.push(`${rel}: indexable page must have exactly one H1, found ${h1Count}`);
  if (missingAlt > 0) errors.push(`${rel}: ${missingAlt} image(s) missing alt attributes`);

  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch {
      errors.push(`${rel}: invalid JSON-LD structured data`);
    }
  }
}

console.log(`Checked ${urls.length} sitemap URLs (${seen.size} files).`);
if (errors.length) {
  console.error(`FAIL: ${errors.length} validation issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("PASS: sitemap targets, page metadata, canonical URLs, H1 hierarchy, image alt attributes and JSON-LD syntax.");
