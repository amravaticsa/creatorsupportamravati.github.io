#!/usr/bin/env python3
import json, pathlib, html, datetime, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
queue_path=ROOT/'content/blog_queue.json'
published_path=ROOT/'content/blog_published.json'
queue=json.loads(queue_path.read_text(encoding='utf-8'))
published=json.loads(published_path.read_text(encoding='utf-8')) if published_path.exists() else []
if not queue:
    print('No queued articles remain; no changes made.')
    raise SystemExit(0)
post=queue.pop(0)
slug=post['slug']
out=ROOT/'blog'/f'{slug}.html'
if out.exists():
    raise SystemExit(f'Refusing to overwrite existing article: {out}')
esc=html.escape
sections=''.join(f'<h2>{esc(h)}</h2><p>{esc(p)}</p>' for h,p in post['sections'])
photo_id = ('photo-1598488035139-bdbb2231ce04' if 'podcast' in slug else ('photo-1460925895917-afdab827c52f' if ('seo' in slug or 'google' in slug) else ('photo-1516035069371-29a1b244cc32' if 'youtube' in slug else ('photo-1611162616305-c69b3fa7fbe0' if 'instagram' in slug else 'photo-1492619375914-88005aa9e8fb'))))
cover_rel=f'https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1600&q=85'
page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(post['title'])} | Creator Support Amravati</title><meta name="description" content="{esc(post['description'])}"><meta name="robots" content="index,follow"><link rel="canonical" href="https://creatorsupportamravati.in/blog/{slug}.html"><meta property="og:type" content="article"><meta property="og:title" content="{esc(post['title'])}"><meta property="og:description" content="{esc(post['description'])}"><meta property="og:image" content="{cover_rel}"><link rel="stylesheet" href="../assets/css/style.css"></head><body><header class="site-header"><div class="container header-inner"><a class="brand" href="../index.html"><img src="../assets/images/logo.png" alt="CSA logo"><span>Creator Support <span>Amravati</span></span></a><nav class="main-nav"><a href="../index.html">Home</a><a href="../about.html">About</a><a href="../services.html">Services</a><a href="../blog.html">Blog</a><a href="../portfolio.html">Portfolio</a><a href="../contact.html">Contact</a></nav></div></header><section class="page-hero"><div class="container"><span class="eyebrow">{esc(post['category'])}</span><h1>{esc(post['title'])}</h1><p>Creator Support Amravati · {esc(post['date'])}</p></div></section><main class="container section split"><article class="article"><img src="{cover_rel}" alt="Illustrated cover for {esc(post['title'])}" class="article-cover" loading="eager">{sections}<p><strong>About Creator Support Amravati:</strong> We support businesses and creators with video production, podcasting, websites and digital marketing in Amravati.</p><p><a href="https://forms.gle/Mdh6X2a7yJn4JabCA">Contact CSA about your project →</a></p><p><a class="text-link" href="../blog.html">← Back to all articles</a></p></article><aside><div class="side-box"><h3>Need creative support?</h3><p>Explore video production, podcast and digital marketing services.</p><a class="text-link" href="../services.html">View services →</a></div></aside></main><footer class="site-footer"><div class="container"><p>© 2026 Creator Support Amravati · <a href="../privacy-policy.html">Privacy</a> · <a href="../contact.html">Contact</a></p></div></footer></body></html>'''
out.write_text(page,encoding='utf-8')
# A lightweight original SVG illustration is generated locally; no paid image API or third-party image hotlink.
(ROOT/'assets/blog').mkdir(parents=True,exist_ok=True)
title=esc(post['title'])
category=esc(post['category'])
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101b35"/><stop offset="1" stop-color="#29466f"/></linearGradient></defs><rect width="1200" height="630" rx="28" fill="url(#g)"/><circle cx="1040" cy="120" r="190" fill="#f4bd45" opacity=".12"/><circle cx="1100" cy="540" r="240" fill="#f4bd45" opacity=".08"/><rect x="80" y="82" width="220" height="12" rx="6" fill="#f4bd45"/><text x="80" y="160" fill="#f4bd45" font-family="Arial,sans-serif" font-size="26" font-weight="700">{category}</text><foreignObject x="80" y="205" width="1000" height="260"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:58px;line-height:1.18;font-weight:800;color:#fff">{title}</div></foreignObject><text x="80" y="555" fill="#dce5f3" font-family="Arial,sans-serif" font-size="28" font-weight="700">CREATOR SUPPORT AMRAVATI</text><text x="1080" y="555" text-anchor="end" fill="#f4bd45" font-family="Arial,sans-serif" font-size="24">CSA BLOG</text></svg>'''
(ROOT/'assets/blog'/f'{slug}.svg').write_text(svg,encoding='utf-8')
published.insert(0,{k:post[k] for k in ('slug','title','category','description','date')})
published_path.write_text(json.dumps(published,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
queue_path.write_text(json.dumps(queue,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Add a listing card before the feed closes; fail safely if the expected markup changes.
blog_path=ROOT/'blog.html'
blog=blog_path.read_text(encoding='utf-8')
marker='</div><aside>'
if marker not in blog:
    raise SystemExit('Could not locate blog feed insertion point; article was generated but listing was not changed.')
card=f'<article class="content-card"><img src="{cover_rel}" alt="{esc(post["title"])}" class="blog-cover" loading="lazy"><div class="meta">{esc(post["category"])}</div><h3>{esc(post["title"])}</h3><p>{esc(post["description"])}</p><a class="text-link" href="blog/{slug}.html">Read article →</a></article>'
blog=blog.replace(marker,card+marker,1)
blog_path.write_text(blog,encoding='utf-8')
# Add the new URL to the sitemap without disturbing existing entries.
sitemap_path=ROOT/'sitemap.xml'
sitemap=sitemap_path.read_text(encoding='utf-8')
loc=f'<url><loc>https://creatorsupportamravati.in/blog/{slug}.html</loc><lastmod>{post["date"]}</lastmod><changefreq>yearly</changefreq><priority>0.7</priority></url>'
if f'https://creatorsupportamravati.in/blog/{slug}.html' not in sitemap:
    sitemap=sitemap.replace('</urlset>',loc+'\n</urlset>')
sitemap_path.write_text(sitemap,encoding='utf-8')
print(f'Published queued article: {slug}')
