(()=>{"use strict";
const API="https://csa-global-api-staging.creatorsupportamravati.workers.dev",token=sessionStorage.getItem("csa_global_token"),user=JSON.parse(sessionStorage.getItem("csa_global_user")||"null");
const $=id=>document.getElementById(id);
if(!token||!user){location.href="login.html";return;}
const headers={"content-type":"application/json","authorization":"Bearer "+token};
$("welcome").textContent="Welcome to CSA Global";
$("account-status").textContent="Signed in as "+user.email+" · "+user.role+" · "+user.status;
$("logout").onclick=()=>{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");location.href="login.html";};
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{...headers,...options.headers}});const d=await r.json();if(r.status===401){$("account-status").textContent="Session expired. Please sign in again.";sessionStorage.clear();setTimeout(()=>location.href="login.html",1200);}if(!r.ok)throw Error(d.error?.message||"Request failed");return d;}
async function multipartUpload(file,details,onProgress=()=>{},resumeUploadId=null){
 const identity=[details.purpose,details.project_id||details.assignment_id||"",file.name,file.size,file.lastModified].join("|");
 const resumeKey="csa_multipart_"+btoa(unescape(encodeURIComponent(identity))).replace(/[^a-zA-Z0-9]/g,"").slice(0,100);
 let start=null;
 const saved=resumeUploadId||localStorage.getItem(resumeKey);
 if(resumeUploadId)localStorage.setItem(resumeKey,resumeUploadId);
 if(saved){
  const check=await fetch(API+"/v1/uploads/multipart/"+encodeURIComponent(saved),{headers:{authorization:"Bearer "+token}});
  const status=await check.json();
  if(check.ok&&status.filename===file.name&&Number(status.total_size_bytes)===file.size){start=status;onProgress(0,file.size,0,status.expected_parts);}
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
     const r=await fetch(API+"/v1/uploads/multipart/"+start.upload_id+"/parts/"+part,{method:"PUT",headers:{authorization:"Bearer "+token,"content-type":"application/octet-stream"},body:chunk});
     const d=await r.json();if(!r.ok)throw Error(d.error?.message||"Upload part "+part+" failed");done=true;
    }catch(err){lastError=err;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,800*attempt));}
   }
   if(!done)throw lastError||Error("Upload part "+part+" failed");
   sent+=chunk.size;onProgress(sent,file.size,part,start.expected_parts);
  }
  const result=await api("/v1/uploads/multipart/"+start.upload_id+"/complete",{method:"POST",body:"{}"});
  localStorage.removeItem(resumeKey);
  return result;
 }catch(err){
  throw Error((err.message||"Upload failed")+". Upload session is saved; select the same file again to resume.");
 }
}

if(user.role==="client"){
 $("client-panel").hidden=false;
 loadClientProjects();loadUploadHistory("client-upload-history");
 $("project-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),major=Number(f.get("budget")),minor=Math.round(major*100),payload={title:f.get("title"),category:f.get("category"),brief:f.get("brief"),video_count:Number(f.get("video_count"))||null,raw_footage_minutes:Number(f.get("raw_footage_minutes"))||null,final_duration_minutes:Number(f.get("final_duration_minutes"))||null,resolution:f.get("resolution"),aspect_ratio:f.get("aspect_ratio"),budget_amount_minor:minor,budget_currency:f.get("currency"),budget_type:f.get("budget_type"),preferred_deadline:f.get("preferred_deadline"),priority:f.get("priority"),revisions_included:Number(f.get("revisions_included")),requirements:{}};
 $("project-message").textContent="Submitting…";try{const d=await api("/v1/projects",{method:"POST",body:JSON.stringify(payload)});$("project-message").textContent="Project submitted: "+d.project_code+". Uploading selected files…";const files=Array.from(e.target.elements.project_files.files||[]);for(const file of files){if(file.size>5*1024*1024*1024)throw Error(file.name+" is over the 5 GB staging limit.");if(file.size>90*1024*1024){await multipartUpload(file,{purpose:"project_file",project_id:d.project_id},(sent,total,part,count)=>{$("project-message").textContent="Uploading "+file.name+" · Part "+part+"/"+count+" · "+Math.round(sent/total*100)+"%";});}else{const up=await fetch(API+"/v1/projects/"+d.project_id+"/files",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":file.type||"application/octet-stream","x-file-name":file.name},body:file});const result=await up.json();if(!up.ok)throw Error(result.error?.message||"Upload failed for "+file.name);}} $("project-message").textContent="Project "+d.project_code+" submitted and "+files.length+" file(s) uploaded privately to CSA.";e.target.reset();loadClientProjects();}catch(err){$("project-message").textContent=err.message;}
 };
}else if(user.role==="editor"){
 $("editor-panel").hidden=false;if(user.status==="pending"){$("assignments").textContent="Your editor profile is awaiting CSA verification. Project offers will appear after approval.";}else{loadOffers();loadAssignments();loadEditorRefunds();loadUploadHistory("editor-upload-history");}
}else if(user.role==="admin"){
 $("admin-panel").hidden=false;loadAdmin();loadAdminMultipartUploads();
}else{$("account-status").textContent="This account role does not have a client/editor portal.";}
async function loadAdminMultipartUploads(){
 const metrics=$("admin-multipart-metrics"),root=$("admin-multipart-uploads");if(!root)return;
 root.textContent="Loading upload operations…";
 try{
  const d=await api("/v1/admin/multipart-uploads");
  metrics.replaceChildren();
  const labels=[["Open sessions",d.totals.open||0],["Completed",d.totals.completed||0],["Aborted",d.totals.aborted||0],["Expired but open",d.totals.expired_open||0]];
  for(const [label,value] of labels){const card=document.createElement("div");card.className="stat";const small=document.createElement("small");small.textContent=label;const strong=document.createElement("strong");strong.textContent=value;card.append(small,strong);metrics.append(card);}
  root.replaceChildren();
  if(!d.uploads.length){root.textContent="No multipart upload sessions recorded yet.";return;}
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
   if(u.status==="open"&&new Date(u.expires_at).getTime()>Date.now()){
    const picker=document.createElement("input");picker.type="file";picker.setAttribute("aria-label","Choose the same file to resume");
    const resume=document.createElement("button");resume.className="btn outline";resume.textContent="Select same file to resume";resume.disabled=true;
    picker.onchange=()=>{const f=picker.files?.[0];resume.disabled=!f||f.name!==u.original_filename||f.size!==u.total_size_bytes;};
    const msg=document.createElement("p");msg.className="muted";msg.setAttribute("role","status");
    resume.onclick=async()=>{const f=picker.files?.[0];if(!f||f.name!==u.original_filename||f.size!==u.total_size_bytes)return;resume.disabled=true;try{await multipartUpload(f,{purpose:u.purpose,project_id:u.project_id,assignment_id:u.assignment_id},(sent,total,part,count)=>{msg.textContent="Resuming upload · "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;},u.id);msg.textContent="Upload completed successfully.";await loadUploadHistory(targetId);}catch(e){msg.textContent=e.message;resume.disabled=false;}};
    card.append(picker,resume,msg);
   }
   root.append(card);
  }
 }catch(e){root.textContent=e.message;}
}
async function loadClientProjects(){
 const root=$("client-projects");if(!root)return;root.textContent="Loading your project submissions…";
 try{const d=await api("/v1/client/projects");root.replaceChildren();if(!d.projects.length){root.textContent="You have not submitted any projects yet.";return;}for(const p of d.projects){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=p.title+" · "+p.public_project_code;const m=document.createElement("p");m.className="muted";m.textContent=p.category+" · "+(p.budget_amount_minor/100)+" "+p.budget_currency+" · "+p.status+" · Deadline: "+(p.preferred_deadline||"Not set");c.append(h,m);try{const dls=await api("/v1/client/projects/"+p.id+"/deliverables");for(const file of dls.deliverables){const b=document.createElement("button");b.className="btn outline";b.textContent="Download approved "+file.original_filename;b.onclick=async()=>{const r=await fetch(API+"/v1/files/"+file.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Download failed");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=file.original_filename;a.click();URL.revokeObjectURL(url);};c.append(b);}}catch{}root.append(c);}}catch(e){root.textContent=e.message;}
}
async function loadAdmin(){
 const metrics=$("admin-metrics"),projects=$("admin-projects"),editors=$("admin-editors"),ready=$("admin-ready");
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
   card.append(h,desc,meta);
   if(["submitted","under_review","approved","matching"].includes(p.status)){
    const form=document.createElement("div");form.className="form";
    const editorSelect=document.createElement("select");editorSelect.setAttribute("aria-label","Verified editor");
    const first=document.createElement("option");first.value="";first.textContent="Select verified editor";editorSelect.append(first);
    for(const e of ve.editors){const opt=document.createElement("option");opt.value=e.id;opt.textContent=e.public_editor_code+" · "+e.display_name+" · "+e.country;editorSelect.append(opt);}
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
  for(const e of pe.editors){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=e.display_name+" · "+e.public_editor_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=e.email+" · "+e.country+" · "+e.verification_status;const portfolio=document.createElement("a");portfolio.href=e.portfolio_url;portfolio.target="_blank";portfolio.rel="noopener noreferrer";portfolio.textContent="Review portfolio";const skills=document.createElement("p");skills.textContent=JSON.parse(e.specializations_json||"[]").join(", ");const approve=document.createElement("button");approve.className="btn dark";approve.textContent="Verify editor";approve.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"verified"})});loadAdmin();}catch(err){alert(err.message);}};const reject=document.createElement("button");reject.className="btn outline";reject.textContent="Reject";reject.onclick=async()=>{try{await api("/v1/admin/editors/"+e.id+"/verify",{method:"POST",body:JSON.stringify({status:"rejected"})});loadAdmin();}catch(err){alert(err.message);}};card.append(h,meta,portfolio,skills,approve,reject);editors.append(card);}
  ready.replaceChildren();
  if(!ro.offers.length)ready.textContent="No captured deposits waiting for assignment.";
  for(const o of ro.offers){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=o.title+" · "+o.public_project_code;const meta=document.createElement("p");meta.textContent=o.public_editor_code+" · Deposit captured · Fee "+(o.proposed_fee_minor/100)+" "+o.fee_currency;const assign=document.createElement("button");assign.className="btn dark";assign.textContent="Confirm Assignment";assign.onclick=async()=>{try{await api("/v1/admin/offers/"+o.id+"/assign",{method:"POST",body:"{}"});alert("Assignment confirmed.");loadAdmin();}catch(e){alert(e.message);}};card.append(h,meta,assign);ready.append(card);}
  const qcRoot=$("admin-submissions");if(qcRoot){qcRoot.replaceChildren();if(!qc.submissions.length)qcRoot.textContent="No submissions waiting for quality review.";for(const item of qc.submissions){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Version "+item.version_number+" · Submitted "+item.submitted_at;const notes=document.createElement("p");notes.textContent=(item.notes||"No submission notes.")+" · "+(item.original_filename||"Submission file")+" · "+Math.round((item.size_bytes||0)/1024/1024*10)/10+" MB";const download=document.createElement("button");download.className="btn outline";download.textContent="Download for QC review";download.onclick=async()=>{try{const response=await fetch(API+"/v1/files/"+item.id,{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Submission download denied");const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=item.original_filename||"submission";link.click();URL.revokeObjectURL(url);}catch(err){alert(err.message);}};const actions=document.createElement("div");actions.className="actions";for(const [status,label] of [["approved","Quality Approve"],["changes_requested","Request Changes"],["rejected","Reject Submission"]]){const b=document.createElement("button");b.className=status==="approved"?"btn dark":"btn outline";b.textContent=label;b.onclick=async()=>{if(!confirm(label+" for "+item.public_project_code+"?"))return;b.disabled=true;try{await api("/v1/admin/submissions/"+item.id+"/review",{method:"POST",body:JSON.stringify({status})});loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};actions.append(b);}card.append(h,meta,notes,download,actions);qcRoot.append(card);}}
  const refundRoot=$("admin-refunds");if(refundRoot){refundRoot.replaceChildren();if(!rf.eligible.length)refundRoot.textContent="No security deposits are currently eligible for refund.";for(const item of rf.eligible){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=item.title+" · "+item.public_project_code;const meta=document.createElement("p");meta.className="muted";meta.textContent=item.display_name+" · "+item.public_editor_code+" · Deposit "+(item.amount_minor/100)+" "+item.currency;const approved=document.createElement("p");approved.textContent="CSA quality approved: "+item.quality_approved_at;const b=document.createElement("button");b.className="btn dark";b.textContent="Initiate Full Deposit Refund";b.onclick=async()=>{if(!confirm("Initiate full refund of "+(item.amount_minor/100)+" "+item.currency+" to the original payment method?"))return;b.disabled=true;try{const result=await api("/v1/admin/deposits/"+item.payment_id+"/refund",{method:"POST",body:"{}"});alert("Razorpay refund status: "+result.status+" · Refund ID: "+result.provider_refund_id);loadAdmin();}catch(e){alert(e.message);b.disabled=false;}};card.append(h,meta,approved,b);refundRoot.append(card);}}
 }catch(e){metrics.textContent="Admin data could not be loaded: "+e.message;}
}
async function loadAssignments(){
 const root=$("assignments");if(!root)return;root.textContent="Loading assignments…";
 try{const d=await api("/v1/editor/assignments");root.replaceChildren();if(!d.assignments.length){root.textContent="No active assignments yet.";return;}for(const a of d.assignments){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=a.title+" · "+a.public_project_code;const p=document.createElement("p");p.textContent=a.brief;const meta=document.createElement("p");meta.className="muted";meta.textContent="Due: "+a.due_at+" · Status: "+a.status;try{const sourceFiles=await api("/v1/projects/"+a.project_id+"/files");for(const sf of sourceFiles.files){const dl=document.createElement("button");dl.className="btn outline";dl.textContent="Download source: "+sf.original_filename;dl.onclick=async()=>{const r=await fetch(API+"/v1/files/"+sf.id,{headers:{authorization:"Bearer "+token}});if(!r.ok){alert("Source download denied");return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=url;a.download=sf.original_filename;a.click();URL.revokeObjectURL(url);};c.append(dl);}}catch{}const file=document.createElement("input");file.type="file";file.accept="video/*,audio/*,image/*,application/pdf,application/zip";const note=document.createElement("input");note.placeholder="Submission notes (optional)";const b=document.createElement("button");b.className="btn dark";b.textContent="Submit work to CSA";b.onclick=async()=>{const f=file.files[0];if(!f){alert("Select a file first.");return;}if(f.size>5*1024*1024*1024){alert("Staging upload limit is 5 GB per file.");return;}try{if(f.size>90*1024*1024){b.disabled=true;b.textContent="Uploading…";await multipartUpload(f,{purpose:"submission",assignment_id:a.id,notes:note.value},(sent,total,part,count)=>{b.textContent="Uploading "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;});}else{const r=await fetch(API+"/v1/assignments/"+a.id+"/submissions",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":f.type||"application/octet-stream","x-file-name":f.name,"x-submission-notes":note.value},body:f});const result=await r.json();if(!r.ok)throw Error(result.error?.message||"Upload failed");}alert("Work submitted to CSA for quality review.");loadAssignments();}catch(e){alert(e.message);}finally{b.disabled=false;b.textContent="Submit work to CSA";}};c.append(h,p,meta,file,note,b);root.append(c);}}catch(e){root.textContent=e.message;}
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