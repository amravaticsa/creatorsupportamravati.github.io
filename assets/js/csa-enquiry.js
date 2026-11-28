(function(){
  if(window.__csaEnquiryLoaded)return;window.__csaEnquiryLoaded=true;
  const css=`
  #csa-enquiry-overlay{position:fixed;inset:0;background:rgba(12,8,30,.72);z-index:9998;display:none;align-items:center;justify-content:center;padding:18px}
  #csa-enquiry-modal{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;color:#211b35;border-radius:20px;box-shadow:0 25px 90px #0005;padding:26px;position:relative;font-family:Inter,Arial,sans-serif}
  #csa-enquiry-modal h2{font-size:25px;line-height:1.2;margin:0 36px 8px 0;color:#211b35}
  #csa-enquiry-modal p{font-size:13px;line-height:1.6;color:#686477;margin:0 0 18px}
  #csa-enquiry-form{display:grid;grid-template-columns:minmax(0,1fr);gap:0;width:100%;margin:0}
  #csa-enquiry-form label{display:block;width:100%;box-sizing:border-box;font-size:12px;font-weight:700;line-height:1.45;letter-spacing:.01em;color:#39334d;margin:15px 0 7px}
  #csa-enquiry-form input,#csa-enquiry-form select,#csa-enquiry-form textarea{display:block;box-sizing:border-box;width:100%;min-width:0;min-height:46px;margin:0;padding:12px 14px;border:1px solid #ded9ea;border-radius:11px;font-family:inherit;font-size:14px;line-height:1.45;background:#fff;color:#211b35;box-shadow:0 1px 2px rgba(25,15,55,.03);transition:border-color .18s ease,box-shadow .18s ease}
  #csa-enquiry-form input::placeholder,#csa-enquiry-form textarea::placeholder{color:#9993a8;opacity:1}
  #csa-enquiry-form input:focus,#csa-enquiry-form select:focus,#csa-enquiry-form textarea:focus{outline:none;border-color:#8058e8;box-shadow:0 0 0 3px rgba(105,56,220,.12)}
  #csa-enquiry-form select{appearance:auto;cursor:pointer}
  #csa-enquiry-form textarea{min-height:104px;resize:vertical}
  #csa-enquiry-modal button{cursor:pointer;border:0;border-radius:999px;padding:13px 19px;font-weight:800}
  #csa-enquiry-submit{display:block;min-height:50px;background:linear-gradient(135deg,#6938dc,#8255e8);color:#fff;width:100%;margin-top:19px;box-shadow:0 8px 20px rgba(105,56,220,.2);transition:transform .18s ease,box-shadow .18s ease}
  #csa-enquiry-submit:hover{transform:translateY(-1px);box-shadow:0 11px 24px rgba(105,56,220,.26)}
  #csa-enquiry-submit:focus-visible,#csa-enquiry-close:focus-visible{outline:3px solid rgba(105,56,220,.3);outline-offset:3px}
  #csa-enquiry-close{position:absolute;right:16px;top:14px;background:#f2eff8;color:#31264c;font-size:20px;width:36px;height:36px;padding:0}
  #csa-enquiry-modal .csa-enquiry-note{font-size:11px;line-height:1.6;color:#777186;margin:13px 0 0}
  body.csa-modal-open{overflow:hidden}
  @media(max-width:520px){#csa-enquiry-overlay{padding:10px}#csa-enquiry-modal{width:100%;max-height:94vh;padding:22px 17px;border-radius:16px}#csa-enquiry-modal h2{font-size:22px}#csa-enquiry-form label{margin-top:13px}#csa-enquiry-form input,#csa-enquiry-form select,#csa-enquiry-form textarea{font-size:16px}}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const overlay=document.createElement('div');overlay.id='csa-enquiry-overlay';overlay.innerHTML=`
  <section id="csa-enquiry-modal" role="dialog" aria-modal="true" aria-labelledby="csa-enquiry-title">
    <button type="button" id="csa-enquiry-close" aria-label="Close enquiry form">×</button>
    <h2 id="csa-enquiry-title">Let’s discuss your project</h2>
    <p>Share a few details. Your enquiry will open in WhatsApp so you can review and send it directly to the CSA team.</p>
    <form id="csa-enquiry-form">
      <label for="csa-enquiry-name">Your name *</label><input id="csa-enquiry-name" name="name" autocomplete="name" required placeholder="Enter your name">
      <label for="csa-enquiry-phone">Mobile / WhatsApp number *</label><input id="csa-enquiry-phone" name="phone" type="tel" autocomplete="tel" required pattern="[0-9+()\\s-]{8,18}" placeholder="Enter your contact number">
      <label for="csa-enquiry-business">Business / Brand (optional)</label><input id="csa-enquiry-business" name="business" placeholder="Business or creator name">
      <label for="csa-enquiry-service">What do you need? *</label><select id="csa-enquiry-service" name="service" required><option value="">Select a service</option><option>Video / Photo Production</option><option>Podcast Production</option><option>Website Development</option><option>Digital Marketing / Advertising</option><option>Social Media Management</option><option>Graphic Design</option><option>Event Coverage / Live Streaming</option><option>Studio / Equipment Support</option><option>Other / Not sure yet</option></select>
      <label for="csa-enquiry-details">Tell us briefly about your requirement</label><textarea id="csa-enquiry-details" name="details" placeholder="Your goal, location, preferred timeline or any useful details"></textarea>
      <button type="submit" id="csa-enquiry-submit">Continue to WhatsApp ↗</button>
      <p class="csa-enquiry-note">Your details are not submitted to or stored by this website. WhatsApp opens with a pre-filled message; you must press Send there to contact CSA.</p>
    </form>
  </section>`;
  document.body.appendChild(overlay);
  // Send privacy-safe GA4 events. Never include names, phone numbers or free-text enquiry details.
  const track=(eventName,params={})=>{
    const payload={page_location:location.href,page_path:location.pathname,...params};
    if(typeof window.gtag==='function')window.gtag('event',eventName,payload);
    else{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:eventName,...payload})}
  };
  const open=()=>{overlay.style.display='flex';document.body.classList.add('csa-modal-open');track('enquiry_form_open',{form_name:'project_enquiry'});setTimeout(()=>document.getElementById('csa-enquiry-name').focus(),40)};
  const close=()=>{overlay.style.display='none';document.body.classList.remove('csa-modal-open')};
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-csa-enquiry],a[href="#csa-enquiry"]');
    if(trigger){e.preventDefault();open();return}
    const link=e.target.closest('a[href]');
    if(!link)return;
    const href=link.getAttribute('href')||'';
    if(/^tel:/i.test(href))track('click_call',{link_url:href,link_text:(link.textContent||'').trim().slice(0,80)});
    else if(/wa\.me\//i.test(href)||/whatsapp/i.test(href))track('click_whatsapp',{link_url:href.split('?')[0],link_text:(link.textContent||'').trim().slice(0,80)});
  });
  document.getElementById('csa-enquiry-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.style.display==='flex')close()});
  document.getElementById('csa-enquiry-form').addEventListener('submit',e=>{
    e.preventDefault();const d=new FormData(e.currentTarget);
    const msg=['Hello Creator Support Amravati, I would like to discuss a project.','Name: '+d.get('name'),'Phone: '+d.get('phone'),'Business/Brand: '+(d.get('business')||'Not provided'),'Service: '+d.get('service'),'Requirement: '+(d.get('details')||'Please contact me to discuss.')].join('\n');
    track('whatsapp_enquiry_handoff',{form_name:'project_enquiry',service_category:String(d.get('service')||'').slice(0,80)});
    const whatsappUrl='https://api.whatsapp.com/send?phone=919225515679&text='+encodeURIComponent(msg);
    const whatsappWindow=window.open(whatsappUrl,'_blank');
    if(!whatsappWindow)window.location.href=whatsappUrl;
    close();
  });
})();