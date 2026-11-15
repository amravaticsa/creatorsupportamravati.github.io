/* CSA blog recommendations: related articles below the story, suggested articles in the right rail. */
(() => {
  const main = document.querySelector('main.container.section');
  const article = main && main.querySelector(':scope > article.article');
  const blogGrid = document.querySelector('.blog-grid');
  if (!main && !blogGrid) return;
  if (!article && blogGrid) {
    if (document.querySelector('.csa-blog-discovery')) return;
    const brandImage = img => {
      if (!img || img.closest('.csa-thumb-frame')) return;
      const frame = document.createElement('span');
      frame.className = 'csa-thumb-frame';
      img.parentNode.insertBefore(frame, img);
      frame.append(img);
      const logo = document.createElement('img');
      logo.className = 'csa-thumb-logo';
      logo.src = '/assets/images/logo.png';
      logo.alt = 'Creator Support Amravati';
      logo.loading = 'lazy';
      frame.append(logo);
    };
    document.querySelectorAll('.blog-card img.blog-cover, img.article-cover').forEach(brandImage);
    const cards = [...blogGrid.querySelectorAll('.blog-card')].map(card => {
      const link=card.querySelector('a[href]'), heading=card.querySelector('h3'), img=card.querySelector('img');
      return link&&heading?{href:new URL(link.getAttribute('href'),location.origin+'/').pathname,title:heading.textContent.trim(),image:img?.getAttribute('src')||'',category:card.querySelector('.meta')?.textContent.trim()||''}:null;
    }).filter(Boolean);
    if(!cards.length)return;
    const section=document.createElement('section'); section.className='csa-blog-discovery';
    section.innerHTML='<div class="csa-discovery-section"><div class="csa-related-heading"><span>EXPLORE MORE</span><h2>Suggested Blogs</h2><p>Hand-picked guides to help you create, publish and grow.</p></div><div class="csa-discovery-grid csa-suggested-grid"></div></div><div class="csa-discovery-section"><div class="csa-related-heading"><span>KEEP LEARNING</span><h2>Related Blogs</h2><p>More useful reads from the CSA knowledge hub.</p></div><div class="csa-discovery-grid csa-related-grid"></div></div>';
    const make=(item)=>{const a=document.createElement('a');a.className='csa-discovery-card';a.href=item.href;if(item.image){const frame=document.createElement('span');frame.className='csa-thumb-frame';const im=document.createElement('img');im.src=new URL(item.image,location.origin+'/').href;im.alt='';im.loading='lazy';frame.append(im);const logo=document.createElement('img');logo.className='csa-thumb-logo';logo.src='/assets/images/logo.png';logo.alt='Creator Support Amravati';logo.loading='lazy';frame.append(logo);a.append(frame)}const copy=document.createElement('span');copy.className='csa-recommendation-copy';const cat=document.createElement('small');cat.textContent=item.category;const title=document.createElement('strong');title.textContent=item.title;copy.append(cat,title);a.append(copy);return a};
    section.querySelector('.csa-suggested-grid').replaceChildren(...cards.slice(0,5).map(make));
    section.querySelector('.csa-related-grid').replaceChildren(...cards.slice(5,8).map(make));
    blogGrid.parentNode.insertBefore(section,blogGrid.nextSibling); return;
  }
  if (!article) return;

  if (!document.querySelector('link[data-csa-recommendation-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/assets/css/style.css?v=20261115-7';
    css.dataset.csaRecommendationCss = '1';
    document.head.appendChild(css);
  }

  const currentPath = location.pathname.replace(/^\//, '');
  const title = (article.querySelector('.article-title')?.textContent || document.title).toLowerCase();
  const bodyText = (article.innerText || '').toLowerCase();
  const stop = new Set(['about','after','also','amravati','and','are','before','best','can','content','from','guide','how','into','india','its','more','need','our','that','the','their','this','tips','video','with','your','you']);
  const tokens = (title + ' ' + bodyText.slice(0, 1800)).match(/[a-z]{3,}/g) || [];
  const keywords = [...new Set(tokens.filter(w => !stop.has(w)))].slice(0, 45);

  const layout = document.createElement('div');
  layout.className = 'csa-article-layout';
  const sidebar = document.createElement('aside');
  sidebar.className = 'csa-suggested-sidebar';
  sidebar.setAttribute('aria-label', 'Suggested blogs');
  const suggestedHeading = document.createElement('h2');
  suggestedHeading.textContent = 'Suggested Blogs';
  const suggestedList = document.createElement('div');
  suggestedList.className = 'csa-suggested-list';
  sidebar.append(suggestedHeading, suggestedList);

  main.insertBefore(layout, article);
  layout.append(article, sidebar);
  // Never let recommendations sit above or overlap the article text.
  layout.style.display = 'flex';
  layout.style.flexDirection = 'column';
  layout.style.alignItems = 'stretch';
  article.style.order = '0';
  sidebar.style.order = '1';
  sidebar.style.position = 'static';
  sidebar.style.width = '100%';
  sidebar.style.maxWidth = '100%';
  sidebar.style.boxSizing = 'border-box';

  const relatedSection = document.createElement('section');
  relatedSection.className = 'csa-related-blogs';
  relatedSection.setAttribute('aria-labelledby', 'csa-related-heading');
  relatedSection.innerHTML = '<div class="csa-related-heading"><span>KEEP EXPLORING</span><h2 id="csa-related-heading">Related Blogs</h2><p>More practical reads selected for this topic.</p></div><div class="csa-related-grid"></div>';
  const existingRelated = main.querySelector(':scope > .related-guides');
  if (existingRelated) existingRelated.replaceWith(relatedSection);
  else main.append(relatedSection);

  const makeCard = (item, compact) => {
    const a = document.createElement('a');
    a.className = compact ? 'csa-suggested-item' : 'csa-related-card';
    a.href = item.href;
    if (item.image) {
      const frame = document.createElement('span');
      frame.className = 'csa-thumb-frame';
      const img = document.createElement('img');
      img.src = new URL(item.image, location.origin + '/').href;
      img.alt = '';
      img.loading = 'lazy';
      frame.append(img);
      const logo = document.createElement('img');
      logo.className = 'csa-thumb-logo';
      logo.src = '/assets/images/logo.png';
      logo.alt = 'Creator Support Amravati';
      logo.loading = 'lazy';
      frame.append(logo);
      a.append(frame);
    }
    const copy = document.createElement('span');
    copy.className = 'csa-recommendation-copy';
    const h = document.createElement('strong');
    h.textContent = item.title;
    copy.append(h);
    if (!compact && item.description) {
      const p = document.createElement('small');
      p.textContent = item.description;
      copy.append(p);
    }
    a.append(copy);
    if (compact) {
      const arrow = document.createElement('span');
      arrow.className = 'csa-suggested-arrow';
      arrow.textContent = '↗';
      a.append(arrow);
    }
    return a;
  };

  fetch('../blog.html', { credentials: 'same-origin' })
    .then(response => response.ok ? response.text() : Promise.reject())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const items = [...doc.querySelectorAll('.blog-grid .blog-card')].map(card => {
        const link = card.querySelector('a[href]');
        const heading = card.querySelector('h3');
        const image = card.querySelector('img');
        return link && heading ? {
          href: new URL(link.getAttribute('href'), location.origin + '/').pathname,
          title: heading.textContent.trim(),
          description: card.querySelector('p')?.textContent.trim() || '',
          image: image?.getAttribute('src') || ''
        } : null;
      }).filter(Boolean).filter(item => item.href.replace(/^\//, '') !== currentPath);

      const score = item => {
        const words = (item.title + ' ' + item.description).toLowerCase().match(/[a-z]{3,}/g) || [];
        return words.reduce((sum, word) => sum + (keywords.includes(word) ? 1 : 0), 0);
      };
      items.sort((a, b) => score(b) - score(a));
      const ranked = items.slice(0, 8);
      const related = ranked.slice(0, 3);
      const suggested = ranked.slice(3, 8).length ? ranked.slice(3, 8) : ranked.slice(0, 5);
      relatedSection.querySelector('.csa-related-grid').replaceChildren(...related.map(item => makeCard(item, false)));
      suggestedList.replaceChildren(...suggested.map(item => makeCard(item, true)));
    })
    .catch(() => {
      sidebar.hidden = true;
      relatedSection.hidden = true;
    });
})();
