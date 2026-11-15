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
 $("project-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),major=Number(f.get("budget")),minor=Math.round(major*100),payload={title:f.get("title"),category:f.get("category"),brief:f.get("brief"),video_count:Number(f.get("video_count"))||null,raw_footage_minutes:Number(f.get("raw_footage_minutes"))||null,final_duration_minutes:Number(f.get("final_duration_minutes"))||null,resolution:f.get("resolution"),aspect_ratio:f.get("aspect_ratio"),budget_amount_minor:minor,budget_currency:f.get("currency"),budget_type:f.get("budget_type"),preferred_deadline:f.get("preferred_deadline"),priority:f.get("priority"),revisions_included:Number(f.get("revisions_included")),requirements:{}};
 $("project-message").textContent="Submitting…";try{const d=await api("/v1/projects",{method:"POST",body:JSON.stringify(payload)});$("project-message").textContent="Project submitted successfully: "+d.project_code+". CSA team will review it.";e.target.reset();}catch(err){$("project-message").textContent=err.message;}
 };
}else if(user.role==="editor"){
 $("editor-panel").hidden=false;loadOffers();
}else{$("account-status").textContent="This account role does not have a client/editor portal.";}
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