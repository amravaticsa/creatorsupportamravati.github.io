(()=>{"use strict";
const API="https://csa-global-api.creatorsupportamravati.workers.dev",token=sessionStorage.getItem("csa_global_token"),user=JSON.parse(sessionStorage.getItem("csa_global_user")||"null");
const $=id=>document.getElementById(id);
if(!token||!user){location.href="login.html";return;}
const headers={"content-type":"application/json","authorization":"Bearer "+token};
$("welcome").textContent="Welcome to CSA Global";
$("account-status").textContent="Signed in as "+user.email+" · "+user.role+" · "+user.status;
$("logout").onclick=()=>{sessionStorage.removeItem("csa_global_token");sessionStorage.removeItem("csa_global_user");location.href="login.html";};
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{...headers,...options.headers}});const d=await r.json();if(r.status===401){$("account-status").textContent="Session expired. Please sign in again.";sessionStorage.clear();setTimeout(()=>location.href="login.html",1200);}if(!r.ok)throw Error(d.error?.message||"Request failed");return d;}
if(user.role==="client"){
 $("client-panel").hidden=false;
 loadClientProjects();\n $("project-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),major=Number(f.get("budget")),minor=Math.round(major*100),payload={title:f.get("title"),category:f.get("category"),brief:f.get("brief"),video_count:Number(f.get("video_count"))||null,raw_footage_minutes:Number(f.get("raw_footage_minutes"))||null,final_duration_minutes:Number(f.get("final_duration_minutes"))||null,resolution:f.get("resolution"),aspect_ratio:f.get("aspect_ratio"),budget_amount_minor:minor,budget_currency:f.get("currency"),budget_type:f.get("budget_type"),preferred_deadline:f.get("preferred_deadline"),priority:f.get("priority"),revisions_included:Number(f.get("revisions_included")),requirements:{}};
 $("project-message").textContent="Submitting…";try{const d=await api("/v1/projects",{method:"POST",body:JSON.stringify(payload)});$("project-message").textContent="Project submitted successfully: "+d.project_code+". CSA team will review it.";e.target.reset();loadClientProjects();}catch(err){$("project-message").textContent=err.message;}
 };
}else if(user.role==="editor"){
 $("editor-panel").hidden=false;loadOffers();
}else if(user.role==="admin"){
 $("admin-panel").hidden=false;loadAdmin();
}else{$("account-status").textContent="This account role does not have a client/editor portal.";}
async function loadClientProjects(){
 const root=$("client-projects");if(!root)return;root.textContent="Loading your project submissions…";
 try{const d=await api("/v1/client/projects");root.replaceChildren();if(!d.projects.length){root.textContent="You have not submitted any projects yet.";return;}for(const p of d.projects){const c=document.createElement("article");c.className="card";const h=document.createElement("h3");h.textContent=p.title+" · "+p.public_project_code;const m=document.createElement("p");m.className="muted";m.textContent=p.category+" · "+(p.budget_amount_minor/100)+" "+p.budget_currency+" · "+p.status+" · Deadline: "+(p.preferred_deadline||"Not set");c.append(h,m);root.append(c);}}catch(e){root.textContent=e.message;}
}
$("agreement-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);$("agreement-message").textContent="Saving inactive draft…";try{const d=await api("/v1/admin/agreements",{method:"POST",body:JSON.stringify({agreement_type:f.get("agreement_type"),version:f.get("version"),title:f.get("title"),body_markdown:f.get("body_markdown")})});$("agreement-message").textContent="Draft saved. Agreement ID: "+d.agreement_id+" (inactive until legal review and activation).";e.target.reset();loadAdmin();}catch(err){$("agreement-message").textContent=err.message;}};\nasync function loadAdmin(){
 const metrics=$("admin-metrics"),projects=$("admin-projects"),editors=$("admin-editors"),ready=$("admin-ready");
 try{
  const [overview,pj,pe,ve,ro]=await Promise.all([
   api("/v1/admin/overview"),api("/v1/admin/projects"),api("/v1/admin/editors/pending"),api("/v1/admin/editors/verified"),api("/v1/admin/offers/ready")
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
 }catch(e){metrics.textContent="Admin data could not be loaded: "+e.message;}
}
async function loadOffers(){
 const root=$("offers");root.textContent="Loading invitations…";
 try{const d=await api("/v1/editor/offers");root.replaceChildren();if(!d.offers.length){root.textContent="Abhi koi project invitation nahi hai. CSA suitable project aane par offer bhejega.";return;}
 for(const o of d.offers){const card=document.createElement("article");card.className="card";const h=document.createElement("h3");h.textContent=o.title+" · "+o.public_project_code;const desc=document.createElement("p");desc.textContent=o.brief;const meta=document.createElement("p");meta.className="muted";meta.textContent="Fee: "+(o.proposed_fee_minor/100)+" "+o.fee_currency+" · Delivery: "+o.delivery_days+" days · Security deposit: "+(o.deposit_amount_minor/100)+" "+o.deposit_currency+" · Status: "+o.status;card.append(h,desc,meta);
 if(o.status==="offered"){const b=document.createElement("button");b.className="btn dark";b.textContent="Accept Project Offer";b.onclick=async()=>{try{await api("/v1/offers/"+o.id+"/accept",{method:"POST",body:"{}"});loadOffers();}catch(e){alert(e.message);}};card.append(b);}
 if(o.status==="accepted_pending_terms"){const wrap=document.createElement("div"),select=document.createElement("select"),agree=document.createElement("input"),label=document.createElement("label"),b=document.createElement("button");agree.type="checkbox";label.append(agree,document.createTextNode(" I have read and accept the active CSA project agreement."));wrap.append(select,label);b.className="btn dark";b.textContent="Accept Terms & Continue";b.onclick=async()=>{if(!agree.checked||!select.value){alert("Agreement select karke checkbox tick karein.");return;}try{await api("/v1/offers/"+o.id+"/terms",{method:"POST",body:JSON.stringify({accept:true,agreement_version_id:select.value})});loadOffers();}catch(e){alert(e.message);}};card.append(wrap,b);api("/v1/editor/agreements").then(x=>{for(const a of x.agreements){const opt=document.createElement("option");opt.value=a.id;opt.textContent=a.title+" (v"+a.version+")";select.append(opt);}}).catch(()=>{});}
 if(o.status==="terms_accepted_pending_deposit"||o.status==="deposit_pending"){const b=document.createElement("button");b.className="btn dark";b.textContent="Pay Security Deposit";b.onclick=async()=>{try{const d=await api("/v1/offers/"+o.id+"/deposit/checkout",{method:"POST",body:"{}"});const options={key:d.key_id,amount:d.amount,currency:d.currency,name:d.checkout_name,description:d.description,order_id:d.order_id,handler:async response=>{try{const v=await api("/v1/payments/razorpay/verify",{method:"POST",body:JSON.stringify(response)});alert("Deposit captured and verified. CSA will confirm your project assignment.");loadOffers();}catch(e){alert(e.message);}},modal:{ondismiss:()=>{}}};new Razorpay(options).open();}catch(e){alert(e.message);}};card.append(b);}
 root.append(card);}
 }catch(e){root.textContent=e.message;}
}
})();