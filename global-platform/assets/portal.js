(()=>{"use strict";
const API="https://csa-global-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
function readSessionValue(key){try{return sessionStorage.getItem(key);}catch{return null;}}
function readSessionUser(){try{const raw=readSessionValue("csa_global_user");return raw?JSON.parse(raw):null;}catch{return null;}}
const token=readSessionValue("csa_global_token"),user=readSessionUser();
if(!token||!user||typeof user!=="object"||!user.role){try{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");}catch{}location.replace("login.html");return;}
const headers={"content-type":"application/json","authorization":"Bearer "+token};
$("welcome").textContent="Welcome to CSA Global";
$("account-status").textContent="Signed in as "+(user.email||"verified account")+" · "+user.role+" · "+(user.status||"active");
function endSession(message="Session expired. Please sign in again."){$("account-status").textContent=message;try{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");}catch{}location.replace("login.html");}
$("logout").onclick=()=>endSession("You have been signed out.");
const refreshButton=$("refresh-dashboard");if(refreshButton)refreshButton.onclick=async()=>{refreshButton.disabled=true;refreshButton.textContent="Refreshing…";try{if(user.role==="client"){await Promise.all([loadClientProjects(),loadUploadHistory("client-upload-history")]);}else if(user.role==="editor"){await Promise.all([loadOffers(),loadAssignments(),loadEditorRefunds(),loadUploadHistory("editor-upload-history")]);}else if(user.role==="admin"){await Promise.all([loadAdmin(),loadAdminMultipartUploads(),loadAdminCleanupRuns()]);}}finally{refreshButton.disabled=false;refreshButton.textContent="Refresh data";}};
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{...headers,...options.headers}});let d={};try{d=await r.json();}catch{if(!r.ok)throw Error("CSA server returned an unreadable response (HTTP "+r.status+").");}if(r.status===401){endSession();throw Error("Your session has expired. Please sign in again.");}if(!r.ok)throw Error(d.error?.message||"Request failed (HTTP "+r.status+").");return d;}
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
 $("editor-panel").hidden=false;if(user.status==="pending"){$("assignments").textContent="Your editor profile is awaiting CSA verification. Project offers will appear after approval.";}else{loadOffers();loadAssignments();loadEditorRefunds();loadUploadHistory("editor-upload-history");}
}else if(user.role==="admin"){
 $("admin-panel").hidden=false;loadAdmin();loadAdminMultipartUploads();loadAdminCleanupRuns();
}else{$("account-status").textContent="This account role does not have a client/editor portal.";}
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
async function loadClientProjects(){
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
   const payment=document.createElement("p");payment.className="muted";const payLabels={quotation_pending:"Payment: Awaiting CSA quotation",created:"Payment: Payment link not generated",pending:"Payment: Pending",succeeded:"Payment: Paid",failed:"Payment: Failed",refunded:"Payment: Refunded",partially_refunded:"Payment: Partially refunded",reversed:"Payment: Reversed"};payment.textContent=payLabels[p.payment_status]||("Payment: "+p.payment_status);
   const detail=document.createElement("p");detail.textContent=info.detail;
   const progress=document.createElement("div");progress.className="client-progress";progress.setAttribute("aria-label","Application progress");
   ["Application received","CSA review","Team & planning","Production","Quality & delivery"].forEach((name,index)=>{const item=document.createElement("span");item.className="client-progress-step"+(index+1<=info.step?" is-done":"");item.textContent=name;progress.append(item);});
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
   root.append(c);
  }
 }catch(e){root.textContent=e.message;}
}
async function loadPortfolioVideoReviews(){
 const root=$("admin-portfolio-videos");if(!root)return;root.textContent="Loading submitted portfolio videos…";
 try{
  const data=await api("/v1/admin/editor-portfolio-videos?status=pending");root.replaceChildren();
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
   const note=document.createElement("textarea");note.maxLength=1000;note.placeholder="Optional review note";
   const actions=document.createElement("div");actions.className="actions";
   for(const [status,label] of [["approved","Approve for Showcase"],["rejected","Reject Video"]]){
    const b=document.createElement("button");b.className=status==="approved"?"btn dark":"btn outline";b.textContent=label;
    b.onclick=async()=>{if(!confirm(label+"?"))return;b.disabled=true;try{await api("/v1/admin/editor-portfolio-videos/"+encodeURIComponent(item.id)+"/review",{method:"POST",body:JSON.stringify({status,note:note.value.trim()})});if(player.src)URL.revokeObjectURL(player.src);await loadPortfolioVideoReviews();loadAdminKycReviews();}catch(err){alert(err.message);b.disabled=false;}};
    actions.append(b);
   }
   card.append(h,meta,desc,consent,preview,player,note,actions);root.append(card);
  }
 }catch(e){root.textContent="Portfolio review queue unavailable: "+e.message;}
}
async function loadAdminKycReviews(){
 const root=$("admin-kyc-documents");if(!root)return;root.textContent="Loading private KYC review queue…";
 try{
  const data=await api("/v1/admin/editors/kyc/pending");root.replaceChildren();
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
 }catch(err){root.textContent="KYC queue unavailable: "+err.message;}
}
async function loadAdmin(){
 const metrics=$("admin-metrics"),projects=$("admin-projects"),editors=$("admin-editors"),ready=$("admin-ready");
 loadPortfolioVideoReviews();
 loadAdminKycReviews();
 try{
  const [overview,pj,pe,ve,ro,qc,rf]=await Promise.all([
   api("/v1/admin/overview"),api("/v1/admin/projects"),api("/v1/admin/editors/pending"),api("/v1/admin/editors/verified"),api("/v1/admin/offers/ready"),api("/v1/admin/submissions/pending"),api("/v1/admin/deposits/refunds/eligible")
  ]);
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
   projects.append(card);
  }
  editors.replaceChildren();
  if(!pe.editors.length)editors.textContent="No editor profiles are awaiting verification, or no editor currently meets all active-account, verified-KYC and approved-profile requirements.";
  for(const e of pe.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";meta.textContent="Legal name: "+(e.legal_name||"Not provided")+" · "+e.email+" · "+e.country+" · Profile: "+e.verification_status+" · KYC: "+(e.kyc_status||"not_submitted");const portfolio=document.createElement("a");portfolio.href=e.portfolio_url;portfolio.target="_blank";portfolio.rel="noopener noreferrer";portfolio.textContent="Review portfolio";const skills=document.createElement("p");skills.textContent=JSON.parse(e.specializations_json||"[]").join(", ");const approve=document.createElement("button");approve.className="btn dark";approve.textContent=e.kyc_status==="verified"?"Verify profile":"Awaiting verified KYC";approve.disabled=e.kyc_status!=="verified";approve.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"verified"})});loadAdmin();}catch(err){alert(err.message);}};const reject=document.createElement("button");reject.className="btn outline";reject.textContent="Reject";reject.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"rejected"})});loadAdmin();}catch(err){alert(err.message);}};card.append(h,meta,portfolio,skills,approve,reject);editors.append(card);}for(const e of ve.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";let verifiedLangs=[];try{verifiedLangs=JSON.parse(e.languages_json||"[]");}catch{}meta.textContent="Verified · "+e.country+" · "+e.public_editor_code+" · Languages: "+(verifiedLangs.join(", ")||"Not listed");const issue=document.createElement("button");issue.className="btn dark";issue.textContent="Issue / Reset CSA Login";issue.onclick=async()=>{if(!confirm("Generate a one-time temporary password for "+e.display_name+"? The previous password will stop working."))return;try{const d=await api("/v1/admin/editors/"+e.id+"/credentials",{method:"POST",body:"{}"});const message="CSA Editor User ID: "+d.username+"\nTemporary Password: "+d.temporary_password+"\n\nThis password is shown once. Share securely and ask editor to change it on first login.";alert(message);await navigator.clipboard?.writeText(message);}catch(err){alert(err.message);}};card.append(h,meta,issue);editors.append(card);}
  ready.replaceChildren();
  if(!ro.offers.length)ready.textContent="No captured deposits waiting for assignment.";
  for(const o of ro.offers){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=o.title+" · "+o.public_project_code;const meta=document.createElement("p");meta.textContent=o.public_editor_code+" · Deposit captured · Fee "+(o.proposed_fee_minor/100)+" "+o.fee_currency;const assign=document.createElement("button");assign.className="btn dark";assign.textContent="Confirm Assignment";assign.onclick=async()=>{try{await api("/v1/admin/offers/"+o.id+"/assign",{method:"POST",body:"{}"});alert("Assignment confirmed.");loadAdmin();}catch(e){alert(e.message);}};card.append(h,meta,assign);ready.append(card);}
  const qcRoot=$("admin-submissions");if(qcRoot){qcRoot.replaceChildren();if(!qc.submissions.length)qcRoot.textContent="No submissions waiting for quality review.";for(const item of qc.submissions){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Version "+item.version_number+" · Submitted "+item.submitted_at;const notes=document.createElement("p");notes.textContent=(item.notes||"No submission notes.")+" · "+(item.original_filename||"Submission file")+" · "+Math.round((item.size_bytes||0)/1024/1024*10)/10+" MB";const download=document.createElement("button");download.className="btn outline";download.textContent="Download for QC review";download.onclick=async()=>{try{const response=await fetch(API+"/v1/files/"+item.id,{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Submission download denied");const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=item.original_filename||"submission";link.click();URL.revokeObjectURL(url);}catch(err){alert(err.message);}};const actions=document.createElement("div");actions.className="actions";for(const [status,label] of [["approved","Quality Approve"],["changes_requested","Request Changes"],["rejected","Reject Submission"]]){const b=document.createElement("button");b.className=status==="approved"?"btn dark":"btn outline";b.textContent=label;b.onclick=async()=>{if(!confirm(label+" for "+item.public_project_code+"?"))return;b.disabled=true;try{await api("/v1/admin/submissions/"+item.id+"/review",{method:"POST",body:JSON.stringify({status})});loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};actions.append(b);}card.append(h,meta,notes,download,actions);qcRoot.append(card);}}
  const refundRoot=$("admin-refunds");if(refundRoot){refundRoot.replaceChildren();if(!rf.eligible.length)refundRoot.textContent="No security deposits are currently eligible for refund.";for(const item of rf.eligible){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Deposit "+(item.amount_minor/100)+" "+item.currency;const approved=document.createElement("p");approved.textContent="CSA quality approved: "+item.quality_approved_at;const b=document.createElement("button");b.className="btn dark";b.textContent="Initiate Full Deposit Refund";b.onclick=async()=>{if(!confirm("Initiate full refund of "+(item.amount_minor/100)+" "+item.currency+" to the original payment method?"))return;b.disabled=true;try{const result=await api("/v1/admin/deposits/"+item.payment_id+"/refund",{method:"POST",body:"{}"});alert("Razorpay refund status: "+result.status+" · Refund ID: "+result.provider_refund_id);loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};card.append(h,meta,approved,b);refundRoot.append(card);}}
 }catch(e){metrics.textContent="Admin data could not be loaded: "+e.message;}
}
async function loadAssignments(){
 const root=$("assignments");if(!root)return;root.textContent="Loading assignments…";
 try{const d=await api("/v1/editor/assignments");root.replaceChildren();if(!d.assignments.length){root.textContent="No active assignments yet.";return;}for(const a of d.assignments){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=a.title+" · "+a.public_project_code;const p=document.createElement("p");p.textContent=a.brief;const meta=document.createElement("p");meta.className="muted";meta.textContent="Due: "+a.due_at+" · Status: "+a.status;try{const sourceFiles=await api("/v1/projects/"+a.project_id+"/files");for(const sf of sourceFiles.files){const dl=document.createElement("button");dl.className="btn outline";dl.textContent="Download source: "+sf.original_filename;dl.onclick=async()=>{const r=await fetch(API+"/v1/files/"+sf.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Source download denied");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=sf.original_filename;a.click();URL.revokeObjectURL(url);};c.append(dl);}}catch{}const file=document.createElement("input");file.type="file";file.accept="video/*,audio/*,image/*,application/pdf,application/zip";const note=document.createElement("input");note.placeholder="Submission notes (optional)";const b=document.createElement("button");b.className="btn dark";b.textContent="Submit work to CSA";b.onclick=async()=>{const f=file.files[0];if(!f){alert("Select a file first.");return;}if(f.size>5*1024*1024*1024){alert("Upload limit is 5 GB per file.");return;}try{if(f.size>90*1024*1024){b.disabled=true;b.textContent="Uploading…";await multipartUpload(f,{purpose:"submission",assignment_id:a.id,notes:note.value},(sent,total,part,count)=>{b.textContent="Uploading "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;},null,state=>{if(state.type==="retry")b.textContent="Retrying · "+state.attempt+"/3 · "+Math.ceil(state.delay/1000)+"s";if(state.type==="completing")b.textContent="Verifying upload…";});}else{const r=await fetch(API+"/v1/assignments/"+a.id+"/submissions",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":f.type||"application/octet-stream","x-file-name":f.name,"x-submission-notes":note.value},body:f});const result=await r.json();if(!r.ok)throw Error(result.error?.message||"Upload failed");}alert("Work submitted to CSA for quality review.");loadAssignments();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Submit work to CSA";}};c.append(h,p,meta,file,note,b);root.append(c);}}catch(e){root.textContent=e.message;}
}
async function loadEditorRefunds(){
 const root=$("editor-refunds");if(!root)return;root.textContent="Loading deposit refund status…";
 try{const d=await api("/v1/editor/deposit-refunds");root.replaceChildren();if(!d.refunds.length){root.textContent="No deposit refund requests yet. Your deposit will become eligible after CSA quality approval.";return;}for(const r of d.refunds){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=r.title+" · "+r.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent="Refund amount: "+(r.amount_minor/100)+" "+r.currency+" · Status: "+r.status;const ref=document.createElement("p");ref.textContent=r.provider_refund_id?"Razorpay Refund ID: "+r.provider_refund_id:"Razorpay refund reference will appear once available.";c.append(h,meta,ref);root.append(c);}}catch(e){root.textContent=e.message;}
}
async function loadOffers(){
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
    card.append(b);
   }
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