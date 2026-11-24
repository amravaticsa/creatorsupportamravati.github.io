(function(){
"use strict";
if(window.__csaConversionTrackingInstalled)return;
window.__csaConversionTrackingInstalled=true;
function track(name,params){try{if(typeof window.gtag==="function")window.gtag("event",name,params||{})}catch(_){}}
const servicePaths=new Set(["/digital-marketing.html","/website-development.html","/video-photo-production.html","/podcast-production.html","/social-media-creative.html","/studio-equipment-support.html","/video-editing.html","/live-event-coverage.html"]);
document.addEventListener("click",event=>{
 const link=event.target&&event.target.closest?event.target.closest("a[href]"):null;
 if(!link)return;
 const raw=link.getAttribute("href")||"",pagePath=location.pathname||"/";
 if(/^tel:/i.test(raw)){track("phone_click",{page_path:pagePath});return}
 if(/^mailto:/i.test(raw)){track("email_click",{page_path:pagePath});return}
 if(/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(raw)){track("whatsapp_click",{page_path:pagePath});return}
 if(/(?:forms\.gle|docs\.google\.com\/forms)/i.test(raw)){track("enquiry_form_open",{page_path:pagePath,form_provider:"google_forms"});return}
 let destination;try{destination=new URL(raw,location.href)}catch(_){return}
 const path=destination.pathname;
 if(path.endsWith("/booking.html"))track("booking_page_open",{source_page:pagePath});
 if(path.endsWith("/contact.html"))track("contact_page_open",{source_page:pagePath});
 if(path.endsWith("/payment.html"))track("payment_page_open",{source_page:pagePath});
 if(path.endsWith("/portfolio.html"))track("portfolio_open",{source_page:pagePath});
 if(/\/global-platform\/(?:login|portal)\.html$/.test(path))track("client_portal_open",{source_page:pagePath});
 if(pagePath.startsWith("/blog/")&&servicePaths.has(path))track("blog_to_service_click",{destination_page:path});
 if(pagePath==="/youtube-complete-course.html"&&path.startsWith("/blog/"))track("course_chapter_open",{chapter_path:path});
},true);
document.addEventListener("change",event=>{
 const box=event.target&&event.target.closest?event.target.closest("[data-course-chapter]"):null;
 if(box)track("course_progress_update",{chapter_number:box.dataset.courseChapter,completed:!!box.checked});
},true);
})();