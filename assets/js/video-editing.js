(() => {
"use strict";
const API="https://csa-video-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const show=(el,text)=>{el.textContent=text;el.classList.remove("ve-hidden");};
const hide=el=>el.classList.add("ve-hidden");
const headers=token=>({"Authorization":"Bearer "+token});
const statusList=["Order Received","Files Under Review","Editing in Progress","Preview Ready","Revision Requested","Final Editing","Completed – Download Available","On Hold","Cancelled"];
let currentOrder=null;
let currentToken=null;
let adminToken=null;
let latestOrders=[];
try{const last=localStorage.getItem("csa_video_last_order");if(last){$("trackForm").elements.orderCode.value=last;$("trackForm").elements.accessToken.value=localStorage.getItem("csa_video_order_"+last)||"";}}catch(e){}
function saveAccess(code,token){try{localStorage.setItem("csa_video_order_"+code,token);localStorage.setItem("csa_video_last_order",code);}catch(e){}}
async function api(path,options={}){const r=await fetch(API+path,options);let data={};try{data=await r.json();}catch(e){}if(!r.ok)throw Error(data.error||("Request failed ("+r.status+")"));return data;}
$("orderForm").addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,btn=$("createOrderBtn"),msg=$("orderMessage");btn.disabled=true;hide(msg);
 const d=Object.fromEntries(new FormData(form).entries());\n const matchDetails=["CSA EDITOR MATCHING REQUIREMENTS","Content style: "+(d.contentStyle||"Not specified"),"Raw video spoken language: "+(d.sourceLanguage||"Not specified"),"Final video language: "+(d.outputLanguage||"Not specified"),"Subtitle/caption language: "+(d.subtitleLanguage||"Not specified"),"Dialect/accent: "+(d.dialect||"Not specified"),"Client location: "+[d.city,d.state,d.country].filter(Boolean).join(", "),"Project location mode: "+(d.locationMode||"Remote editing")].join("\n");\n d.instructions=(d.instructions?d.instructions+"\n\n":"")+matchDetails;if(d.reference)d.instructions+="\nReference link: "+d.reference;
 try{const result=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});
 currentOrder=result.orderCode;currentToken=result.accessToken;saveAccess(currentOrder,currentToken);
 show(msg,"Order created successfully.\nOrder ID: "+currentOrder+"\nPrivate access token: "+currentToken+"\nSave both now. The token is shown only once and cannot be recovered. You can upload your raw footage below.");
 $("uploadAfterOrder").classList.remove("ve-hidden");$("uploadAfterOrder").dataset.order=currentOrder;$("uploadAfterOrder").dataset.token=currentToken;
 }catch(err){show(msg,err.message);}finally{btn.disabled=false;}
});
async function uploadOne(file,code,token,onProgress){
 const init=await api("/api/orders/"+encodeURIComponent(code)+"/files/initiate",{method:"POST",headers:{...headers(token),"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type||"application/octet-stream",size:file.size})});
 const count=init.totalParts,chunk=init.partSize;
 for(let part=1;part<=count;part++){
  const start=(part-1)*chunk,end=Math.min(file.size,start+chunk),blob=file.slice(start,end);
  await api("/api/uploads/"+init.fileId,{method:"PUT",headers:{...headers(token),"X-Part-Number":String(part),"Content-Type":"application/octet-stream"},body:blob});
  onProgress(end/file.size);
 }
 await api("/api/uploads/"+init.fileId,{method:"POST",headers:headers(token)});
}
$("uploadBtn").addEventListener("click",async()=>{
 const files=Array.from($("rawFiles").files||[]),code=$("uploadAfterOrder").dataset.order,token=$("uploadAfterOrder").dataset.token,btn=$("uploadBtn");
 if(!files.length){$("uploadStatus").textContent="Please select at least one file.";return;}
 btn.disabled=true;let done=0;const total=files.reduce((s,f)=>s+f.size,0);
 try{for(const file of files){$("uploadStatus").textContent="Uploading "+file.name+"…";await uploadOne(file,code,token,ratio=>{$("uploadProgress").style.width=((done+file.size*ratio)/total*100)+"%";});done+=file.size;}
 $("uploadStatus").textContent="All selected files uploaded successfully. Your team can now review the footage.";
 $("rawFiles").value="";
 }catch(err){$("uploadStatus").textContent="Upload stopped: "+err.message+". Your completed parts may remain in storage; retry with a new upload if needed.";}finally{btn.disabled=false;}
});
$("trackForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget),code=String(f.get("orderCode")).trim().toUpperCase(),token=String(f.get("accessToken")).trim(),msg=$("trackMessage"),result=$("trackResult");hide(msg);hide(result);
 try{const d=await api("/api/orders/"+encodeURIComponent(code),{headers:headers(token)});currentOrder=code;currentToken=token;renderTracking(d,token);}
 catch(err){show(msg,err.message);}
});
function renderTracking(d,token){
 const root=$("trackResult");root.innerHTML="";root.classList.remove("ve-hidden");
 const o=d.order||{};const title=document.createElement("h3");title.textContent=o.order_code||"Order";root.append(title);
 const st=document.createElement("p");const badge=document.createElement("span");badge.className="ve-status";badge.textContent=o.order_status||"Status unavailable";st.append("Current status: ",badge);root.append(st);
 const details=document.createElement("p");details.textContent="Package: "+(o.service_package||"Custom")+" · Project: "+(o.project_type||"Not specified")+" · Deadline: "+(o.deadline||"To be confirmed");root.append(details);
 if(o.instructions){const brief=document.createElement("p");brief.className="ve-note";brief.style.whiteSpace="pre-wrap";brief.textContent="Project brief & editor matching requirements:\n"+o.instructions;root.append(brief);}
 const hist=document.createElement("div");hist.className="ve-files";(d.history||[]).forEach(h=>{const p=document.createElement("p");p.className="ve-note";p.textContent=(h.created_at||"")+" — "+(h.new_status||"")+" "+(h.note?"· "+h.note:"");hist.append(p);});root.append(hist);
 const files=document.createElement("div");files.className="ve-files";(d.files||[]).forEach(file=>{const row=document.createElement("div");row.className="ve-file";const label=document.createElement("span");label.textContent=file.original_filename+" · "+file.file_role+" · "+file.upload_state;row.append(label);if(file.upload_state==="complete"){const b=document.createElement("button");b.className="ve-btn alt";b.type="button";b.textContent="Download";b.addEventListener("click",async()=>{try{const response=await fetch(API+"/api/orders/"+encodeURIComponent(o.order_code)+"/files/"+file.id+"/download",{headers:headers(token)});if(!response.ok)throw Error("Download failed");const blob=await response.blob(),a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=file.original_filename;a.click();URL.revokeObjectURL(url);}catch(err){alert(err.message);}});row.append(b);}files.append(row);});root.append(files);
 const extra=document.createElement("div");extra.className="ve-order";const title2=document.createElement("h3");title2.textContent="Upload additional footage";extra.append(title2);const input2=document.createElement("input");input2.type="file";input2.multiple=true;input2.accept="video/*,audio/*,image/*,.zip,.7z,.rar,.pdf";extra.append(input2);const progress2=document.createElement("p");progress2.className="ve-note";extra.append(progress2);const addBtn=document.createElement("button");addBtn.type="button";addBtn.className="ve-btn alt";addBtn.textContent="Upload files";addBtn.addEventListener("click",async()=>{const chosen=Array.from(input2.files||[]);if(!chosen.length){progress2.textContent="Select files first.";return;}addBtn.disabled=true;try{for(const file of chosen){progress2.textContent="Uploading "+file.name+"…";await uploadOne(file,o.order_code,token,ratio=>{progress2.textContent="Uploading "+file.name+" · "+Math.round(ratio*100)+"%";});}const refreshed=await api("/api/orders/"+encodeURIComponent(o.order_code),{headers:headers(token)});renderTracking(refreshed,token);}catch(err){progress2.textContent="Upload failed: "+err.message;}finally{addBtn.disabled=false;}});extra.append(addBtn);root.append(extra);
}
$("adminLogin").addEventListener("submit",async e=>{
 e.preventDefault();const key=String(new FormData(e.currentTarget).get("adminKey")).trim(),msg=$("adminMessage");adminToken=key;try{await loadAdmin();show(msg,"Admin dashboard connected.");}catch(err){adminToken=null;show(msg,err.message);}
});
async function loadAdmin(){const d=await api("/api/admin/orders",{headers:headers(adminToken)});latestOrders=d.orders||[];renderAdmin();}
function renderAdmin(){
 const root=$("adminOrders");root.innerHTML="";
 if(!latestOrders.length){root.textContent="No orders received yet.";return;}
 latestOrders.forEach(o=>{
  const card=document.createElement("article");card.className="ve-order";
  const h=document.createElement("h3");h.textContent=o.order_code+" · "+o.customer_name;card.append(h);
  const p=document.createElement("p");p.textContent=o.customer_email+" · "+o.customer_phone+" · "+(o.service_package||"Custom");card.append(p);
  if(o.instructions){const brief=document.createElement("p");brief.className="ve-note";brief.style.whiteSpace="pre-wrap";brief.textContent="Project brief & language/location matching:\n"+o.instructions;card.append(brief);}
  const controls=document.createElement("div");controls.className="ve-actions";
  const sel=document.createElement("select");statusList.forEach(s=>{const op=document.createElement("option");op.value=s;op.textContent=s;if(s===o.order_status)op.selected=true;sel.append(op);});controls.append(sel);
  const note=document.createElement("input");note.placeholder="Status note (optional)";note.setAttribute("aria-label","Status note");controls.append(note);
  const update=document.createElement("button");update.className="ve-btn";update.type="button";update.textContent="Update status";update.addEventListener("click",async()=>{try{await api("/api/admin/orders/"+encodeURIComponent(o.order_code),{method:"PATCH",headers:{...headers(adminToken),"Content-Type":"application/json"},body:JSON.stringify({status:sel.value,note:note.value})});await loadAdmin();}catch(err){alert(err.message);}});controls.append(update);
  const upload=document.createElement("input");upload.type="file";upload.accept="video/*,audio/*,image/*,.zip,.pdf";upload.setAttribute("aria-label","Select preview or final file");controls.append(upload);
  const role=document.createElement("select");["preview","final"].forEach(s=>{const op=document.createElement("option");op.value=s;op.textContent=s==="preview"?"Preview file":"Final delivery";role.append(op);});controls.append(role);
  const deliver=document.createElement("button");deliver.className="ve-btn alt";deliver.type="button";deliver.textContent="Upload delivery";deliver.addEventListener("click",async()=>{const file=upload.files[0];if(!file){alert("Select a file first.");return;}deliver.disabled=true;try{await adminUpload(o.order_code,file,role.value);await loadAdmin();alert("File uploaded to private order storage.");}catch(err){alert(err.message);}finally{deliver.disabled=false;}});controls.append(deliver);
  const view=document.createElement("button");view.className="ve-btn alt";view.type="button";view.textContent="View raw files & history";view.addEventListener("click",async()=>{try{const detail=await api("/api/admin/orders/"+encodeURIComponent(o.order_code),{headers:headers(adminToken)});let box=card.querySelector(".ve-detail");if(!box){box=document.createElement("div");box.className="ve-detail";card.append(box);}box.innerHTML="";if(detail.order&&detail.order.instructions){const brief=document.createElement("p");brief.className="ve-note";brief.style.whiteSpace="pre-wrap";brief.textContent="Project brief & language/location matching:\n"+detail.order.instructions;box.append(brief);}(detail.files||[]).forEach(file=>{const row=document.createElement("div");row.className="ve-file";const label=document.createElement("span");label.textContent=file.original_filename+" · "+file.file_role+" · "+file.upload_state;row.append(label);if(file.upload_state==="complete"){const dl=document.createElement("button");dl.className="ve-btn alt";dl.type="button";dl.textContent="Download";dl.addEventListener("click",async()=>{try{const r=await fetch(API+"/api/admin/orders/"+encodeURIComponent(o.order_code)+"/files/"+file.id+"/download",{headers:headers(adminToken)});if(!r.ok)throw Error("Download failed");const blob=await r.blob(),a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=file.original_filename;a.click();URL.revokeObjectURL(url);}catch(err){alert(err.message);}});row.append(dl);}box.append(row);});(detail.history||[]).forEach(h=>{const line=document.createElement("p");line.className="ve-note";line.textContent=(h.created_at||"")+" — "+(h.new_status||"")+" "+(h.note||"");box.append(line);});}catch(err){alert(err.message);}});controls.append(view);
  card.append(controls);root.append(card);
 });
}
async function adminUpload(code,file,role){
 const init=await api("/api/admin/orders/"+encodeURIComponent(code)+"/files/initiate",{method:"POST",headers:{...headers(adminToken),"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type||"application/octet-stream",size:file.size,role})});
 for(let part=1;part<=init.totalParts;part++){const blob=file.slice((part-1)*init.partSize,Math.min(file.size,part*init.partSize));await api("/api/uploads/"+init.fileId,{method:"PUT",headers:{...headers(adminToken),"X-Part-Number":String(part),"Content-Type":"application/octet-stream"},body:blob});}
 await api("/api/uploads/"+init.fileId,{method:"POST",headers:headers(adminToken)});
}
})();