(() => {
"use strict";
const API="https://csa-video-api.creatorsupportamravati.workers.dev";
const PAYMENT_API="https://csa-payment-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const hide=el=>el.classList.add("cd-hide");
const show=(el,msg)=>{el.textContent=msg;el.classList.remove("cd-hide");};
const auth=token=>({Authorization:"Bearer "+token});
let orderCode="",accessToken="",draftCode="",draftToken="",verifiedPayment=null,projectTotal=0,draftFormData=null,termsAccepted=false,latestReceipt=null;
function receiptMoney(paise){return "₹"+(Number(paise||0)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});}
function receiptEscape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));}
function renderReceipt(receipt){
 if(!receipt||receipt.status!=="PAID")return;
 latestReceipt=receipt;
 let list=[];try{list=JSON.parse(localStorage.getItem("csa_video_receipts")||"[]");if(!Array.isArray(list))list=[];if(!list.some(x=>x.paymentId===receipt.paymentId))list.push(receipt);localStorage.setItem("csa_video_receipts",JSON.stringify(list));}catch{list=[receipt];}
 renderReceiptHistory(list);
}
function renderReceiptHistory(list){
 const root=$("paymentReceiptPanel");if(!root||!Array.isArray(list)||!list.length)return;
 root.replaceChildren();root.classList.remove("cd-hide");
 const title=document.createElement("h2");title.textContent="Payment receipts";root.append(title);
 const intro=document.createElement("p");intro.className="cd-help";intro.textContent="Every verified payment has its own receipt. Save each receipt for your records.";root.append(intro);
 list.slice().reverse().forEach(receipt=>{
  if(!receipt||receipt.status!=="PAID")return;
  const card=document.createElement("div");card.className="cd-upload-zone";card.style.marginTop="12px";
  const heading=document.createElement("strong");heading.textContent=(receipt.receiptNumber||"Payment receipt")+" · "+receiptMoney(receipt.paymentAmountPaise);card.append(heading);
  const grid=document.createElement("div");grid.className="cd-payment-grid";
  const date=receipt.paymentDate?new Date(receipt.paymentDate).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";
  [["Status",receipt.status],["Payment date",date],["Payment ID",receipt.paymentId],["Method",String(receipt.paymentMethod||"—").toUpperCase()],["Project amount",receiptMoney(receipt.projectTotalPaise)],["Balance after payment",receiptMoney(receipt.balancePaise)]].forEach(([label,value])=>{const cell=document.createElement("div"),small=document.createElement("small"),b=document.createElement("b");small.textContent=label;b.textContent=value||"—";cell.append(small,b);grid.append(cell);});
  card.append(grid);
  const button=document.createElement("button");button.type="button";button.className="cd-btn";button.textContent="Download PDF Receipt / Print";button.addEventListener("click",()=>printReceipt(receipt));card.append(button);
  root.append(card);
 });
 const note=document.createElement("p");note.className="cd-help";note.textContent="These are payment receipts, not GST tax invoices.";root.append(note);
}
function printReceipt(r){
 const win=window.open("","_blank");if(!win){alert("Please allow pop-ups to download your receipt.");return;}
 const fmt=receiptMoney,dt=r.paymentDate?new Date(r.paymentDate).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";
 const rows=[["Receipt number",r.receiptNumber],["Receipt date",dt],["Customer",r.customerName],["Email",r.customerEmail],["Phone",r.customerPhone],["Razorpay Order ID",r.razorpayOrderId],["Razorpay Payment ID",r.paymentId],["Payment method",String(r.paymentMethod||"—").toUpperCase()],["Payment type",r.paymentType==="advance"?"50% Advance":"Full Payment"],["Project amount",fmt(r.projectTotalPaise)],["Amount received",fmt(r.paymentAmountPaise)],["Balance after payment",fmt(r.balancePaise)]];
 const table=rows.map(([k,v])=>"<tr><th>"+receiptEscape(k)+"</th><td>"+receiptEscape(v)+"</td></tr>").join("");
 const html="<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>"+receiptEscape(r.receiptNumber)+"</title><style>body{font:15px Arial,sans-serif;color:#17212b;margin:32px auto;max-width:760px;padding:20px}header{border-bottom:3px solid #0f9d8c;padding-bottom:16px;margin-bottom:22px}h1{margin:0 0 6px;font-size:25px}p{line-height:1.5;color:#52606d}.paid{display:inline-block;background:#e8f7ef;color:#126b3a;padding:7px 12px;border-radius:20px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:12px;border-bottom:1px solid #e5e9ef;vertical-align:top}th{width:38%;color:#52606d;font-weight:600}.amount{font-size:23px;font-weight:700;margin:20px 0}.foot{margin-top:28px;border-top:1px solid #e5e9ef;padding-top:14px;font-size:12px}@media print{body{margin:0 auto;padding:10mm}.no-print{display:none}}</style></head><body><header><h1>"+receiptEscape(r.businessName)+"</h1><p>"+receiptEscape(r.businessAddress)+"<br>"+receiptEscape(r.businessEmail)+" · "+receiptEscape(r.businessPhone)+"</p><span class='paid'>PAYMENT RECEIVED · PAID</span></header><h2>Payment Receipt</h2><div class='amount'>"+fmt(r.paymentAmountPaise)+" received</div><table>"+table+"</table><p class='foot'>This document confirms receipt of the payment shown above. It is a payment receipt and not a GST tax invoice.</p><button class='no-print' onclick='window.print()'>Print / Save as PDF</button></body></html>";
 win.document.open();win.document.write(html);win.document.close();win.focus();
}
async function api(path,options={}){const r=await fetch(API+path,options);let d={};try{d=await r.json();}catch{}if(!r.ok)throw Error(d.error||"Request failed ("+r.status+")");return d;}
function save(code,token){try{localStorage.setItem("csa_video_last_order",code);localStorage.setItem("csa_video_order_"+code,token);}catch{}}
function loadSaved(){try{const code=localStorage.getItem("csa_video_last_order");if(code){$("trackForm").elements.orderCode.value=code;$("trackForm").elements.accessToken.value=localStorage.getItem("csa_video_order_"+code)||"";}const receipts=JSON.parse(localStorage.getItem("csa_video_receipts")||"[]");if(Array.isArray(receipts)&&receipts.length)renderReceiptHistory(receipts);}catch{}}
const publicShareUrl="https://creatorsupportamravati.in/video-editing.html";
const budgetSelect=$("clientBudget"),budgetAmountInput=$("projectBudgetAmount");
function currentPaymentType(){return document.querySelector('input[name="paymentType"]:checked')?.value||"advance";}
function updatePaymentBreakdown(){
 const amount=Number(budgetAmountInput.value||0),type=currentPaymentType();
 if(!amount||amount<100){$("paymentBreakdown").textContent="Enter your exact project budget to calculate payment.";return;}
 const due=type==="advance"?Math.round(amount*50)/100:amount;
 $("paymentBreakdown").textContent=(type==="advance"?"50% advance payable now: ":"100% full payment payable now: ")+"₹"+due.toLocaleString("en-IN",{maximumFractionDigits:2})+" · Project budget: ₹"+amount.toLocaleString("en-IN");
}
document.querySelectorAll('input[name="paymentType"]').forEach(x=>x.addEventListener("change",updatePaymentBreakdown));
budgetAmountInput.addEventListener("input",updatePaymentBreakdown);
$("shareCsa").addEventListener("click",async()=>{
 const data={title:"Creator Support Amravati",text:"Professional video editing services by Creator Support Amravati. Check details here:",url:publicShareUrl};
 try{if(navigator.share){await navigator.share(data);$("shareMessage").textContent="Share options opened.";}else{await navigator.clipboard.writeText(publicShareUrl);$("shareMessage").textContent="Website link copied. Ab aap ise kisi ko bhi share kar sakte hain.";}}
 catch(e){if(e.name!=="AbortError")$("shareMessage").textContent="Share nahi ho paya. Copy Link button use karein.";}
});
$("copyCsaLink").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(publicShareUrl);$("shareMessage").textContent="CSA website link copied successfully.";}
 catch{$("shareMessage").textContent="Link: "+publicShareUrl;}
});
function buildProjectData(){
 const d=Object.fromEntries(new FormData($("clientOrderForm")).entries());
 const amount=Number(d.projectBudgetAmount);
 if(!Number.isSafeInteger(amount)||amount<100||amount>500000)throw Error("Enter an exact project budget between ₹100 and ₹5,00,000.");
 projectTotal=amount;
 const tender=["CLIENT TENDER / WORK REQUIREMENTS","Estimated budget range: "+(d.clientBudget||"Not specified"),"Exact project budget: ₹"+amount.toLocaleString("en-IN"),"Budget flexibility: "+(d.budgetFlexibility||"Not specified"),"Number of final videos: "+(d.videoQuantity||"Not specified"),"Approx. final video length: "+(d.finalDuration||"Not specified"),"Work frequency: "+(d.workFrequency||"Not specified"),"Editing level: "+(d.editingLevel||"Not specified"),"Required work / deliverables: "+(d.workScope||"Not specified")].join("\n");
 d.instructions=(d.instructions?d.instructions+"\n\n":"")+tender;if(d.reference)d.instructions+="\nReference link: "+d.reference;
 d.projectBudgetPaise=amount*100;delete d.projectBudgetAmount;delete d.paymentType;return d;
}
async function createDraftIfNeeded(){
 if(draftCode&&draftToken)return;
 draftFormData=buildProjectData();
 const result=await api("/api/orders/draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draftFormData)});
 draftCode=result.draftCode;draftToken=result.accessToken;
 Array.from($("clientOrderForm").elements).forEach(el=>{if(el.name!=="paymentType"&&!["rawFiles","uploadBeforePayment","payNowButton","submitRequest","acceptVideoTerms"].includes(el.id)&&el.type!=="button"&&el.type!=="submit")el.disabled=true;});
}
async function uploadDraftFile(file,progress){
 const init=await api("/api/drafts/"+encodeURIComponent(draftCode)+"/files",{method:"POST",headers:{...auth(draftToken),"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type||"application/octet-stream",size:file.size})});
 for(let part=1;part<=init.totalParts;part++){const begin=(part-1)*init.partSize,end=Math.min(file.size,begin+init.partSize);await api("/api/uploads/"+init.fileId,{method:"PUT",headers:{...auth(draftToken),"X-Part-Number":String(part),"Content-Type":"application/octet-stream"},body:file.slice(begin,end)});progress(end/file.size);}
 await api("/api/uploads/"+init.fileId,{method:"POST",headers:auth(draftToken)});
}
$("uploadBeforePayment").addEventListener("click",async()=>{
 const form=$("clientOrderForm"),input=$("rawFiles"),note=$("uploadStatus"),button=$("uploadBeforePayment");
 if(!form.reportValidity())return;
 const files=Array.from(input.files||[]);if(!files.length){note.textContent="Please select at least one raw clip before continuing.";return;}
 button.disabled=true;hide($("requestMessage"));
 try{
  await createDraftIfNeeded();const total=files.reduce((n,f)=>n+f.size,0);let done=0;
  for(const file of files){note.textContent="Uploading "+file.name+"…";await uploadDraftFile(file,x=>$("uploadProgress").style.width=((done+file.size*x)/total*100)+"%");done+=file.size;}
  note.textContent="All selected raw clips uploaded securely. Please review and accept the Terms & Conditions below.";input.value="";input.required=false;
  $("videoTermsSection").classList.remove("cd-hide");$("videoTermsSection").scrollIntoView({behavior:"smooth",block:"center"});
 }catch(err){note.textContent="Upload could not be completed: "+err.message+". Retry to continue.";}
 finally{button.disabled=false;}
});
$("payNowButton").addEventListener("click",async()=>{
 const button=$("payNowButton"),note=$("paymentMessage");button.disabled=true;note.textContent="";
 try{
  if(!draftCode||!draftToken)throw Error("Upload your raw clips first.");
  if(!termsAccepted)throw Error("Please accept the Terms & Conditions before payment.");
  const amount=Number(budgetAmountInput.value),type=currentPaymentType();
  if(!Number.isSafeInteger(amount)||amount<100||amount>500000)throw Error("Enter a valid project budget between ₹100 and ₹5,00,000.");
  if(typeof window.Razorpay!=="function")throw Error("Razorpay checkout could not load. Refresh and try again.");
  const data=draftFormData;
  const created=await fetch(PAYMENT_API+"/api/create-order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({totalAmount:amount,paymentType:type,name:data.name,email:data.email,contact:data.phone,whatsappOptIn:true,draftCode})});
  const order=await created.json();if(!created.ok)throw Error(order.error||"Unable to create payment order.");
  const options={key:order.keyId,amount:order.amount,currency:order.currency,name:order.businessName||"Creator Support Amravati",description:order.description,order_id:order.orderId,prefill:{name:data.name,email:data.email,contact:data.phone},theme:{color:"#123d58"},
   config:{display:{
    blocks:{preferred:{name:"UPI Payment",instruments:[{method:"upi"}]}},
    sequence:["block.preferred"],
    preferences:{show_default_blocks:true}
   }},
   handler:async response=>{
    note.textContent="Payment received by checkout. Verifying securely with Razorpay…";
    try{
     const vr=await fetch(PAYMENT_API+"/api/verify-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(response)}),verified=await vr.json();
     if(!vr.ok||!verified.verified||verified.paymentStatus!=="captured")throw Error(verified.error||verified.message||"Payment is not yet captured.");
     verifiedPayment={orderId:response.razorpay_order_id,paymentId:response.razorpay_payment_id,type};
     if(!verified.receipt||verified.receipt.status!=="PAID")throw Error("Payment is captured, but receipt generation is pending. Contact CSA with your payment ID.");
     renderReceipt(verified.receipt);
     note.textContent="Payment successfully verified. Your accepted Terms & Conditions will be included with the application.";$("submitRequest").disabled=!termsAccepted;
     $("submitRequest").scrollIntoView({behavior:"smooth",block:"center"});
    }catch(err){verifiedPayment=null;note.textContent="Payment verification pending: "+err.message+" Your application remains unsubmitted. Contact CSA with your payment ID if money was deducted.";}
   },
   modal:{ondismiss:()=>{if(!verifiedPayment)note.textContent="Payment window closed. No editing request has been submitted.";}}
  };
  const checkout=new window.Razorpay(options);checkout.on("payment.failed",response=>{note.textContent="Payment failed: "+(response.error?.description||"Please try again.");});checkout.open();
 }catch(err){note.textContent=err.message;}
 finally{button.disabled=false;}
});
$("clientOrderForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("submitRequest"),msg=$("requestMessage");hide(msg);
 if(!verifiedPayment||!draftCode||!draftToken){show(msg,"Upload your raw clips, accept the Terms & Conditions and complete verified payment before submitting the application.");return;}
 if(!termsAccepted){show(msg,"Please accept the Terms & Conditions before submitting your application.");$("videoTermsSection").scrollIntoView({behavior:"smooth",block:"center"});return;}
 btn.disabled=true;
 try{
  const result=await api("/api/drafts/"+encodeURIComponent(draftCode)+"/finalize",{method:"POST",headers:{...auth(draftToken),"Content-Type":"application/json"},body:JSON.stringify({paymentOrderId:verifiedPayment.orderId,paymentId:verifiedPayment.paymentId,termsAccepted:true,termsVersion:"CSA-VIDEO-EDITING-2026-11-20-v1"})});
  orderCode=result.orderCode;accessToken=draftToken;save(orderCode,accessToken);
  show(msg,"Your payment has been verified and your editing request has been submitted successfully.\n\nApplication / Order ID: "+orderCode+"\nPrivate access code: "+accessToken+"\n\nKeep these details safe to track your project.");
  $("trackForm").elements.orderCode.value=orderCode;$("trackForm").elements.accessToken.value=accessToken;
  $("track-project").scrollIntoView({behavior:"smooth",block:"start"});
  const current=await api("/api/orders/"+encodeURIComponent(orderCode),{headers:auth(accessToken)});render(current);
  $("preSubmitUpload").classList.add("cd-hide");$("paymentSection").classList.add("cd-hide");$("videoTermsSection").classList.add("cd-hide");btn.textContent="Request Submitted";btn.disabled=true;
 }catch(err){show(msg,"Application not submitted: "+err.message);}
 finally{if(!orderCode)btn.disabled=false;}
});
async function uploadFile(file,code,token,progress){
 const init=await api("/api/orders/"+encodeURIComponent(code)+"/files/initiate",{method:"POST",headers:{...auth(token),"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type||"application/octet-stream",size:file.size})});
 for(let part=1;part<=init.totalParts;part++){const start=(part-1)*init.partSize,end=Math.min(file.size,start+init.partSize);await api("/api/uploads/"+init.fileId,{method:"PUT",headers:{...auth(token),"X-Part-Number":String(part),"Content-Type":"application/octet-stream"},body:file.slice(start,end)});progress(end/file.size);}
 await api("/api/uploads/"+init.fileId,{method:"POST",headers:auth(token)});
}
async function uploadSelected(input,code,token,note,bar,button){
 const files=Array.from(input.files||[]);if(!files.length){note.textContent="Please select your raw footage files first.";return;}
 button.disabled=true;const total=files.reduce((n,f)=>n+f.size,0);let done=0;
 try{for(const f of files){note.textContent=f.name+" upload ho rahi hai…";await uploadFile(f,code,token,x=>bar.style.width=((done+f.size*x)/total*100)+"%");done+=f.size;}
 note.textContent="Upload complete! Your raw footage has been received by Creator Support Amravati.";input.value="";
 }catch(err){note.textContent="Upload paused: "+err.message+". Internet check karke dobara try karein.";}
 finally{button.disabled=false;}
}

$("trackForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);orderCode=String(f.get("orderCode")).trim().toUpperCase();accessToken=String(f.get("accessToken")).trim();const msg=$("trackMessage"),root=$("trackResult");hide(msg);hide(root);
 try{const d=await api("/api/orders/"+encodeURIComponent(orderCode),{headers:auth(accessToken)});save(orderCode,accessToken);render(d);}
 catch(err){show(msg,"Unable to open the project: "+err.message+". Please check your Order ID and private access code.");}
});
function norm(v){return String(v||"").toLowerCase().replace(/[_–—-]+/g," ").replace(/\s+/g," ").trim();}
function stageFor(status,payment,amount,files=[]){
 const s=norm(status);
 if(s.includes("cancel"))return 0;
 if(s.includes("final delivery")||s.includes("completed")||s.includes("download available"))return 5;
 if(s.includes("preview")||s.includes("revision"))return 4;
 if(s.includes("editing in progress")||s.includes("final editing"))return 3;
 if(s.includes("work assigned"))return 2;
 if(s.includes("files received")||s.includes("files under review")||s.includes("review"))return 1;
 if(s.includes("order received")||s.includes("application received"))return (files||[]).some(f=>f.file_role==="raw"&&f.upload_state==="complete")?1:0;
 return 0;
}
const stageNames=["Application received","Files received","Work assigned","Editing in progress","Preview & revisions","Final delivery"];
function render(d){
 const root=$("trackResult"),o=d.order||{};root.replaceChildren();root.classList.remove("cd-hide");
 const panel=document.createElement("div");panel.className="cd-status-panel";
 const head=document.createElement("div");head.className="cd-status-head";
 const h=document.createElement("h3");h.textContent="Application status · "+(o.order_code||orderCode);head.append(h);
 const pill=document.createElement("span");pill.className="cd-status";pill.textContent=humanStatus(o.order_status);head.append(pill);panel.append(head);
 const current=stageFor(o.order_status,o.payment_status,o.quoted_amount_paise,d.files||[]);
 const timeline=document.createElement("div");timeline.className="cd-timeline";
 stageNames.forEach((name,i)=>{const item=document.createElement("div");item.className="cd-stage"+(i<current?" done":i===current?" current":"");const dot=document.createElement("span");dot.className="dot";dot.textContent=i<current?"✓":String(i+1);const b=document.createElement("b");b.textContent=name;const small=document.createElement("small");small.textContent=i<current?"Completed":i===current?"Current stage":"Pending";item.append(dot,b,small);timeline.append(item);});panel.append(timeline);
 const summary=document.createElement("p");summary.className="cd-help";summary.textContent="Video type: "+(o.service_package||"Video editing")+" · Deadline: "+(o.deadline||"To be confirmed")+" · Last updated: "+(o.updated_at||"");panel.append(summary);
 if(o.instructions){
  const reqTitle=document.createElement("h4");reqTitle.textContent="Your submitted work requirements";panel.append(reqTitle);
  const req=document.createElement("p");req.className="cd-help";req.style.whiteSpace="pre-wrap";req.textContent=o.instructions;panel.append(req);
 }
 const amount=Number(o.quoted_amount_paise||0)/100;
 const payment=norm(o.payment_status);
 const pay=document.createElement("div");pay.className="cd-payment";
 const payTitle=document.createElement("strong");payTitle.textContent="Payment plan · "+(o.payment_type==="full"?"100% full payment":"50% advance");pay.append(payTitle);
 const payText=document.createElement("p");payText.className="cd-help";
 if(amount>0){
  const advance=amount/2,balance=amount-advance;
  payText.textContent="Project budget: "+(o.currency||"INR")+" "+amount.toLocaleString("en-IN",{maximumFractionDigits:2})+". "+(o.payment_type==="full"?"100% full payment received.":"50% advance received: "+advance.toLocaleString("en-IN",{maximumFractionDigits:2})+". Remaining 50% before final delivery: "+balance.toLocaleString("en-IN",{maximumFractionDigits:2})+".");
  const grid=document.createElement("div");grid.className="cd-payment-grid";
  [[ "50% Advance",advance ],[ "50% Before final delivery",balance ]].forEach(([label,value])=>{const cell=document.createElement("div"),small=document.createElement("small"),b=document.createElement("b");small.textContent=label;b.textContent=(o.currency||"INR")+" "+value.toLocaleString("en-IN",{maximumFractionDigits:2});cell.append(small,b);grid.append(cell);});pay.append(grid);
  const info=document.createElement("p");info.className="cd-help";info.textContent=payment.includes("paid")?(o.payment_type==="full"?"Full payment status: payment recorded.":"50% advance payment status: payment recorded."):"Payment status is awaiting CSA confirmation.";pay.append(info);
 }else{payText.textContent="CSA team pehle aapki requirement review karke quotation share karegi. Quotation approve hone ke baad 50% advance payment hoga; remaining 50% final delivery se pehle.";pay.append(payText);}
 panel.append(pay);
 if(norm(o.order_status).includes("completed")){
  const rate=document.createElement("section");rate.className="cd-upload-zone";
  const rt=document.createElement("h3");rt.textContent="Rate your CSA experience";rate.append(rt);
  const desc=document.createElement("p");desc.className="cd-help";desc.textContent="Aapka feedback hamari service ko behtar banane mein madad karta hai.";rate.append(desc);
  const form=document.createElement("form");form.className="cd-form";
  const label=document.createElement("label");label.textContent="Your rating (1–5 stars)";
  const stars=document.createElement("div");stars.style.display="flex";stars.style.gap="8px";stars.setAttribute("role","group");stars.setAttribute("aria-label","Rate CSA from 1 to 5 stars");
  let selected=Number(d.feedback?.rating||0);
  const starButtons=[];
  for(let n=1;n<=5;n++){const b=document.createElement("button");b.type="button";b.textContent="★";b.style.cssText="font-size:30px;border:0;background:transparent;color:"+(n<=selected?"#e5a000":"#b8c2cc")+";cursor:pointer;padding:0 3px";b.setAttribute("aria-label",n+" stars");b.addEventListener("click",()=>{selected=n;starButtons.forEach((x,k)=>x.style.color=k<selected?"#e5a000":"#b8c2cc");});starButtons.push(b);stars.append(b);}
  label.append(stars);form.append(label);
  const commentLabel=document.createElement("label");commentLabel.textContent="Your feedback (optional)";
  const comment=document.createElement("textarea");comment.maxLength=1200;comment.placeholder="Tell us about your experience…";comment.value=d.feedback?.comment||"";commentLabel.append(comment);form.append(commentLabel);
  const send=document.createElement("button");send.type="submit";send.className="cd-btn";send.textContent=d.feedback?"Update rating":"Submit rating";form.append(send);
  const feedbackMsg=document.createElement("p");feedbackMsg.className="cd-help";feedbackMsg.setAttribute("aria-live","polite");form.append(feedbackMsg);
  form.addEventListener("submit",async ev=>{ev.preventDefault();if(!selected){feedbackMsg.textContent="Please select a star rating.";return;}send.disabled=true;try{await api("/api/orders/"+encodeURIComponent(o.order_code)+"/feedback",{method:"POST",headers:{...auth(accessToken),"Content-Type":"application/json"},body:JSON.stringify({rating:selected,comment:comment.value})});feedbackMsg.textContent="Thank you! Your rating has been saved.";send.textContent="Update rating";}catch(err){feedbackMsg.textContent="Rating save nahi hui: "+err.message;}finally{send.disabled=false;}});
  rate.append(form);panel.append(rate);
 }
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
 if(delivered.length){const title=document.createElement("h3");title.textContent="Preview & final delivery";root.append(title);delivered.forEach(file=>{const row=document.createElement("div");row.className="cd-file";const name=document.createElement("span");name.textContent=file.file_role==="final"?"Final video":"Your preview";row.append(name);if(file.upload_state==="complete"){if(file.file_role==="final"&&norm(o.payment_status)!=="paid"){const locked=document.createElement("small");locked.textContent="Locked · remaining balance payment required";row.append(locked);}else{const b=document.createElement("button");b.className="cd-btn cd-btn-light";b.type="button";b.textContent="Download";b.addEventListener("click",async()=>{try{const r=await fetch(API+"/api/orders/"+encodeURIComponent(o.order_code)+"/files/"+file.id+"/download",{headers:auth(accessToken)});if(!r.ok)throw Error("Download unavailable");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file.original_filename||"CSA-video";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(err){alert(err.message);}});row.append(b);}}else{const pending=document.createElement("small");pending.textContent="Processing";row.append(pending);}root.append(row);});}
}
function humanStatus(status){
 const s=norm(status);
 if(s.includes("application received")||s.includes("order received"))return "Application received";
 if(s.includes("files received")||s.includes("files under review"))return "Files received";
 if(s.includes("work assigned"))return "Work assigned";
 if(s.includes("editing in progress"))return "Editing in progress";
 if(s.includes("preview")||s.includes("revision"))return "Preview & revisions";
 if(s.includes("final delivery")||s.includes("completed")||s.includes("download available"))return "Final delivery";
 if(s.includes("on hold"))return "On hold";
 if(s.includes("cancel"))return "Cancelled";
 return status||"Status update pending";
}
$("acceptVideoTerms").addEventListener("change",()=>{$("acceptTermsContinue").disabled=!$("acceptVideoTerms").checked;});
$("acceptTermsContinue").addEventListener("click",()=>{
 if(!$("acceptVideoTerms").checked)return;
 termsAccepted=true;$("acceptVideoTerms").disabled=true;$("acceptTermsContinue").disabled=true;$("acceptTermsContinue").textContent="Terms Accepted ✓";
 $("paymentSection").classList.remove("cd-hide");updatePaymentBreakdown();$("paymentMessage").textContent="Terms accepted. You can now choose your payment option.";$("paymentSection").scrollIntoView({behavior:"smooth",block:"center"});
});
loadSaved();
})();