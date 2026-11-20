(()=>{"use strict";
const API="https://csa-global-api-staging.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const token=sessionStorage.getItem("csa_global_token");
let account=null;try{account=JSON.parse(sessionStorage.getItem("csa_global_user")||"null");}catch{}
const form=$("orderForm"),message=$("orderMessage"),button=$("createOrderBtn");
if(!token||!account||account.role!=="client"){
 const note=document.createElement("p");note.className="ve-msg";note.textContent="Video Editing application submit karne ke liye CSA Global Client Login zaroori hai.";
 const link=document.createElement("a");link.className="ve-btn";link.href="global-platform/login.html";link.textContent="Login with CSA Global";
 form.insertBefore(note,form.firstChild);form.insertBefore(link,form.firstChild);
 form.addEventListener("submit",e=>{e.preventDefault();sessionStorage.setItem("csa_global_return_to","/video-editing.html#new-order");location.href="global-platform/login.html";});
}
const headers={"authorization":"Bearer "+token};
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{...headers,...(options.headers||{})}});let d={};try{d=await r.json();}catch{}if(!r.ok)throw Error(d.error?.message||"Request failed ("+r.status+")");return d;}
if(form&&token&&account?.role==="client")form.addEventListener("submit",async e=>{
 e.preventDefault();if(!form.reportValidity())return;button.disabled=true;message.classList.remove("ve-hidden");message.textContent="Submitting your application securely to CSA Global…";
 const d=Object.fromEntries(new FormData(form).entries());
 const brief=[
 "CSA VIDEO EDITING APPLICATION","Contact name: "+d.name,"Contact phone / WhatsApp: "+d.phone,
 "Client account: "+account.email,"Content style: "+d.contentStyle,"Editing package: "+d.package,
 "Project type: "+(d.projectType||"Not specified"),"Raw footage duration: "+(d.duration||"Not specified"),
 "Output format: "+d.aspectRatio,"Deadline: "+(d.deadline||"To be confirmed"),
 "Dialect / accent: "+(d.dialect||"Not specified"),"Project mode: "+d.locationMode,
 "Instructions: "+(d.instructions||"None"),"Reference: "+(d.reference||"None")
 ].join("\n");
 const mode=d.locationMode==="On-site required"?"onsite":d.locationMode==="Hybrid"?"hybrid":"remote";
 const amountText=String(d.budget||"").trim();
 const payload={title:(d.package+" — "+(d.projectType||d.contentStyle)).slice(0,180),category:"Video Editing",brief,
 budget_amount_minor:amountText?Math.round(Number(amountText)*100):null,budget_currency:"INR",budget_type:amountText?"fixed":"recommend",
 preferred_deadline:d.deadline||null,priority:"normal",revisions_included:2,aspect_ratio:d.aspectRatio,
 requirements:{communication_language:"English",source_language:d.sourceLanguage,output_language:d.outputLanguage,
 subtitle_languages:d.subtitleLanguage||"",client_country:d.country,client_region:d.state||"",client_city:d.city,
 project_mode:mode,project_location:"",client_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Kolkata",
 contact_name:d.name,contact_phone:d.phone,content_style:d.contentStyle,dialect:d.dialect,service_package:d.package,
 project_type:d.projectType,raw_footage_duration:d.duration}};
 try{
  const result=await api("/v1/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const selected=Array.from(form.elements.project_files?.files||[]);let uploaded=0;
  for(const file of selected){
   if(file.size>90*1024*1024)throw Error("Application "+result.project_code+" is saved. "+file.name+" is over the 90 MB direct-upload limit. Upload this file from the CSA Global dashboard using its resumable uploader.");
   const r=await fetch(API+"/v1/projects/"+encodeURIComponent(result.project_id)+"/files",{method:"PUT",headers:{...headers,"content-type":file.type||"application/octet-stream","x-file-name":file.name},body:file});
   let x={};try{x=await r.json();}catch{}if(!r.ok)throw Error(x.error?.message||"Upload failed for "+file.name);uploaded++;
  }
  message.textContent="Application received successfully.\nApplication ID: "+result.project_code+"\n"+uploaded+" file(s) uploaded securely.\nOpen CSA Global Client Dashboard to track your application, files and progress.";
  const dash=document.createElement("a");dash.href="global-platform/portal.html";dash.className="ve-btn";dash.textContent="Open My CSA Global Dashboard";dash.style.display="inline-block";dash.style.marginTop="12px";message.append(document.createElement("br"),dash);
  form.reset();
 }catch(err){message.textContent=err.message;}finally{button.disabled=false;}
});
})();