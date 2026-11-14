#!/usr/bin/env python3
# Publish one reviewed article per run; use the current CSA blog feed closing marker.
import json, pathlib, html, datetime, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
queue_path=ROOT/'content/blog_queue.json'
published_path=ROOT/'content/blog_published.json'
queue=json.loads(queue_path.read_text(encoding='utf-8'))
published=json.loads(published_path.read_text(encoding='utf-8')) if published_path.exists() else []
if not queue:
    print('No queued articles remain; no changes made.')
    raise SystemExit(0)
blog_path=ROOT/'blog.html'
blog=blog_path.read_text(encoding='utf-8')
marker='</div></div></main><footer class="site-footer">'
if marker not in blog:
    raise SystemExit('Could not locate the .cards feed closing tag in blog.html; no files were changed.')
post=queue[0]
# Hold thin drafts so the scheduled publisher cannot automatically publish low-value pages.
sections_data=post.get('sections', [])
section_words=[len(re.findall(r"\b[\w'-]+\b", str(body), flags=re.UNICODE)) for _,body in sections_data]
article_text=' '.join([str(post.get('title','')),str(post.get('description',''))]+[str(h)+' '+str(body) for h,body in sections_data])
article_words=len(re.findall(r"\b[\w'-]+\b", article_text, flags=re.UNICODE))
unique_headings={str(h).strip().casefold() for h,_ in sections_data}
if article_words < 650 or len(sections_data) < 6 or len(unique_headings) != len(sections_data) or any(w < 45 for w in section_words):
    print(f"Held article '{post.get('slug','unknown')}': {article_words} words across {len(sections_data)} sections. Minimum: 650 words, 6 distinct sections, and 45 words per section. Expand and review the Google Doc before publishing.")
    raise SystemExit(0)
queue.pop(0)
slug=post['slug']
out=ROOT/'blog'/f'{slug}.html'
if out.exists():
    raise SystemExit(f'Refusing to overwrite existing article: {out}')
esc=html.escape
sections=''.join(f'<h2>{esc(h)}</h2>'+''.join(f'<p>{esc(part.strip())}</p>' for part in re.split(r'\n\s*\n', str(p)) if part.strip()) for h,p in post['sections'])
photo_id = ('photo-1598488035139-bdbb2231ce04' if 'podcast' in slug else ('photo-1460925895917-afdab827c52f' if ('seo' in slug or 'google' in slug) else ('photo-1516035069371-29a1b244cc32' if 'youtube' in slug else ('photo-1611162616305-c69b3fa7fbe0' if 'instagram' in slug else 'photo-1492619375914-88005aa9e8fb'))))
cover_rel=f'https://creatorsupportamravati.in/assets/blog/{slug}.svg'
page=f'''<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(post['title'])} | Creator Support Amravati</title><meta name="description" content="{esc(post['description'])}"><meta name="robots" content="index,follow"><link rel="canonical" href="https://creatorsupportamravati.in/blog/{slug}.html"><meta property="og:type" content="article"><meta property="og:title" content="{esc(post['title'])}"><meta property="og:description" content="{esc(post['description'])}"><meta property="og:url" content="https://creatorsupportamravati.in/blog/{slug}.html"><meta property="og:image" content="{cover_rel}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{cover_rel}"><link rel="stylesheet" href="../assets/css/style.css"><script async src="https://www.googletagmanager.com/gtag/js?id=G-FE2SEB8NPH"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','G-FE2SEB8NPH');</script><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4869876655236532" crossorigin="anonymous"></script><script type="application/ld+json">{{"@context":"https://schema.org","@type":"BlogPosting","headline":{json.dumps(post['title'],ensure_ascii=False)},"description":{json.dumps(post['description'],ensure_ascii=False)},"image":[{json.dumps(cover_rel)}],"mainEntityOfPage":{{"@type":"WebPage","@id":"https://creatorsupportamravati.in/blog/{slug}.html"}},"author":{{"@type":"Organization","name":"Creator Support Amravati"}},"publisher":{{"@type":"Organization","name":"Creator Support Amravati","url":"https://creatorsupportamravati.in/"}},"datePublished":{json.dumps(post['date'])},"dateModified":{json.dumps(post['date'])},"inLanguage":"en-IN"}}</script></head><body><div class="topbar"><div class="container"><span>Creator Support Amravati · Practical creator and business guides</span><span><a href="tel:+919225515679">92255 15679</a> · <a href="mailto:amravati.csa@gmail.com">amravati.csa@gmail.com</a></span></div></div><header class="site-header"><div class="container header-inner"><a class="brand" href="../index.html"><img src="../assets/images/logo.png" alt="CSA logo"><span>Creator Support <span>Amravati</span></span></a><nav class="main-nav" aria-label="Main navigation"><a href="../index.html">Home</a><a href="../about.html">About</a><a href="../services.html">Services</a><a href="../blog.html">Blog</a><a href="../portfolio.html">Portfolio</a><a href="../contact.html">Contact</a></nav></div></header><section class="page-hero"><div class="container"><span class="eyebrow">{esc(post['category'])}</span><h1>{esc(post['title'])}</h1><p>By Creator Support Amravati · Updated {esc(post['date'])}</p></div></section><main class="container section"><article class="article"><img src="{cover_rel}" alt="CSA editorial illustration for {esc(post['title'])}" class="article-cover" width="1200" height="630" loading="eager" decoding="async"><div class="article-body">{sections}</div><p><strong>About Creator Support Amravati:</strong> CSA is a creative production and digital services business based in Amravati, Maharashtra. We publish practical guides for creators and local businesses.</p><p><a href="https://forms.gle/Mdh6X2a7yJn4JabCA">Contact CSA about your project →</a></p><p><a class="text-link" href="../blog.html">← Back to all articles</a></p></article></main><footer class="site-footer"><div class="container"><p>© 2026 Creator Support Amravati. All rights reserved.</p><p><a href="../privacy-policy.html">Privacy Policy</a> · <a href="../terms.html">Terms</a> · <a href="../refund-policy.html">Refund</a> · <a href="../disclaimer.html">Disclaimer</a> · <a href="../copyright-policy.html">Copyright</a> · <a href="../contact.html">Contact</a></p></div></footer></body></html>'''
out.write_text(page,encoding='utf-8')
# A lightweight original SVG illustration is generated locally; no paid image API or third-party image hotlink.
(ROOT/'assets/blog').mkdir(parents=True,exist_ok=True)
title=esc(post['title'])
category=esc(post['category'])
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101b35"/><stop offset="1" stop-color="#29466f"/></linearGradient></defs><rect width="1200" height="630" rx="28" fill="url(#g)"/><circle cx="1040" cy="120" r="190" fill="#f4bd45" opacity=".12"/><circle cx="1100" cy="540" r="240" fill="#f4bd45" opacity=".08"/><rect x="80" y="82" width="220" height="12" rx="6" fill="#f4bd45"/><text x="80" y="160" fill="#f4bd45" font-family="Arial,sans-serif" font-size="26" font-weight="700">{category}</text><foreignObject x="80" y="205" width="1000" height="260"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:58px;line-height:1.18;font-weight:800;color:#fff">{title}</div></foreignObject><text x="80" y="555" fill="#dce5f3" font-family="Arial,sans-serif" font-size="28" font-weight="700">CREATOR SUPPORT AMRAVATI</text><text x="1080" y="555" text-anchor="end" fill="#f4bd45" font-family="Arial,sans-serif" font-size="24">CSA BLOG</text></svg>'''
cover_path=ROOT/'assets/blog'/f'{slug}.svg'
if not cover_path.exists():
    cover_path.write_text(svg,encoding='utf-8')
else:
    print(f'Keeping existing editorial cover: {cover_path.name}')
published.insert(0,{k:post[k] for k in ('slug','title','category','description','date')})
published_path.write_text(json.dumps(published,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
queue_path.write_text(json.dumps(queue,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Insert the new card inside the existing .cards grid, before its closing tag.
card=f'<article class="content-card blog-card"><img src="{cover_rel}" alt="{esc(post["title"])}" class="blog-cover" loading="lazy"><div class="meta">{esc(post["category"])}</div><h3>{esc(post["title"])}</h3><p>{esc(post["description"])}</p><a class="text-link" href="blog/{slug}.html">Read article →</a></article>'
blog=blog.replace(marker,card+marker,1)
blog_path.write_text(blog,encoding='utf-8')
# Add the new URL to the sitemap without disturbing existing entries.
# The workflow also runs on publisher-script changes for an immediate regression check.
sitemap_path=ROOT/'sitemap.xml'
sitemap=sitemap_path.read_text(encoding='utf-8')
loc=f'<url><loc>https://creatorsupportamravati.in/blog/{slug}.html</loc><lastmod>{post["date"]}</lastmod><changefreq>yearly</changefreq><priority>0.7</priority></url>'
if f'https://creatorsupportamravati.in/blog/{slug}.html' not in sitemap:
    sitemap=sitemap.replace('</urlset>',loc+'\n</urlset>')
sitemap_path.write_text(sitemap,encoding='utf-8')
print(f'Published queued article: {slug}')
