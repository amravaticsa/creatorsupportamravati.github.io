(()=>{"use strict";
const API="https://csa-global-api-staging.creatorsupportamravati.workers.dev",token=sessionStorage.getItem("csa_global_token"),user=JSON.parse(sessionStorage.getItem("csa_global_user")||"null");
const $=id=>document.getElementById(id);
if(!token||!user){location.href="login.html";return;}
const headers={"content-type":"application/json","authorization":"Bearer "+token};
$("welcome").textContent="Welcome to CSA Global";
$("account-status").textContent="Signed in as "+user.email+" · "+user.role+" · "+user.status;
$("logout").onclick=()=>{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");location.href="login.html";};
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{...headers,...options.headers}});const d=await r.json();if(r.status===401){$("account-status").textContent="Session expired. Please sign in again.";sessionStorage.clear();setTimeout(()=>location.href="login.html",1200);}if(!r.ok)throw Error(d.error?.message||"Request failed");return d;}
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
 loadClientProjects();loadUploadHistory("client-upload-history");
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
     if(file.size>5*1024*1024*1024)throw Error(file.name+" is over the 5 GB staging limit.");
     if(file.size>90*1024*1024){await multipartUpload(file,{purpose:"project_file",project_id:project.project_id},(sent,total,part,count)=>{$("project-message").textContent="CSA received "+project.project_code+" · Uploading "+file.name+" · Part "+part+"/"+count+" · "+Math.round(sent/total*100)+"%";},null,state=>{if(state.type==="retry")$("project-message").textContent="Project received · Connection retry "+state.attempt+"/3 · "+file.name;if(state.type==="completing")$("project-message").textContent="Project received · Verifying "+file.name;if(state.type==="error")$("project-message").textContent="Project received · Upload paused: "+state.message+" · Resume from upload history.";});}
     else{const up=await fetch(API+"/v1/projects/"+project.project_id+"/files",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":file.type||"application/octet-stream","x-file-name":file.name},body:file});let result={};try{result=await up.json();}catch{}if(!up.ok)throw Error(result.error?.message||"Upload failed for "+file.name);}
     uploaded++;
    }
    $("project-message").textContent="Success! Project "+project.project_code+" has been submitted to CSA"+(files.length?" and "+uploaded+" file(s) uploaded securely.":".");
    form.reset();loadClientProjects();loadUploadHistory("client-upload-history");
   }catch(err){$("project-message").textContent=(project?"Project "+project.project_code+" is safely saved with CSA, but file upload needs attention: ":"")+err.message;loadClientProjects();}
   finally{delete form.dataset.submitting;if(submit){submit.disabled=false;submit.textContent="Submit Project to CSA";}}
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
async function loadClientProjects(){
 const root=$("client-projects");if(!root)return;root.textContent="Loading your projects with CSA…";
 const statusInfo={
  submitted:{label:"Received by CSA",step:1,detail:"Your project brief has been received. Our team will review your requirements and confirm the scope."},
  under_review:{label:"CSA reviewing your brief",step:1,detail:"Our team is reviewing your requirements and preparing the next steps."},
  approved:{label:"CSA planning production",step:2,detail:"The project scope is being prepared by CSA before production begins."},
  matching:{label:"CSA planning production",step:2,detail:"The CSA team is organizing the production workflow for your project."},
  assigned:{label:"Production in progress",step:3,detail:"The CSA production team is working on your project. We will keep you updated as it progresses."},
  client_review:{label:"Ready for your review",step:5,detail:"CSA has completed its quality review. Your approved files are ready below."},
  in_progress:{label:"Production in progress",step:3,detail:"The CSA production team is working on your project. We will keep you updated as it progresses."},
  quality_check:{label:"CSA quality review",step:4,detail:"Your video is going through CSA's quality and brief-compliance checks before delivery."},
  quality_review:{label:"CSA quality review",step:4,detail:"Your video is going through CSA's quality and brief-compliance checks before delivery."},
  revision:{label:"CSA finalizing your video",step:3,detail:"CSA is coordinating final refinements to make sure the video meets your approved brief."},
  completed:{label:"Completed and delivered",step:5,detail:"Your project has been completed by CSA. You can access the approved deliverables below."},
  closed:{label:"Project closed",step:5,detail:"This project is closed. Please contact CSA if you need any clarification."}
 };
 try{
  const d=await api("/v1/client/projects");root.replaceChildren();
  if(!d.projects.length){root.textContent="You have not submitted any projects yet.";return;}
  for(const p of d.projects){
   const c=document.createElement("article");c.className="card";
   const h=document.createElement("h3");h.textContent=p.title+" · "+p.public_project_code;
   const info=statusInfo[p.status]||statusInfo.submitted;
   const badge=document.createElement("span");badge.className="tag blue";badge.textContent=info.label;
   const meta=document.createElement("p");meta.className="muted";meta.textContent=p.category+" · "+(p.budget_amount_minor/100)+" "+p.budget_currency+" · Preferred delivery: "+(p.preferred_deadline||"To be confirmed");
   const detail=document.createElement("p");detail.textContent=info.detail;
   const progress=document.createElement("div");progress.className="client-progress";progress.setAttribute("aria-label","Project progress");
   const stages=["Brief received","CSA planning","Production","Quality review","Final delivery"];
   stages.forEach((name,index)=>{const item=document.createElement("span");item.className="client-progress-step"+(index+1<=info.step?" is-done":"");item.textContent=name;progress.append(item);});
   c.append(h,badge,meta,detail,progress);
   try{
    const dls=await api("/v1/client/projects/"+p.id+"/deliverables");
    for(const file of dls.deliverables){
     const b=document.createElement("button");b.className="btn outline";b.textContent="Download your approved file · "+file.original_filename;
     b.onclick=async()=>{const r=await fetch(API+"/v1/files/"+file.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Download failed");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=file.original_filename;a.click();URL.revokeObjectURL(url);};
     c.append(b);
    }
    if(dls.deliverables.length===0&&p.status==="client_review"){const wait=document.createElement("p");wait.className="muted";wait.textContent="Approved files are being prepared for secure delivery.";c.append(wait);}
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
    b.onclick=async()=>{if(!confirm(label+"?"))return;b.disabled=true;try{await api("/v1/admin/editor-portfolio-videos/"+encodeURIComponent(item.id)+"/review",{method:"POST",body:JSON.stringify({status,note:note.value.trim()})});if(player.src)URL.revokeObjectURL(player.src);await loadPortfolioVideoReviews();}catch(err){alert(err.message);b.disabled=false;}};
    actions.append(b);
   }
   card.append(h,meta,desc,consent,preview,player,note,actions);root.append(card);
  }
 }catch(e){root.textContent="Portfolio review queue unavailable: "+e.message;}
}
async function loadAdmin(){
 const metrics=$("admin-metrics"),projects=$("admin-projects"),editors=$("admin-editors"),ready=$("admin-ready");
 loadPortfolioVideoReviews();
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
   if(["submitted","under_review","approved","matching"].includes(p.status)){
    const form=document.createElement("div");form.className="form";
    const editorSelect=document.createElement("select");editorSelect.setAttribute("aria-label","Verified editor");
    const first=document.createElement("option");first.value="";first.textContent="Select verified editor";editorSelect.append(first);
    for(const e of ve.editors.filter(x=>x.account_status==="active")){const opt=document.createElement("option");opt.value=e.id;opt.textContent=e.public_editor_code+" · "+e.display_name+" · "+[e.city,e.country].filter(Boolean).join(", ")+" · "+(JSON.parse(e.languages_json||"[]").join("/")||"Languages not listed");editorSelect.append(opt);}
    const fee=document.createElement("input");fee.type="number";fee.min="0.01";fee.step="0.01";fee.placeholder="Editor fee in "+p.budget_currency;
    const deposit=document.createElement("input");deposit.type="number";deposit.min="0.01";deposit.step="0.01";deposit.placeholder="Security deposit in "+p.budget_currency;
    const days=document.createElement("input");days.type="number";days.min="1";days.value="5";days.placeholder="Delivery days";
    const msg=document.createElement("input");msg.placeholder="Offer instructions (optional)";
    const send=document.createElement("button");send.className="btn dark";send.textContent="Send Managed Offer";
    send.onclick=async()=>{if(!editorSelect.value||Number(fee.value)<=0||Number(deposit.value)<=0){alert("Editor, fee and deposit required.");return;}send.disabled=true;try{await api("/v1/admin/projects/"+p.id+"/offers",{method:"POST",body:JSON.stringify({editor_id:editorSelect.value,proposed_fee_minor:Math.round(Number(fee.value)*100),fee_currency:p.budget_currency,deposit_amount_minor:Math.round(Number(deposit.value)*100),deposit_currency:p.budget_currency,delivery_days:Number(days.value),offer_message:msg.value})});alert("Project offer sent to selected editor.");loadAdmin();}catch(e){alert(e.message);send.disabled=false;}};
    form.append(editorSelect,fee,deposit,days,msg,send);card.append(form);
   }
   projects.append(card);
  }
  editors.replaceChildren();
  if(!pe.editors.length)editors.textContent="No editor profiles awaiting verification.";
  for(const e of pe.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=e.email+" · "+e.country+" · "+e.verification_status;const portfolio=document.createElement("a");portfolio.href=e.portfolio_url;portfolio.target="_blank";portfolio.rel="noopener noreferrer";portfolio.textContent="Review portfolio";const skills=document.createElement("p");skills.textContent=JSON.parse(e.specializations_json||"[]").join(", ");const approve=document.createElement("button");approve.className="btn dark";approve.textContent="Verify profile";approve.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"verified"})});loadAdmin();}catch(err){alert(err.message);}};const reject=document.createElement("button");reject.className="btn outline";reject.textContent="Reject";reject.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"rejected"})});loadAdmin();}catch(err){alert(err.message);}};card.append(h,meta,portfolio,skills,approve,reject);editors.append(card);}for(const e of ve.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";meta.textContent="Verified · "+e.country+" · "+e.public_editor_code;const issue=document.createElement("button");issue.className="btn dark";issue.textContent="Issue / Reset CSA Login";issue.onclick=async()=>{if(!confirm("Generate a one-time temporary password for "+e.display_name+"? The previous password will stop working."))return;try{const d=await api("/v1/admin/editors/"+e.id+"/credentials",{method:"POST",body:"{}"});const message="CSA Editor User ID: "+d.username+"\nTemporary Password: "+d.temporary_password+"\n\nThis password is shown once. Share securely and ask editor to change it on first login.";alert(message);await navigator.clipboard?.writeText(message);}catch(err){alert(err.message);}};card.append(h,meta,issue);editors.append(card);}
  ready.replaceChildren();
  if(!ro.offers.length)ready.textContent="No captured deposits waiting for assignment.";
  for(const o of ro.offers){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=o.title+" · "+o.public_project_code;const meta=document.createElement("p");meta.textContent=o.public_editor_code+" · Deposit captured · Fee "+(o.proposed_fee_minor/100)+" "+o.fee_currency;const assign=document.createElement("button");assign.className="btn dark";assign.textContent="Confirm Assignment";assign.onclick=async()=>{try{await api("/v1/admin/offers/"+o.id+"/assign",{method:"POST",body:"{}"});alert("Assignment confirmed.");loadAdmin();}catch(e){alert(e.message);}};card.append(h,meta,assign);ready.append(card);}
  const qcRoot=$("admin-submissions");if(qcRoot){qcRoot.replaceChildren();if(!qc.submissions.length)qcRoot.textContent="No submissions waiting for quality review.";for(const item of qc.submissions){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Version "+item.version_number+" · Submitted "+item.submitted_at;const notes=document.createElement("p");notes.textContent=(item.notes||"No submission notes.")+" · "+(item.original_filename||"Submission file")+" · "+Math.round((item.size_bytes||0)/1024/1024*10)/10+" MB";const download=document.createElement("button");download.className="btn outline";download.textContent="Download for QC review";download.onclick=async()=>{try{const response=await fetch(API+"/v1/files/"+item.id,{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Submission download denied");const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=item.original_filename||"submission";link.click();URL.revokeObjectURL(url);}catch(err){alert(err.message);}};const actions=document.createElement("div");actions.className="actions";for(const [status,label] of [["approved","Quality Approve"],["changes_requested","Request Changes"],["rejected","Reject Submission"]]){const b=document.createElement("button");b.className=status==="approved"?"btn dark":"btn outline";b.textContent=label;b.onclick=async()=>{if(!confirm(label+" for "+item.public_project_code+"?"))return;b.disabled=true;try{await api("/v1/admin/submissions/"+item.id+"/review",{method:"POST",body:JSON.stringify({status})});loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};actions.append(b);}card.append(h,meta,notes,download,actions);qcRoot.append(card);}}
  const refundRoot=$("admin-refunds");if(refundRoot){refundRoot.replaceChildren();if(!rf.eligible.length)refundRoot.textContent="No security deposits are currently eligible for refund.";for(const item of rf.eligible){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Deposit "+(item.amount_minor/100)+" "+item.currency;const approved=document.createElement("p");approved.textContent="CSA quality approved: "+item.quality_approved_at;const b=document.createElement("button");b.className="btn dark";b.textContent="Initiate Full Deposit Refund";b.onclick=async()=>{if(!confirm("Initiate full refund of "+(item.amount_minor/100)+" "+item.currency+" to the original payment method?"))return;b.disabled=true;try{const result=await api("/v1/admin/deposits/"+item.payment_id+"/refund",{method:"POST",body:"{}"});alert("Razorpay refund status: "+result.status+" · Refund ID: "+result.provider_refund_id);loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};card.append(h,meta,approved,b);refundRoot.append(card);}}
 }catch(e){metrics.textContent="Admin data could not be loaded: "+e.message;}
}
async function loadAssignments(){
 const root=$("assignments");if(!root)return;root.textContent="Loading assignments…";
 try{const d=await api("/v1/editor/assignments");root.replaceChildren();if(!d.assignments.length){root.textContent="No active assignments yet.";return;}for(const a of d.assignments){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=a.title+" · "+a.public_project_code;const p=document.createElement("p");p.textContent=a.brief;const meta=document.createElement("p");meta.className="muted";meta.textContent="Due: "+a.due_at+" · Status: "+a.status;try{const sourceFiles=await api("/v1/projects/"+a.project_id+"/files");for(const sf of sourceFiles.files){const dl=document.createElement("button");dl.className="btn outline";dl.textContent="Download source: "+sf.original_filename;dl.onclick=async()=>{const r=await fetch(API+"/v1/files/"+sf.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Source download denied");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=sf.original_filename;a.click();URL.revokeObjectURL(url);};c.append(dl);}}catch{}const file=document.createElement("input");file.type="file";file.accept="video/*,audio/*,image/*,application/pdf,application/zip";const note=document.createElement("input");note.placeholder="Submission notes (optional)";const b=document.createElement("button");b.className="btn dark";b.textContent="Submit work to CSA";b.onclick=async()=>{const f=file.files[0];if(!f){alert("Select a file first.");return;}if(f.size>5*1024*1024*1024){alert("Staging upload limit is 5 GB per file.");return;}try{if(f.size>90*1024*1024){b.disabled=true;b.textContent="Uploading…";await multipartUpload(f,{purpose:"submission",assignment_id:a.id,notes:note.value},(sent,total,part,count)=>{b.textContent="Uploading "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;},null,state=>{if(state.type==="retry")b.textContent="Retrying · "+state.attempt+"/3 · "+Math.ceil(state.delay/1000)+"s";if(state.type==="completing")b.textContent="Verifying upload…";});}else{const r=await fetch(API+"/v1/assignments/"+a.id+"/submissions",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":f.type||"application/octet-stream","x-file-name":f.name,"x-submission-notes":note.value},body:f});const result=await r.json();if(!r.ok)throw Error(result.error?.message||"Upload failed");}alert("Work submitted to CSA for quality review.");loadAssignments();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Submit work to CSA";}};c.append(h,p,meta,file,note,b);root.append(c);}}catch(e){root.textContent=e.message;}
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