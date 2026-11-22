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
 const projectForm=$("project-form"),budgetType=projectForm?.elements?.budget_type,budgetInput=projectForm?.elements?.budget;
 const syncProjectBudgetRequirement=()=>{if(!budgetInput||!budgetType)return;const recommended=budgetType.value==="recommend";budgetInput.required=!recommended;budgetInput.min="1";budgetInput.placeholder=recommended?"Optional — CSA will recommend a suitable budget":"Enter your maximum or estimated budget";const label=budgetInput.closest(".field")?.querySelector("label");if(label)label.textContent=recommended?"Budget amount (optional)":"Budget amount *";};
 budgetType?.addEventListener("change",syncProjectBudgetRequirement);syncProjectBudgetRequirement();
 loadClientProjects();loadClientQuotes();loadCsaNotifications("client");loadClientRefundRequests();const rf=$("client-refund-form");if(rf)rf.onsubmit=async e=>{e.preventDefault();await submitClientRefund(rf);};
  $("project-form").onsubmit=async e=>{
   e.preventDefault();const form=e.target;if(form.dataset.submitting==="1")return;
   const submit=form.querySelector('button[type="submit"]');if(!form.reportValidity())return;
   form.dataset.submitting="1";if(submit){submit.disabled=true;submit.textContent="Submitting to CSA…";}
   const f=new FormData(form),budgetText=String(f.get("budget")||"").trim(),minor=budgetText?Math.round(Number(budgetText)*100):null,payload={title:String(f.get("title")||"").trim(),category:f.get("category"),brief:String(f.get("brief")||"").trim(),video_count:Number(f.get("video_count"))||null,raw_footage_minutes:Number(f.get("raw_footage_minutes"))||null,final_duration_minutes:Number(f.get("final_duration_minutes"))||null,resolution:f.get("resolution"),aspect_ratio:f.get("aspect_ratio"),budget_amount_minor:minor,budget_currency:f.get("currency"),budget_type:f.get("budget_type"),preferred_deadline:f.get("preferred_deadline"),priority:f.get("priority"),revisions_included:Number(f.get("revisions_included")),requirements:{
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
    communication_language:String(f.get("communication_language")||"").trim(),source_language:String(f.get("source_language")||"").trim(),output_language:String(f.get("output_language")||"").trim(),subtitle_languages:String(f.get("subtitle_languages")||"").trim(),client_country:String(f.get("client_country")||"").trim(),client_region:String(f.get("client_region")||"").trim(),client_city:String(f.get("client_city")||"").trim(),project_mode:String(f.get("project_mode")||"remote"),project_location:"",client_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Kolkata",contact_name:String(f.get("contact_name")||"").trim(),contact_phone:String(f.get("contact_phone")||"").trim(),content_style:style,dialect:String(f.get("dialect")||"").trim(),service_package:packageName,project_type:String(f.get("project_type")||"").trim(),raw_footage_duration:String(f.get("raw_footage_duration")||"").trim()
   }};
   const message=$("video-editing-message");message.textContent="Submitting your application securely…";let project=null;
   try{
    project=await api("/v1/projects",{method:"POST",body:JSON.stringify(payload)});
    message.textContent="Application "+project.project_code+" received. Uploading selected footage…";
    const files=Array.from(form.elements.project_files?.files||[]);let uploaded=0;
    for(const file of files){
     if(file.size>5*1024*1024*1024)throw Error(file.name+" exceeds the 5 GB staging limit.");
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
 loadCsaNotifications("editor");
 $("editor-panel").hidden=false;loadCsaNotifications("editor");if(user.status==="pending"){$("assignments").textContent="Your editor profile is awaiting CSA verification. Project offers will appear after approval.";}else{loadOffers();loadAssignments();loadEditorRefunds();loadUploadHistory("editor-upload-history");loadEditorTenders();}
}else if(user.role==="admin"){
 $("admin-panel").hidden=false;loadAdmin();loadAdminMultipartUploads();loadAdminCleanupRuns();loadTenderOps();loadCsaNotifications("admin");loadAdminClientRefunds();const nf=$("admin-notification-form");if(nf)nf.onsubmit=async e=>{e.preventDefault();const f=new FormData(nf),msg=$("admin-notification-message");try{await api("/v1/admin/notifications",{method:"POST",body:JSON.stringify({user_id:String(f.get("user_id")).trim(),type:String(f.get("type")||"admin_notice"),title:String(f.get("title")).trim(),body:String(f.get("body")).trim()})});msg.textContent="In-app notification sent.";nf.reset();await loadCsaNotifications("admin");}catch(err){msg.textContent=err.message;}};
}else{$("account-status").textContent="This account role does not have a client/editor portal.";}

async function loadClientQuotes(){const root=$("client-quotes");if(!root)return;try{const d=await api("/v1/client/quotes");root.replaceChildren();if(!d.quotes.length){root.textContent="No formal quotations have been sent yet.";return;}for(const q of d.quotes){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=q.title+" · "+q.public_project_code;const fmt=n=>(Number(n||0)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+" "+q.currency;const paid=Number(q.paid_amount_minor||0),total=Number(q.total_amount_minor||0),remaining=Math.max(0,total-paid),advance=paid>0?0:Math.min(remaining,Math.ceil(total*Number(q.client_advance_bps||0)/10000));const breakdown=document.createElement("dl");breakdown.className="application-details";for(const [label,value] of [["Editor / production cost",fmt(q.base_cost_minor)],["CSA service & coordination fee",fmt(q.margin_minor)],["Final quotation",fmt(total)],["Advance payable",Number(q.client_advance_bps)>0?fmt(advance):"Not configured"],["Amount paid",fmt(paid)],["Remaining balance",fmt(remaining)]]){const wrap=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=value;wrap.append(dt,dd);breakdown.append(wrap);}const meta=document.createElement("p");meta.className="muted";meta.textContent="Status: "+q.status+" · Payment: "+(q.payment_status||"unpaid")+" · Quote valid until: "+(q.valid_until||"Not specified");const note=document.createElement("p");note.className="muted";note.textContent="The advance is calculated from the approved CSA payment policy. The remaining balance is payable after the advance is recorded.";c.append(h,breakdown,meta,note);if(q.status==="sent")for(const [decision,label] of [["accept","Accept quotation"],["reject","Decline"]]){const b=document.createElement("button");b.className="btn "+(decision==="accept"?"dark":"outline");b.textContent=label;b.onclick=async()=>{try{const x=await api("/v1/client/quotes/"+q.id+"/decision",{method:"POST",body:JSON.stringify({decision})});alert(x.status==="accepted"?"Quotation accepted. Payment will follow the configured CSA advance policy.":"Quotation declined.");loadClientQuotes();}catch(e){alert(e.message);}};c.append(b);}if(q.status==="accepted"&&q.payment_status!=="paid"){const pay=document.createElement("button");pay.className="btn dark";pay.textContent=paid>0?"Pay Remaining Balance":"Pay Advance";pay.onclick=async()=>{if(!window.Razorpay){alert("Razorpay Checkout could not be loaded.");return;}pay.disabled=true;try{const order=await api("/v1/client/quotes/"+q.id+"/checkout",{method:"POST",body:"{}"});if(order.already_paid){alert("This quotation is already fully paid.");loadClientQuotes();return;}const checkout=new window.Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,order_id:order.order_id,name:"CSA Global",description:order.description,handler:async response=>{try{const result=await api("/v1/client/payments/razorpay/verify",{method:"POST",body:JSON.stringify(response)});alert("Payment verified. Quote payment status: "+result.payment_status);loadClientQuotes();}catch(e){alert("Payment submitted but verification needs attention: "+e.message);}},modal:{ondismiss:()=>{pay.disabled=false;}}});checkout.open();}catch(e){alert(e.message);pay.disabled=false;}};c.append(pay);}root.append(c);}}catch(e){root.textContent="Could not load quotes: "+e.message;}}
async function loadEditorTenders(){const root=$("editor-tenders");if(!root)return;try{const d=await api("/v1/editor/tenders");root.replaceChildren();if(!d.tenders.length){root.textContent="No open tenders are available.";return;}for(const t of d.tenders){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=t.title+" · "+t.public_project_code;const p=document.createElement("p");p.textContent=t.scope_summary;const meta=document.createElement("p");meta.className="muted";meta.textContent=t.category+" · "+t.budget_currency+" · Deadline "+t.bid_deadline;const amount=document.createElement("input");amount.type="number";amount.min="0.01";amount.step="0.01";amount.placeholder="Your bid ("+t.budget_currency+")";const days=document.createElement("input");days.type="number";days.min="1";days.max="365";days.value="5";days.placeholder="Delivery days";const proposal=document.createElement("textarea");proposal.placeholder="Proposal and delivery plan";const send=document.createElement("button");send.className="btn dark";send.textContent="Submit Bid";send.onclick=async()=>{if(Number(amount.value)<=0||Number(days.value)<1)return alert("Enter a valid bid and delivery days.");send.disabled=true;try{await api("/v1/editor/tenders/"+t.id+"/bids",{method:"POST",body:JSON.stringify({bid_amount_minor:Math.round(Number(amount.value)*100),currency:t.budget_currency,delivery_days:Number(days.value),proposal:proposal.value})});alert("Bid submitted to CSA.");loadEditorTenders();}catch(e){alert(e.message);send.disabled=false;}};c.append(h,p,meta,amount,days,proposal,send);root.append(c);}}catch(e){root.textContent="Could not load tenders: "+e.message;}}
async function loadTenderOps(){const root=$("admin-tenders"),pricing=$("admin-pricing-policy");if(!root)return;
 if(pricing){pricing.replaceChildren();try{const d=await api("/v1/admin/pricing-policy"),form=document.createElement("form");form.className="panel form";const currency=document.createElement("input");currency.value="INR";currency.maxLength=3;currency.placeholder="Currency code";const rate=document.createElement("input");rate.type="number";rate.min="0";rate.max="100";rate.step="0.01";rate.placeholder="Markup percentage";const minimum=document.createElement("input");minimum.type="number";minimum.min="0";minimum.step="0.01";minimum.placeholder="Minimum markup amount";const advance=document.createElement("input");advance.type="number";advance.min="1";advance.max="100";advance.step="0.01";advance.placeholder="Client advance % (optional; leave blank to disable checkout)";const save=document.createElement("button");save.className="btn dark";save.textContent="Save Pricing Policy";const info=document.createElement("p");info.className="muted";info.textContent=(d.policies||[]).map(x=>x.currency+" "+(x.margin_bps/100)+"% markup · min "+(x.minimum_margin_minor/100)+" · client advance "+(x.client_advance_bps?x.client_advance_bps/100+"%":"not configured")+" · "+x.status).join(" | ")||"No active markup policy. Quotes remain blocked.";form.append(currency,rate,minimum,advance,save,info);form.onsubmit=async e=>{e.preventDefault();try{await api("/v1/admin/pricing-policy",{method:"POST",body:JSON.stringify({currency:currency.value.toUpperCase(),margin_bps:Math.round(Number(rate.value)*100),minimum_margin_minor:Math.round(Number(minimum.value||0)*100),client_advance_bps:advance.value?Math.round(Number(advance.value)*100):null})});alert("Pricing policy saved.");loadTenderOps();}catch(err){alert(err.message);}};pricing.append(form);}catch(e){pricing.textContent=e.message.includes("Only Super Admin")?"Only Super Admin can configure this policy.":e.message;}}
 root.textContent="Loading tender workflow…";try{const [td,pd]=await Promise.all([api("/v1/admin/tenders"),api("/v1/admin/projects")]);root.replaceChildren();const create=document.createElement("form");create.className="panel form";const select=document.createElement("select");select.required=true;select.innerHTML='<option value="">Select an application</option>';for(const p of pd.projects||[]){const o=document.createElement("option");o.value=p.id;o.textContent=p.public_project_code+" · "+p.title;select.append(o);}const scope=document.createElement("textarea");scope.required=true;scope.placeholder="Tender scope / deliverables";const deadline=document.createElement("input");deadline.type="datetime-local";deadline.required=true;const make=document.createElement("button");make.className="btn dark";make.textContent="Save Tender Draft";create.append(select,scope,deadline,make);create.onsubmit=async e=>{e.preventDefault();try{await api("/v1/admin/projects/"+select.value+"/tender",{method:"POST",body:JSON.stringify({scope_summary:scope.value,bid_deadline:new Date(deadline.value).toISOString()})});alert("Tender draft saved.");loadTenderOps();}catch(err){alert(err.message);}};root.append(create);
 if(!td.tenders.length){const empty=document.createElement("p");empty.textContent="No tender records yet.";root.append(empty);}
 for(const t of td.tenders){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=t.project_title+" · "+t.public_project_code;const p=document.createElement("p");p.textContent=t.title+" · "+t.status+" · "+t.bid_count+" bid(s) · "+t.bid_deadline;c.append(h,p);if(t.status==="draft"||t.status==="published"){const b=document.createElement("button");b.className="btn dark";b.textContent=t.status==="draft"?"Publish Tender":"Close Tender";b.onclick=async()=>{try{await api("/v1/admin/tenders/"+t.id+"/"+(t.status==="draft"?"publish":"close"),{method:"POST",body:"{}"});loadTenderOps();}catch(e){alert(e.message);}};c.append(b);}
 if(t.status==="closed"||t.status==="awarded"){const view=document.createElement("button");view.className="btn outline";view.textContent="Compare Bids";view.onclick=async()=>{view.disabled=true;try{const bd=await api("/v1/admin/tenders/bids?tender_id="+encodeURIComponent(t.id));const panel=document.createElement("section");panel.className="card";const heading=document.createElement("h4");heading.textContent="Editor bid comparison · "+bd.bids.length+" submission(s)";panel.append(heading);if(!bd.bids.length){const empty=document.createElement("p");empty.textContent="No editor bids were submitted for this tender.";panel.append(empty);}for(const bid of bd.bids){const row=document.createElement("article");row.className="card";const title=document.createElement("h4");title.textContent=bid.display_name+" · "+bid.public_editor_code;const price=document.createElement("p");price.textContent="Bid: "+(bid.bid_amount_minor/100).toLocaleString()+" "+bid.currency+" · Delivery: "+bid.delivery_days+" day(s) · Status: "+bid.status;const profile=document.createElement("p");profile.className="muted";profile.textContent="Country: "+(bid.country||"Not provided")+" · Languages: "+(Array.isArray(bid.languages_json)?bid.languages_json.join(", "):bid.languages_json||"Not provided")+" · Specializations: "+(Array.isArray(bid.specializations_json)?bid.specializations_json.join(", "):bid.specializations_json||"Not provided");const proposal=document.createElement("p");proposal.textContent="Proposal: "+(bid.proposal||"No proposal supplied");row.append(title,price,profile,proposal);if(t.status==="awarded"&&bid.status==="won"){const offer=document.createElement("button");offer.className="btn dark";offer.textContent="Create Managed Editor Offer";offer.onclick=async()=>{const raw=window.prompt("Enter the security deposit amount in "+bid.currency+" for this editor. This amount is not auto-set.");if(raw===null)return;const deposit=Number(raw);if(!Number.isFinite(deposit)||deposit<=0){alert("Enter a valid deposit amount greater than zero.");return;}const confirmed=window.confirm("Create managed offer for "+bid.display_name+"?\nEditor fee: "+(bid.bid_amount_minor/100)+" "+bid.currency+"\nDelivery: "+bid.delivery_days+" days\nSecurity deposit: "+deposit+" "+bid.currency+"\nThe editor must accept the offer, agreement and deposit before assignment.");if(!confirmed)return;offer.disabled=true;try{await api("/v1/admin/projects/"+t.project_id+"/offers",{method:"POST",body:JSON.stringify({editor_id:bid.editor_id,proposed_fee_minor:bid.bid_amount_minor,fee_currency:bid.currency,deposit_amount_minor:Math.round(deposit*100),deposit_currency:bid.currency,delivery_days:bid.delivery_days,offer_message:"Your tender bid has been selected by CSA. Please review the managed project offer, agreement and security deposit requirements."})});alert("Managed editor offer created. The editor can review it in the portal.");offer.textContent="Offer Created";}catch(e){alert(e.message);offer.disabled=false;}};row.append(offer);}if(t.status==="closed"&&["submitted","shortlisted"].includes(bid.status)){const award=document.createElement("button");award.className="btn dark";award.textContent="Select this editor";award.onclick=async()=>{const confirmed=window.confirm("Confirm tender award?\nEditor: "+bid.display_name+" ("+bid.public_editor_code+")\nBid: "+(bid.bid_amount_minor/100)+" "+bid.currency+"\nDelivery: "+bid.delivery_days+" days\n\nOther eligible bids will be rejected. This action cannot be undone here.");if(!confirmed)return;award.disabled=true;try{await api("/v1/admin/tenders/"+t.id+"/award",{method:"POST",body:JSON.stringify({bid_id:bid.id})});alert("Editor selected. You can now generate the client quotation.");loadTenderOps();}catch(e){alert(e.message);award.disabled=false;}};row.append(award);}panel.append(row);}c.append(panel);}catch(e){alert(e.message);}finally{view.disabled=false;}};c.append(view);}
 if(t.status==="awarded"){const quote=document.createElement("button");quote.className="btn dark";quote.textContent="Generate Client Quote";quote.onclick=async()=>{try{const q=await api("/v1/admin/tenders/"+t.id+"/quote",{method:"POST",body:"{}"});alert("Draft quote: "+(q.total_amount_minor/100)+" "+q.currency);const send=document.createElement("button");send.className="btn outline";send.textContent="Send Quote to Client";send.onclick=async()=>{try{await api("/v1/admin/quotes/"+q.quote_id+"/send",{method:"POST",body:"{}"});alert("Quote sent to client portal.");loadTenderOps();}catch(e){alert(e.message);}};c.append(send);}catch(e){alert(e.message);}};c.append(quote);}root.append(c);}
 }catch(e){root.textContent="Tender tools unavailable: "+e.message;}}

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
   const info=statusInfo[p.status]||statusInfo.submitted;
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
    const policy=dls.revision_policy||{included:Number(p.revisions_included||0),used:0,remaining:0,can_request:false};
    const review=document.createElement("section");review.className="panel";
    const reviewTitle=document.createElement("h4");reviewTitle.textContent="Video review & included revisions";
    const reviewMeta=document.createElement("p");reviewMeta.className="muted";reviewMeta.textContent="Revisions used: "+policy.used+" / "+policy.included+" · Remaining: "+policy.remaining;
    review.append(reviewTitle,reviewMeta);
    const history=dls.revision_requests||[];
    if(history.length){
     const historyList=document.createElement("ol");historyList.className="revision-history";
     for(const request of history){
      const item=document.createElement("li");
      const title=document.createElement("strong");title.textContent="Revision "+request.request_number+" · "+String(request.status||"open").replaceAll("_"," ");
      const note=document.createElement("p");note.textContent=request.notes||"No revision notes supplied.";
      const date=document.createElement("small");date.className="muted";date.textContent=request.created_at?"Requested "+new Date(request.created_at).toLocaleString():"Request date unavailable";
      item.append(title,note,date);historyList.append(item);
     }
     review.append(historyList);
    }else{
     const empty=document.createElement("p");empty.className="muted";empty.textContent="No revision requests have been submitted for this project.";review.append(empty);
    }
    if(policy.can_request&&dls.deliverables?.length){
     const notes=document.createElement("textarea");notes.required=true;notes.minLength=5;notes.maxLength=2000;notes.placeholder="Describe the exact changes you want CSA to make (minimum 5 characters).";
     const requestButton=document.createElement("button");requestButton.className="btn dark";requestButton.type="button";requestButton.textContent="Request included revision";
     const requestStatus=document.createElement("p");requestStatus.className="muted";requestStatus.setAttribute("role","status");
     requestButton.onclick=async()=>{if(notes.value.trim().length<5){requestStatus.textContent="Please describe the requested changes in at least 5 characters.";return;}requestButton.disabled=true;requestStatus.textContent="Submitting your revision request…";try{const result=await api("/v1/client/projects/"+encodeURIComponent(p.id)+"/revisions",{method:"POST",body:JSON.stringify({submission_id:dls.deliverables[0].id,notes:notes.value.trim()})});requestStatus.textContent="Revision request #"+result.request_number+" submitted successfully. Remaining included revisions: "+result.remaining_revisions+".";await loadClientProjects();}catch(error){requestStatus.textContent=error.message;requestButton.disabled=false;}};
     review.append(notes,requestButton,requestStatus);
    }else if(p.status==="client_review"&&policy.remaining===0){const limit=document.createElement("p");limit.className="muted";limit.textContent="Included revision limit reached. Contact CSA for additional changes.";review.append(limit);}
    else if(p.status==="revision"){const pending=document.createElement("p");pending.className="muted";pending.textContent="Your revision request has been sent to the assigned editor. New requests are paused until this revision is completed and reviewed.";review.append(pending);}
    else if(p.status==="client_review"){const unavailable=document.createElement("p");unavailable.className="muted";unavailable.textContent="A revision request is already open or the latest approved delivery is not available.";review.append(unavailable);}
    c.append(review);
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
 const metrics=$("admin-metrics"),projects=$("admin-projects"),editors=$("admin-editors"),ready=$("admin-ready"),departments=$("admin-departments");
 loadPortfolioVideoReviews();
 try{
  const [overview,pj,pe,ve,ro,qc,rf,dp]=await Promise.all([
   api("/v1/admin/overview"),api("/v1/admin/projects"),api("/v1/admin/editors/pending"),api("/v1/admin/editors/verified"),api("/v1/admin/offers/ready"),api("/v1/admin/submissions/pending"),api("/v1/admin/deposits/refunds/eligible"),api("/v1/admin/departments")
  ]);
  if(departments){departments.replaceChildren();for(const d of dp.departments||[]){const tag=document.createElement("span");tag.className="tag blue";tag.textContent=d.name+" · "+d.access_level;departments.append(tag)}if(!(dp.departments||[]).length)departments.textContent="No department access has been assigned.";}
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
   const meta=document.createElement("p");meta.className="muted";meta.textContent="Client budget: "+(p.budget_amount_minor/100)+" "+p.budget_currency+" · "+p.category+" · "+p.status+" · Department queues: "+(p.department_names||"Not assigned")+" · Deadline: "+(p.preferred_deadline||"Not set");
   let req={};try{req=JSON.parse(p.requirements_json||"{}");}catch{}
   const langLoc=document.createElement("p");langLoc.className="muted";langLoc.textContent="Languages: "+[req.communication_language&&("Communication: "+req.communication_language),req.source_language&&("Source: "+req.source_language),req.output_language&&("Output: "+req.output_language),req.subtitle_languages&&("Captions: "+req.subtitle_languages)].filter(Boolean).join(" · ")+" | Location: "+[req.client_city,req.client_region,req.client_country].filter(Boolean).join(", ")+(req.project_mode?" · "+req.project_mode:"")+(req.project_location?" · Project site: "+req.project_location:"");
   card.append(h,desc,meta,langLoc);
   if(["submitted","under_review","approved","matching"].includes(p.status)){
    const form=document.createElement("div");form.className="form";
    const editorSelect=document.createElement("select");editorSelect.setAttribute("aria-label","Verified editor");
    const first=document.createElement("option");first.value="";first.textContent="Select verified editor";editorSelect.append(first);
    const normalizeLang=v=>String(v||"").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
    const requestedLangs=String(req.source_language||"").split(/[,;+|]/).map(normalizeLang).filter(Boolean);
    const eligibleEditors=ve.editors.filter(x=>x.account_status==="active").map(e=>{let langs=[];try{langs=JSON.parse(e.languages_json||"[]");}catch{}const normalized=langs.map(normalizeLang).filter(Boolean);const matched=requestedLangs.length>0&&requestedLangs.some(want=>normalized.some(have=>have===want||have.startsWith(want+" ")||want.startsWith(have+" ")));return {...e,editorLanguages:langs,languageMatched:matched};}).sort((a,b)=>Number(b.languageMatched)-Number(a.languageMatched)||a.display_name.localeCompare(b.display_name));
    const matchedEditors=eligibleEditors.filter(e=>e.languageMatched);
    const matchNote=document.createElement("p");matchNote.className="muted";
    if(requestedLangs.length){matchNote.textContent=matchedEditors.length+" verified editor(s) match source language: "+requestedLangs.join(", ")+". Language-matched editors are listed first; CSA Admin must still review and select the editor.";}
    else{matchNote.textContent="Source language is not specified. Add it to the project brief to enable language-based editor recommendations.";}
    form.append(matchNote);
    for(const e of eligibleEditors){const opt=document.createElement("option");opt.value=e.id;opt.textContent=(e.languageMatched?"✓ LANGUAGE MATCH · ":"")+e.public_editor_code+" · "+e.display_name+" · "+[e.city,e.country].filter(Boolean).join(", ")+" · "+(e.editorLanguages.join("/")||"Languages not listed");editorSelect.append(opt);}
    if(matchedEditors.length)editorSelect.value=matchedEditors[0].id;
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
 try{
  const d=await api("/v1/editor/assignments");root.replaceChildren();
  if(!d.assignments.length){root.textContent="No active assignments yet.";return;}
  for(const assignment of d.assignments){
   const card=document.createElement("article");card.className="card";
   const heading=document.createElement("h3");heading.textContent=assignment.title+" · "+assignment.public_project_code;
   const brief=document.createElement("p");brief.textContent=assignment.brief||"No additional brief supplied.";
   const meta=document.createElement("p");meta.className="muted";meta.textContent="Due: "+assignment.due_at+" · Status: "+assignment.status+" · Delivery window: "+assignment.delivery_days+" day(s)";
   card.append(heading,brief,meta);
   if(assignment.revision_notes){const revision=document.createElement("section");revision.className="panel";const label=document.createElement("h4");label.textContent="Client revision request · "+assignment.revisions_used+"/"+assignment.revisions_included+" included";const details=document.createElement("p");details.textContent=assignment.revision_notes;revision.append(label,details);card.append(revision);}
   const sourceHeading=document.createElement("h4");sourceHeading.textContent="Project source files";card.append(sourceHeading);
   try{
    const sourceFiles=await api("/v1/projects/"+assignment.project_id+"/files");
    if(!sourceFiles.files?.length){const empty=document.createElement("p");empty.className="muted";empty.textContent="No source files attached.";card.append(empty);}
    for(const sf of sourceFiles.files||[]){
     const dl=document.createElement("button");dl.className="btn outline";dl.type="button";dl.textContent="Download source: "+sf.original_filename;
     dl.onclick=async()=>{dl.disabled=true;try{const response=await fetch(API+"/v1/files/"+sf.id,{headers:{authorization:"Bearer "+token}});if(!response.ok)throw Error("Source download denied");const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=sf.original_filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){alert(error.message);}finally{dl.disabled=false;}};
     card.append(dl);
    }
   }catch(error){const warning=document.createElement("p");warning.className="muted";warning.textContent="Source files could not be loaded: "+error.message;card.append(warning);}
   const historyHeading=document.createElement("h4");historyHeading.textContent="Submission and QC history";card.append(historyHeading);
   try{
    const history=await api("/v1/editor/assignments/"+assignment.id+"/submissions");
    if(!history.submissions?.length){const empty=document.createElement("p");empty.className="muted";empty.textContent="No work submitted yet.";card.append(empty);}
    for(const item of history.submissions||[]){
     const row=document.createElement("p");row.className="muted";
     row.textContent="Version "+item.version_number+" · "+item.original_filename+" · "+item.qc_status+" · "+new Date(item.submitted_at).toLocaleString()+(item.notes?" · Note: "+item.notes:"");
     card.append(row);
    }
   }catch(error){const warning=document.createElement("p");warning.className="muted";warning.textContent="Submission history unavailable: "+error.message;card.append(warning);}
   if(assignment.status==="active"||assignment.status==="revision"){
    const uploadHeading=document.createElement("h4");uploadHeading.textContent=assignment.status==="revision"?"Upload requested revision":"Submit completed work";card.append(uploadHeading);
    const file=document.createElement("input");file.type="file";file.accept="video/*,audio/*,image/*,application/pdf,application/zip";
    const note=document.createElement("input");note.placeholder="Submission notes (optional)";
    const submit=document.createElement("button");submit.className="btn dark";submit.type="button";submit.textContent=assignment.status==="revision"?"Submit revised version":"Submit work to CSA";
    submit.onclick=async()=>{
     const selected=file.files[0];if(!selected){alert("Select a file first.");return;}if(selected.size>5*1024*1024*1024){alert("Staging upload limit is 5 GB per file.");return;}
     submit.disabled=true;
     try{
      if(selected.size>90*1024*1024){
       submit.textContent="Uploading…";
       await multipartUpload(selected,{purpose:"submission",assignment_id:assignment.id,notes:note.value},(sent,total,part,count)=>{submit.textContent="Uploading "+Math.round(sent/total*100)+"% · Part "+part+"/"+count;},null,state=>{if(state.type==="retry")submit.textContent="Retrying · "+state.attempt+"/3 · "+Math.ceil(state.delay/1000)+"s";if(state.type==="completing")submit.textContent="Verifying upload…";});
      }else{
       const response=await fetch(API+"/v1/assignments/"+assignment.id+"/submissions",{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":selected.type||"application/octet-stream","x-file-name":selected.name,"x-submission-notes":note.value},body:selected});
       const result=await response.json();if(!response.ok)throw Error(result.error?.message||"Upload failed");
      }
      alert("Work submitted to CSA for quality review.");await loadAssignments();
     }catch(error){alert(error.message);submit.disabled=false;submit.textContent=assignment.status==="revision"?"Submit revised version":"Submit work to CSA";}
    };
    card.append(file,note,submit);
   }else{
    const locked=document.createElement("p");locked.className="muted";locked.textContent=assignment.status==="submitted"||assignment.status==="quality_check"?"Submission received. Upload is paused while CSA completes quality review.":"This assignment is not currently accepting uploads.";card.append(locked);
   }
   root.append(card);
  }
 }catch(error){root.textContent=error.message;}
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
async function loadCsaNotifications(role){
 const root=$(role+"-notifications"),prefs=$(role+"-notification-preferences");if(!root)return;
 try{
  const [list,settings]=await Promise.all([api("/v1/notifications"),api("/v1/notifications/preferences")]);
  root.replaceChildren();const items=list.notifications||[];
  if(!items.length)root.textContent="No new notifications.";
  for(const n of items){const card=document.createElement("article");card.className="card";const title=document.createElement("h4");title.textContent=n.title||"CSA update";const body=document.createElement("p");body.textContent=n.body||n.message||"";const meta=document.createElement("small");meta.className="muted";meta.textContent=(n.created_at||"")+" · "+(n.read_at?"Read":"Unread");card.append(title,body,meta);
   if(!n.read_at){const b=document.createElement("button");b.className="btn outline";b.textContent="Mark as read";b.onclick=async()=>{b.disabled=true;try{await api("/v1/notifications/"+encodeURIComponent(n.id)+"/read",{method:"POST",body:"{}"});await loadCsaNotifications(role);}catch(e){alert(e.message);b.disabled=false;}};card.append(b);}root.append(card);}
  if(prefs){prefs.replaceChildren();const form=document.createElement("form");form.className="panel form";const heading=document.createElement("h3");heading.textContent="Notification preferences";form.append(heading);
   for(const [key,label] of [["in_app_enabled","In-app notifications"],["email_enabled","Email notifications"],["whatsapp_enabled","WhatsApp notifications (optional opt-in)"]]){const wrap=document.createElement("label");wrap.className="field";const input=document.createElement("input");input.type="checkbox";input.name=key;input.checked=!!settings.preferences?.[key];wrap.append(input,document.createTextNode(" "+label));form.append(wrap);}
   const save=document.createElement("button");save.className="btn dark";save.textContent="Save preferences";form.append(save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const data={};for(const key of ["in_app_enabled","email_enabled","whatsapp_enabled"])data[key]=!!form.elements[key].checked;await api("/v1/notifications/preferences",{method:"PUT",body:JSON.stringify(data)});save.textContent="Saved";}catch(err){alert(err.message);save.disabled=false;}};prefs.append(form);}
 }catch(e){root.textContent="Notifications unavailable: "+e.message;if(prefs)prefs.textContent="Preferences unavailable: "+e.message;}
}
async function loadClientRefundRequests(){const root=$("client-refunds");if(!root)return;root.textContent="Loading refund requests…";try{const d=await api("/v1/client/refunds");root.replaceChildren();const rows=d.refunds||[];if(!rows.length){root.textContent="No refund requests submitted.";return;}for(const r of rows){const c=document.createElement("article");c.className="card";const h=document.createElement("h4");h.textContent="Refund · "+(Number(r.amount_minor||0)/100).toFixed(2)+" "+(r.currency||"INR");const p=document.createElement("p");p.textContent="Status: "+r.status+" · "+(r.reason||"");c.append(h,p);root.append(c);}}catch(e){root.textContent="Refund history unavailable: "+e.message;}}
async function submitClientRefund(form){const msg=$("client-refund-message"),f=new FormData(form),amount=Math.round(Number(f.get("amount"))*100);if(!Number.isSafeInteger(amount)||amount<=0){msg.textContent="Enter a valid refund amount.";return;}const key=(crypto.randomUUID?crypto.randomUUID():("csa-"+Date.now()+"-"+Math.random().toString(36).slice(2)));try{await api("/v1/client/refunds",{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify({payment_id:String(f.get("payment_id")).trim(),amount_minor:amount,currency:"INR",reason:String(f.get("reason")).trim(),idempotency_key:key})});msg.textContent="Refund request submitted to CSA Finance.";form.reset();await loadClientRefundRequests();}catch(e){msg.textContent=e.message;}}
async function loadAdminClientRefunds(){const root=$("admin-client-refunds");if(!root)return;root.textContent="Loading finance review queue…";try{const d=await api("/v1/admin/client-refunds");root.replaceChildren();const rows=d.refunds||[];if(!rows.length){root.textContent="No client refund requests awaiting review.";return;}for(const r of rows){const c=document.createElement("article");c.className="card";const h=document.createElement("h4");h.textContent=(r.amount_minor/100).toFixed(2)+" "+r.currency+" · "+r.status;const p=document.createElement("p");p.textContent="Client: "+r.client_id+" · Payment: "+r.payment_id+" · "+r.reason;c.append(h,p);for(const [action,label] of [["under_review","Mark under review"],["approve","Approve for processing"],["reject","Reject"]]){if(r.status!=="requested"&&r.status!=="under_review")continue;const b=document.createElement("button");b.className="btn "+(action==="approve"?"dark":"outline");b.textContent=label;b.onclick=async()=>{let review_note="";if(action==="reject"){review_note=prompt("Rejection reason (required):")||"";if(review_note.trim().length<3)return;}b.disabled=true;try{await api("/v1/admin/client-refunds/"+encodeURIComponent(r.id),{method:"PATCH",body:JSON.stringify({action,review_note})});await loadAdminClientRefunds();}catch(e){alert(e.message);b.disabled=false;}};c.append(b);}root.append(c);}}catch(e){root.textContent="Finance review queue unavailable: "+e.message;}}

})();