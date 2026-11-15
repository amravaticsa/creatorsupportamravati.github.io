/* CSA Premium Article Enhancements — accessible, URL-preserving, bilingual-friendly */
(function(){
  'use strict';
  var article=document.querySelector('main article.article, article.article, .article');
  if(!article)return;
  var bar=document.createElement('div');bar.className='csa-article-progress';bar.setAttribute('aria-hidden','true');document.body.prepend(bar);
  function progress(){var d=document.documentElement;var max=d.scrollHeight-d.clientHeight;bar.style.width=(max>0?Math.min(100,Math.max(0,d.scrollTop/max*100)):0)+'%';}
  window.addEventListener('scroll',progress,{passive:true});progress();
  var main=document.querySelector('main');
  if(main&&!document.querySelector('.csa-article-breadcrumb')){
    var crumb=document.createElement('nav');crumb.className='csa-article-breadcrumb';crumb.setAttribute('aria-label','Breadcrumb');
    crumb.innerHTML='<a href="../index.html">Home</a> <span aria-hidden="true">›</span> <a href="../blog.html">Blog / ब्लॉग</a> <span aria-hidden="true">›</span> <span aria-current="page">Article</span>';
    main.insertBefore(crumb,main.firstChild);
  }
  var headings=Array.from(article.querySelectorAll('h2'));
  var words=(article.innerText||'').trim().split(/\s+/).filter(Boolean).length;
  var mins=Math.max(1,Math.ceil(words/200));
  var meta=article.querySelector('.article-byline, .article-meta, p strong');
  var info=document.createElement('div');info.className='csa-article-meta';info.setAttribute('aria-label','Article information');
  info.innerHTML='<span>✍️ Creator Support Amravati</span><span>⏱️ '+mins+' min read</span><span>🌐 Hindi + English search topics</span>';
  if(meta&&meta.parentNode===article){meta.insertAdjacentElement('afterend',info);}else{var cover=article.querySelector('.article-cover,img');if(cover)cover.insertAdjacentElement('afterend',info);else article.insertBefore(info,article.firstChild);}
  if(headings.length>=3&&!article.querySelector('.csa-article-toc')){
    var toc=document.createElement('nav');toc.className='csa-article-toc';toc.setAttribute('aria-label','Table of contents');
    var title=document.createElement('h2');title.textContent='इस लेख में / In this article';toc.appendChild(title);
    var list=document.createElement('ol');
    headings.forEach(function(h,i){if(!h.id)h.id='article-section-'+(i+1);var li=document.createElement('li');var a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent.trim();li.appendChild(a);list.appendChild(li);});
    toc.appendChild(list);
    var lead=article.querySelector('.article-lead')||article.querySelector('p');
    if(lead)lead.insertAdjacentElement('afterend',toc);else article.insertBefore(toc,article.firstChild);
  }
  article.querySelectorAll('img:not([alt]),img[alt=""]').forEach(function(img){img.alt=(document.querySelector('h1')||{}).textContent||'Creator Support Amravati article image';});
})();
