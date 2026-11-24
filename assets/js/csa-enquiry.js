(function(){
  if(window.__csaEnquiryLoaded)return;window.__csaEnquiryLoaded=true;
  const css=`
  #csa-enquiry-overlay{position:fixed;inset:0;background:rgba(12,8,30,.72);z-index:9998;display:none;align-items:center;justify-content:center;padding:18px}
  #csa-enquiry-modal{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;color:#211b35;border-radius:20px;box-shadow:0 25px 90px #0005;padding:26px;position:relative;font-family:Inter,Arial,sans-serif}
  #csa-enquiry-modal h2{font-size:25px;line-height:1.2;margin:0 36px 8px 0;color:#211b35}
  #csa-enquiry-modal p{font-size:13px;line-height:1.6;color:#686477;margin:0 0 18px}
  #csa-enquiry-modal label{display:block;font-size:12px;font-weight:700;color:#39334d;margin:12px 0 6px}
  #csa-enquiry-modal input,#csa-enquiry-modal select,#csa-enquiry-modal textarea{box-sizing:border-box;width:100%;border:1px solid #ded9ea;border-radius:10px;padding:12px;font:inherit;font-size:14px;background:#fff;color:#211b35}
  #csa-enquiry-modal textarea{min-height:90px;resize:vertical}
  #csa-enquiry-modal button{cursor:pointer;border:0;border-radius:999px;padding:13px 19px;font-weight:800}
  #csa-enquiry-submit{background:#6938dc;color:#fff;width:100%;margin-top:16px}
  #csa-enquiry-close{position:absolute;right:16px;top:14px;background:#f2eff8;color:#31264c;font-size:20px;width:36px;height:36px;padding:0}
  #csa-enquiry-modal .csa-enquiry-note{font-size:11px;color:#777186;margin:12px 0 0}
  body.csa-modal-open{overflow:hidden}
  @media(max-width:520px){#csa-enquiry-modal{padding:21px 17px;border-radius:16px}#csa-enquiry-modal h2{font-size:22px}}
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
  const open=()=>{overlay.style.display='flex';document.body.classList.add('csa-modal-open');setTimeout(()=>document.getElementById('csa-enquiry-name').focus(),40)};
  const close=()=>{overlay.style.display='none';document.body.classList.remove('csa-modal-open')};
  document.addEventListener('click',e=>{const trigger=e.target.closest('[data-csa-enquiry],a[href="#csa-enquiry"]');if(trigger){e.preventDefault();open()}});
  document.getElementById('csa-enquiry-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.style.display==='flex')close()});
  document.getElementById('csa-enquiry-form').addEventListener('submit',e=>{
    e.preventDefault();const d=new FormData(e.currentTarget);
    const msg=['Hello Creator Support Amravati, I would like to discuss a project.','Name: '+d.get('name'),'Phone: '+d.get('phone'),'Business/Brand: '+(d.get('business')||'Not provided'),'Service: '+d.get('service'),'Requirement: '+(d.get('details')||'Please contact me to discuss.')].join('\n');
    window.open('https://wa.me/919225515679?text='+encodeURIComponent(msg),'_blank','noopener');close();
  });
})();