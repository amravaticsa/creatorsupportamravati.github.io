(() => {
"use strict";
const API="https://csa-video-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const hide=el=>el.classList.add("cd-hide");
const show=(el,msg)=>{el.textContent=msg;el.classList.remove("cd-hide");};
const auth=token=>({Authorization:"Bearer "+token});
let orderCode="",accessToken="";
async function api(path,options={}){const r=await fetch(API+path,options);let d={};try{d=await r.json();}catch{}if(!r.ok)throw Error(d.error||"Request failed ("+r.status+")");return d;}
function save(code,token){try{localStorage.setItem("csa_video_last_order",code);localStorage.setItem("csa_video_order_"+code,token);}catch{}}
function loadSaved(){try{const code=localStorage.getItem("csa_video_last_order");if(code){$("trackForm").elements.orderCode.value=code;$("trackForm").elements.accessToken.value=localStorage.getItem("csa_video_order_"+code)||"";}}catch{}}
$("clientOrderForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("submitRequest"),msg=$("requestMessage");btn.disabled=true;hide(msg);
 const d=Object.fromEntries(new FormData(e.currentTarget).entries());
 if(d.reference)d.instructions=(d.instructions?d.instructions+"\n\n":"")+"Reference link: "+d.reference;
 try{
  const result=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});
  orderCode=result.orderCode;accessToken=result.accessToken;save(orderCode,accessToken);
  show(msg,"Aapka request successfully receive ho gaya!\n\nOrder ID: "+orderCode+"\nPrivate access code: "+accessToken+"\n\nIn dono ko safe rakhein. CSA team aapki requirement review karke aapse contact karegi.");
  $("uploadArea").classList.remove("cd-hide");$("uploadArea").dataset.order=orderCode;$("uploadArea").dataset.token=accessToken;
  $("trackForm").elements.orderCode.value=orderCode;$("trackForm").elements.accessToken.value=accessToken;
 }catch(err){show(msg,"Request submit nahi ho paya: "+err.message+"\nPlease dobara try karein ya CSA se contact karein.");}
 finally{btn.disabled=false;}
});
async function uploadFile(file,code,token,progress){
 const init=await api("/api/orders/"+encodeURIComponent(code)+"/files/initiate",{method:"POST",headers:{...auth(token),"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type||"application/octet-stream",size:file.size})});
 for(let part=1;part<=init.totalParts;part++){const start=(part-1)*init.partSize,end=Math.min(file.size,start+init.partSize);await api("/api/uploads/"+init.fileId,{method:"PUT",headers:{...auth(token),"X-Part-Number":String(part),"Content-Type":"application/octet-stream"},body:file.slice(start,end)});progress(end/file.size);}
 await api("/api/uploads/"+init.fileId,{method:"POST",headers:auth(token)});
}
$("uploadButton").addEventListener("click",async()=>{
 const files=Array.from($("rawFiles").files||[]),code=$("uploadArea").dataset.order,token=$("uploadArea").dataset.token,btn=$("uploadButton");
 if(!files.length){$("uploadStatus").textContent="Pehle files select karein.";return;}
 btn.disabled=true;const total=files.reduce((n,f)=>n+f.size,0);let done=0;
 try{for(const f of files){$("uploadStatus").textContent=f.name+" upload ho rahi hai…";await uploadFile(f,code,token,x=>$("uploadProgress").style.width=((done+f.size*x)/total*100)+"%");done+=f.size;}
 $("uploadStatus").textContent="Upload complete. CSA team ko aapki files mil gayi hain.";$("rawFiles").value="";
 }catch(err){$("uploadStatus").textContent="Upload ruk gaya: "+err.message+". Internet check karke phir try karein.";}
 finally{btn.disabled=false;}
});
$("trackForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);orderCode=String(f.get("orderCode")).trim().toUpperCase();accessToken=String(f.get("accessToken")).trim();const msg=$("trackMessage"),root=$("trackResult");hide(msg);hide(root);
 try{const d=await api("/api/orders/"+encodeURIComponent(orderCode),{headers:auth(accessToken)});save(orderCode,accessToken);render(d);}
 catch(err){show(msg,"Project open nahi ho paya: "+err.message+". Order ID aur access code check karein.");}
});
const statusText={
 order_received:"Request received",files_under_review:"CSA team is reviewing your files",editing_in_progress:"Editing in progress",preview_ready:"Preview ready",revision_requested:"Revision requested",final_editing:"Final editing in progress",completed:"Final video ready",on_hold:"Project on hold",cancelled:"Project cancelled",pending_review:"CSA team is reviewing your request"
};
function render(d){
 const root=$("trackResult"),o=d.order||{};root.replaceChildren();root.classList.remove("cd-hide");
 const h=document.createElement("h3");h.textContent="Project "+(o.order_code||orderCode);root.append(h);
 const status=document.createElement("p"),pill=document.createElement("span");pill.className="cd-status";pill.textContent=statusText[o.order_status]||o.order_status||"Status update pending";status.append("Current update: ",pill);root.append(status);
 const summary=document.createElement("p");summary.className="cd-help";summary.textContent="Project: "+(o.service_package||"Video editing")+" · Deadline: "+(o.deadline||"To be confirmed");root.append(summary);
 if(d.history&&d.history.length){const hist=document.createElement("div");hist.className="cd-history";d.history.forEach(item=>{const p=document.createElement("p");p.textContent=(item.created_at||"")+" · "+(statusText[item.new_status]||item.new_status)+(item.note?" — "+item.note:"");hist.append(p);});root.append(hist);}
 const files=(d.files||[]).filter(f=>f.file_role==="preview"||f.file_role==="final");
 if(files.length){const title=document.createElement("h3");title.textContent="Your files";root.append(title);files.forEach(file=>{const row=document.createElement("div");row.className="cd-file";const name=document.createElement("span");name.textContent=file.file_role==="final"?"Final delivery":"Preview";row.append(name);if(file.upload_state==="complete"){const b=document.createElement("button");b.className="cd-btn cd-btn-light";b.type="button";b.textContent="Download";b.addEventListener("click",async()=>{try{const r=await fetch(API+"/api/orders/"+encodeURIComponent(o.order_code)+"/files/"+file.id+"/download",{headers:auth(accessToken)});if(!r.ok)throw Error("Download unavailable");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file.original_filename||"CSA-video";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(err){alert(err.message);}});row.append(b);}else{const pending=document.createElement("small");pending.textContent="Processing";row.append(pending);}root.append(row);});}
 const upload=document.createElement("div");upload.style.marginTop="18px";const label=document.createElement("label");label.className="cd-form";label.textContent="Additional footage upload";const input=document.createElement("input");input.type="file";input.multiple=true;input.accept="video/*,audio/*,image/*,.zip,.7z,.rar,.pdf";label.append(input);upload.append(label);const note=document.createElement("p");note.className="cd-help";upload.append(note);const btn=document.createElement("button");btn.type="button";btn.className="cd-btn cd-btn-light";btn.textContent="Upload selected files";btn.addEventListener("click",async()=>{const chosen=Array.from(input.files||[]);if(!chosen.length){note.textContent="Please select files first.";return;}btn.disabled=true;try{for(const file of chosen){note.textContent="Uploading "+file.name+"…";await uploadFile(file,o.order_code,accessToken,ratio=>note.textContent="Uploading "+file.name+" · "+Math.round(ratio*100)+"%");}note.textContent="Upload complete. Files received by CSA.";const fresh=await api("/api/orders/"+encodeURIComponent(o.order_code),{headers:auth(accessToken)});render(fresh);}catch(err){note.textContent="Upload failed: "+err.message;}finally{btn.disabled=false;}});upload.append(btn);root.append(upload);
}
loadSaved();
})();