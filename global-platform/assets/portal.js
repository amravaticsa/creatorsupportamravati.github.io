(()=>{"use strict";
const API="https://csa-global-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
function readSessionValue(key){try{return sessionStorage.getItem(key);}catch{return null;}}
function readSessionUser(){try{const raw=readSessionValue("csa_global_user");return raw?JSON.parse(raw):null;}catch{return null;}}
const token=readSessionValue("csa_global_token"),user=readSessionUser();
if(!token||!user||typeof user!=="object"||!user.role){try{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");}catch{}location.replace("login.html");return;}
const headers={"content-type":"application/json","authorization":"Bearer "+token};
$("welcome").textContent="Welcome to CSA Global";
$("account-status").textContent="Signed in as "+(user.email||"verified account")+" · "+user.role+" · Account status: "+(user.account_status||user.status||"not provided by login response");
function endSession(message="Session expired. Please sign in again."){$("account-status").textContent=message;try{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");}catch{}location.replace("login.html");}
$("logout").onclick=()=>endSession("You have been signed out.");
const refreshButton=$("refresh-dashboard");if(refreshButton)refreshButton.onclick=async()=>{refreshButton.disabled=true;refreshButton.textContent="Refreshing…";try{if(user.role==="client"){await Promise.all([loadClientProjects(),loadClientFeedbackEligible(),loadUploadHistory("client-upload-history")]);}else if(user.role==="editor"){await Promise.all([loadMyEditorPerformance(),loadEditorAvailability(),loadOffers(),loadAssignments(),loadEditorRefunds(),loadUploadHistory("editor-upload-history")]);}else if(user.role==="admin"){await Promise.all([loadAdmin(),loadAdminMultipartUploads(),loadAdminCleanupRuns()]);}}finally{refreshButton.disabled=false;refreshButton.textContent="Refresh data";}};
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{...headers,...options.headers}});let d={};try{d=await r.json();}catch{if(!r.ok)throw Error("CSA server returned an unreadable response (HTTP "+r.status+").");}if(r.status===401){endSession();throw Error("Your session has expired. Please sign in again.");}if(!r.ok)throw Error(d.error?.message||"Request failed (HTTP "+r.status+").");return d;}

function buildDisputeForm(projectId,role,host){
 const details=document.createElement("details");details.className="dispute-form";
 const summary=document.createElement("summary");summary.textContent="Report a problem / Raise a complaint";
 const form=document.createElement("form");form.className="form";
 const category=document.createElement("select");category.required=true;category.setAttribute("aria-label","Complaint category");
 for(const [v,label] of [["","Select complaint category"],["scope","Work scope / requirements"],["quality","Work quality"],["deadline","Missed deadline"],["payment","Payment"],["deposit","Security deposit"],["conduct","Communication / conduct"],["other","Other"]]){const o=document.createElement("option");o.value=v;o.textContent=label;category.append(o);}
 const severity=document.createElement("select");severity.setAttribute("aria-label","Complaint urgency");
 for(const [v,label] of [["normal","Normal priority"],["high","High priority"],["low","Low priority"]]){const o=document.createElement("option");o.value=v;o.textContent=label;severity.append(o);}
 const description=document.createElement("textarea");description.required=true;description.minLength=20;description.maxLength=4000;description.rows=4;description.placeholder="Explain what happened, important dates and what outcome you are seeking (20–4,000 characters).";
 const send=document.createElement("button");send.type="submit";send.className="btn dark";send.textContent="Submit complaint";
 const status=document.createElement("p");status.className="muted";status.setAttribute("role","status");
 form.append(category,severity,description,send,status);details.append(summary,form);host.append(details);
 form.addEventListener("submit",async e=>{e.preventDefault();if(description.value.trim().length<20){status.textContent="Please add more detail.";return;}send.disabled=true;status.textContent="Submitting securely…";try{await api("/v1/"+role+"/projects/"+encodeURIComponent(projectId)+"/disputes",{method:"POST",body:JSON.stringify({dispute_type:category.value,severity:severity.value,description:description.value.trim()})});status.textContent="Complaint submitted. CSA has been notified.";form.reset();details.open=false;loadMyDisputes(role,role==="client"?"client-disputes":"editor-disputes");}catch(err){status.textContent=err.message;}finally{send.disabled=false;}});
}
async function loadMyDisputes(role,rootId){
 const root=$(rootId);if(!root)return;root.textContent="Loading complaints…";
 try{const d=await api("/v1/"+role+"/disputes"),items=Array.isArray(d.disputes)?d.disputes:[],events=Array.isArray(d.events)?d.events:[];root.replaceChildren();if(!items.length){root.textContent="No complaints have been submitted.";return;}
 for(const item of items){const card=document.createElement("article");card.className="card dispute-card";const title=document.createElement("h3");title.textContent=(item.public_project_code||"Project")+" · "+item.dispute_type;const meta=document.createElement("p");meta.className="muted";meta.textContent="Status: "+item.status.replace("_"," ")+" · Priority: "+item.severity+" · Submitted: "+new Date(item.created_at).toLocaleString();const desc=document.createElement("p");desc.textContent=item.description;card.append(title,meta,desc);
 if(item.resolution_notes){const resolution=document.createElement("p");resolution.textContent="CSA response: "+item.resolution_notes;card.append(resolution);}
 const history=events.filter(x=>x.dispute_id===item.id);for(const ev of history){if(!ev.public_note)continue;const line=document.createElement("p");line.className="muted dispute-event";line.textContent=(ev.actor_role==="admin"?"CSA · ":"")+ev.public_note+" · "+new Date(ev.created_at).toLocaleString();card.append(line);}
 root.append(card);}
 }catch(e){root.textContent="Complaints could not be loaded: "+e.message;}
}
async function loadAdminDisputes(){
 const root=$("admin-disputes");if(!root)return;root.textContent="Loading complaint queue…";
 try{const filter=$("admin-dispute-filter")?.value||"open",d=await api("/v1/admin/disputes"+(filter==="all"?"":"?status="+encodeURIComponent(filter))),items=Array.isArray(d.disputes)?d.disputes:[],events=Array.isArray(d.events)?d.events:[];root.replaceChildren();if(!items.length){root.textContent="No complaints in this queue.";return;}
 for(const item of items){const card=document.createElement("article");card.className="card dispute-card";const title=document.createElement("h3");title.textContent=item.public_project_code+" · "+item.title;const meta=document.createElement("p");meta.className="muted";meta.textContent="From: "+item.opener_role+" ("+item.opener_email+") · "+item.dispute_type+" · "+item.severity+" priority · "+item.status;const due=document.createElement("p");due.className="muted";due.textContent="Response target: "+(item.response_due_at?new Date(item.response_due_at).toLocaleString():"Not set")+" · Received: "+new Date(item.created_at).toLocaleString();const desc=document.createElement("p");desc.textContent=item.description;card.append(title,meta,due,desc);
 const history=events.filter(x=>x.dispute_id===item.id);for(const ev of history){const line=document.createElement("p");line.className="muted dispute-event";line.textContent=ev.actor_role+" · "+(ev.to_status||ev.event_type)+" · "+(ev.public_note||"")+" · "+new Date(ev.created_at).toLocaleString();card.append(line);}
 if(item.admin_private_notes){const priv=document.createElement("p");priv.className="muted";priv.textContent="Previous internal note: "+item.admin_private_notes;card.append(priv);}
 if(!["resolved","rejected"].includes(item.status)){const form=document.createElement("form");form.className="form dispute-decision";const status=document.createElement("select");status.setAttribute("aria-label","Complaint decision");for(const [v,l] of [["under_review","Move to under review"],["resolved","Resolve complaint"],["rejected","Reject complaint"]]){const o=document.createElement("option");o.value=v;o.textContent=l;status.append(o);}const resolution=document.createElement("select");resolution.setAttribute("aria-label","Resolution recommendation");for(const [v,l] of [["","Select resolution type"],["refund_review","Refund review (not automatic)"],["reassignment_review","Reassignment review (not automatic)"],["revision","Additional revision"],["other","Other / guidance"]]){const o=document.createElement("option");o.value=v;o.textContent=l;resolution.append(o);}const pub=document.createElement("textarea");pub.rows=2;pub.maxLength=3000;pub.placeholder="Client/Editor-visible response or decision reason";const internal=document.createElement("textarea");internal.rows=2;internal.maxLength=3000;internal.placeholder="Internal CSA note (not visible to Client/Editor)";const save=document.createElement("button");save.type="submit";save.className="btn dark";save.textContent="Save complaint decision";const msg=document.createElement("p");msg.className="muted";msg.setAttribute("role","status");form.append(status,resolution,pub,internal,save,msg);card.append(form);
 form.addEventListener("submit",async e=>{e.preventDefault();if(status.value==="resolved"&&!resolution.value){msg.textContent="Select a resolution type.";return;}save.disabled=true;msg.textContent="Saving decision…";try{await api("/v1/admin/disputes/"+encodeURIComponent(item.id)+"/decision",{method:"POST",body:JSON.stringify({status:status.value,resolution_type:resolution.value,public_note:pub.value.trim(),private_note:internal.value.trim()})});msg.textContent="Decision saved and requester notified.";await loadAdminDisputes();}catch(err){msg.textContent=err.message;save.disabled=false;}});
 }
 root.append(card);}
 }catch(e){root.textContent="Complaint queue could not be loaded: "+e.message;}
}


async function renderProjectMessages(projectId,role,host){
 const details=document.createElement("details");details.className="project-messages panel";
 const summary=document.createElement("summary");summary.textContent="Project messages · Client & CSA Support";
 const body=document.createElement("div");body.className="project-message-body";
 const history=document.createElement("div");history.className="project-message-history";history.setAttribute("aria-live","polite");history.textContent="Open to load project messages.";
 const refresh=document.createElement("button");refresh.type="button";refresh.className="btn outline";refresh.textContent="Refresh messages";
 const form=document.createElement("form");form.className="project-message-form";
 const input=document.createElement("textarea");input.rows=3;input.maxLength=2000;input.required=true;input.placeholder="Write a message to CSA Support…";input.setAttribute("aria-label","Message to CSA Support");
 const count=document.createElement("small");count.className="muted";count.textContent="0 / 2,000 characters";
 input.addEventListener("input",()=>{count.textContent=input.value.length+" / 2,000 characters";});
 const send=document.createElement("button");send.type="submit";send.className="btn dark";send.textContent="Send message";
 const status=document.createElement("p");status.className="muted";status.setAttribute("role","status");
 form.append(input,count,send,status);body.append(history,refresh,form);details.append(summary,body);host.append(details);
 const endpoint="/v1/"+role+"/projects/"+encodeURIComponent(projectId)+"/messages";
 let loaded=false;
 async function load(){
  refresh.disabled=true;history.textContent="Loading messages…";
  try{
   const data=await api(endpoint);history.replaceChildren();
   const messages=Array.isArray(data.messages)?data.messages:[];
   if(!messages.length){history.textContent="No messages yet. Start the conversation with CSA Support.";return;}
   for(const item of messages){
    const entry=document.createElement("article");entry.className="project-message"+(item.sender_label==="You"?" is-own":"");
    const head=document.createElement("div");head.className="project-message-meta";
    const sender=document.createElement("strong");sender.textContent=item.sender_label||"CSA Support";
    const date=document.createElement("time");date.textContent=item.created_at?new Date(item.created_at).toLocaleString():"Time unavailable";
    const message=document.createElement("p");message.textContent=item.body||"";entry.append(head,message);head.append(sender,date);history.append(entry);
   }
   loaded=true;
  }catch(e){history.textContent=e.message.includes("permission")?"Messaging is not enabled for this Admin role.":"Messages could not be loaded: "+e.message;}
  finally{refresh.disabled=false;}
 }
 details.addEventListener("toggle",()=>{if(details.open&&!loaded)load();});
 refresh.addEventListener("click",load);
 form.addEventListener("submit",async event=>{
  event.preventDefault();const message=input.value.trim();if(!message){status.textContent="Write a message first.";return;}
  send.disabled=true;status.textContent="Sending securely…";
  try{await api(endpoint,{method:"POST",body:JSON.stringify({message})});input.value="";count.textContent="0 / 2,000 characters";status.textContent="Message sent to CSA Support.";loaded=false;await load();}
  catch(e){status.textContent=e.message;}
  finally{send.disabled=false;}
 });
}

async function multipartUpload(file,details,onProgress=()=>{},resumeUploadId=null,onStatus=()=>{}){
 const report=state=>{try{onStatus(state);}catch{}};
 const identity=[details.purpose,details.project_id||details.assignment_id||"",file.name,file.size,file.lastModified].join("|");
 const resumeKey="csa_multipart_"+btoa(unescape(encodeURIComponent(identity))).replace(/[^a-zA-Z0-9]/g,"").slice(0,100);
 let start=null;
 const saved=resumeUploadId||localStorage.getItem(resumeKey);
 if(resumeUploadId)localStorage.setItem(resumeKey,resumeUploadId);
 if(saved){
  const check=await fetch(API+"/v1/uploads/multipart/"+encodeURIComponent(saved),{headers:{authorization:"Bearer "+token}});
  const status=await check.json();
  if(check.ok&&status.filename===file.name&&Number(status.total_size_bytes)===file.size){
   for(const part of status.uploaded_parts||[]){
    if(!part.sha256)throw Error("This older upload session has no integrity checksum. It cannot be safely resumed; please start a fresh upload.");
    const from=(Number(part.part_number)-1)*Number(status.part_size_bytes),to=Math.min(file.size,from+Number(status.part_size_bytes));
    const digest=await crypto.subtle.digest("SHA-256",await file.slice(from,to).arrayBuffer());
    const localHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
    if(localHash!==part.sha256)throw Error("Selected file content does not match the previously uploaded parts. Choose the original file to resume.");
   }
   start=status;onProgress(0,file.size,0,status.expected_parts);
  }
  else if(check.status===404||check.status===410){localStorage.removeItem(resumeKey);}
  else if(!check.ok)throw Error(status.error?.message||"Could not resume the previous upload.");
 }
 if(!start){
  start=await api("/v1/uploads/multipart",{method:"POST",body:JSON.stringify({purpose:details.purpose,project_id:details.project_id,assignment_id:details.assignment_id,filename:file.name,mime_type:file.type||"application/octet-stream",size_bytes:file.size,notes:details.notes||""})});
  localStorage.setItem(resumeKey,start.upload_id);
 }
 try{
  const completed=new Set((start.uploaded_parts||[]).map(x=>Number(x.part_number)));
  let sent=(start.uploaded_parts||[]).reduce((n,x)=>n+Number(x.size_bytes||0),0);
  for(let part=1;part<=start.expected_parts;part++){
   if(completed.has(part))continue;
   const from=(part-1)*start.part_size_bytes,to=Math.min(file.size,from+start.part_size_bytes),chunk=file.slice(from,to);
   let done=false,lastError;
   for(let attempt=1;attempt<=3&&!done;attempt++){
    try{
     if(typeof navigator!=="undefined"&&navigator.onLine===false)throw Object.assign(Error("Your internet connection is offline."),{retryable:true});
     report({type:"sending",part,total:start.expected_parts,attempt});
     const r=await fetch(API+"/v1/uploads/multipart/"+start.upload_id+"/parts/"+part,{method:"PUT",headers:{authorization:"Bearer "+token,"content-type":"application/octet-stream"},body:chunk});
     let d;try{d=await r.json();}catch{const parseError=Error("Upload server returned an unreadable response.");parseError.retryable=r.status===408||r.status===429||r.status>=500;parseError.status=r.status;throw parseError;}
     if(!r.ok){const requestError=Error(d.error?.message||"Upload part "+part+" failed");requestError.status=r.status;requestError.retryable=r.status===408||r.status===429||r.status>=500;const retryAfter=r.headers.get("Retry-After");if(retryAfter){const seconds=Number(retryAfter);const dateDelay=Date.parse(retryAfter)-Date.now();requestError.retryAfterMs=Number.isFinite(seconds)?Math.max(0,seconds*1000):Number.isFinite(dateDelay)?Math.max(0,dateDelay):0;}throw requestError;}
     done=true;
    }catch(err){lastError=err;if(err.retryable===false)throw err;if(attempt<3){const backoff=Math.min(10000,700*Math.pow(2,attempt-1));const jitter=Math.floor(Math.random()*300);const delay=Math.min(30000,Math.max(backoff+jitter,Number(err.retryAfterMs)||0));report({type:"retry",part,total:start.expected_parts,attempt,delay,message:err.message});await new Promise(resolve=>setTimeout(resolve,delay));}}
   }
   if(!done)throw lastError||Error("Upload part "+part+" failed");
   sent+=chunk.size;onProgress(sent,file.size,part,start.expected_parts);report({type:"progress",part,total:start.expected_parts,sent,totalBytes:file.size});
  }
  report({type:"completing",part:start.expected_parts,total:start.expected_parts});
  const result=await api("/v1/uploads/multipart/"+start.upload_id+"/complete",{method:"POST",body:"{}"});
  localStorage.removeItem(resumeKey);report({type:"complete"});
  return result;
 }catch(err){
  report({type:"error",message:err.message||"Upload failed"});
  throw Error((err.message||"Upload failed")+". Upload session is saved; select the same file again to resume.");
 }
}

if(user.role==="client"){
 $("client-panel").hidden=false;
 loadClientProjects();
 loadClientFeedbackEligible();
  $("project-form").onsubmit=async e=>{
   e.preventDefault();const form=e.target;if(form.dataset.submitting==="1")return;
   const submit=form.querySelector('button[type="submit"]');if(!form.reportValidity())return;
   form.dataset.submitting="1";if(submit){submit.disabled=true;submit.textContent="Submitting to CSA…";}
   const f=new FormData(form),major=Number(f.get("budget")),minor=Math.round(major*100),payload={title:String(f.get("title")||"").trim(),category:f.get("category"),brief:String(f.get("brief")||"").trim(),video_count:Number(f.get("video_count"))||null,raw_footage_minutes:Number(f.get("raw_footage_minutes"))||null,final_duration_minutes:Number(f.get("final_duration_minutes"))||null,resolution:f.get("resolution"),aspect_ratio:f.get("aspect_ratio"),budget_amount_minor:minor,budget_currency:f.get("currency"),budget_type:f.get("budget_type"),preferred_deadline:f.get("preferred_deadline"),priority:f.get("priority"),revisions_included:Number(f.get("revisions_included")),requirements:{
      communication_language:String(f.get("communication_language")||"").trim(),
      source_language:String(f.get("source_language")||"").trim(),
      output_language:String(f.get("output_language")||"").trim(),
      subtitle_languages:String(f.get("subtitle_languages")||"").trim(),
      client_country:String(f.get("client_country")||"").trim(),
      client_region:String(f.get("client_region")||"").trim(),
      client_city:String(f.get("client_city")||"").trim(),
      project_mode:String(f.get("project_mode")||"").trim(),
      project_location:String(f.get("project_location")||"").trim(),
      reference_url:String(f.get("reference_url")||"").trim(),
      client_timezone:String(f.get("client_timezone")||"").trim()
    }};
   const startedAt=Date.now();let project=null;
   $("project-message").textContent="Submitting your project to CSA. Please do not close this page…";
   try{
    try{project=await api("/v1/projects",{method:"POST",body:JSON.stringify(payload)});}
    catch(submitError){
     // A network/server error can arrive after the database commit; reconcile before ever inviting a retry.
     try{const check=await api("/v1/client/projects");const match=(check.projects||[]).find(p=>p.title===payload.title&&p.category===payload.category&&Number(p.budget_amount_minor)===minor&&Date.parse(p.created_at)>=startedAt-120000);if(match)project={project_id:match.id,project_code:match.public_project_code,reconciled:true};}catch{}
     if(!project)throw Error(submitError.message+" We could not confirm whether CSA received it. Check “Your projects with CSA” before trying again.");
    }
    $("project-message").textContent="Project "+project.project_code+" received by CSA. Now uploading your selected files…";
    const files=Array.from(form.elements.project_files?.files||[]);let uploaded=0;
    for(const file of files){
     if(file.size>5*1024*1024*1024)throw Error(file.name+" is over the 5 GB per-file limit.");
     if(file.size>90*1024*1024){await multipartUpload(file,{purpose:"project_file",project_id:project.project_id},(sent,total,part,count)=>{$("project-message").textContent="CSA received "+project.project_code+" · Uploading "+file.name+" · Part "+part+"/"+count+" · "+Math.round(sent/total*100)+"%";},null,state=>{if(state.type==="retry")$("project-message").textContent="Project received · Connection retry "+state.attempt+"/3 · "+file.name;if(state.type==="completing")$("project-message").textContent="Project received · Verifying "+file.name;if(state.type==="error")$("project-message").textContent="Project received · Upload paused: "+state.message+" · Resume from upload history.";});}
     else{const up=await fetch(API+"/v1/projects/"+project.project_id+"/files",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":file.type||"application/octet-stream","x-file-name":file.name},body:file});let result={};try{result=await up.json();}catch{}if(!up.ok)throw Error(result.error?.message||"Upload failed for "+file.name);}
     uploaded++;
    }
    $("project-message").textContent="Success! Project "+project.project_code+" has been submitted to CSA"+(files.length?" and "+uploaded+" file(s) uploaded securely.":".");
    form.reset();loadClientProjects();loadUploadHistory("client-upload-history");
   }catch(err){$("project-message").textContent=(project?"Project "+project.project_code+" is safely saved with CSA, but file upload needs attention: ":"")+err.message;loadClientProjects();}
   finally{delete form.dataset.submitting;if(submit){submit.disabled=false;submit.textContent="Submit Project to CSA";}}
  };
  $("legacy-video-claim-form").onsubmit=async e=>{
   e.preventDefault();const form=e.target;if(form.dataset.submitting==="1"||!form.reportValidity())return;
   const submit=form.querySelector('button[type="submit"]'),message=$("legacy-claim-message"),data=new FormData(form);
   form.dataset.submitting="1";submit.disabled=true;submit.textContent="Verifying securely…";message.textContent="Checking the original Order ID and access token. This may take a moment.";
   try{
    const result=await api("/v1/client/legacy-video-orders/claim",{method:"POST",body:JSON.stringify({order_code:String(data.get("order_code")||"").trim(),access_token:String(data.get("access_token")||"").trim()})});
    message.textContent=(result.already_claimed?"This order is already linked to your account. ":"Legacy order linked successfully. ")+"Application ID: "+result.project_code+". "+(result.files_imported??"Existing")+" file(s) are now available in your CSA Global dashboard.";
    form.reset();await loadClientProjects();
   }catch(err){message.textContent=err.message;}
   finally{delete form.dataset.submitting;submit.disabled=false;submit.textContent="Securely Link My Old Order";}
  };
  $("video-editing-form").onsubmit=async e=>{
   e.preventDefault();const form=e.target;if(form.dataset.submitting==="1")return;
   if(!form.reportValidity())return;const submit=form.querySelector('button[type="submit"]');form.dataset.submitting="1";submit.disabled=true;submit.textContent="Submitting application…";
   const f=new FormData(form),budget=String(f.get("budget")||"").trim(),minor=budget?Math.round(Number(budget)*100):null;
   const packageName=String(f.get("service_package")||"Video Editing"),style=String(f.get("content_style")||"");
   const title=(packageName+" — "+(f.get("project_type")||style)).slice(0,180);
   const payload={title,category:"Video Editing",brief:String(f.get("brief")||"").trim(),video_count:Number(f.get("video_count"))||null,final_duration_minutes:Number(f.get("final_duration_minutes"))||null,resolution:f.get("resolution"),aspect_ratio:f.get("aspect_ratio"),budget_amount_minor:minor,budget_currency:"INR",budget_type:budget?"fixed":"recommend",preferred_deadline:String(f.get("preferred_deadline")||"").trim()||null,priority:"normal",revisions_included:2,requirements:{
    communication_language:String(f.get("communication_language")||"").trim(),source_language:String(f.get("source_language")||"").trim(),output_language:String(f.get("output_language")||"").trim(),subtitle_languages:String(f.get("subtitle_languages")||"").trim(),client_country:String(f.get("client_country")||"").trim(),client_region:String(f.get("client_region")||"").trim(),client_city:String(f.get("client_city")||"").trim(),project_mode:String(f.get("project_mode")||"remote"),project_location:"",reference_url:String(f.get("reference_url")||"").trim(),client_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Kolkata",contact_name:String(f.get("contact_name")||"").trim(),contact_phone:String(f.get("contact_phone")||"").trim(),content_style:style,dialect:String(f.get("dialect")||"").trim(),service_package:packageName,project_type:String(f.get("project_type")||"").trim(),raw_footage_duration:String(f.get("raw_footage_duration")||"").trim()
   }};
   const message=$("video-editing-message");message.textContent="Submitting your application securely…";let project=null;
   try{
    project=await api("/v1/projects",{method:"POST",body:JSON.stringify(payload)});
    message.textContent="Application "+project.project_code+" received. Uploading selected footage…";
    const files=Array.from(form.elements.project_files?.files||[]);let uploaded=0;
    for(const file of files){
     if(file.size>5*1024*1024*1024)throw Error(file.name+" exceeds the 5 GB per-file limit.");
     if(file.size>90*1024*1024){await multipartUpload(file,{purpose:"project_file",project_id:project.project_id},(sent,total,part,count)=>{message.textContent="Application "+project.project_code+" · Uploading "+file.name+" · Part "+part+"/"+count+" · "+Math.round(sent/total*100)+"%";},null,state=>{if(state.type==="retry")message.textContent="Retrying upload "+state.attempt+"/3 · "+file.name;if(state.type==="completing")message.textContent="Verifying "+file.name;if(state.type==="error")message.textContent="Upload paused: "+state.message;});}
     else{const up=await fetch(API+"/v1/projects/"+encodeURIComponent(project.project_id)+"/files",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":file.type||"application/octet-stream","x-file-name":file.name},body:file});let result={};try{result=await up.json();}catch{}if(!up.ok)throw Error(result.error?.message||"Upload failed for "+file.name);}
     uploaded++;
    }
    message.textContent="Success! Video Editing application "+project.project_code+" is saved in CSA Central Database. "+uploaded+" file(s) uploaded. Track payment, progress and final delivery below.";
    form.reset();loadClientProjects();loadUploadHistory("client-upload-history");
   }catch(err){message.textContent=(project?"Application "+project.project_code+" is saved, but upload needs attention: ":"")+err.message;loadClientProjects();}
   finally{delete form.dataset.submitting;submit.disabled=false;submit.textContent="Submit Video Editing Application";}
  };
}else if(user.role==="editor"){
 $("editor-panel").hidden=false;renderEditorReadiness();if(user.status==="pending"){$("assignments").textContent="Your editor profile is awaiting CSA verification. Project offers will appear after approval.";}else{loadMyEditorPerformance();loadEditorAvailability();loadOffers();loadAssignments();loadEditorRefunds();loadUploadHistory("editor-upload-history");}
}else if(user.role==="admin"){
 $("admin-panel").hidden=false;loadAdmin();loadAdminMultipartUploads();loadAdminCleanupRuns();
}else{$("account-status").textContent="This account role does not have a client/editor portal.";}
function renderEditorReadiness(){
 const root=$("editor-readiness");if(!root)return;root.replaceChildren();
 const statusValue=(value)=>{const s=String(value||"").trim();return s?s.replaceAll("_"," "):"Not provided by login response";};
 const items=[
  ["Login / account",user.account_status||user.status],
  ["KYC verification",user.kyc_status],
  ["Editor profile approval",user.verification_status]
 ];
 for(const [label,value] of items){
  const card=document.createElement("div");card.className="stat";
  const title=document.createElement("small");title.textContent=label;
  const strong=document.createElement("strong");strong.textContent=statusValue(value);
  card.append(title,strong);root.append(card);
 }
 const note=document.createElement("p");note.className="muted";note.style.gridColumn="1 / -1";
 const kyc=String(user.kyc_status||"").toLowerCase(),profile=String(user.verification_status||"").toLowerCase(),account=String(user.account_status||user.status||"").toLowerCase();
 if(kyc==="verified"&&profile==="verified"&&account==="active"){
  note.textContent="Your login session reports an active account, verified KYC and approved profile. CSA still validates eligibility on the server when offers are requested.";
 }else if(!user.kyc_status&&!user.verification_status){
  note.textContent="The current login response does not include KYC or profile-review details. This dashboard will not guess those results. Contact CSA for the latest review status; offer access remains controlled by the CSA server.";
 }else{
  note.textContent="Project invitations are available only when the CSA server confirms an active account, verified KYC and approved editor profile. If a status is pending or unavailable, contact CSA for review.";
 }
 root.append(note);
}
async function loadAdminCleanupRuns(){
 const root=$("admin-cleanup-runs");if(!root)return;root.textContent="Loading cleanup history…";
 try{
  const d=await api("/v1/admin/multipart-cleanup-runs");root.replaceChildren();
  if(!d.runs.length){root.textContent="No scheduled cleanup execution has been recorded yet.";return;}
  for(const run of d.runs){
   const card=document.createElement("article");card.className="card";
   const title=document.createElement("h4");title.textContent=run.status.toUpperCase()+" · "+new Date(run.started_at).toLocaleString();
   const stats=document.createElement("p");stats.textContent="Checked "+run.checked+" · Aborted "+run.aborted+" · Failed "+run.failed;
   const finish=document.createElement("small");finish.textContent=run.finished_at?"Finished "+new Date(run.finished_at).toLocaleString():"Execution has not finished";
   card.append(title,stats,finish);
   if(run.error_message){const err=document.createElement("p");err.className="muted";err.textContent=run.error_message;card.append(err);}
   root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
async function loadAdminMultipartUploads(){
 const metrics=$("admin-multipart-metrics"),root=$("admin-multipart-uploads");if(!root)return;
 root.textContent="Loading upload operations…";
 try{
  const d=await api("/v1/admin/multipart-uploads");
  metrics.replaceChildren();
  const labels=[["Open sessions",d.totals.open||0],["Completed",d.totals.completed||0],["Aborted",d.totals.aborted||0],["Expired but open",d.totals.expired_open||0],["Unknown outcome",d.totals.unknown||0],["Completing",d.totals.completing||0]];
  for(const [label,value] of labels){const card=document.createElement("div");card.className="stat";const small=document.createElement("small");small.textContent=label;const strong=document.createElement("strong");strong.textContent=value;card.append(small,strong);metrics.append(card);}
  root.replaceChildren();
  const attention=document.createElement("section");attention.className="card";
  const attentionTitle=document.createElement("h4");attentionTitle.textContent="Sessions requiring attention ("+(d.attention||[]).length+")";attention.append(attentionTitle);
  if(!(d.attention||[]).length){const clear=document.createElement("p");clear.className="muted";clear.textContent="No stale, expired or uncertain multipart sessions need review.";attention.append(clear);}
  else for(const item of d.attention){
   const entry=document.createElement("div");entry.className="card";
   const heading=document.createElement("strong");heading.textContent=item.original_filename+" · "+(item.public_project_code||"No project code")+" · "+item.status.replaceAll("_"," ");
   const owner=document.createElement("p");owner.className="muted";owner.textContent=item.uploader_name+" · "+item.email+" · "+item.purpose.replaceAll("_"," ");
   const reason=document.createElement("p");reason.textContent=item.reason;
   const age=document.createElement("small");age.textContent="Started "+new Date(item.created_at).toLocaleString()+" · "+item.age_minutes+" minutes ago";
   const inspect=document.createElement("button");inspect.className="btn outline";inspect.textContent="Inspect session";
   const detail=document.createElement("div");detail.className="muted";detail.hidden=true;
   inspect.onclick=async()=>{inspect.disabled=true;detail.hidden=false;detail.textContent="Loading safe session diagnostics…";try{const report=await api("/v1/admin/multipart-uploads/"+encodeURIComponent(item.id)+"/inspect");const x=report.session;detail.replaceChildren();const summary=document.createElement("p");summary.textContent="Session "+x.id+" · "+x.total_size_bytes+" bytes · "+report.parts.length+" parts · "+x.status;const parts=document.createElement("p");parts.textContent="Expected "+x.expected_parts+" · Received "+report.parts.length+" · Missing "+report.missing_parts.length;const integrity=document.createElement("p");integrity.textContent="Checksum verified parts available: "+report.integrity.parts_with_checksum+" · Without checksum: "+report.integrity.parts_without_checksum;const missing=document.createElement("p");missing.textContent=report.missing_parts.length?"Missing part numbers: "+report.missing_parts.join(", "):"No missing parts recorded in database.";const caution=document.createElement("p");caution.textContent="Read-only diagnostics only. No retry, abort, delete, or refund action was performed.";detail.append(summary,parts,integrity,missing,caution);await renderMultipartIncidentPanel(item.id,detail);inspect.textContent="Refresh inspection";}catch(err){detail.textContent="Inspection failed: "+err.message;}finally{inspect.disabled=false;}};
   entry.append(heading,owner,reason,age,inspect,detail);attention.append(entry);
  }
  root.append(attention);
  if(!d.uploads.length){const empty=document.createElement("p");empty.textContent="No multipart upload sessions recorded yet.";root.append(empty);return;}
  for(const u of d.uploads){
   const card=document.createElement("article");card.className="card";
   const h=document.createElement("h4");h.textContent=u.original_filename+" · "+(u.public_project_code||"No project code");
   const meta=document.createElement("p");meta.className="muted";meta.textContent=u.uploader_name+" ("+u.role+") · "+u.email+" · "+u.purpose.replaceAll("_"," ");
   const progress=document.createElement("p");progress.textContent=(u.total_size_bytes/1024/1024).toFixed(1)+" MB · "+u.parts_uploaded+"/"+u.expected_parts+" parts · "+(u.total_size_bytes?Math.round(u.bytes_uploaded/u.total_size_bytes*100):0)+"% · "+u.status.replaceAll("_"," ");
   const date=document.createElement("small");date.textContent="Created "+new Date(u.created_at).toLocaleString()+" · Expires "+new Date(u.expires_at).toLocaleString();
   card.append(h,meta,progress,date);
   if(u.expired_open){const warning=document.createElement("p");warning.className="muted";warning.textContent="Expired session awaiting scheduled R2 cleanup.";card.append(warning);}
   root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
async function renderMultipartIncidentPanel(sessionId,container){
 const panel=document.createElement("section");panel.className="card";
 const heading=document.createElement("h4");heading.textContent="Incident & resolution history";
 const history=document.createElement("div");history.textContent="Loading incident history…";
 const form=document.createElement("form");form.className="form";
 const type=document.createElement("select");type.setAttribute("aria-label","Incident type");
 for(const [v,label] of [["upload_failed","Upload failed"],["unknown_completion","Unknown storage outcome"],["stale_completion","Stale completion"],["expired_session","Expired session"],["integrity_issue","Integrity/checksum issue"],["other","Other"]]){const o=document.createElement("option");o.value=v;o.textContent=label;type.append(o);}
 const status=document.createElement("select");status.setAttribute("aria-label","Resolution status");
 for(const [v,label] of [["reviewed","Reviewed"],["awaiting_user","Awaiting user"],["reupload_requested","Re-upload requested"],["resolved","Resolved"],["escalated","Escalated"]]){const o=document.createElement("option");o.value=v;o.textContent=label;status.append(o);}
 const notes=document.createElement("textarea");notes.maxLength=1000;notes.required=true;notes.placeholder="Record what was checked and the next step (max 1000 characters).";
 const submit=document.createElement("button");submit.className="btn dark";submit.type="submit";submit.textContent="Save resolution record";
 const hint=document.createElement("small");hint.className="muted";hint.textContent="Append-only audit trail. This records a decision only; it does not retry, abort, delete, or modify stored files.";
 form.append(type,status,notes,submit,hint);
 async function refresh(){
  const data=await api("/v1/admin/multipart-uploads/"+encodeURIComponent(sessionId)+"/incidents");history.replaceChildren();
  if(!data.incidents.length){history.textContent="No incident or resolution records yet.";return;}
  for(const event of data.incidents){const row=document.createElement("article");row.className="card";const title=document.createElement("strong");title.textContent=event.resolution_status.replaceAll("_"," ").toUpperCase()+" · "+event.incident_type.replaceAll("_"," ");const meta=document.createElement("small");meta.textContent=(event.actor_name||event.actor_email)+" · "+new Date(event.created_at).toLocaleString();const note=document.createElement("p");note.textContent=event.notes;row.append(title,meta,note);history.append(row);}
 }
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await api("/v1/admin/multipart-uploads/"+encodeURIComponent(sessionId)+"/incidents",{method:"POST",body:JSON.stringify({incident_type:type.value,resolution_status:status.value,notes:notes.value.trim()})});notes.value="";await refresh();}catch(err){alert("Could not save resolution: "+err.message);}finally{submit.disabled=false;}};
 panel.append(heading,history,form);container.append(panel);
 try{await refresh();}catch(err){history.textContent="Incident history unavailable: "+err.message;}
}
async function loadUploadHistory(targetId){
 const root=$(targetId);if(!root)return;root.textContent="Loading recent upload history…";
 try{
  const d=await api("/v1/uploads/multipart/history");root.replaceChildren();
  if(!d.uploads.length){root.textContent="No large-file upload sessions yet.";return;}
  for(const u of d.uploads){
   const card=document.createElement("article");card.className="card";
   const title=document.createElement("h3");title.textContent=u.original_filename;
   const progress=document.createElement("p");progress.className="muted";
   const percent=u.total_size_bytes?Math.min(100,Math.round(u.bytes_uploaded/u.total_size_bytes*100)):0;
   progress.textContent=(u.total_size_bytes/1024/1024).toFixed(1)+" MB · "+u.parts_uploaded+"/"+u.expected_parts+" parts · "+percent+"% uploaded";
   const status=document.createElement("p");status.className="tag "+(u.status==="completed"?"":"blue");status.textContent=u.status.replaceAll("_"," ");
   const date=document.createElement("small");date.textContent="Started: "+new Date(u.created_at).toLocaleString();
   card.append(title,progress,status,date);
   const canResume=u.status==="open"&&new Date(u.expires_at).getTime()>Date.now();
   const canRestart=u.status==="aborted"||(u.status==="open"&&new Date(u.expires_at).getTime()<=Date.now());
   if(canResume||canRestart){
    const picker=document.createElement("input");picker.type="file";picker.setAttribute("aria-label","Choose the original file");
    const action=document.createElement("button");action.className="btn outline";action.textContent=canResume?"Select same file to resume":"Select same file to start a fresh upload";action.disabled=true;
    picker.onchange=()=>{const f=picker.files?.[0];action.disabled=!f||f.name!==u.original_filename||f.size!==u.total_size_bytes;};
    const msg=document.createElement("p");msg.className="muted";msg.setAttribute("role","status");
    action.onclick=async()=>{const f=picker.files?.[0];if(!f||f.name!==u.original_filename||f.size!==u.total_size_bytes)return;action.disabled=true;try{await multipartUpload(f,{purpose:u.purpose,project_id:u.project_id,assignment_id:u.assignment_id},(sent,total,part,count)=>{msg.textContent=(canResume?"Resuming":"Starting fresh upload")+" · "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;},canResume?u.id:null,state=>{if(state.type==="retry")msg.textContent="Connection issue · retry "+state.attempt+"/3 · waiting "+Math.ceil(state.delay/1000)+"s";if(state.type==="completing")msg.textContent="Verifying uploaded parts…";if(state.type==="error")msg.textContent="Upload paused: "+state.message;});msg.textContent="Upload completed successfully.";await loadUploadHistory(targetId);}catch(e){msg.textContent=e.message;action.disabled=false;}};
    card.append(picker,action,msg);
   }else if(u.status==="unknown"||u.status==="completing"){
    const warning=document.createElement("p");warning.className="muted";warning.textContent="CSA review required before retry. Do not upload again until the storage outcome is checked, to avoid duplicate files.";card.append(warning);
   }else if(u.status==="completed"){
    const done=document.createElement("small");done.textContent="This upload is complete.";card.append(done);
   }
   root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
async function loadClientPortfolioShowcase(){
 const root=$("client-portfolio-showcase");if(!root)return;root.textContent="Loading approved editing samples…";
 try{
  const data=await api("/v1/client/editor-portfolio-videos");root.replaceChildren();
  if(!data.videos.length){root.textContent="No approved portfolio videos are available yet.";return;}
  for(const item of data.videos){
   const card=document.createElement("article");card.className="card";
   const title=document.createElement("h3");title.textContent=item.title;
   const meta=document.createElement("p");meta.className="muted";meta.textContent=item.category;
   const desc=document.createElement("p");desc.textContent=item.description;
   const video=document.createElement("video");video.controls=true;video.playsInline=true;video.preload="none";video.style.cssText="width:100%;max-height:340px;border-radius:10px;background:#111";
   const load=document.createElement("button");load.className="btn outline";load.textContent="Load sample video";
   load.onclick=async()=>{load.disabled=true;try{const response=await fetch(API+"/v1/client/editor-portfolio-videos/"+encodeURIComponent(item.id)+"/stream",{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Video preview is unavailable.");video.src=URL.createObjectURL(await response.blob());load.hidden=true;}catch(e){alert(e.message);load.disabled=false;}};
   card.append(title,meta,desc,load,video);root.append(card);
  }
 }catch(e){root.textContent="Showcase could not be loaded: "+e.message;}
}
async function loadClientFeedbackEligible(){
 const root=$("client-feedback-eligible");if(!root)return;root.textContent="Checking completed projects eligible for feedback…";
 try{
  const d=await api("/v1/client/feedback-eligible");root.replaceChildren();
  if(!Array.isArray(d.projects)||!d.projects.length){root.textContent="No completed project is currently awaiting your feedback.";return;}
  for(const project of d.projects){
   const card=document.createElement("article");card.className="card";
   const heading=document.createElement("h3");heading.textContent=project.title+" · "+project.public_project_code;
   const editor=document.createElement("p");editor.className="muted";editor.textContent="Editor: "+(project.editor_name||project.public_editor_code||"CSA verified Editor");
   const form=document.createElement("form");form.className="panel form";
   const fields=[["overall_rating","Overall experience"],["quality_rating","Editing quality"],["communication_rating","Communication"],["timeliness_rating","Delivery timeliness"]];
   const selects={};
   for(const [name,label] of fields){
    const wrap=document.createElement("div");wrap.className="field";
    const l=document.createElement("label");l.textContent=label+" *";
    const s=document.createElement("select");s.required=true;
    const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Select rating";s.append(placeholder);
    for(let n=5;n>=1;n--){const option=document.createElement("option");option.value=String(n);option.textContent=n+" / 5"+(n===5?" · Excellent":n===4?" · Very good":n===3?" · Good":n===2?" · Needs improvement":" · Poor");s.append(option);}
    wrap.append(l,s);form.append(wrap);selects[name]=s;
   }
   const reviewWrap=document.createElement("div");reviewWrap.className="field full";
   const reviewLabel=document.createElement("label");reviewLabel.textContent="Your review (optional, max 1,000 characters)";
   const review=document.createElement("textarea");review.maxLength=1000;review.rows=3;review.placeholder="Share your experience with CSA…";
   reviewWrap.append(reviewLabel,review);form.append(reviewWrap);
   const submit=document.createElement("button");submit.type="submit";submit.className="btn dark";submit.textContent="Submit verified feedback";
   const status=document.createElement("p");status.className="muted";status.setAttribute("role","status");
   form.append(submit,status);
   form.onsubmit=async event=>{
    event.preventDefault();if(Object.values(selects).some(s=>!s.value)){status.textContent="Please select all four ratings.";return;}
    submit.disabled=true;status.textContent="Submitting your feedback securely…";
    try{
     await api("/v1/client/projects/"+encodeURIComponent(project.project_id)+"/feedback",{method:"POST",body:JSON.stringify({assignment_id:project.assignment_id,overall_rating:Number(selects.overall_rating.value),quality_rating:Number(selects.quality_rating.value),communication_rating:Number(selects.communication_rating.value),timeliness_rating:Number(selects.timeliness_rating.value),review_text:review.value.trim()})});
     status.textContent="Thank you. Your verified feedback has been recorded.";
     await loadClientFeedbackEligible();
    }catch(e){status.textContent=e.message;submit.disabled=false;}
   };
   card.append(heading,editor,form);root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
async function loadNotifications(containerId){
 const root=$(containerId);if(!root)return;root.textContent="Loading notifications…";
 try{
  const d=await api("/v1/notifications");root.replaceChildren();
  const items=Array.isArray(d.notifications)?d.notifications:[];
  if(!items.length){root.textContent="You are all caught up. No notifications yet.";return;}
  const count=document.createElement("p");count.className="muted";count.textContent=(d.unread_count||0)+" unread notification(s)";root.append(count);
  for(const n of items){
   const card=document.createElement("article");card.className="card";
   const title=document.createElement("h4");const titles={editor_offer_received:"New project offer",editor_offer_accepted:"Editor accepted an offer",editor_terms_accepted:"Project agreement accepted",editor_deposit_verified:"Security deposit verified",client_editor_assigned:"Editor assigned to your project",editor_project_assigned:"New project assigned",client_work_submitted:"Work submitted for quality review"};title.textContent=titles[n.template_key]||String(n.template_key||"CSA update").replaceAll("_"," ");
   const message=document.createElement("p");message.textContent=n.payload?.message||n.payload?.title||"There is an update to your CSA project.";
   const meta=document.createElement("p");meta.className="muted";meta.textContent=new Date(n.created_at).toLocaleString()+" · "+(n.status==="read"?"Read":"Unread");
   card.append(title,message,meta);
   if(n.status!=="read"){const b=document.createElement("button");b.className="btn outline";b.textContent="Mark as read";b.onclick=async()=>{b.disabled=true;try{await api("/v1/notifications/"+encodeURIComponent(n.id)+"/read",{method:"POST",body:"{}"});await loadNotifications(containerId);}catch(e){message.textContent=e.message;b.disabled=false;}};card.append(b);}
   root.append(card);
  }
 }catch(e){root.textContent="Notifications unavailable: "+e.message;}
}
async function loadClientProjects(){
 loadNotifications("client-notifications");
 loadMyDisputes("client","client-disputes");
 const root=$("client-projects");if(!root)return;root.textContent="Loading your applications…";
 const statusInfo={
  submitted:{label:"Application received",step:1,detail:"Your application has been received by CSA and is awaiting review."},
  under_review:{label:"Under review",step:1,detail:"CSA is reviewing your application and requirements."},
  approved:{label:"Accepted by CSA",step:2,detail:"CSA has accepted your application. The submitted application is now locked."},
  matching:{label:"Accepted · Team matching",step:2,detail:"CSA has accepted your application and is arranging the project team."},
  assigned:{label:"Team assigned",step:3,detail:"Your project team has been assigned and work is moving forward."},
  in_progress:{label:"Work in progress",step:3,detail:"Your project is currently in progress."},
  quality_review:{label:"Quality review",step:4,detail:"CSA is checking the work before delivery."},
  client_review:{label:"Ready for your review",step:5,detail:"Your approved deliverables are ready for review."},
  revision:{label:"Final refinements",step:4,detail:"CSA is coordinating the requested refinements."},
  completed:{label:"Completed",step:5,detail:"Your project has been completed and delivered."},
  closed:{label:"Closed",step:5,detail:"This application is closed. Contact CSA if you need help."}
 };
 try{
  const d=await api("/v1/client/projects");root.replaceChildren();
  if(!d.projects.length){root.textContent="You have not submitted any applications yet.";return;}
  for(const p of d.projects){
   const c=document.createElement("article");c.className="card";
   const h=document.createElement("h3");h.textContent=p.title+" · "+p.public_project_code;
   const info=statusInfo[p.status]||{label:"Status: "+String(p.status||"update pending").replaceAll("_"," "),step:0,detail:"CSA is updating this application status. Contact CSA support if you need clarification."};
   const badge=document.createElement("span");badge.className="tag blue";badge.textContent=info.label;
   const meta=document.createElement("p");meta.className="muted";meta.textContent=p.category+" · "+(p.budget_amount_minor!=null?(Number(p.budget_amount_minor)/100)+" "+p.budget_currency:"Quotation pending")+" · Deadline: "+(p.preferred_deadline||"To be confirmed");
   const payment=document.createElement("p");payment.className="muted";const payLabels={quotation_pending:"Payment: Awaiting CSA quotation",created:"Payment: Payment link not generated",pending:"Payment: Pending confirmation",processing:"Payment: Processing",succeeded:"Payment: Paid",failed:"Payment: Failed",refunded:"Payment: Refunded",partially_refunded:"Payment: Partially refunded",reversed:"Payment: Reversed",cancelled:"Payment: Cancelled"};const paymentState=String(p.payment_status||"").trim().toLowerCase();payment.textContent=payLabels[paymentState]||(paymentState?"Payment: "+paymentState.replaceAll("_"," "):"Payment: Awaiting CSA quotation");
   const detail=document.createElement("p");detail.textContent=info.detail;
   const progress=document.createElement("div");progress.className="client-progress";progress.setAttribute("aria-label","Application progress");
   ["Application received","CSA review","Team & planning","Production","Quality & delivery"].forEach((name,index)=>{const item=document.createElement("span");item.className="client-progress-step"+(index+1<=info.step?" is-done":"");item.textContent=name;progress.append(item);});
   const timeline=document.createElement("section");timeline.className="panel";timeline.setAttribute("aria-label","Project activity timeline");
   const timelineTitle=document.createElement("h4");timelineTitle.textContent="Project Activity Timeline";
   const timelineList=document.createElement("ol");timelineList.className="project-timeline";
   timeline.append(timelineTitle,timelineList);
   try{
    const td=await api("/v1/client/projects/"+encodeURIComponent(p.id)+"/timeline");
    const labels={application_received:"Application received",status_changed:"Project status updated",editor_offer_created:"Editor offer issued",editor_offer_accepted:"Editor accepted offer",editor_assigned:"Editor assigned",payment_update:"Payment update",work_submitted:"Work submitted for quality review",revision_update:"Revision update"};
    for(const ev of (td.events||[])){
     const li=document.createElement("li");li.className="project-timeline-event";
     const name=document.createElement("strong");name.textContent=labels[ev.event_type]||"Project update";
     const date=document.createElement("time");date.dateTime=ev.created_at||"";date.textContent=ev.created_at?new Date(ev.created_at).toLocaleString():"Time unavailable";
     const description=document.createElement("p");
     if(ev.event_type==="status_changed")description.textContent=(ev.old_status?String(ev.old_status).replaceAll("_"," ")+" → ":"")+" "+String(ev.new_status||"updated").replaceAll("_"," ");
     else if(ev.event_type==="editor_assigned")description.textContent="Assigned to "+(ev.editor_name||"CSA Editor")+(ev.due_at?" · Due "+new Date(ev.due_at).toLocaleString():"");
     else if(ev.event_type==="payment_update")description.textContent=String(ev.payment_type||"payment").replaceAll("_"," ")+" · "+String(ev.status||"updated").replaceAll("_"," ")+(ev.amount_minor!=null?" · "+(Number(ev.amount_minor)/100)+" "+(ev.currency||""):"");
     else if(ev.event_type==="work_submitted")description.textContent="Version "+ev.version_number+" · Quality review: "+String(ev.status||"pending").replaceAll("_"," ");
     else if(ev.event_type==="revision_update")description.textContent="Revision request: "+String(ev.status||"open").replaceAll("_"," ");
     else if(ev.event_type==="editor_offer_created")description.textContent="Editor matching offer · Current offer status: "+String(ev.status||"offered").replaceAll("_"," ");
     else description.textContent=ev.event_type==="application_received"?"Your request entered CSA on this date.":"Your project record was updated.";
     li.append(name,date,description);timelineList.append(li);
    }
    if(!timelineList.children.length){const empty=document.createElement("p");empty.textContent="No additional activity has been recorded yet.";timeline.append(empty);}
   }catch(e){const msg=document.createElement("p");msg.className="muted";msg.textContent="Activity timeline is temporarily unavailable.";timeline.append(msg);}
   const section=document.createElement("section");section.className="panel";
   const heading=document.createElement("h4");heading.textContent="Your submitted application";
   const brief=document.createElement("p");brief.textContent=p.brief||"No additional brief supplied.";
   let req={};try{req=JSON.parse(p.requirements_json||"{}");}catch{}
   const rows=[
    ["Number of videos",p.video_count],["Raw footage",p.raw_footage_minutes!=null?p.raw_footage_minutes+" minutes":""],
    ["Final duration",p.final_duration_minutes!=null?p.final_duration_minutes+" minutes":""],["Resolution",p.resolution],
    ["Aspect ratio",p.aspect_ratio],["Budget type",p.budget_type],["Priority",p.priority],
    ["Included revisions",p.revisions_included],["Communication language",req.communication_language],
    ["Footage language",req.source_language],["Final video language",req.output_language],
    ["Subtitle / caption language",req.subtitle_languages],["Country",req.client_country],
    ["State / Province",req.client_region],["City",req.client_city],["Project mode",req.project_mode],
    ["Project / shoot location",req.project_location],["Time zone",req.client_timezone]
   ];
   const list=document.createElement("dl");list.className="application-details";
   for(const [label,value] of rows){if(value===null||value===undefined||String(value).trim()==="")continue;const wrap=document.createElement("div");const dt=document.createElement("dt");dt.textContent=label;const dd=document.createElement("dd");dd.textContent=String(value);wrap.append(dt,dd);list.append(wrap);}
   section.append(heading,brief,list);
   const referenceValue=String(req.reference_url||"").trim();
   if(referenceValue){
    try{
     const referenceUrl=new URL(referenceValue);
     if(referenceUrl.protocol==="https:"||referenceUrl.protocol==="http:"){
      const referenceWrap=document.createElement("p");referenceWrap.className="muted";
      const referenceLabel=document.createElement("strong");referenceLabel.textContent="Project reference: ";
      const referenceLink=document.createElement("a");referenceLink.href=referenceUrl.href;referenceLink.target="_blank";referenceLink.rel="noopener noreferrer";referenceLink.textContent="Open your reference link";
      referenceWrap.append(referenceLabel,referenceLink);section.append(referenceWrap);
     }
    }catch{}
   }
   const locked=Boolean(p.application_locked);
   const lockNote=document.createElement("p");lockNote.className="muted";
   lockNote.textContent=locked?"This application has been accepted by CSA and is now locked. You cannot edit or change the submitted application. For any clarification, contact CSA support.":"Your application is awaiting CSA acceptance. The submitted details are shown here for your reference.";
   c.append(h,badge,meta,payment,detail,progress,section,lockNote);
   try{
    const sourceFiles=await api("/v1/projects/"+p.id+"/files");
    if(sourceFiles.files?.length){
     const filesHeading=document.createElement("h4");filesHeading.textContent="Uploaded project files";c.append(filesHeading);
     for(const file of sourceFiles.files){
      const row=document.createElement("p");row.className="muted";row.textContent=file.original_filename+" · "+(Number(file.size_bytes||0)/1024/1024).toFixed(1)+" MB ";
      const dl=document.createElement("button");dl.className="btn outline";dl.textContent="Download";dl.onclick=async()=>{try{const r=await fetch(API+"/v1/files/"+encodeURIComponent(file.id),{headers:{authorization:"Bearer "+token}});if(!r.ok)throw Error("File download failed");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file.original_filename;a.click();URL.revokeObjectURL(url);}catch(e){alert(e.message);}};row.append(dl);c.append(row);
     }
    }
   }catch{}
   const uploadWrap=document.createElement("div");uploadWrap.className="panel";
   const uploadTitle=document.createElement("h4");uploadTitle.textContent="Upload more footage / references";
   const uploadInput=document.createElement("input");uploadInput.type="file";uploadInput.multiple=true;uploadInput.accept="video/*,audio/*,image/jpeg,image/png,application/pdf,application/zip";
   const uploadStatus=document.createElement("p");uploadStatus.className="muted";
   const uploadBtn=document.createElement("button");uploadBtn.className="btn outline";uploadBtn.textContent="Upload selected files";
   uploadBtn.onclick=async()=>{const chosen=Array.from(uploadInput.files||[]);if(!chosen.length){uploadStatus.textContent="Select files first.";return;}uploadBtn.disabled=true;try{for(const file of chosen){if(file.size>5*1024*1024*1024)throw Error(file.name+" exceeds the 5 GB upload limit.");if(file.size>90*1024*1024){await multipartUpload(file,{purpose:"project_file",project_id:p.id},(sent,total,part,count)=>{uploadStatus.textContent="Uploading "+file.name+" · Part "+part+"/"+count+" · "+Math.round(sent/total*100)+"%";});}else{const r=await fetch(API+"/v1/projects/"+encodeURIComponent(p.id)+"/files",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":file.type||"application/octet-stream","x-file-name":file.name},body:file});let d={};try{d=await r.json();}catch{}if(!r.ok)throw Error(d.error?.message||"Upload failed: "+file.name);}uploadStatus.textContent=file.name+" uploaded successfully.";}uploadInput.value="";await loadClientProjects();}catch(e){uploadStatus.textContent=e.message;}finally{uploadBtn.disabled=false;}};
   uploadWrap.append(uploadTitle,uploadInput,uploadBtn,uploadStatus);c.append(uploadWrap);
   try{
    const dls=await api("/v1/client/projects/"+p.id+"/deliverables");
    for(const file of dls.deliverables){
     const b=document.createElement("button");b.className="btn outline";b.textContent="Download approved file · "+file.original_filename;
     b.onclick=async()=>{const r=await fetch(API+"/v1/files/"+file.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Download failed");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=file.original_filename;a.click();URL.revokeObjectURL(url);};
     c.append(b);
    }
   }catch{}
   await renderProjectMessages(p.id,"client",c);
   buildDisputeForm(p.id,"client",c);
   root.append(c);
  }
 }catch(e){root.textContent=e.message;}
}
const editorReviewCounts={kyc:null,profile:null,portfolio:null};
$("admin-dispute-filter")?.addEventListener("change",loadAdminDisputes);
async function loadEditorReviewHistory(){
 const root=$("admin-editor-review-history");if(!root)return;root.textContent="Loading editor review history…";
 try{
  const data=await api("/v1/admin/editor-review-history?limit=100");
  const events=Array.isArray(data.events)?data.events:[];
  root.replaceChildren();
  if(!events.length){root.textContent="No editor review decisions have been recorded yet.";return;}
  const controls=document.createElement("div");controls.className="form";
  const search=document.createElement("input");search.type="search";search.placeholder="Search editor name, code, admin or note";search.setAttribute("aria-label","Search editor review history");
  const type=document.createElement("select");type.setAttribute("aria-label","Filter review type");
  for(const [v,label] of [["all","All review types"],["editor_kyc_reviewed","KYC decisions"],["editor_verification_updated","Profile decisions"],["editor_portfolio_video_reviewed","Portfolio decisions"],["editor_profile_correction_submitted","Profile corrections"],["editor_portfolio_video_resubmitted","Video resubmissions"]]){const o=document.createElement("option");o.value=v;o.textContent=label;type.append(o);}
  const list=document.createElement("div");
  const render=()=>{
   list.replaceChildren();
   const q=search.value.trim().toLocaleLowerCase();
   const filtered=events.filter(e=>(type.value==="all"||e.action===type.value)&&[e.display_name,e.public_editor_code,e.actor_email,e.review_note,e.review_status,e.action].some(v=>String(v||"").toLocaleLowerCase().includes(q)));
   if(!filtered.length){list.textContent="No matching review records.";return;}
   for(const event of filtered){
    const card=document.createElement("article");card.className="card";
    const title=document.createElement("h4");
    const kind=event.action==="editor_kyc_reviewed"?"KYC verification":event.action==="editor_verification_updated"?"Editor profile":event.action==="editor_portfolio_video_reviewed"?"Portfolio video":event.action==="editor_profile_correction_submitted"?"Profile correction submitted":event.action==="editor_portfolio_video_resubmitted"?"Portfolio video resubmitted":"Editor review";
    title.textContent=kind+" · "+String(event.review_status||"recorded").replaceAll("_"," ").toUpperCase();
    const meta=document.createElement("p");meta.className="muted";
    meta.textContent=(event.display_name||"Editor record")+(event.public_editor_code?" · "+event.public_editor_code:"")+" · Reviewed by "+(event.actor_email||"CSA Admin")+" · "+(event.created_at?new Date(event.created_at).toLocaleString():"Time unavailable");
    const note=document.createElement("p");note.textContent=event.review_note||"No review note was recorded.";
    card.append(title,meta,note);list.append(card);
   }
  };
  search.oninput=render;type.onchange=render;controls.append(search,type);root.append(controls,list);render();
 }catch(err){root.textContent="Editor review history unavailable: "+err.message;}
}
function updateEditorReviewSummary(kind,count,state="ready"){
 editorReviewCounts[kind]=state==="ready"?count:{state};
 const root=$("admin-editor-review-summary");if(!root)return;
 const rows=[["kyc","KYC documents"],["profile","Profile approvals"],["portfolio","Portfolio videos"]];
 root.replaceChildren();
 for(const [key,label] of rows){
  const card=document.createElement("div");card.className="stat";
  const small=document.createElement("small");small.textContent=label;
  const strong=document.createElement("strong");
  const value=editorReviewCounts[key];
  strong.textContent=typeof value==="number"?String(value):value?.state==="loading"?"Loading…":"Unavailable";
  const note=document.createElement("small");note.textContent=typeof value==="number"?(value===1?"1 item awaiting review":value+" items awaiting review"):value?.state==="loading"?"Fetching queue":"Queue could not be loaded";
  card.append(small,strong,note);root.append(card);
 }
}
async function loadPortfolioVideoReviews(){
 const root=$("admin-portfolio-videos");if(!root)return;updateEditorReviewSummary("portfolio",null,"loading");root.textContent="Loading submitted portfolio videos…";
 try{
  const data=await api("/v1/admin/editor-portfolio-videos?status=pending");updateEditorReviewSummary("portfolio",Array.isArray(data.videos)?data.videos.length:0);root.replaceChildren();
  if(!data.videos.length){root.textContent="No portfolio videos are waiting for review.";return;}
  for(const item of data.videos){
   const card=document.createElement("article");card.className="card";
   const h=document.createElement("h3");h.textContent=item.title+" · "+item.category;
   const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.country+" · "+(item.size_bytes/1024/1024).toFixed(1)+" MB · Terms v"+item.terms_version;
   const desc=document.createElement("p");desc.textContent=item.description;
   const consent=document.createElement("p");consent.className="muted";consent.textContent="Rights confirmed · Terms accepted "+new Date(item.terms_accepted_at).toLocaleString();
   const preview=document.createElement("button");preview.className="btn outline";preview.textContent="Load private preview";
   const player=document.createElement("video");player.controls=true;player.playsInline=true;player.preload="none";player.style.cssText="width:100%;max-height:360px;border-radius:10px";player.hidden=true;
   preview.onclick=async()=>{preview.disabled=true;try{const response=await fetch(API+"/v1/admin/editor-portfolio-videos/"+encodeURIComponent(item.id)+"/preview",{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Private preview could not be loaded.");const blob=await response.blob();player.src=URL.createObjectURL(blob);player.hidden=false;preview.textContent="Preview loaded";}catch(err){alert(err.message);preview.disabled=false;}};
   const note=document.createElement("textarea");note.maxLength=1000;note.placeholder="Rejection reason (required when rejecting)";
   const actions=document.createElement("div");actions.className="actions";
   for(const [status,label] of [["approved","Approve for Showcase"],["rejected","Reject Video"]]){
    const b=document.createElement("button");b.className=status==="approved"?"btn dark":"btn outline";b.textContent=label;
    b.onclick=async()=>{if(status==="rejected"&&!note.value.trim()){alert("Video reject karne ke liye clear reason likhna mandatory hai.");note.focus();return;}if(!confirm(label+"?"))return;b.disabled=true;try{await api("/v1/admin/editor-portfolio-videos/"+encodeURIComponent(item.id)+"/review",{method:"POST",body:JSON.stringify({status,note:note.value.trim()})});if(player.src)URL.revokeObjectURL(player.src);await loadEditorPerformance();
 loadPortfolioVideoReviews();loadAdminKycReviews();}catch(err){alert(err.message);b.disabled=false;}};
    actions.append(b);
   }
   card.append(h,meta,desc,consent,preview,player,note,actions);root.append(card);
  }
 }catch(e){updateEditorReviewSummary("portfolio",null,"error");root.textContent="Portfolio review queue unavailable: "+e.message;}
}
async function loadAdminKycReviews(){
 const root=$("admin-kyc-documents");if(!root)return;updateEditorReviewSummary("kyc",null,"loading");root.textContent="Loading private KYC review queue…";
 try{
  const data=await api("/v1/admin/editors/kyc/pending");updateEditorReviewSummary("kyc",Array.isArray(data.documents)?data.documents.length:0);root.replaceChildren();
  if(!data.documents.length){root.textContent="No KYC documents are awaiting review.";return;}
  for(const doc of data.documents){
   const card=document.createElement("article");card.className="card";
   const title=document.createElement("h3");title.textContent=doc.display_name+" · "+doc.public_editor_code;
   const meta=document.createElement("p");meta.className="muted";meta.textContent="Legal name: "+(doc.legal_name||"Not provided")+" · "+doc.email+" · "+doc.document_type.replaceAll("_"," ")+" · "+doc.country+" · "+(doc.size_bytes/1024/1024).toFixed(2)+" MB";
   const address=document.createElement("p");address.className="muted";
   const addressParts=[doc.address_line,doc.village,doc.city,doc.district,doc.state,doc.postal_code,doc.country].filter(Boolean);
   address.textContent="Address: "+(addressParts.join(", ")||"Not provided");
   const date=document.createElement("small");date.textContent="Submitted "+new Date(doc.created_at).toLocaleString()+" · Consent v"+doc.consent_version+" at "+new Date(doc.consented_at).toLocaleString()+" · Private KYC document";
   const actions=document.createElement("div");actions.className="actions";
   const preview=document.createElement("button");preview.className="btn outline";preview.textContent="Preview ID Document";
   preview.onclick=async()=>{const tab=window.open("about:blank","_blank");if(!tab){alert("Please allow pop-ups to preview the private KYC document.");return;}preview.disabled=true;try{const r=await fetch(API+"/v1/admin/editors/"+encodeURIComponent(doc.editor_id)+"/kyc-preview",{headers:{authorization:"Bearer "+token}});if(!r.ok)throw Error("Private KYC preview is unavailable.");const blob=await r.blob(),url=URL.createObjectURL(blob);tab.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(err){tab.close();alert(err.message);}finally{preview.disabled=false;}};
   const approve=document.createElement("button");approve.className="btn dark";approve.textContent="Verify KYC";
   approve.onclick=async()=>{if(!confirm("Confirm that the ID document matches the editor's submitted identity details?"))return;approve.disabled=true;try{await api("/v1/admin/editors/"+encodeURIComponent(doc.editor_id)+"/kyc-review",{method:"POST",body:JSON.stringify({status:"verified"})});loadAdmin();}catch(err){alert(err.message);approve.disabled=false;}};
   const reject=document.createElement("button");reject.className="btn outline";reject.textContent="Reject KYC";
   reject.onclick=async()=>{const note=prompt("Enter the reason. This will be shown to the editor for correction:");if(!note||!note.trim())return;reject.disabled=true;try{await api("/v1/admin/editors/"+encodeURIComponent(doc.editor_id)+"/kyc-review",{method:"POST",body:JSON.stringify({status:"rejected",note:note.trim()})});loadAdmin();}catch(err){alert(err.message);reject.disabled=false;}};
   actions.append(preview,approve,reject);card.append(title,meta,address,date,actions);root.append(card);
  }
 }catch(err){updateEditorReviewSummary("kyc",null,"error");root.textContent="KYC queue unavailable: "+err.message;}
}
async function openEditorReviewProfile(editorId){
 const root=$("admin-editor-detail");if(!root)return;
 root.replaceChildren();const loading=document.createElement("p");loading.textContent="Loading complete editor record…";root.append(loading);
 try{
  const data=await api("/v1/admin/editors/"+encodeURIComponent(editorId)+"/review-profile");
  const p=data.profile;if(!p)throw Error("Editor record was not returned.");
  root.replaceChildren();
  const section=(heading,items)=>{
   const wrap=document.createElement("section");wrap.className="card";
   const title=document.createElement("h4");title.textContent=heading;wrap.append(title);
   for(const [label,value] of items){const row=document.createElement("p");row.textContent=label+": "+(value===null||value===undefined||value===""?"Not provided":String(value));wrap.append(row);}
   root.append(wrap);
  };
  let langs=[],software=[],skills=[];
  for(const [raw,target] of [[p.languages_json,langs],[p.software_json,software],[p.specializations_json,skills]]){try{const a=JSON.parse(raw||"[]");if(Array.isArray(a))target.push(...a);}catch{}}
  section("Editor profile",[
   ["Name",p.display_name],["CSA Editor Code",p.public_editor_code],["Email",p.email],["Legal name",p.legal_name],
   ["Account status",p.account_status],["Profile approval",p.verification_status],["Country",p.country],["State / District", [p.state,p.district].filter(Boolean).join(" / ")],
   ["City / Village",[p.city,p.village].filter(Boolean).join(" / ")],["Address",[p.address_line,p.postal_code].filter(Boolean).join(", ")],
   ["Languages",langs.join(", ")],["Experience",p.experience_level],["Editing software",software.join(", ")],["Specializations",skills.join(", ")],
   ["Portfolio URL",p.portfolio_url],["Sample URL",p.sample_url],["Rate",p.rate_amount_minor!==null?(p.rate_amount_minor/100)+" "+(p.rate_currency||""):""],["Rate basis",p.rate_basis],["Availability",p.availability],["Timezone",p.timezone],["Reliability score",p.reliability_score],["Bio",p.bio],["Profile updated",p.updated_at]
  ]);
  const kycWrap=document.createElement("section");kycWrap.className="card";const kh=document.createElement("h4");kh.textContent="KYC review records";kycWrap.append(kh);
  if(!data.kyc_documents?.length){const empty=document.createElement("p");empty.textContent="No KYC documents found.";kycWrap.append(empty);}
  for(const doc of data.kyc_documents||[]){const row=document.createElement("p");row.textContent=[doc.document_type,doc.status,"Submitted "+(doc.created_at||""),"Reviewed "+(doc.reviewed_at||""),doc.review_note||""].filter(Boolean).join(" · ");kycWrap.append(row);}
  root.append(kycWrap);
  const portfolio=document.createElement("section");portfolio.className="card";const vh=document.createElement("h4");vh.textContent="Portfolio video records";portfolio.append(vh);
  if(!data.portfolio_videos?.length){const empty=document.createElement("p");empty.textContent="No portfolio videos found.";portfolio.append(empty);}
  for(const v of data.portfolio_videos||[]){const row=document.createElement("p");row.textContent=[v.title,v.category,v.review_status,"Client visible: "+(v.client_visible?"Yes":"No"),"Reviewed "+(v.reviewed_at||""),v.review_note||""].filter(Boolean).join(" · ");portfolio.append(row);}
  root.append(portfolio);
  const history=document.createElement("section");history.className="card";const ah=document.createElement("h4");ah.textContent="Complete review history";history.append(ah);
  if(!data.review_history?.length){const empty=document.createElement("p");empty.textContent="No review actions recorded for this editor yet.";history.append(empty);}
  for(const event of data.review_history||[]){const row=document.createElement("p");const action=event.action==="editor_kyc_reviewed"?"KYC":event.action==="editor_verification_updated"?"Profile":event.action==="editor_portfolio_video_reviewed"?"Portfolio":event.action;row.textContent=action+" · "+(event.review_status||"recorded")+" · "+(event.actor_email||"CSA Admin")+" · "+(event.created_at||"")+" · "+(event.review_note||"No note");history.append(row);}
  root.append(history);
 }catch(err){root.textContent="Editor detail could not be loaded: "+err.message;}
}
function renderPerformanceMetrics(root,record,adminMode=false){
 root.replaceChildren();
 const metrics=[
  ["Assigned projects",record.assigned_total],
  ["Completed projects",record.completed_total],
  ["Active projects",record.active_total],
  ["Overdue active projects",record.overdue_active],
  ["On-time completions",record.on_time_completions],
  ["Work submissions",record.submissions_total],
  ["QC changes requested",record.qc_changes_requested],
  ["Client revision requests",record.revision_requests],
  ["Project disputes",record.disputes],
  ["Cancelled / reassigned",record.cancelled_or_reassigned],["Average client rating",record.average_rating==null?"Not rated":Number(record.average_rating).toFixed(2)+" / 5"],["Verified client reviews",record.rating_count||0]
 ];
 if(adminMode){
  const title=document.createElement("h4");title.textContent=(record.display_name||"Editor")+" · "+(record.public_editor_code||"CSA Editor");root.append(title);
  const meta=document.createElement("p");meta.className="muted";meta.textContent=(record.email||"")+" · Account: "+(record.account_status||"unknown")+" · Profile: "+(record.verification_status||"unknown");root.append(meta);
 }
 const grid=document.createElement("div");grid.className="stats";
 for(const [label,value] of metrics){
  const card=document.createElement("div");card.className="stat";
  const small=document.createElement("small");small.textContent=label;
  const strong=document.createElement("strong");strong.textContent=typeof value==="string"?value:Number(value||0).toLocaleString();
  card.append(small,strong);grid.append(card);
 }
 root.append(grid);
 const note=document.createElement("p");note.className="muted";
 note.textContent="Ratings are collected only from verified clients after project completion. On-time completion count is based on recorded project completion history and assignment due dates.";
 root.append(note);
}
async function loadEditorClientFeedback(){
 const root=$("editor-feedback");if(!root)return;root.textContent="Loading verified client feedback…";
 try{
  const d=await api("/v1/editor/feedback"),s=d.summary||{};root.replaceChildren();
  const summary=document.createElement("p");summary.className="muted";summary.textContent="Average rating: "+(s.average_rating==null?"Not rated yet":Number(s.average_rating).toFixed(2)+" / 5")+" · "+Number(s.rating_count||0)+" verified review(s)";root.append(summary);
  for(const [label,key] of [["Editing quality","average_quality_rating"],["Communication","average_communication_rating"],["Delivery timeliness","average_timeliness_rating"]]){const p=document.createElement("p");p.className="muted";p.textContent=label+": "+(s[key]==null?"No ratings":Number(s[key]).toFixed(2)+" / 5");root.append(p);}
  for(const item of d.feedback||[]){const card=document.createElement("article");card.className="card";const title=document.createElement("h4");title.textContent=(item.title||"Completed project")+" · "+item.public_project_code;const rating=document.createElement("p");rating.textContent="Overall "+item.overall_rating+"/5 · Quality "+item.quality_rating+"/5 · Communication "+item.communication_rating+"/5 · Timeliness "+item.timeliness_rating+"/5";card.append(title,rating);if(item.review_text){const text=document.createElement("p");text.textContent=item.review_text;card.append(text);}const date=document.createElement("small");date.className="muted";date.textContent=new Date(item.created_at).toLocaleDateString();card.append(date);root.append(card);}
  if(!d.feedback?.length){const p=document.createElement("p");p.className="muted";p.textContent="You have not received a verified client review yet.";root.append(p);}
 }catch(e){root.textContent=e.message;}
}
async function loadAdminClientFeedback(){
 const root=$("admin-editor-feedback");if(!root)return;root.textContent="Loading verified feedback…";
 try{
  const d=await api("/v1/admin/editor-feedback?limit=100");root.replaceChildren();
  if(!d.feedback?.length){root.textContent="No verified client feedback has been submitted yet.";return;}
  for(const item of d.feedback){const card=document.createElement("article");card.className="card";const title=document.createElement("h4");title.textContent=(item.title||"Project")+" · "+item.public_project_code;const editor=document.createElement("p");editor.className="muted";editor.textContent="Editor: "+(item.editor_name||item.editor_email||"Unknown")+" · Client: "+(item.client_email||"");const rating=document.createElement("p");rating.textContent="Overall "+item.overall_rating+"/5 · Quality "+item.quality_rating+"/5 · Communication "+item.communication_rating+"/5 · Timeliness "+item.timeliness_rating+"/5";card.append(title,editor,rating);if(item.review_text){const review=document.createElement("p");review.textContent=item.review_text;card.append(review);}const date=document.createElement("small");date.className="muted";date.textContent=new Date(item.created_at).toLocaleString();card.append(date);root.append(card);}
 }catch(e){root.textContent=e.message;}
}
async function loadEditorAvailability(){
 const root=$("editor-availability");if(!root)return;root.textContent="Loading availability settings…";
 try{
  const d=await api("/v1/editor/availability"),a=d.availability||{};root.replaceChildren();
  const status=document.createElement("p");status.className="muted";status.textContent="Current status: "+(a.availability_status||"available").toUpperCase()+" · Active projects: "+(a.active_projects||0)+" · Open offers: "+(a.open_offers||0);root.append(status);
  const form=$("editor-availability-form");if(!form)return;form.elements.availability_status.value=a.availability_status||"available";form.elements.max_concurrent_projects.value=String(a.max_concurrent_projects||2);form.elements.availability_note.value=a.availability_note||"";
  const msg=$("editor-availability-message");form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;msg.textContent="Saving your availability…";try{const body={availability_status:form.elements.availability_status.value,max_concurrent_projects:Number(form.elements.max_concurrent_projects.value),availability_note:form.elements.availability_note.value.trim()};await api("/v1/editor/availability",{method:"PUT",body:JSON.stringify(body)});msg.textContent="Availability settings saved.";await loadEditorAvailability();}catch(err){msg.textContent=err.message;}finally{button.disabled=false;}};
 }catch(e){root.textContent=e.message;}
}
async function loadAdminEditorWorkload(){
 const root=$("admin-editor-workload");if(!root)return;root.textContent="Loading editor availability and workload…";
 try{const d=await api("/v1/admin/editor-workload");root.replaceChildren();if(!Array.isArray(d.editors)||!d.editors.length){root.textContent="No editor profiles are registered yet.";return;}
  for(const e of d.editors){const card=document.createElement("article");card.className="card";const title=document.createElement("h4");title.textContent=(e.display_name||e.public_editor_code||"Editor")+" · "+String(e.availability_status||"available").toUpperCase();const stats=document.createElement("p");stats.textContent="Profile: "+(e.verification_status||"pending")+" · Account: "+(e.account_status||"unknown")+" · Active projects: "+(e.active_projects||0)+" · Open offers: "+(e.open_offers||0)+" · Workload: "+(e.workload||0)+" / "+(e.max_concurrent_projects||2);card.append(title,stats);if(e.availability_note){const note=document.createElement("p");note.className="muted";note.textContent="Editor note: "+e.availability_note;card.append(note);}root.append(card);}
 }catch(e){root.textContent=e.message;}
}
async function loadEditorPerformance(){
 const root=$("admin-editor-performance");if(!root)return;root.textContent="Loading editor performance records…";
 try{
  const d=await api("/v1/admin/editor-performance");root.replaceChildren();
  if(!Array.isArray(d.editors)||!d.editors.length){root.textContent="No editor performance records available yet.";return;}
  for(const record of d.editors){const card=document.createElement("article");card.className="card";renderPerformanceMetrics(card,record,true);root.append(card);}
 }catch(e){root.textContent=e.message;}
}
async function loadMyEditorPerformance(){
 const root=$("editor-performance");if(!root)return;root.textContent="Loading your performance…";
 try{const d=await api("/v1/editor/performance");renderPerformanceMetrics(root,d.performance||{});await loadEditorClientFeedback();}catch(e){root.textContent=e.message;}
}
async function loadAdminProjectOffers(){
 const root=$("admin-project-offers");if(!root)return;root.textContent="Loading offer history…";
 try{
  const d=await api("/v1/admin/project-offers");root.replaceChildren();
  if(!Array.isArray(d.offers)||!d.offers.length){root.textContent="No project offers have been created yet.";return;}
  for(const o of d.offers){
   const card=document.createElement("article");card.className="card";
   const h=document.createElement("h4");h.textContent=(o.title||"Project")+" · "+(o.public_project_code||o.project_id);
   const meta=document.createElement("p");meta.textContent=(o.display_name||o.public_editor_code||o.editor_email)+" · Status: "+String(o.status).replaceAll("_"," ")+" · Fee "+(o.proposed_fee_minor/100)+" "+o.fee_currency+" · Deposit "+(o.deposit_amount_minor/100)+" "+o.deposit_currency+" · "+o.delivery_days+" days";
   const details=document.createElement("p");details.className="muted";details.textContent="Created: "+new Date(o.created_at).toLocaleString()+" · Expires: "+(o.offer_expires_at?new Date(o.offer_expires_at).toLocaleString():"Not set")+" · Payment: "+(o.payment_status||"not initiated")+" · Project: "+(o.project_status||"unknown");
   card.append(h,meta,details);
   if(["offered","accepted_pending_terms"].includes(o.status)){
    const cancel=document.createElement("button");cancel.className="btn outline";cancel.textContent="Cancel Offer";cancel.onclick=async()=>{const reason=prompt("Reason for cancelling this offer:");if(reason===null)return;if(!reason.trim()){alert("Cancellation reason is required.");return;}cancel.disabled=true;try{await api("/v1/admin/offers/"+o.id+"/cancel",{method:"POST",body:JSON.stringify({reason:reason.trim()})});await loadAdminProjectOffers();}catch(e){alert(e.message);cancel.disabled=false;}};card.append(cancel);
   }
   root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
async function loadAdmin(){
 loadNotifications("admin-notifications");
 loadAdminDisputes();
 const metrics=$("admin-metrics"),projects=$("admin-projects"),editors=$("admin-editors"),ready=$("admin-ready");
 loadPortfolioVideoReviews();
 loadAdminKycReviews();
 loadEditorReviewHistory();
 loadEditorPerformance();
 loadAdminEditorWorkload();
 loadAdminProjectOffers();
 loadAdminClientFeedback();
 try{
  updateEditorReviewSummary("profile",null,"loading");
  const [overview,pj,pe,ve,ro,qc,rf]=await Promise.all([
   api("/v1/admin/overview"),api("/v1/admin/projects"),api("/v1/admin/editors/pending"),api("/v1/admin/editors/verified"),api("/v1/admin/offers/ready"),api("/v1/admin/submissions/pending"),api("/v1/admin/deposits/refunds/eligible")
  ]);
  updateEditorReviewSummary("profile",Array.isArray(pe.editors)?pe.editors.length:0);
  metrics.replaceChildren();
  for(const [label,value] of Object.entries({Projects:overview.metrics.projects_to_review,EditorsPending:overview.metrics.editors_pending,ActiveAssignments:overview.metrics.active_assignments,OpenDisputes:overview.metrics.open_disputes})){
   const card=document.createElement("div");card.className="stat";const small=document.createElement("small");small.textContent=label;const strong=document.createElement("strong");strong.textContent=value;card.append(small,strong);metrics.append(card);
  }
  projects.replaceChildren();
  if(!pj.projects.length)projects.textContent="No projects are waiting in the managed queue.";
  for(const p of pj.projects){
   const card=document.createElement("article");card.className="card";
   const h=document.createElement("h3");h.textContent=p.title+" · "+p.public_project_code;
   const desc=document.createElement("p");desc.textContent=p.brief;
   const meta=document.createElement("p");meta.className="muted";meta.textContent="Client budget: "+(p.budget_amount_minor/100)+" "+p.budget_currency+" · "+p.category+" · "+p.status+" · Deadline: "+(p.preferred_deadline||"Not set");
   let req={};try{req=JSON.parse(p.requirements_json||"{}");}catch{}
   const langLoc=document.createElement("p");langLoc.className="muted";langLoc.textContent="Languages: "+[req.communication_language&&("Communication: "+req.communication_language),req.source_language&&("Source: "+req.source_language),req.output_language&&("Output: "+req.output_language),req.subtitle_languages&&("Captions: "+req.subtitle_languages)].filter(Boolean).join(" · ")+" | Location: "+[req.client_city,req.client_region,req.client_country].filter(Boolean).join(", ")+(req.project_mode?" · "+req.project_mode:"")+(req.project_location?" · Project site: "+req.project_location:"");
   card.append(h,desc,meta,langLoc);
   if(req.reference_url){try{const reference=new URL(req.reference_url);if(["https:","http:"].includes(reference.protocol)){const link=document.createElement("a");link.href=reference.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open client reference";card.append(link);}}catch{}}
   if(["submitted","under_review","approved","matching"].includes(p.status)){
    const form=document.createElement("div");form.className="form";
    const editorSelect=document.createElement("select");editorSelect.setAttribute("aria-label","Verified editor");
    const first=document.createElement("option");first.value="";first.textContent="Select approved, KYC-verified editor";editorSelect.append(first);
    const normalizeLang=v=>String(v||"").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
    const requestedLangs=String(req.source_language||"").split(/[,;+|]/).map(normalizeLang).filter(Boolean);
    const eligibleEditors=ve.editors.filter(x=>x.account_status==="active"&&x.kyc_status==="verified"&&x.verification_status==="verified").map(e=>{let langs=[];try{langs=JSON.parse(e.languages_json||"[]");}catch{}const normalized=langs.map(normalizeLang).filter(Boolean);const matched=requestedLangs.length>0&&requestedLangs.some(want=>normalized.some(have=>have===want||have.startsWith(want+" ")||want.startsWith(have+" ")));return {...e,editorLanguages:langs,languageMatched:matched};}).sort((a,b)=>Number(b.languageMatched)-Number(a.languageMatched)||a.display_name.localeCompare(b.display_name));
    const matchedEditors=eligibleEditors.filter(e=>e.languageMatched);
    const matchNote=document.createElement("p");matchNote.className="muted";
    if(requestedLangs.length){matchNote.textContent=matchedEditors.length+" verified editor(s) match source language: "+requestedLangs.join(", ")+". Only active editors with verified KYC and approved profiles are listed. Language-matched editors appear first; CSA Admin must still review and select the editor.";}
    else{matchNote.textContent="Source language is not specified. Add it to the project brief to enable language-based editor recommendations.";}
    form.append(matchNote);
    const rankButton=document.createElement("button");rankButton.type="button";rankButton.className="btn outline";rankButton.textContent="Find best-matched Editors";
    const rankStatus=document.createElement("p");rankStatus.className="muted";rankStatus.setAttribute("role","status");
    const rankDetails=document.createElement("div");rankDetails.className="muted";
    rankButton.onclick=async()=>{
     rankButton.disabled=true;rankButton.textContent="Calculating Editor Ranking…";rankStatus.textContent="Checking KYC, specialization, language, verified ratings, delivery history, portfolio and workload.";
     try{
      const ranking=await api("/v1/admin/editor-ranking?project_id="+encodeURIComponent(p.id));
      const ranked=Array.isArray(ranking.editors)?ranking.editors:[];
      editorSelect.replaceChildren(first);
      if(!ranked.length){rankStatus.textContent="No eligible Editor is currently available. Check KYC, profile approval, active account and existing project offers.";rankDetails.replaceChildren();return;}
      for(const e of ranked){
       const option=document.createElement("option");option.value=e.id;
       option.textContent="#"+e.rank+" · "+Number(e.score).toFixed(1)+"/100 · "+e.public_editor_code+" · "+e.display_name+" · "+(e.rating_count>=3?"Rating "+Number(e.average_rating).toFixed(2)+"/5":"New rating history")+" · Active "+Number(e.active_total||0);
       editorSelect.append(option);
      }
      editorSelect.value=ranked[0].id;
      rankStatus.textContent="Top recommendation: "+ranked[0].display_name+" · "+Number(ranked[0].score).toFixed(1)+"/100. This is a recommendation only; CSA Admin makes the final selection.";
      rankDetails.replaceChildren();
      for(const e of ranked.slice(0,5)){
       const card=document.createElement("section");card.className="card";
       const line=document.createElement("h4");line.textContent="#"+e.rank+" "+e.display_name+" — "+Number(e.score).toFixed(1)+"/100";
       const capacity=document.createElement("p");capacity.textContent="Available · Workload "+Number(e.workload||0)+" / "+Number(e.capacity||e.max_concurrent_projects||2)+" · Remaining capacity "+Number(e.remaining_capacity||0)+" · Open offers "+Number(e.open_offers||0);
       const ratings=document.createElement("p");ratings.textContent=e.rating_count>=3?"Verified client rating: "+Number(e.average_rating).toFixed(2)+"/5 ("+e.rating_count+" reviews)":"Rating evidence: "+Number(e.rating_count||0)+" review(s); neutral ranking score used";
       const breakdown=document.createElement("p");const b=e.score_breakdown||{};breakdown.textContent="Score breakdown — Skill "+Number(b.specialization||0)+"/25 · Language "+Number(b.language||0)+"/15 · Ratings "+Number(b.ratings||0)+"/20 · Reliability "+Number(b.reliability||0)+"/20 · Portfolio "+Number(b.portfolio||0)+"/10 · Workload "+Number(b.workload||0)+"/10";
       const why=document.createElement("p");why.className="muted";why.textContent=(e.reasons||[]).join(" · ");
       card.append(line,capacity,ratings,breakdown,why);rankDetails.append(card);
      }
      const note=document.createElement("p");note.className="muted";note.textContent="Scoring: specialization 25, language 15, verified client ratings 20, reliability 20, approved portfolio 10, workload 10. Ratings and delivery history use neutral scores until enough evidence exists; 3 client ratings are required before ratings affect ranking.";
      rankDetails.append(note);
     }catch(err){rankStatus.textContent="Ranking unavailable: "+err.message;}
     finally{rankButton.disabled=false;rankButton.textContent="Refresh Editor Ranking";}
    };
    form.append(rankButton,rankStatus,rankDetails);
    for(const e of eligibleEditors){const opt=document.createElement("option");opt.value=e.id;opt.textContent=(e.languageMatched?"✓ LANGUAGE MATCH · ":"")+e.public_editor_code+" · "+e.display_name+" · "+[e.city,e.country].filter(Boolean).join(", ")+" · "+(e.editorLanguages.join("/")||"Languages not listed");editorSelect.append(opt);}
    if(matchedEditors.length)editorSelect.value=matchedEditors[0].id;
    const fee=document.createElement("input");fee.type="number";fee.min="0.01";fee.step="0.01";fee.placeholder="Editor fee in "+p.budget_currency;
    const deposit=document.createElement("input");deposit.type="number";deposit.min="0.01";deposit.step="0.01";deposit.placeholder="Security deposit in "+p.budget_currency;
    const days=document.createElement("input");days.type="number";days.min="1";days.value="5";days.placeholder="Delivery days";
    const msg=document.createElement("input");msg.placeholder="Offer instructions (optional)";
    const send=document.createElement("button");send.className="btn dark";send.textContent="Send Managed Offer";
    send.onclick=async()=>{const feeValue=Number(fee.value),depositValue=Number(deposit.value),deliveryDays=Number(days.value);if(!editorSelect.value||!Number.isFinite(feeValue)||feeValue<=0||!Number.isFinite(depositValue)||depositValue<=0||!Number.isInteger(deliveryDays)||deliveryDays<1){alert("Select an active, KYC-verified editor and enter a valid positive fee, refundable deposit and delivery period of at least 1 day.");return;}send.disabled=true;try{await api("/v1/admin/projects/"+p.id+"/offers",{method:"POST",body:JSON.stringify({editor_id:editorSelect.value,proposed_fee_minor:Math.round(feeValue*100),fee_currency:p.budget_currency,deposit_amount_minor:Math.round(depositValue*100),deposit_currency:p.budget_currency,delivery_days:deliveryDays,offer_message:msg.value})});alert("Project offer sent to selected editor.");loadAdmin();}catch(e){alert(e.message);send.disabled=false;}};
    form.append(editorSelect,fee,deposit,days,msg,send);card.append(form);
   }
   await renderProjectMessages(p.id,"admin",card);
   projects.append(card);
  }
  editors.replaceChildren();
  if(!pe.editors.length)editors.textContent="No editor profiles are awaiting verification, or no editor currently meets all active-account, verified-KYC and approved-profile requirements.";
  for(const e of pe.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";meta.textContent="Legal name: "+(e.legal_name||"Not provided")+" · "+e.email+" · "+e.country+" · Profile: "+e.verification_status+" · KYC: "+(e.kyc_status||"not_submitted");const portfolio=document.createElement("a");portfolio.href=e.portfolio_url;portfolio.target="_blank";portfolio.rel="noopener noreferrer";portfolio.textContent="Review portfolio";const skills=document.createElement("p");skills.textContent=JSON.parse(e.specializations_json||"[]").join(", ");const approve=document.createElement("button");approve.className="btn dark";approve.textContent=e.kyc_status==="verified"?"Verify profile":"Awaiting verified KYC";approve.disabled=e.kyc_status!=="verified";approve.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"verified"})});loadAdmin();}catch(err){alert(err.message);}};const reject=document.createElement("button");reject.className="btn outline";reject.textContent="Reject";reject.onclick=async()=>{const note=prompt("Editor profile reject karne ka reason likhein. Ye reason Editor ko correction ke liye dikhaya jayega:");if(note===null)return;if(!note.trim()){alert("Rejection reason zaroori hai.");return;}try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"rejected",note:note.trim()})});loadAdmin();}catch(err){alert(err.message);}};const detail=document.createElement("button");detail.className="btn outline";detail.textContent="View full editor record";detail.onclick=()=>openEditorReviewProfile(e.id);card.append(h,meta,portfolio,skills,detail,approve,reject);editors.append(card);}for(const e of ve.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";let verifiedLangs=[];try{verifiedLangs=JSON.parse(e.languages_json||"[]");}catch{}meta.textContent="Verified · "+e.country+" · "+e.public_editor_code+" · Languages: "+(verifiedLangs.join(", ")||"Not listed");const issue=document.createElement("button");issue.className="btn dark";issue.textContent="Issue / Reset CSA Login";issue.onclick=async()=>{if(!confirm("Generate a one-time temporary password for "+e.display_name+"? The previous password will stop working."))return;try{const d=await api("/v1/admin/editors/"+e.id+"/credentials",{method:"POST",body:"{}"});const message="CSA Editor User ID: "+d.username+"\nTemporary Password: "+d.temporary_password+"\n\nThis password is shown once. Share securely and ask editor to change it on first login.";alert(message);await navigator.clipboard?.writeText(message);}catch(err){alert(err.message);}};const detail=document.createElement("button");detail.className="btn outline";detail.textContent="View full editor record";detail.onclick=()=>openEditorReviewProfile(e.id);card.append(h,meta,detail,issue);editors.append(card);}
  ready.replaceChildren();
  if(!ro.offers.length)ready.textContent="No captured deposits waiting for assignment.";
  for(const o of ro.offers){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=o.title+" · "+o.public_project_code;const meta=document.createElement("p");meta.textContent=o.public_editor_code+" · Deposit captured · Fee "+(o.proposed_fee_minor/100)+" "+o.fee_currency;const assign=document.createElement("button");assign.className="btn dark";assign.textContent="Confirm Assignment";assign.onclick=async()=>{try{await api("/v1/admin/offers/"+o.id+"/assign",{method:"POST",body:"{}"});alert("Assignment confirmed.");loadAdmin();}catch(e){alert(e.message);}};card.append(h,meta,assign);ready.append(card);}
  const qcRoot=$("admin-submissions");if(qcRoot){qcRoot.replaceChildren();if(!qc.submissions.length)qcRoot.textContent="No submissions waiting for quality review.";for(const item of qc.submissions){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Version "+item.version_number+" · Submitted "+item.submitted_at;const notes=document.createElement("p");notes.textContent=(item.notes||"No submission notes.")+" · "+(item.original_filename||"Submission file")+" · "+Math.round((item.size_bytes||0)/1024/1024*10)/10+" MB";const download=document.createElement("button");download.className="btn outline";download.textContent="Download for QC review";download.onclick=async()=>{try{const response=await fetch(API+"/v1/files/"+item.id,{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Submission download denied");const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=item.original_filename||"submission";link.click();URL.revokeObjectURL(url);}catch(err){alert(err.message);}};const actions=document.createElement("div");actions.className="actions";for(const [status,label] of [["approved","Quality Approve"],["changes_requested","Request Changes"],["rejected","Reject Submission"]]){const b=document.createElement("button");b.className=status==="approved"?"btn dark":"btn outline";b.textContent=label;b.onclick=async()=>{if(!confirm(label+" for "+item.public_project_code+"?"))return;b.disabled=true;try{await api("/v1/admin/submissions/"+item.id+"/review",{method:"POST",body:JSON.stringify({status})});loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};actions.append(b);}card.append(h,meta,notes,download,actions);qcRoot.append(card);}}
  const refundRoot=$("admin-refunds");if(refundRoot){refundRoot.replaceChildren();if(!rf.eligible.length)refundRoot.textContent="No security deposits are currently eligible for refund.";for(const item of rf.eligible){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Deposit "+(item.amount_minor/100)+" "+item.currency;const approved=document.createElement("p");approved.textContent="CSA quality approved: "+item.quality_approved_at;const b=document.createElement("button");b.className="btn dark";b.textContent="Initiate Full Deposit Refund";b.onclick=async()=>{if(!confirm("Initiate full refund of "+(item.amount_minor/100)+" "+item.currency+" to the original payment method?"))return;b.disabled=true;try{const result=await api("/v1/admin/deposits/"+item.payment_id+"/refund",{method:"POST",body:"{}"});alert("Razorpay refund status: "+result.status+" · Refund ID: "+result.provider_refund_id);loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};card.append(h,meta,approved,b);refundRoot.append(card);}}
 }catch(e){updateEditorReviewSummary("profile",null,"error");metrics.textContent="Admin data could not be loaded: "+e.message;}
}
async function loadAssignments(){
 loadMyDisputes("editor","editor-disputes");
 const root=$("assignments");if(!root)return;root.textContent="Loading assignments…";
 try{const d=await api("/v1/editor/assignments");root.replaceChildren();if(!d.assignments.length){root.textContent="No active assignments yet.";return;}for(const a of d.assignments){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=a.title+" · "+a.public_project_code;const p=document.createElement("p");p.textContent=a.brief;const meta=document.createElement("p");meta.className="muted";meta.textContent="Due: "+a.due_at+" · Status: "+a.status;try{const sourceFiles=await api("/v1/projects/"+a.project_id+"/files");for(const sf of sourceFiles.files){const dl=document.createElement("button");dl.className="btn outline";dl.textContent="Download source: "+sf.original_filename;dl.onclick=async()=>{const r=await fetch(API+"/v1/files/"+sf.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Source download denied");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=sf.original_filename;a.click();URL.revokeObjectURL(url);};c.append(dl);}}catch{}const file=document.createElement("input");file.type="file";file.accept="video/*,audio/*,image/*,application/pdf,application/zip";const note=document.createElement("input");note.placeholder="Submission notes (optional)";const b=document.createElement("button");b.className="btn dark";b.textContent="Submit work to CSA";b.onclick=async()=>{const f=file.files[0];if(!f){alert("Select a file first.");return;}if(f.size>5*1024*1024*1024){alert("Upload limit is 5 GB per file.");return;}try{if(f.size>90*1024*1024){b.disabled=true;b.textContent="Uploading…";await multipartUpload(f,{purpose:"submission",assignment_id:a.id,notes:note.value},(sent,total,part,count)=>{b.textContent="Uploading "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;},null,state=>{if(state.type==="retry")b.textContent="Retrying · "+state.attempt+"/3 · "+Math.ceil(state.delay/1000)+"s";if(state.type==="completing")b.textContent="Verifying upload…";});}else{const r=await fetch(API+"/v1/assignments/"+a.id+"/submissions",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":f.type||"application/octet-stream","x-file-name":f.name,"x-submission-notes":note.value},body:f});const result=await r.json();if(!r.ok)throw Error(result.error?.message||"Upload failed");}alert("Work submitted to CSA for quality review.");loadAssignments();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Submit work to CSA";}};c.append(h,p,meta,file,note,b);buildDisputeForm(a.project_id,"editor",c);root.append(c);}}catch(e){root.textContent=e.message;}
}
async function loadEditorRefunds(){
 const root=$("editor-refunds");if(!root)return;root.textContent="Loading deposit refund status…";
 try{const d=await api("/v1/editor/deposit-refunds");root.replaceChildren();if(!d.refunds.length){root.textContent="No deposit refund requests yet. Your deposit will become eligible after CSA quality approval.";return;}for(const r of d.refunds){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=r.title+" · "+r.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent="Refund amount: "+(r.amount_minor/100)+" "+r.currency+" · Status: "+r.status;const ref=document.createElement("p");ref.textContent=r.provider_refund_id?"Razorpay Refund ID: "+r.provider_refund_id:"Razorpay refund reference will appear once available.";c.append(h,meta,ref);root.append(c);}}catch(e){root.textContent=e.message;}
}
async function loadOffers(){
 loadNotifications("editor-notifications");
 const root=$("offers");root.textContent="Loading invitations…";
 try{
  const d=await api("/v1/editor/offers");root.replaceChildren();
  if(!d.offers.length){root.textContent="Abhi koi project invitation nahi hai. CSA suitable project aane par offer bhejega.";return;}
  for(const o of d.offers){
   const card=document.createElement("article");card.className="card";
   const h=document.createElement("h3");h.textContent=o.title+" · "+o.public_project_code;card.append(h);
   let req={};try{req=JSON.parse(o.requirements_json||"{}");}catch{}
   const langLoc=document.createElement("p");langLoc.className="muted";langLoc.textContent="Languages — Source: "+(req.source_language||"Not specified")+" · Output: "+(req.output_language||"Not specified")+" · Captions: "+(req.subtitle_languages||"Not specified")+" | Location: "+[req.client_city,req.client_region,req.client_country].filter(Boolean).join(", ")+(req.project_mode?" · "+req.project_mode:"")+(req.project_location?" · Site: "+req.project_location:"");
   card.append(langLoc);
   if(o.status==="offered"){
    const b=document.createElement("button");b.className="btn dark";b.textContent="Accept Project";
    b.onclick=async()=>{b.disabled=true;try{await api("/v1/offers/"+o.id+"/accept",{method:"POST",body:"{}"});await loadOffers();}catch(e){alert(e.message);b.disabled=false;}};
    const reject=document.createElement("button");reject.className="btn outline";reject.textContent="Decline Offer";reject.onclick=async()=>{if(!confirm("Decline this CSA project offer?"))return;const reason=prompt("Optional reason for declining:")||"";reject.disabled=true;try{await api("/v1/offers/"+o.id+"/reject",{method:"POST",body:JSON.stringify({reason})});await loadOffers();}catch(e){alert(e.message);reject.disabled=false;}};card.append(b,reject);
   }
   if(o.offer_expires_at){const expiry=document.createElement("p");expiry.className="muted";expiry.textContent="Offer expires: "+new Date(o.offer_expires_at).toLocaleString();card.append(expiry);}
   if(o.status==="accepted_pending_terms"){
    const meta=document.createElement("p");meta.className="muted";
    meta.textContent="Project fee: "+(o.proposed_fee_minor/100)+" "+o.fee_currency+" · Delivery: "+o.delivery_days+" days · Refundable security deposit: "+(o.deposit_amount_minor/100)+" "+o.deposit_currency;
    const intro=document.createElement("p");intro.textContent="Please read the complete approved CSA project agreement below before accepting.";
    const select=document.createElement("select");select.setAttribute("aria-label","Project agreement version");
    const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Loading approved agreement…";select.append(placeholder);
    const body=document.createElement("pre");body.style.whiteSpace="pre-wrap";body.style.maxHeight="360px";body.style.overflow="auto";body.style.padding="14px";body.style.border="1px solid #e5e9f0";body.style.borderRadius="8px";body.style.background="#f8fafc";body.textContent="Loading agreement text…";
    const label=document.createElement("label"),agree=document.createElement("input");agree.type="checkbox";label.append(agree,document.createTextNode(" I have read and accept this complete CSA project agreement."));
    const message=document.createElement("p");message.className="muted";message.setAttribute("role","status");
    const b=document.createElement("button");b.className="btn dark";b.textContent="Accept Terms & Continue";b.disabled=true;
    let agreements=[];
    const showAgreement=()=>{const a=agreements.find(x=>x.id===select.value);body.textContent=a?.body_markdown||"Select an approved agreement to read its full terms.";b.disabled=!a;agree.checked=false;};
    select.onchange=showAgreement;
    b.onclick=async()=>{if(!agree.checked||!select.value){alert("Please read the agreement and tick the acceptance checkbox.");return;}b.disabled=true;try{await api("/v1/offers/"+o.id+"/terms",{method:"POST",body:JSON.stringify({accept:true,agreement_version_id:select.value})});await loadOffers();}catch(e){alert(e.message);b.disabled=false;}};
    card.append(meta,intro,select,body,label,b,message);
    api("/v1/editor/agreements").then(result=>{
     agreements=result.agreements||[];select.replaceChildren();
     if(!agreements.length){const opt=document.createElement("option");opt.value="";opt.textContent="No approved project agreement is active yet";select.append(opt);body.textContent="CSA has not published an approved project agreement yet. Please wait; no deposit can be paid until the agreement is published.";message.textContent="This offer is paused until CSA activates the legally reviewed project agreement.";b.disabled=true;return;}
     for(const a of agreements){const opt=document.createElement("option");opt.value=a.id;opt.textContent=a.title+" (v"+a.version+")";select.append(opt);}
     showAgreement();
    }).catch(()=>{select.replaceChildren();body.textContent="Could not load the agreement. Please refresh and try again.";message.textContent="Agreement details are unavailable.";b.disabled=true;});
   }
   if(o.status==="terms_accepted_pending_deposit"||o.status==="deposit_pending"){
    const meta=document.createElement("p");meta.className="muted";
    meta.textContent="Agreement accepted · Refundable security deposit: "+(o.deposit_amount_minor/100)+" "+o.deposit_currency+" · Project fee: "+(o.proposed_fee_minor/100)+" "+o.fee_currency;
    const b=document.createElement("button");b.className="btn dark";b.textContent="Pay Security Deposit";
    b.onclick=async()=>{b.disabled=true;try{const d=await api("/v1/offers/"+o.id+"/deposit/checkout",{method:"POST",body:"{}"});const options={key:d.key_id,amount:d.amount,currency:d.currency,name:d.checkout_name,description:d.description,order_id:d.order_id,handler:async response=>{try{await api("/v1/payments/razorpay/verify",{method:"POST",body:JSON.stringify(response)});alert("Deposit captured and verified. CSA will confirm your project assignment.");await loadOffers();}catch(e){alert(e.message);}},modal:{ondismiss:()=>{b.disabled=false;}}};new Razorpay(options).open();}catch(e){alert(e.message);b.disabled=false;}};
    card.append(meta,b);
   }
   if(o.status==="ready_for_assignment"||o.status==="assigned"){
    const meta=document.createElement("p");meta.className="muted";meta.textContent="Agreement accepted · Deposit verified · Status: "+o.status;card.append(meta);
   }
   root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
})();