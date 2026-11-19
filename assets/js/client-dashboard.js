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
  show(msg,"Aapki application successfully submit ho gayi!\n\nApplication / Order ID: "+orderCode+"\nPrivate access code: "+accessToken+"\n\nIs code ko sambhal kar rakhein. Ab neeche raw footage upload kar sakte hain. Aapka status bhi isi page par milega.");
  $("uploadArea").classList.remove("cd-hide");$("uploadArea").dataset.order=orderCode;$("uploadArea").dataset.token=accessToken;
  $("trackForm").elements.orderCode.value=orderCode;$("trackForm").elements.accessToken.value=accessToken;
  $("track-project").scrollIntoView({behavior:"smooth",block:"start"});
  const current=await api("/api/orders/"+encodeURIComponent(orderCode),{headers:auth(accessToken)});render(current);
 }catch(err){show(msg,"Request submit nahi ho paya: "+err.message+"\nPlease dobara try karein ya CSA se contact karein.");}
 finally{btn.disabled=false;}
});
async function uploadFile(file,code,token,progress){
 const init=await api("/api/orders/"+encodeURIComponent(code)+"/files/initiate",{method:"POST",headers:{...auth(token),"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type||"application/octet-stream",size:file.size})});
 for(let part=1;part<=init.totalParts;part++){const start=(part-1)*init.partSize,end=Math.min(file.size,start+init.partSize);await api("/api/uploads/"+init.fileId,{method:"PUT",headers:{...auth(token),"X-Part-Number":String(part),"Content-Type":"application/octet-stream"},body:file.slice(start,end)});progress(end/file.size);}
 await api("/api/uploads/"+init.fileId,{method:"POST",headers:auth(token)});
}
async function uploadSelected(input,code,token,note,bar,button){
 const files=Array.from(input.files||[]);if(!files.length){note.textContent="Pehle apne raw clips select karein.";return;}
 button.disabled=true;const total=files.reduce((n,f)=>n+f.size,0);let done=0;
 try{for(const f of files){note.textContent=f.name+" upload ho rahi hai…";await uploadFile(f,code,token,x=>bar.style.width=((done+f.size*x)/total*100)+"%");done+=f.size;}
 note.textContent="Upload complete! Aapki raw footage CSA ko mil gayi hai.";input.value="";
 }catch(err){note.textContent="Upload ruk gaya: "+err.message+". Internet check karke dobara try karein.";}
 finally{button.disabled=false;}
}
$("uploadButton").addEventListener("click",()=>uploadSelected($("rawFiles"),$("uploadArea").dataset.order,$("uploadArea").dataset.token,$("uploadStatus"),$("uploadProgress"),$("uploadButton")));
$("trackForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);orderCode=String(f.get("orderCode")).trim().toUpperCase();accessToken=String(f.get("accessToken")).trim();const msg=$("trackMessage"),root=$("trackResult");hide(msg);hide(root);
 try{const d=await api("/api/orders/"+encodeURIComponent(orderCode),{headers:auth(accessToken)});save(orderCode,accessToken);render(d);}
 catch(err){show(msg,"Project open nahi ho paya: "+err.message+". Application ID aur private access code check karein.");}
});
function norm(v){return String(v||"").toLowerCase().replace(/[_–—-]+/g," ").replace(/\s+/g," ").trim();}
function stageFor(status,payment,amount){
 const s=norm(status),p=norm(payment);
 if(s.includes("cancel"))return 0;
 if(s.includes("completed")||s.includes("download available"))return 5;
 if(s.includes("preview"))return 4;
 if(s.includes("editing")||s.includes("revision")||s.includes("final editing"))return 3;
 if(p.includes("paid")||p.includes("partial"))return 3;
 if(Number(amount||0)>0)return 2;
 if(s.includes("file")||s.includes("review")||s.includes("hold"))return 1;
 return 0;
}
const stageNames=["Application submitted","CSA review","Quotation & 50% advance","Editing in progress","Preview & revisions","Final delivery"];
function render(d){
 const root=$("trackResult"),o=d.order||{};root.replaceChildren();root.classList.remove("cd-hide");
 const panel=document.createElement("div");panel.className="cd-status-panel";
 const head=document.createElement("div");head.className="cd-status-head";
 const h=document.createElement("h3");h.textContent="Application status · "+(o.order_code||orderCode);head.append(h);
 const pill=document.createElement("span");pill.className="cd-status";pill.textContent=humanStatus(o.order_status);head.append(pill);panel.append(head);
 const current=stageFor(o.order_status,o.payment_status,o.quoted_amount_paise);
 const timeline=document.createElement("div");timeline.className="cd-timeline";
 stageNames.forEach((name,i)=>{const item=document.createElement("div");item.className="cd-stage"+(i<current?" done":i===current?" current":"");const dot=document.createElement("span");dot.className="dot";dot.textContent=i<current?"✓":String(i+1);const b=document.createElement("b");b.textContent=name;const small=document.createElement("small");small.textContent=i<current?"Completed":i===current?"Current stage":"Pending";item.append(dot,b,small);timeline.append(item);});panel.append(timeline);
 const summary=document.createElement("p");summary.className="cd-help";summary.textContent="Video type: "+(o.service_package||"Video editing")+" · Deadline: "+(o.deadline||"To be confirmed")+" · Last updated: "+(o.updated_at||"");panel.append(summary);
 const amount=Number(o.quoted_amount_paise||0)/100;
 const payment=norm(o.payment_status);
 const pay=document.createElement("div");pay.className="cd-payment";
 const payTitle=document.createElement("strong");payTitle.textContent="Payment plan · 50% advance";pay.append(payTitle);
 const payText=document.createElement("p");payText.className="cd-help";
 if(amount>0){
  const advance=amount/2,balance=amount-advance;
  payText.textContent="Quotation: "+(o.currency||"INR")+" "+amount.toLocaleString("en-IN",{maximumFractionDigits:2})+". 50% advance: "+advance.toLocaleString("en-IN",{maximumFractionDigits:2})+". Remaining 50%: "+balance.toLocaleString("en-IN",{maximumFractionDigits:2})+".";
  const grid=document.createElement("div");grid.className="cd-payment-grid";
  [[ "50% Advance",advance ],[ "50% Before final delivery",balance ]].forEach(([label,value])=>{const cell=document.createElement("div"),small=document.createElement("small"),b=document.createElement("b");small.textContent=label;b.textContent=(o.currency||"INR")+" "+value.toLocaleString("en-IN",{maximumFractionDigits:2});cell.append(small,b);grid.append(cell);});pay.append(grid);
  const info=document.createElement("p");info.className="cd-help";info.textContent=payment.includes("paid")?"Advance payment status: payment recorded.":"CSA team will share the secure payment option after quotation approval. Please do not pay to a personal account.";pay.append(info);
 }else{payText.textContent="CSA team pehle aapki requirement review karke quotation share karegi. Quotation approve hone ke baad 50% advance payment hoga; remaining 50% final delivery se pehle.";pay.append(payText);}
 panel.append(pay);
 if(d.history&&d.history.length){const title=document.createElement("h4");title.textContent="Application activity";panel.append(title);const hist=document.createElement("div");hist.className="cd-history";d.history.forEach(item=>{const p=document.createElement("p");p.textContent=(item.created_at||"")+" · "+humanStatus(item.new_status)+(item.note?" — "+item.note:"");hist.append(p);});panel.append(hist);}
 root.append(panel);
 const raw=(d.files||[]).filter(f=>f.file_role==="raw"&&f.upload_state==="complete");
 const rawTitle=document.createElement("h3");rawTitle.textContent="Your raw footage · "+raw.length+" file(s) uploaded";root.append(rawTitle);
 const upload=document.createElement("div");upload.className="cd-upload-zone";
 const upTitle=document.createElement("strong");upTitle.textContent="Upload raw clips / project files";upload.append(upTitle);
 const upHelp=document.createElement("p");upHelp.className="cd-help";upHelp.textContent="Yahin apne original video clips, audio, images ya project ZIP upload karein. Aap baad mein bhi isi Application ID se login karke aur files add kar sakte hain.";upload.append(upHelp);
 const input=document.createElement("input");input.type="file";input.multiple=true;input.accept="video/*,audio/*,image/*,.zip,.7z,.rar,.pdf";upload.append(input);
 const bar=document.createElement("div");bar.className="cd-progress";const fill=document.createElement("span");bar.append(fill);upload.append(bar);
 const note=document.createElement("p");note.className="cd-help";upload.append(note);
 const button=document.createElement("button");button.type="button";button.className="cd-btn cd-btn-light";button.textContent="Upload selected raw clips";button.addEventListener("click",async()=>{await uploadSelected(input,o.order_code,accessToken,note,fill,button);if(!button.disabled&&note.textContent.startsWith("Upload complete")){try{const fresh=await api("/api/orders/"+encodeURIComponent(o.order_code),{headers:auth(accessToken)});render(fresh);}catch{}}});upload.append(button);root.append(upload);
 const delivered=(d.files||[]).filter(f=>["preview","final"].includes(f.file_role));
 if(delivered.length){const title=document.createElement("h3");title.textContent="Preview & final delivery";root.append(title);delivered.forEach(file=>{const row=document.createElement("div");row.className="cd-file";const name=document.createElement("span");name.textContent=file.file_role==="final"?"Final video":"Your preview";row.append(name);if(file.upload_state==="complete"){const b=document.createElement("button");b.className="cd-btn cd-btn-light";b.type="button";b.textContent="Download";b.addEventListener("click",async()=>{try{const r=await fetch(API+"/api/orders/"+encodeURIComponent(o.order_code)+"/files/"+file.id+"/download",{headers:auth(accessToken)});if(!r.ok)throw Error("Download unavailable");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file.original_filename||"CSA-video";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(err){alert(err.message);}});row.append(b);}else{const pending=document.createElement("small");pending.textContent="Processing";row.append(pending);}root.append(row);});}
}
function humanStatus(status){
 const s=norm(status);
 if(s.includes("order received"))return "Application received";
 if(s.includes("files under review"))return "Documents / footage under review";
 if(s.includes("editing in progress"))return "Editing in progress";
 if(s.includes("preview ready"))return "Preview ready";
 if(s.includes("revision requested"))return "Revision in progress";
 if(s.includes("final editing"))return "Final editing";
 if(s.includes("completed"))return "Completed · final video available";
 if(s.includes("on hold"))return "On hold";
 if(s.includes("cancel"))return "Cancelled";
 return status||"Status update pending";
}
loadSaved();
})();