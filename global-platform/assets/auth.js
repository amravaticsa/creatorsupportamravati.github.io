(()=>{"use strict";
const API="https://csa-global-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const role=$("role"),status=$("status"),editor=$("editor-fields"),client=$("client-fields");
role.addEventListener("change",()=>{const isEditor=role.value==="editor";editor.hidden=!isEditor;client.hidden=isEditor;});
let nonce="",clientId="";
// Country-specific government identity document options.
(function setupCountryKycTypes(){
 const country=$("editor-country"),type=$("kyc-document-type"),help=$("kyc-id-help");
 if(!country||!type)return;
 const india=[["passport","Passport"],["national_id","National ID (if applicable)"],["pan","PAN Card"],["voter_id","Voter ID / EPIC"],["driving_licence","Driving Licence"],["aadhaar","Aadhaar Card (optional)"],["other_government_id","Other Government-issued Photo ID"]];
 const global=[["passport","Passport"],["national_id","National Identity Card"],["driving_licence","Government Driving Licence"],["residence_permit","Residence Permit / Government Resident Card"],["tax_id","Government Tax Identity Card (if it includes a photo)"],["other_government_id","Other Government-issued Photo ID"]];
 function update(){
  const code=country.value,items=code==="IN"?india:global;
  type.replaceChildren(new Option("Select ID type",""));
  for(const [value,label] of items)type.add(new Option(label,value));
  help.textContent=code==="IN"?"India: Passport, National ID (where issued), PAN, Voter ID, Driving Licence, optional Aadhaar or another government photo ID. Aadhaar is not mandatory.":"Your country: Passport, National Identity Card, government Driving Licence, Residence Permit, qualifying government Tax ID or another government-issued photo ID. Availability and naming vary by country.";
 }
 country.addEventListener("change",update);update();
})();

// Populate a complete ISO-style country list using the browser's localized country names.
(function populateEditorCountries(){
 const select=$("editor-country");if(!select)return;
 const codes=["AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","YE","YT","ZA","ZM","ZW","XK"];
 let names;try{names=new Intl.DisplayNames([navigator.language||"en"],{type:"region"});}catch(e){names=null;}
 const options=codes.map(code=>({code,name:names?.of(code)||code})).sort((x,y)=>x.name.localeCompare(y.name));
 for(const item of options){const option=document.createElement("option");option.value=item.code;option.textContent=item.name;select.append(option);}
 select.addEventListener("change",()=>{const pin=$("editor-postal-code");pin.placeholder=select.value==="IN"?"6-digit PIN Code":"Postal or ZIP code (if used in your country)";});
})();

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
function renderKycReviewStatus(data,stage){
 const panel=$("kyc-review-status"),message=$("kyc-review-status-text"),note=$("kyc-review-note"),upload=$("kyc-upload-fields");
 if(!panel||!message||!upload)return;
 panel.hidden=false;note.hidden=true;note.textContent="";
 const statusValue=String(data?.kyc_status||"").toLowerCase();
 const reviewNote=String(data?.kyc_review_note||"").trim();
 if(stage==="submitted"){
  message.textContent="KYC document received by CSA. Status: Pending review. Please wait for the verification decision.";
  upload.hidden=true;
  return;
 }
 if(["pending","in_review"].includes(statusValue)){
  message.textContent="Your identity document is already with CSA for review. A duplicate upload is not needed while this review is in progress.";
  upload.hidden=true;
 }else if(statusValue==="verified"){
  message.textContent="Your identity verification is complete. CSA profile and portfolio approval are separate review steps.";
  upload.hidden=true;
 }else if(statusValue==="rejected"){
  message.textContent="CSA could not verify the submitted document. Review the reason below, then upload a corrected document to request another review.";
  upload.hidden=false;
  if(reviewNote){note.hidden=false;note.textContent="CSA review note: "+reviewNote;}
 }else if(["not_submitted","missing"].includes(statusValue)){
  message.textContent="KYC document is not yet submitted. Complete the identity document section below.";
  upload.hidden=false;
 }else{
  message.textContent="CSA returned an unrecognized KYC status. For your security, resubmission is paused until CSA confirms the correct next step.";
  upload.hidden=true;
  if(reviewNote){note.hidden=false;note.textContent="CSA review note: "+reviewNote;}
 }
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
 const r=await fetch(API+"/v1/editor/kyc-document",{method:"POST",headers:{"authorization":"Bearer "+credential,"content-type":file.type,"x-csa-kyc-document-type":$("kyc-document-type").value,"x-csa-kyc-consent":"true","x-csa-kyc-consent-version":"1.0"},body:file});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message||"KYC document upload failed.");
 return d;
}
async function loadRejectedPortfolioVideos(credential){
 const panel=$("rejected-portfolio-panel"),root=$("rejected-portfolio-list"),message=$("rejected-portfolio-status");
 if(!panel||!root)return;
 panel.hidden=false;root.textContent="Rejected portfolio videos check ho rahe hain…";
 try{
  const r=await fetch(API+"/v1/editor/portfolio-videos/rejected",{headers:{authorization:"Bearer "+credential}});
  const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message||"Rejected video records load nahi ho paaye.");
  root.replaceChildren();
  if(!Array.isArray(d.videos)||!d.videos.length){root.textContent="Abhi koi rejected portfolio video nahi hai.";return;}
  for(const item of d.videos){
   const card=document.createElement("article");card.className="card";
   const title=document.createElement("h4");title.textContent=item.title+" · "+item.category;
   const reason=document.createElement("p");reason.textContent="Admin review reason: "+(item.review_note||"Please contact CSA Admin for clarification.");
   const fileLabel=document.createElement("label");fileLabel.textContent="Corrected video file (MP4/MOV, max 80 MB) *";
   const file=document.createElement("input");file.type="file";file.accept="video/mp4,video/quicktime";
   const titleLabel=document.createElement("label");titleLabel.textContent="Video title *";
   const titleInput=document.createElement("input");titleInput.maxLength=120;titleInput.value=item.title||"";
   const descLabel=document.createElement("label");descLabel.textContent="Video description *";
   const descInput=document.createElement("textarea");descInput.maxLength=1200;descInput.value=item.description||"";
   const categoryLabel=document.createElement("label");categoryLabel.textContent="Video category *";
   const category=document.createElement("select");
   for(const value of ["Reels / Shorts","YouTube Video","Wedding Film","Podcast","Advertisement / Commercial","Corporate Video","Motion Graphics / VFX","Other"]){const o=document.createElement("option");o.value=value;o.textContent=value;category.append(o);}
   category.value=item.category||"Other";
   const rightsLabel=document.createElement("label");rightsLabel.style.cssText="display:flex;gap:10px;align-items:flex-start";
   const rights=document.createElement("input");rights.type="checkbox";
   const rightsText=document.createElement("span");rightsText.textContent="I confirm that I own this corrected work or have all permissions required to upload and showcase it.";
   rightsLabel.append(rights,rightsText);
   const submit=document.createElement("button");submit.className="btn dark";submit.textContent="Submit corrected video for review";
   const feedback=document.createElement("p");feedback.className="muted";feedback.setAttribute("role","status");
   submit.onclick=async()=>{
    const f=file.files&&file.files[0];
    if(!f){feedback.textContent="Corrected video file select karein.";return;}
    if(!["video/mp4","video/quicktime"].includes(f.type)){feedback.textContent="Sirf MP4 ya MOV file accepted hai.";return;}
    if(f.size<1||f.size>80*1024*1024){feedback.textContent="Video size 80 MB se kam hona chahiye.";return;}
    if(!titleInput.value.trim()||!descInput.value.trim()||!category.value||!rights.checked){feedback.textContent="Title, description, category aur rights confirmation complete karein.";return;}
    submit.disabled=true;feedback.textContent="Corrected video securely upload ho raha hai…";
    try{
     const response=await fetch(API+"/v1/editor/portfolio-videos/"+encodeURIComponent(item.id)+"/replacement",{method:"PUT",headers:{"authorization":"Bearer "+credential,"content-type":f.type,"x-csa-video-title":titleInput.value.trim(),"x-csa-video-description":descInput.value.trim(),"x-csa-video-category":category.value,"x-csa-video-rights-confirmed":"true","x-csa-terms-version":PORTFOLIO_TERMS_VERSION},body:f});
     const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error?.message||"Replacement upload failed.");
     feedback.textContent="Corrected video submitted. Status: Pending Admin Review. Client Showcase mein approval se pehle nahi dikhega.";
     await loadRejectedPortfolioVideos(credential);
    }catch(err){feedback.textContent=err.message;submit.disabled=false;}
   };
   card.append(title,reason,fileLabel,file,titleLabel,titleInput,descLabel,descInput,categoryLabel,category,rightsLabel,submit,feedback);root.append(card);
  }
 }catch(err){root.textContent=err.message;}
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
  const returnTo=sessionStorage.getItem("csa_global_return_to");sessionStorage.removeItem("csa_global_return_to");location.href=returnTo&&returnTo.startsWith("/")&&!returnTo.startsWith("//")?returnTo:"portal.html";
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
  legal_name:$("legal-name").value.trim(),country:$("editor-country").selectedOptions[0]?.textContent.trim()||"",country_code:$("editor-country").value,state:$("editor-state").value.trim(),district:$("editor-district").value.trim(),city:$("editor-city").value.trim(),village:$("editor-village").value.trim(),postal_code:$("editor-postal-code").value.trim(),address_line:$("editor-address-line").value.trim(),
  languages:$("langs").value.split(",").map(x=>x.trim()).filter(Boolean),
  experience_level:$("exp").value,software:$("software").value.split(",").map(x=>x.trim()).filter(Boolean),
  specializations:$("specializations").value.split(",").map(x=>x.trim()).filter(Boolean),
  bio:$("bio").value.trim(),availability:"project-based"
 }:role.value==="admin"?{}:{company_name:$("company").value.trim(),country:$("client-country").value.trim(),language:"English"};
 try{
  const r=await fetch(API+"/v1/auth/google",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({credential:response.credential,nonce,role:role.value,profile})});
  const data=await r.json();
  if(!r.ok||!data.ok){status.textContent=data.error?.message||"Sign-in failed. Please retry.";return;}
  if(isEditor){
   // Google is registration/KYC identity only for editors; it never creates an Editor Panel session.
   sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");
   if(data.existing_editor){
    renderKycReviewStatus(data);
    await loadRejectedPortfolioVideos(response.credential);
    if(String(data.verification_status||"").toLowerCase()==="rejected"){
     const panel=$("profile-correction-panel"),message=$("profile-correction-status"),submit=$("profile-correction-submit"),ep=data.editor_profile||{};
     const set=(id,value)=>{const el=$(id);if(el&&value!==null&&value!==undefined)el.value=value;};
     set("legal-name",ep.legal_name);set("editor-country",ep.country_code);set("editor-state",ep.state);set("editor-district",ep.district);set("editor-city",ep.city);set("editor-village",ep.village);set("editor-postal-code",ep.postal_code);set("editor-address-line",ep.address_line);
     const parse=(v)=>{try{const a=JSON.parse(v||"[]");return Array.isArray(a)?a.join(", "):"";}catch{return "";}};
     set("langs",parse(ep.languages_json));set("exp",ep.experience_level);set("software",parse(ep.software_json));set("specializations",parse(ep.specializations_json));set("bio",ep.bio);
     panel.hidden=false;message.textContent="CSA ne aapka profile reject kiya hai. "+(data.profile_review_note?"Review reason: "+data.profile_review_note+" ":"")+"Neeche details sudharein aur corrected profile dobara submit karein.";
     submit.onclick=async()=>{const updated={legal_name:$("legal-name").value.trim(),country:$("editor-country").selectedOptions[0]?.textContent.trim()||"",country_code:$("editor-country").value,state:$("editor-state").value.trim(),district:$("editor-district").value.trim(),city:$("editor-city").value.trim(),village:$("editor-village").value.trim(),postal_code:$("editor-postal-code").value.trim(),address_line:$("editor-address-line").value.trim(),languages:$("langs").value.split(",").map(x=>x.trim()).filter(Boolean),experience_level:$("exp").value,software:$("software").value.split(",").map(x=>x.trim()).filter(Boolean),specializations:$("specializations").value.split(",").map(x=>x.trim()).filter(Boolean),bio:$("bio").value.trim(),availability:"project-based"};
      if(!updated.legal_name||!updated.country_code||!updated.state||!updated.city||!updated.specializations.length){message.textContent="Full legal name, country, state, city aur at least one specialization zaroori hai.";return;}
      if(updated.country_code==="IN"&&updated.postal_code&&!/^\\d{6}$/.test(updated.postal_code)){message.textContent="India PIN Code 6 digits ka hona chahiye.";return;}
      submit.disabled=true;message.textContent="Corrected profile CSA ko submit ho raha hai…";
      try{const cr=await fetch(API+"/v1/editor/profile-correction",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({credential:response.credential,nonce,profile:updated})}),cd=await cr.json();if(!cr.ok||!cd.ok)throw Error(cd.error?.message||"Profile correction submit nahi hua.");message.textContent="Corrected profile successfully submitted. CSA Admin review pending hai.";submit.hidden=true;status.textContent="Profile correction submitted for review.";}catch(err){message.textContent=err.message;submit.disabled=false;}
     };
    }
    if(["pending","in_review","verified"].includes(String(data.kyc_status||"").toLowerCase())){status.textContent="KYC status checked. Profile correction option, if required, is shown above.";return;}
    if(!["rejected","not_submitted","missing"].includes(String(data.kyc_status||"").toLowerCase())){status.textContent="CSA could not confirm a safe KYC resubmission state. Please contact CSA before uploading again.";return;}
    const kycError=validateKycDocument();if(kycError){status.textContent=kycError;return;}
    await uploadKycDocument(response.credential);renderKycReviewStatus({kyc_status:"pending"},"submitted");status.textContent="Your replacement KYC document has been securely resubmitted. CSA review is pending.";
   }else{
    if(isEditor&&(!profile.legal_name||!profile.country_code||!profile.state||!profile.city||!profile.specializations.length)){status.textContent="Full legal name, country, state/province, city and specializations are required.";return;}
    if(isEditor&&profile.country_code==="IN"&&profile.postal_code&&!/^\\d{6}$/.test(profile.postal_code)){status.textContent="India ke liye PIN Code 6 digits ka hona chahiye.";return;}
    const portfolioError=validatePortfolioVideos(),kycError=validateKycDocument();
    if(portfolioError||kycError){status.textContent=portfolioError||kycError;return;}
    await uploadKycDocument(response.credential);renderKycReviewStatus({kyc_status:"pending"},"submitted");await uploadPortfolioVideos(response.credential);
    status.textContent="Registration, KYC document and portfolio samples submitted securely. CSA team KYC, profile aur video review karegi. Approval ke baad CSA aapko Editor User ID aur temporary Password degi. Google se Dashboard login nahi hoga.";
   }
  }else{sessionStorage.setItem("csa_global_token",response.credential);sessionStorage.setItem("csa_global_user",JSON.stringify({id:data.user_id,role:data.role,status:data.status,email:data.email}));location.href="portal.html";}
 }catch(e){status.textContent="Network error. Please retry.";}
}
$("editor-login-form")?.addEventListener("submit",e=>{e.preventDefault();editorPasswordLogin();});
boot();
})();