const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
const bad=(message,status=400,code="bad_request")=>out({ok:false,error:{code,message}},status);
const uid=(p)=>p+"_"+crypto.randomUUID().replaceAll("-","");
const txt=(v,n=2000)=>typeof v==="string"?v.trim().slice(0,n):"";
const amt=(v)=>Number.isSafeInteger(v)&&v>=0?v:null;
function decode(s){s=s.replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(s+"=".repeat((4-s.length%4)%4)));}
async function claims(req,env){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""),p=token.split(".");
 if(p.length!==3||!env.AUTH_JWKS_URL||!env.AUTH_ISSUER||!env.AUTH_AUDIENCE)throw Error("Identity provider is not configured or token is missing.");
 const h=decode(p[0]),c=decode(p[1]);if(h.alg!=="RS256"||!h.kid)throw Error("Unsupported identity token.");
 const jr=await fetch(env.AUTH_JWKS_URL);if(!jr.ok)throw Error("Identity provider unavailable.");
 const jwk=(await jr.json()).keys?.find(k=>k.kid===h.kid&&k.kty==="RSA");if(!jwk)throw Error("Identity signing key not found.");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const sig=Uint8Array.from(atob(p[2].replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-p[2].length%4)%4)),x=>x.charCodeAt(0));
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,sig,new TextEncoder().encode(p[0]+"."+p[1])))throw Error("Invalid token signature.");
 const now=Math.floor(Date.now()/1000);
 if(c.iss!==env.AUTH_ISSUER||!(c.aud===env.AUTH_AUDIENCE||c.aud?.includes?.(env.AUTH_AUDIENCE))||c.exp<=now||c.email_verified!==true||!c.sub||!c.email)throw Error("Token claims or verified email are invalid.");
 return c;
}
async function user(req,env,roles){
 const c=await claims(req,env);
 const u=await env.DB.prepare("SELECT id,role,account_status,email FROM users WHERE auth_subject=? AND email=? COLLATE NOCASE").bind(c.sub,c.email).first();
 if(!u||u.account_status!=="active")throw Error("Account is pending or inactive.");
 if(!roles.includes(u.role))throw Error("Role is not permitted.");
 return u;
}
async function hmacHex(secret,message){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));return [...sig].map(x=>x.toString(16).padStart(2,"0")).join("");}\nfunction constantTime(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}\nasync function log(env,actor,action,type,entity,meta={}){
 await env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)").bind(uid("log"),actor,action,type,entity,JSON.stringify(meta)).run();
}
async function handle(req,env){
 const u=new URL(req.url),p=u.pathname.replace(/\/$/,""),m=req.method;
 if(m==="GET"&&p==="/health")return out({ok:true,service:"CSA Global API",status:"healthy",google_login:!!env.GOOGLE_CLIENT_ID,razorpay_checkout:!!(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET&&env.RAZORPAY_WEBHOOK_SECRET),mode:env.ENVIRONMENT||"staging"});
 if(m==="GET"&&p==="/v1/config")return out({ok:true,google_client_id:env.GOOGLE_CLIENT_ID||null,razorpay_key_id:env.RAZORPAY_KEY_ID||null,environment:env.ENVIRONMENT||"staging"});
 if(m==="POST"&&p==="/v1/auth/google"){
  const b=await req.json(),role=b.role,credential=txt(b.credential,10000),nonce=txt(b.nonce,200);
  if(!credential||!nonce||!["client","editor"].includes(role))return bad("Google credential, login nonce and account type are required.");
  const c=await claims(new Request(req.url,{headers:{Authorization:"Bearer "+credential}}),env);
  if(c.nonce!==nonce)return bad("Google login nonce validation failed. Please retry sign-in.",401,"nonce_invalid");
  const old=await env.DB.prepare("SELECT id,role,account_status,email FROM users WHERE auth_subject=?").bind(c.sub).first();
  if(old){
   if(old.role!==role)return bad("This Google account is already registered under a different account type. Please use the existing account type.",409,"role_conflict");
   return out({ok:true,user_id:old.id,role:old.role,status:old.account_status,email:old.email});
  }
  const byEmail=await env.DB.prepare("SELECT id,role,auth_subject FROM users WHERE email=? COLLATE NOCASE").bind(c.email).first();
  if(byEmail)return bad("This email already has an account. Contact CSA support to securely link Google sign-in.",409,"email_exists");
  const profile=b.profile||{},name=txt(profile.display_name,120)||txt(c.name,120)||txt(c.email,254).split("@")[0],newId=uid("usr");
  if(role==="client"){
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'client',?,?, 'active',?)").bind(newId,c.sub,c.email,new Date().toISOString(),txt(profile.country_code,2).toUpperCase()||null).run();
   await env.DB.prepare("INSERT INTO client_profiles(user_id,display_name,company_name,country,timezone,preferred_language) VALUES(?,?,?,?,?,?)").bind(newId,name,txt(profile.company_name,160)||null,txt(profile.country,100)||null,txt(profile.timezone,80)||null,txt(profile.language,40)||"English").run();
  }else{
   const country=txt(profile.country,100),portfolio=txt(profile.portfolio_url,500),skills=Array.isArray(profile.specializations)?profile.specializations.map(x=>txt(x,80)).filter(Boolean).slice(0,20):[];
   if(!country||!portfolio||!skills.length)return bad("Editor country, portfolio URL and at least one specialization are required.");
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'editor',?,?, 'pending',?)").bind(newId,c.sub,c.email,new Date().toISOString(),txt(profile.country_code,2).toUpperCase()||null).run();
   await env.DB.prepare("INSERT INTO editor_profiles(user_id,public_editor_code,display_name,country,city,languages_json,experience_level,software_json,specializations_json,portfolio_url,sample_url,availability,bio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(newId,"CSA-ED-"+crypto.randomUUID().slice(0,8).toUpperCase(),name,country,txt(profile.city,100)||null,JSON.stringify(Array.isArray(profile.languages)?profile.languages:[]),txt(profile.experience_level,40)||null,JSON.stringify(Array.isArray(profile.software)?profile.software:[]),JSON.stringify(skills),portfolio,txt(profile.sample_url,500)||null,txt(profile.availability,40)||"project-based",txt(profile.bio,2000)||null).run();
  }
  await log(env,newId,"google_account_registered",role,newId,{email_domain:c.email.split("@")[1]});
  return out({ok:true,user_id:newId,role,status:role==="editor"?"pending":"active",email:c.email},201);
 }
 if(m==="POST"&&p==="/v1/onboarding/editor"){
  const c=await claims(req,env),b=await req.json(),name=txt(b.display_name,120),country=txt(b.country,100);
  if(!name||!country||!Array.isArray(b.specializations)||!b.specializations.length||!txt(b.portfolio_url,500))return bad("Name, country, specializations and portfolio are required.");
  const idu=uid("usr");
  await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'editor',?,?, 'pending',?)").bind(idu,c.sub,c.email,new Date().toISOString(),txt(b.country_code,2).toUpperCase()||null).run();
  await env.DB.prepare("INSERT INTO editor_profiles(user_id,public_editor_code,display_name,country,city,languages_json,experience_level,software_json,specializations_json,portfolio_url,sample_url,availability,bio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(idu,"CSA-ED-"+crypto.randomUUID().slice(0,8).toUpperCase(),name,country,txt(b.city,100)||null,JSON.stringify(b.languages||[]),txt(b.experience_level,40)||null,JSON.stringify(b.software||[]),JSON.stringify(b.specializations),txt(b.portfolio_url,500),txt(b.sample_url,500)||null,txt(b.availability,40)||"project-based",txt(b.bio,2000)||null).run();
  await log(env,idu,"editor_registration_submitted","editor",idu);
  return out({ok:true,status:"pending_verification",message:"Registration is free. No deposit is charged until an editor chooses to accept a project offer."},201);
 }
 if(m==="POST"&&p==="/v1/onboarding/client"){
  const c=await claims(req,env),b=await req.json(),name=txt(b.display_name,120);if(!name)return bad("Name is required.");
  const idu=uid("usr");
  await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'client',?,?, 'active',?)").bind(idu,c.sub,c.email,new Date().toISOString(),txt(b.country_code,2).toUpperCase()||null).run();
  await env.DB.prepare("INSERT INTO client_profiles(user_id,display_name,company_name,country,timezone,preferred_language) VALUES(?,?,?,?,?,?)").bind(idu,name,txt(b.company_name,160)||null,txt(b.country,100)||null,txt(b.timezone,80)||null,txt(b.language,40)||null).run();
  return out({ok:true,status:"active"},201);
 }
 if(m==="POST"&&p==="/v1/projects"){
  const a=await user(req,env,["client"]),b=await req.json(),title=txt(b.title,180),cat=txt(b.category,80),brief=txt(b.brief,12000),budget=amt(b.budget_amount_minor),cur=txt(b.budget_currency,3).toUpperCase();
  if(!title||!cat||!brief||!budget||!/^[A-Z]{3}$/.test(cur))return bad("Project title, category, brief, budget and ISO currency are required.");
  const pid=uid("prj"),code="CSA-"+new Date().getUTCFullYear()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.DB.prepare("INSERT INTO projects(id,public_project_code,client_id,title,category,brief,raw_footage_minutes,final_duration_minutes,video_count,resolution,aspect_ratio,requirements_json,reference_url,budget_amount_minor,budget_currency,budget_type,preferred_deadline,priority,revisions_included,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted')").bind(pid,code,a.id,title,cat,brief,Number.isInteger(b.raw_footage_minutes)?b.raw_footage_minutes:null,Number.isInteger(b.final_duration_minutes)?b.final_duration_minutes:null,Number.isInteger(b.video_count)?b.video_count:null,txt(b.resolution,20)||null,txt(b.aspect_ratio,20)||null,JSON.stringify(b.requirements||{}),txt(b.reference_url,1000)||null,budget,cur,["fixed","flexible","recommend"].includes(b.budget_type)?b.budget_type:"fixed",txt(b.preferred_deadline,40)||null,["normal","urgent","flexible"].includes(b.priority)?b.priority:"normal",Number.isInteger(b.revisions_included)?Math.max(0,Math.min(10,b.revisions_included)):2).run();
  await log(env,a.id,"project_submitted","project",pid);
  return out({ok:true,project_id:pid,project_code:code,status:"submitted"},201);
 }
 if(m==="GET"&&p==="/v1/editor/offers"){
  const a=await user(req,env,["editor"]),r=await env.DB.prepare("SELECT o.id,o.offer_message,o.proposed_fee_minor,o.fee_currency,o.delivery_days,o.deposit_amount_minor,o.deposit_currency,o.offer_expires_at,o.status,p.public_project_code,p.title,p.category,p.brief,p.preferred_deadline,p.revisions_included FROM project_offers o JOIN projects p ON p.id=o.project_id WHERE o.editor_id=? AND o.status IN ('offered','accepted_pending_terms','terms_accepted_pending_deposit') ORDER BY o.created_at DESC").bind(a.id).all();
  return out({ok:true,offers:r.results||[]});
 }
 const ac=p.match(/^\/v1\/offers\/([\w-]+)\/accept$/);
 if(m==="POST"&&ac){
  const a=await user(req,env,["editor"]),r=await env.DB.prepare("UPDATE project_offers SET status='accepted_pending_terms',accepted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND editor_id=? AND status='offered' AND (offer_expires_at IS NULL OR offer_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(ac[1],a.id).run();
  if(!r.meta?.changes)return bad("Offer is expired, unavailable or already processed.",409,"offer_not_available");
  await log(env,a.id,"offer_accepted","offer",ac[1]);return out({ok:true,next_step:"review_project_terms"});
 }
 const tm=p.match(/^\/v1\/offers\/([\w-]+)\/terms$/);
 if(m==="POST"&&tm){
  const a=await user(req,env,["editor"]),b=await req.json();if(b.accept!==true||!txt(b.agreement_version_id,100))return bad("Explicit agreement acceptance and version are required.");
  const o=await env.DB.prepare("SELECT id,project_id,status FROM project_offers WHERE id=? AND editor_id=?").bind(tm[1],a.id).first();
  if(!o||o.status!=="accepted_pending_terms")return bad("Offer is not awaiting agreement.",409);
  const ag=await env.DB.prepare("SELECT id FROM agreement_versions WHERE id=? AND agreement_type='project_specific' AND active=1").bind(b.agreement_version_id).first();if(!ag)return bad("Agreement version is not active.",409);
  await env.DB.prepare("INSERT INTO agreement_acceptances(id,agreement_version_id,user_id,project_id,offer_id) VALUES(?,?,?,?,?)").bind(uid("agr"),ag.id,a.id,o.project_id,tm[1]).run();
  await env.DB.prepare("UPDATE project_offers SET status='terms_accepted_pending_deposit' WHERE id=? AND editor_id=?").bind(tm[1],a.id).run();
  await log(env,a.id,"project_terms_accepted","offer",tm[1],{agreement_version_id:ag.id});return out({ok:true,next_step:"security_deposit_payment"});
 }
 const pay=p.match(/^\/v1\/offers\/([\w-]+)\/deposit\/checkout$/);
 if(m==="POST"&&pay){await user(req,env,["editor"]);return bad("Payment provider is not configured. No money has been collected. Enable checkout only after provider, legal and cross-border approval.",503,"payment_not_configured");}
 if(m==="GET"&&p==="/v1/admin/overview"){
  await user(req,env,["admin","staff"]);
  const q=await env.DB.batch([env.DB.prepare("SELECT COUNT(*) n FROM projects WHERE status IN ('submitted','under_review','matching')"),env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='editor' AND account_status='pending'"),env.DB.prepare("SELECT COUNT(*) n FROM assignments WHERE status IN ('active','submitted','quality_check','revision')"),env.DB.prepare("SELECT COUNT(*) n FROM project_disputes WHERE status IN ('open','under_review')")]);
  return out({ok:true,metrics:{projects_to_review:q[0].results[0].n,editors_pending:q[1].results[0].n,active_assignments:q[2].results[0].n,open_disputes:q[3].results[0].n}});
 }
 const ev=p.match(/^\/v1\/admin\/editors\/([\w-]+)\/verify$/);
 if(m==="POST"&&ev){
  const a=await user(req,env,["admin"]),b=await req.json();if(!["verified","rejected","in_review"].includes(b.status))return bad("Invalid verification status.");
  await env.DB.prepare("UPDATE editor_profiles SET verification_status=? WHERE user_id=?").bind(b.status,ev[1]).run();
  if(b.status==="verified")await env.DB.prepare("UPDATE users SET account_status='active' WHERE id=? AND role='editor'").bind(ev[1]).run();
  if(b.status==="rejected")await env.DB.prepare("UPDATE users SET account_status='suspended' WHERE id=? AND role='editor'").bind(ev[1]).run();
  await log(env,a.id,"editor_verification_updated","editor",ev[1],{status:b.status});return out({ok:true,status:b.status});
 }
 const of=p.match(/^\/v1\/admin\/projects\/([\w-]+)\/offers$/);
 if(m==="POST"&&of){
  const a=await user(req,env,["admin"]),b=await req.json(),ed=await env.DB.prepare("SELECT user_id FROM editor_profiles WHERE user_id=? AND verification_status='verified'").bind(b.editor_id).first();
  if(!ed)return bad("Only verified editors can receive offers.",409);
  const fee=amt(b.proposed_fee_minor),dep=amt(b.deposit_amount_minor),cur=txt(b.fee_currency,3).toUpperCase(),dc=txt(b.deposit_currency,3).toUpperCase();
  if(!fee||!dep||!/^[A-Z]{3}$/.test(cur)||!/^[A-Z]{3}$/.test(dc)||!Number.isInteger(b.delivery_days)||b.delivery_days<1)return bad("Valid fee, deposit, currency and delivery days are required.");
  const pr=await env.DB.prepare("SELECT id,status FROM projects WHERE id=?").bind(of[1]).first();if(!pr||!["submitted","under_review","approved","matching"].includes(pr.status))return bad("Project is not ready for matching.",409);
  const oid=uid("off");await env.DB.prepare("INSERT INTO project_offers(id,project_id,editor_id,offer_message,proposed_fee_minor,fee_currency,delivery_days,deposit_amount_minor,deposit_currency,offer_expires_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,'offered')").bind(oid,pr.id,ed.user_id,txt(b.offer_message,2000)||null,fee,cur,b.delivery_days,dep,dc,txt(b.offer_expires_at,40)||null).run();
  await env.DB.prepare("UPDATE projects SET status='matching',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(pr.id).run();await log(env,a.id,"project_offer_created","offer",oid,{project_id:pr.id,editor_id:ed.user_id});return out({ok:true,offer_id:oid,status:"offered"},201);
 }
 return bad("Route not found.",404,"not_found");
}
export default {async fetch(req,env){
 const origin=req.headers.get("Origin")||"",allowed=(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean),ch={"vary":"Origin","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Authorization,Content-Type","access-control-max-age":"86400"};
 if(allowed.includes(origin))ch["access-control-allow-origin"]=origin;
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:ch});
 try{const r=await handle(req,env),h=new Headers(r.headers);Object.entries(ch).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});}
 catch(e){const auth=/token|identity|account is|role is|verified email/i.test(e.message||"");return new Response(JSON.stringify({ok:false,error:{code:auth?"auth_error":"server_error",message:auth?e.message:"Request failed safely."}}),{status:auth?401:500,headers:{...H,...ch}});}
}};
