(()=>{"use strict";
const API="https://csa-global-api-staging.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const role=$("role"),status=$("status"),editor=$("editor-fields"),client=$("client-fields");
role.addEventListener("change",()=>{const isEditor=role.value==="editor";editor.hidden=!isEditor;client.hidden=isEditor;});
let nonce="",clientId="";
const PORTFOLIO_TERMS_VERSION="1.0";
function addPortfolioVideoField(){
 const list=$("portfolio-video-list");if(!list||list.children.length>=3)return;
 const n=list.children.length+1,wrap=document.createElement("div");wrap.className="portfolio-video-entry";wrap.style.cssText="border-top:1px solid #d8dee8;padding-top:14px;margin-top:14px";
 wrap.innerHTML='<label>Video File '+n+' *</label><input class="portfolio-video-file" type="file" accept="video/mp4,video/quicktime" required><label>Video Title *</label><input class="portfolio-video-title" maxlength="120" required placeholder="e.g. Product Advertisement Edit"><label>Video Description *</label><textarea class="portfolio-video-description" maxlength="1200" required placeholder="Describe your editing approach, techniques and contribution."></textarea><label>Video Category *</label><select class="portfolio-video-category" required><option value="">Select category</option><option>Reels / Shorts</option><option>YouTube Video</option><option>Wedding Film</option><option>Podcast</option><option>Advertisement / Commercial</option><option>Corporate Video</option><option>Motion Graphics / VFX</option><option>Other</option></select><label><input class="portfolio-video-rights" type="checkbox" required> I confirm that I own this work or have all permissions required to upload and showcase it.</label>';
 list.append(wrap);if(list.children.length>=3)$("add-portfolio-video").disabled=true;
}
$("add-portfolio-video")?.addEventListener("click",addPortfolioVideoField);
function validatePortfolioVideos(){
 const entries=[...document.querySelectorAll(".portfolio-video-entry")];if(!entries.length||entries.length>3)return "Upload between 1 and 3 portfolio videos.";
 for(const e of entries){const f=e.querySelector(".portfolio-video-file").files[0];if(!f)return "Please select every portfolio video.";if(!["video/mp4","video/quicktime"].includes(f.type))return "Only MP4 and MOV videos are accepted.";if(f.size>80*1024*1024)return "Each portfolio video must be 80 MB or smaller.";if(!e.querySelector(".portfolio-video-title").value.trim()||!e.querySelector(".portfolio-video-description").value.trim()||!e.querySelector(".portfolio-video-category").value)return "Complete the title, description and category for every video.";if(!e.querySelector(".portfolio-video-rights").checked)return "Confirm the ownership or permissions for every video.";}
 if(!$("portfolio-terms-accepted").checked)return "Please accept the Portfolio Video Terms & Conditions.";return "";
}
function validateKycDocument(){
 const file=$("kyc-document-file")?.files?.[0],type=$("kyc-document-type")?.value;
 if(!type||!file)return "Select your government ID type and upload one KYC document.";
 if(!["application/pdf","image/jpeg","image/png"].includes(file.type))return "KYC document must be PDF, JPG or PNG.";
 if(file.size<1||file.size>10*1024*1024)return "KYC document must be 10 MB or smaller.";
 if(!$("kyc-privacy-consent")?.checked)return "Please accept the KYC privacy notice.";
 return "";
}
async function uploadKycDocument(credential){
 const file=$("kyc-document-file").files[0];status.textContent="Uploading your identity document securely for KYC review…";
 const r=await fetch(API+"/v1/editor/kyc-document",{method:"POST",headers:{"authorization":"Bearer "+credential,"content-type":file.type,"x-csa-kyc-document-type":$("kyc-document-type").value,"x-csa-kyc-consent":"true"},body:file});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message||"KYC document upload failed.");
 return d;
}
async function uploadPortfolioVideos(credential){
 const entries=[...document.querySelectorAll(".portfolio-video-entry")];
 for(let i=0;i<entries.length;i++){const e=entries[i],f=e.querySelector(".portfolio-video-file").files[0];status.textContent="Uploading portfolio video "+(i+1)+" of "+entries.length+"…";
  const r=await fetch(API+"/v1/editor/portfolio-videos",{method:"POST",headers:{"authorization":"Bearer "+credential,"content-type":f.type,"x-csa-video-title":e.querySelector(".portfolio-video-title").value.trim(),"x-csa-video-description":e.querySelector(".portfolio-video-description").value.trim(),"x-csa-video-category":e.querySelector(".portfolio-video-category").value,"x-csa-video-rights-confirmed":"true","x-csa-terms-accepted":"true","x-csa-terms-version":PORTFOLIO_TERMS_VERSION},body:f});
  const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message||"Portfolio video upload failed.");
 }
}

async function editorPasswordLogin(){
 const username=$("editor-user-id").value.trim(),password=$("editor-password").value;
 status.textContent="CSA Editor ID verify ho raha hai…";
 try{
  const r=await fetch(API+"/v1/auth/editor-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password})}),d=await r.json();
  if(!r.ok||!d.ok){status.textContent=d.error?.message||"Login failed.";return;}
  sessionStorage.setItem("csa_global_token",d.token);sessionStorage.setItem("csa_global_user",JSON.stringify(d.user));
  if(d.user.must_change_password){
   const next=prompt("First login: naya password set karein (minimum 12 characters).");
   if(!next||next.length<12){status.textContent="Password update zaroori hai. Dobara login karke try karein.";sessionStorage.clear();return;}
   const cr=await fetch(API+"/v1/editor/password/change",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+d.token},body:JSON.stringify({new_password:next})}),cd=await cr.json();
   if(!cr.ok||!cd.ok){status.textContent=cd.error?.message||"Password update nahi hua.";sessionStorage.clear();return;}
   d.user.must_change_password=false;sessionStorage.setItem("csa_global_user",JSON.stringify(d.user));
  }
  location.href="portal.html";
 }catch(e){status.textContent="Network error. Please retry.";}
}

function makeNonce(){const a=new Uint8Array(32);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,"0")).join("");}
async function boot(){
 try{
  const r=await fetch(API+"/v1/config"),c=await r.json();
  clientId=c.google_client_id||"";
  if(!clientId){status.textContent="Google OAuth Client ID abhi configure nahi hua. Cloudflare setup ke baad sign-in button yahan active hoga.";return;}
  nonce=makeNonce();
  const wait=()=>{if(!window.google?.accounts?.id){setTimeout(wait,150);return;}
   google.accounts.id.initialize({client_id:clientId,nonce,callback:onGoogleCredential,auto_select:false,ux_mode:"popup"});
   google.accounts.id.renderButton($("google-button"),{theme:"outline",size:"large",shape:"rectangular",text:"continue_with",width:280});
   status.textContent="Google sign-in ready. Apna account type aur profile details select karein.";
  };wait();
 }catch(e){status.textContent="Sign-in configuration load nahi ho paayi. Please retry later.";}
}
async function onGoogleCredential(response){
 status.textContent="Google account verify ho raha hai…";
 const isEditor=role.value==="editor";
 const profile=isEditor?{
  legal_name:$("legal-name").value.trim(),country:$("editor-country").value.trim(),city:$("editor-city").value.trim(),
  languages:$("langs").value.split(",").map(x=>x.trim()).filter(Boolean),
  experience_level:$("exp").value,software:$("software").value.split(",").map(x=>x.trim()).filter(Boolean),
  specializations:$("specializations").value.split(",").map(x=>x.trim()).filter(Boolean),
  bio:$("bio").value.trim(),availability:"project-based"
 }:role.value==="admin"?{}:{company_name:$("company").value.trim(),country:$("client-country").value.trim(),language:"English"};
 if(isEditor&&(!profile.legal_name||!profile.country||!profile.specializations.length)){status.textContent="Full legal name, country and specializations are required.";return;}
 try{
  const r=await fetch(API+"/v1/auth/google",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({credential:response.credential,nonce,role:role.value,profile})});
  const data=await r.json();
  if(!r.ok||!data.ok){status.textContent=data.error?.message||"Sign-in failed. Please retry.";return;}
  sessionStorage.setItem("csa_global_token",response.credential);
  sessionStorage.setItem("csa_global_user",JSON.stringify({id:data.user_id,role:data.role,status:data.status,email:data.email}));
  if(isEditor){
   if(data.existing_editor){
    if(["pending","in_review"].includes(data.kyc_status)){status.textContent="Your KYC document is already under CSA review. Please wait for the verification result.";return;}
    if(data.kyc_status==="verified"){status.textContent="Your KYC is already verified. CSA will continue the editor profile and portfolio review."+(data.kyc_review_note?" Previous review note: "+data.kyc_review_note:"");return;}
    const kycError=validateKycDocument();if(kycError){status.textContent=kycError+(data.kyc_review_note?" Previous rejection reason: "+data.kyc_review_note:"");return;}
    await uploadKycDocument(response.credential);status.textContent="Your replacement KYC document has been securely resubmitted. CSA review is pending.";
   }else{
    const portfolioError=validatePortfolioVideos(),kycError=validateKycDocument();
    if(portfolioError||kycError){status.textContent=portfolioError||kycError;return;}
    await uploadKycDocument(response.credential);await uploadPortfolioVideos(response.credential);
    status.textContent="Registration, KYC document and portfolio samples submitted securely. KYC and editor/video approvals are pending CSA review.";
   }
  }else{location.href="portal.html";}
 }catch(e){status.textContent="Network error. Please retry.";}
}
$("editor-login-form")?.addEventListener("submit",e=>{e.preventDefault();editorPasswordLogin();});
boot();
})();