const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
const bad=(message,status=400,code="bad_request")=>out({ok:false,error:{code,message}},status);
const uid=(p)=>p+"_"+crypto.randomUUID().replaceAll("-","");
const txt=(v,n=2000)=>typeof v==="string"?v.trim().slice(0,n):"";
const amt=(v)=>Number.isSafeInteger(v)&&v>=0?v:null;
function safeHttpUrl(value,max=500){
 const raw=txt(value,max);if(!raw)return "";
 try{const u=new URL(raw);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.toString():"";}catch{return "";}
}
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
 if(c.iss!==env.AUTH_ISSUER||!(c.aud===env.AUTH_AUDIENCE||(Array.isArray(c.aud)&&c.aud.includes(env.AUTH_AUDIENCE)))||c.exp<=now||c.iat>now+60||c.email_verified!==true||!c.sub||!c.email)throw Error("Token claims or verified email are invalid.");
 return c;
}
async function user(req,env,roles){
 const c=await claims(req,env);
 const u=await env.DB.prepare("SELECT id,role,account_status,email FROM users WHERE auth_subject=? AND email=? COLLATE NOCASE").bind(c.sub,c.email).first();
 if(!u||u.account_status!=="active")throw Error("Account is pending or inactive.");
 if(!roles.includes(u.role))throw Error("Role is not permitted.");
 // Admin access is checked against the live Super Admin authorization registry on every request.
 if(u.role==="admin"){
  const a=await env.DB.prepare("SELECT 1 AS ok FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'").bind(u.email).first();
  if(!a)throw Error("CSA Super Admin authorization is inactive.");
 }
 return u;
}
async function hmacHex(secret,message){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));return [...sig].map(x=>x.toString(16).padStart(2,"0")).join("");}
function constantTime(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function log(env,actor,action,type,entity,meta={}){
 await env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)").bind(uid("log"),actor,action,type,entity,JSON.stringify(meta)).run();
}
async function rateLimit(env,req,scope,limit,windowSeconds=60){
 const ip=req.headers.get("CF-Connecting-IP")||"unknown";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(scope+"|"+ip));
 const key=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/windowSeconds)*windowSeconds;
 const row=await env.DB.prepare("INSERT INTO api_rate_limits(bucket_key,window_start,hits,expires_at) VALUES(?,?,1,?) ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=hits+1 RETURNING hits").bind(key,windowStart,windowStart+windowSeconds*2).first();
 const hits=Number(row?.hits||0);
 if(hits===1&&Math.floor(now/60)%15===0)await env.DB.prepare("DELETE FROM api_rate_limits WHERE expires_at<?").bind(now-86400).run();
 return {allowed:hits<=limit,retryAfter:Math.max(1,windowStart+windowSeconds-now)};
}
async function handle(req,env){
 const u=new URL(req.url),p=u.pathname.replace(/\/$/,""),m=req.method;
 // IP-based abuse controls for unauthenticated entry points and expensive upload routes.
 let policy=null;
 if(m==="POST"&&p==="/v1/auth/google")policy={scope:"google-auth",limit:10,window:60};
 else if(m==="POST"&&["/v1/onboarding/editor","/v1/onboarding/client"].includes(p))policy={scope:"onboarding",limit:5,window:60};
 else if(m==="POST"&&p==="/v1/uploads/multipart")policy={scope:"multipart-create",limit:5,window:60};
 else if(m==="PUT"&&/^\/v1\/uploads\/multipart\/[\w-]+\/parts\/\d+$/.test(p))policy={scope:"multipart-part",limit:120,window:300};
 else if(m==="POST"&&/^\/v1\/uploads\/multipart\/[\w-]+\/(complete|abort)$/.test(p))policy={scope:"multipart-finish",limit:10,window:300};
 else if(m==="PUT"&&(p.startsWith("/v1/projects/")&&p.endsWith("/files")||p.startsWith("/v1/assignments/")&&p.endsWith("/submissions")))policy={scope:"media-upload",limit:6,window:300};
 if(policy){
  const rl=await rateLimit(env,req,policy.scope,policy.limit,policy.window);
  if(!rl.allowed)return new Response(JSON.stringify({ok:false,error:{code:"rate_limited",message:"Too many requests. Please wait before trying again."}}),{status:429,headers:{...H,"retry-after":String(rl.retryAfter)}});
 }
 if(m==="POST"&&p==="/internal/admin-authorizations/sync"){
  // Private server-to-server snapshot from the CSA Super Admin Worker only.
  if(env.ENVIRONMENT!=="staging"||!env.ADMIN_SYNC_HMAC_SECRET)return bad("Admin authorization sync is not configured.",503,"sync_unavailable");
  const raw=await req.text();
  if(raw.length>65536)return bad("Authorization snapshot is too large.",413,"sync_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"";
  const seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/i.test(sig))return bad("Invalid sync authentication headers.",401,"sync_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  const bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\\n/internal/admin-authorizations/sync\\n"+ts+"\\n"+nonce+"\\n"+bodyHash;
  const expected=await hmacHex(env.ADMIN_SYNC_HMAC_SECRET,canonical);
  if(!constantTime(expected,sig))return bad("Sync signature is invalid.",401,"sync_signature_invalid");
  let snapshot;
  try{snapshot=JSON.parse(raw);}catch{return bad("Invalid JSON snapshot.");}
  if(!Array.isArray(snapshot)||snapshot.length>100)return bad("Snapshot must be an array of at most 100 admin records.");
  const seenIds=new Set(),seenEmails=new Set(),records=[];
  for(const item of snapshot){
   const sourceId=txt(item?.source_admin_id,100),email=txt(item?.email,254).toLowerCase(),role=txt(item?.source_role,40),status=txt(item?.status,20);
   if(!sourceId||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||!["project_admin","editor_admin","finance_admin","support_admin"].includes(role)||!["active","suspended","revoked"].includes(status))return bad("Snapshot contains an invalid admin record.");
   if(seenIds.has(sourceId)||seenEmails.has(email))return bad("Snapshot contains duplicate admin identities.");
   seenIds.add(sourceId);seenEmails.add(email);records.push({sourceId,email,role,status});
  }
  try{
   await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();
  }catch{return bad("Sync nonce was already used.",409,"sync_replay");}
  const statements=[env.DB.prepare("UPDATE global_admin_authorizations SET status='revoked',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),synced_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")];
  for(const a of records)statements.push(env.DB.prepare("INSERT INTO global_admin_authorizations(id,source_admin_id,email,source_role,status) VALUES(?,?,?,?,?) ON CONFLICT(source_admin_id) DO UPDATE SET email=excluded.email,source_role=excluded.source_role,status=excluded.status,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),synced_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(uid("gauth"),a.sourceId,a.email,a.role,a.status));
  statements.push(env.DB.prepare("DELETE FROM admin_sync_nonces WHERE expires_at<?").bind(nowSeconds));
  await env.DB.batch(statements);
  return out({ok:true,synced:records.length,revoked_if_absent:true},200);
 }
 if(m==="GET"&&p==="/health")return out({ok:true,service:"CSA Global API",status:"healthy",google_login:!!env.GOOGLE_CLIENT_ID,razorpay_checkout:!!(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET&&env.RAZORPAY_WEBHOOK_SECRET),mode:env.ENVIRONMENT||"staging"});
 if(m==="GET"&&p==="/v1/config")return out({ok:true,google_client_id:env.GOOGLE_CLIENT_ID||null,razorpay_key_id:env.RAZORPAY_KEY_ID||null,environment:env.ENVIRONMENT||"staging"});
 if(m==="POST"&&p==="/v1/auth/google"){
  const b=await req.json(),role=b.role,credential=txt(b.credential,10000),nonce=txt(b.nonce,200);
  if(!credential||!nonce||!["client","editor","admin"].includes(role))return bad("Google credential, login nonce and account type are required.");
  const c=await claims(new Request(req.url,{headers:{Authorization:"Bearer "+credential}}),env);
  if(c.nonce!==nonce)return bad("Google login nonce validation failed. Please retry sign-in.",401,"nonce_invalid");
  // A Google email allowlist alone must never create an administrator account.
  // Only a server-synchronized, active Super Admin invitation grants Global admin access.
  const adminAuthorization=role==="admin"?await env.DB.prepare("SELECT email,status FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'").bind(c.email).first():null;
  if(role==="admin"&&!adminAuthorization)return bad("This Google account has not been invited by the CSA Super Admin.",403,"admin_invitation_required");
  const old=await env.DB.prepare("SELECT id,role,account_status,email FROM users WHERE auth_subject=?").bind(c.sub).first();
  if(old){
   if(old.role!==role)return bad("This Google account is already registered under a different account type. Please use the existing account type.",409,"role_conflict");
   return out({ok:true,user_id:old.id,role:old.role,status:old.account_status,email:old.email});
  }
  const byEmail=await env.DB.prepare("SELECT id,role,auth_subject FROM users WHERE email=? COLLATE NOCASE").bind(c.email).first();
  if(byEmail)return bad("This email already has an account. Contact CSA support to securely link Google sign-in.",409,"email_exists");
  const profile=b.profile||{},name=txt(profile.display_name,120)||txt(c.name,120)||txt(c.email,254).split("@")[0],newId=uid("usr");
  if(role==="admin"){
   // Re-check immediately before creating the Global admin identity.
   const stillAuthorized=await env.DB.prepare("SELECT 1 AS ok FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'").bind(c.email).first();
   if(!stillAuthorized)return bad("CSA Super Admin authorization is no longer active.",403,"admin_authorization_revoked");
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status) VALUES(?,?, 'admin',?,?, 'active')").bind(newId,c.sub,c.email,new Date().toISOString()).run();
  }else if(role==="client"){
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'client',?,?, 'active',?)").bind(newId,c.sub,c.email,new Date().toISOString(),txt(profile.country_code,2).toUpperCase()||null).run();
   await env.DB.prepare("INSERT INTO client_profiles(user_id,display_name,company_name,country,timezone,preferred_language) VALUES(?,?,?,?,?,?)").bind(newId,name,txt(profile.company_name,160)||null,txt(profile.country,100)||null,txt(profile.timezone,80)||null,txt(profile.language,40)||"English").run();
  }else{
   const country=txt(profile.country,100),portfolio=safeHttpUrl(profile.portfolio_url,500),sample=safeHttpUrl(profile.sample_url,500),skills=Array.isArray(profile.specializations)?profile.specializations.map(x=>txt(x,80)).filter(Boolean).slice(0,20):[];
   if(!country||!portfolio||!skills.length)return bad("Editor country, a valid HTTP(S) portfolio URL and at least one specialization are required.");
   if(profile.sample_url&&!sample)return bad("Sample URL must use a valid HTTP or HTTPS address.");
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'editor',?,?, 'pending',?)").bind(newId,c.sub,c.email,new Date().toISOString(),txt(profile.country_code,2).toUpperCase()||null).run();
   await env.DB.prepare("INSERT INTO editor_profiles(user_id,public_editor_code,display_name,country,city,languages_json,experience_level,software_json,specializations_json,portfolio_url,sample_url,availability,bio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(newId,"CSA-ED-"+crypto.randomUUID().slice(0,8).toUpperCase(),name,country,txt(profile.city,100)||null,JSON.stringify(Array.isArray(profile.languages)?profile.languages:[]),txt(profile.experience_level,40)||null,JSON.stringify(Array.isArray(profile.software)?profile.software:[]),JSON.stringify(skills),portfolio,sample||null,txt(profile.availability,40)||"project-based",txt(profile.bio,2000)||null).run();
  }
  await log(env,newId,"google_account_registered",role,newId,{email_domain:c.email.split("@")[1]});
  return out({ok:true,user_id:newId,role,status:role==="editor"?"pending":"active",email:c.email},201);
 }
 if(m==="POST"&&p==="/v1/onboarding/editor"){
  const c=await claims(req,env),b=await req.json(),name=txt(b.display_name,120),country=txt(b.country,100);
  const portfolio=safeHttpUrl(b.portfolio_url,500),sample=safeHttpUrl(b.sample_url,500);
  if(!name||!country||!Array.isArray(b.specializations)||!b.specializations.length||!portfolio)return bad("Name, country, specializations and a valid HTTP(S) portfolio URL are required.");
  if(b.sample_url&&!sample)return bad("Sample URL must use a valid HTTP or HTTPS address.");
  const idu=uid("usr");
  await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'editor',?,?, 'pending',?)").bind(idu,c.sub,c.email,new Date().toISOString(),txt(b.country_code,2).toUpperCase()||null).run();
  await env.DB.prepare("INSERT INTO editor_profiles(user_id,public_editor_code,display_name,country,city,languages_json,experience_level,software_json,specializations_json,portfolio_url,sample_url,availability,bio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(idu,"CSA-ED-"+crypto.randomUUID().slice(0,8).toUpperCase(),name,country,txt(b.city,100)||null,JSON.stringify(b.languages||[]),txt(b.experience_level,40)||null,JSON.stringify(b.software||[]),JSON.stringify(b.specializations),portfolio,sample||null,txt(b.availability,40)||"project-based",txt(b.bio,2000)||null).run();
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
 if(m==="GET"&&p==="/v1/client/projects"){
  const a=await user(req,env,["client"]);
  const r=await env.DB.prepare("SELECT id,public_project_code,title,category,budget_amount_minor,budget_currency,CASE WHEN client_visible_status='reviewing' THEN 'client_review' WHEN client_visible_status='in_progress' THEN 'in_progress' WHEN status IN ('submitted','under_review','approved','matching') THEN 'submitted' WHEN status IN ('assigned','in_progress','revision') THEN 'in_progress' WHEN status='quality_check' THEN 'quality_review' WHEN status IN ('client_review','completed') THEN status WHEN status IN ('cancelled','rejected') THEN 'closed' ELSE 'submitted' END AS status,preferred_deadline,created_at,updated_at FROM projects WHERE client_id=? ORDER BY created_at DESC LIMIT 100").bind(a.id).all();
  return out({ok:true,projects:r.results||[]});
 }
 // Resumable R2 multipart uploads: 50 MiB parts, up to 5 GiB per file.
 const multipartPart=p.match(/^\/v1\/uploads\/multipart\/([\w-]+)\/parts\/(\d+)$/);
 const multipartAction=p.match(/^\/v1\/uploads\/multipart\/([\w-]+)\/(complete|abort)$/);
 if(m==="POST"&&p==="/v1/uploads/multipart"){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const a=await user(req,env,["client","editor"]),b=await req.json();
  if(!["project_file","submission"].includes(b.purpose))return bad("Upload purpose must be project_file or submission.");
  const purpose=b.purpose;
  const total=Number(b.size_bytes),partSize=50*1024*1024,maxSize=5*1024*1024*1024;
  const mime=txt(b.mime_type,100).toLowerCase(),allowed=["video/mp4","video/quicktime","video/x-matroska","audio/mpeg","audio/wav","audio/x-wav","image/jpeg","image/png","application/pdf","application/zip","application/octet-stream"];
  if(!Number.isSafeInteger(total)||total<=90*1024*1024||total>maxSize)return bad("Resumable upload supports files larger than 90 MB and up to 5 GB.",413,"invalid_upload_size");
  if(!allowed.includes(mime))return bad("This file type is not allowed.",415);
  const rawName=txt(b.filename,180)||"upload.bin",name=rawName.split(/[\\\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||"upload.bin";
  let projectId=null,assignmentId=null,key="";
  if(purpose==="project_file"){
   projectId=txt(b.project_id,100);
   const project=await env.DB.prepare("SELECT id,client_id FROM projects WHERE id=?").bind(projectId).first();
   if(!project)return bad("Project not found.",404);
   if(a.role==="client"&&project.client_id!==a.id)return bad("You cannot upload to this project.",403);
   if(a.role==="editor"){
    const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND editor_id=? AND status IN ('active','submitted','quality_check','revision')").bind(projectId,a.id).first();
    if(!assignment)return bad("Only the assigned editor can upload to this project.",403);
   }
   key="projects/"+projectId+"/source/"+uid("file")+"/"+name;
  }else{
   if(a.role!=="editor")return bad("Only assigned editors can submit deliverables.",403);
   assignmentId=txt(b.assignment_id,100);
   const assignment=await env.DB.prepare("SELECT id,project_id FROM assignments WHERE id=? AND editor_id=? AND status IN ('active','revision')").bind(assignmentId,a.id).first();
   if(!assignment)return bad("Assignment is not active for this editor.",403);
   projectId=assignment.project_id;
   key="assignments/"+assignmentId+"/multipart/"+uid("sub")+"/"+name;
  }
  const expectedParts=Math.ceil(total/partSize);
  const id=uid("upl"),disposition="attachment; filename*=UTF-8''"+encodeURIComponent(name);
  const upload=await env.MEDIA.createMultipartUpload(key,{httpMetadata:{contentType:mime,contentDisposition:disposition}});
  const expires=new Date(Date.now()+24*60*60*1000).toISOString();
  try{
   await env.DB.prepare("INSERT INTO multipart_upload_sessions(id,project_id,assignment_id,uploaded_by,purpose,r2_object_key,r2_upload_id,original_filename,mime_type,total_size_bytes,part_size_bytes,expected_parts,notes,status,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?)")
    .bind(id,projectId,assignmentId,a.id,purpose,key,upload.uploadId,name,mime,total,partSize,expectedParts,txt(b.notes,2000)||null,expires).run();
  }catch(e){await upload.abort();throw e;}
  await log(env,a.id,"multipart_upload_started","multipart_upload",id,{purpose,total_size_bytes:total,expected_parts:expectedParts});
  return out({ok:true,upload_id:id,part_size_bytes:partSize,expected_parts:expectedParts,expires_at:expires},201);
 }
 // Read-only inspection for a single multipart session. Never returns R2 object keys or provider upload IDs.
 const multipartInspect=p.match(/^\/v1\/admin\/multipart-uploads\/([\w-]+)\/inspect$/);
 if(m==="GET"&&multipartInspect){
  await user(req,env,["admin","staff"]);
  const id=multipartInspect[1];
  const session=await env.DB.prepare("SELECT s.id,s.purpose,s.original_filename,s.total_size_bytes,s.part_size_bytes,s.expected_parts,s.status,s.created_at,s.expires_at,s.completed_at,s.project_id,s.assignment_id,u.email,u.role,COALESCE(cp.display_name,ep.display_name,u.email) AS uploader_name,p.public_project_code,p.title AS project_title FROM multipart_upload_sessions s JOIN users u ON u.id=s.uploaded_by LEFT JOIN client_profiles cp ON cp.user_id=u.id LEFT JOIN editor_profiles ep ON ep.user_id=u.id LEFT JOIN projects p ON p.id=s.project_id WHERE s.id=?").bind(id).first();
  if(!session)return bad("Upload session not found.",404);
  const rows=await env.DB.prepare("SELECT part_number,size_bytes,created_at,sha256 IS NOT NULL AS checksum_present FROM multipart_upload_parts WHERE session_id=? ORDER BY part_number").bind(id).all();
  const parts=(rows.results||[]).map(r=>({part_number:Number(r.part_number),size_bytes:Number(r.size_bytes),created_at:r.created_at,checksum_present:Boolean(r.checksum_present)}));
  const present=new Set(parts.map(r=>r.part_number)),expected=Number(session.expected_parts);
  const missing=[];for(let n=1;n<=expected;n++)if(!present.has(n))missing.push(n);
  return out({ok:true,session:{...session,total_size_bytes:Number(session.total_size_bytes),part_size_bytes:Number(session.part_size_bytes),expected_parts:expected,age_minutes:Math.max(0,Math.floor((Date.now()-new Date(session.created_at).getTime())/60000)),expired:session.status==="open"&&new Date(session.expires_at).getTime()<=Date.now()},parts,missing_parts:missing,integrity:{parts_with_checksum:parts.filter(x=>x.checksum_present).length,parts_without_checksum:parts.filter(x=>!x.checksum_present).length}});
 }
 // Append-only admin incident and resolution history for a multipart upload.
 const multipartIncidents=p.match(/^\/v1\/admin\/multipart-uploads\/([\w-]+)\/incidents$/);
 if(multipartIncidents&&(m==="GET"||m==="POST")){
  const actor=await user(req,env,["admin","staff"]),sessionId=multipartIncidents[1];
  const session=await env.DB.prepare("SELECT id FROM multipart_upload_sessions WHERE id=?").bind(sessionId).first();
  if(!session)return bad("Upload session not found.",404);
  if(m==="GET"){
   const rows=await env.DB.prepare("SELECT i.id,i.incident_type,i.resolution_status,i.notes,i.created_at,u.email AS actor_email,COALESCE(cp.display_name,ep.display_name,u.email) AS actor_name FROM multipart_upload_incidents i JOIN users u ON u.id=i.actor_user_id LEFT JOIN client_profiles cp ON cp.user_id=u.id LEFT JOIN editor_profiles ep ON ep.user_id=u.id WHERE i.session_id=? ORDER BY i.created_at DESC LIMIT 50").bind(sessionId).all();
   return out({ok:true,incidents:rows.results||[]});
  }
  const body=await req.json(),incidentType=txt(body.incident_type,40),resolution=txt(body.resolution_status,40),notes=txt(body.notes,1000);
  if(!["upload_failed","unknown_completion","stale_completion","expired_session","integrity_issue","other"].includes(incidentType))return bad("Invalid incident type.");
  if(!["reviewed","awaiting_user","reupload_requested","resolved","escalated"].includes(resolution))return bad("Invalid resolution status.");
  if(!notes)return bad("A short resolution note is required.");
  const id=uid("inc");
  await env.DB.prepare("INSERT INTO multipart_upload_incidents(id,session_id,actor_user_id,incident_type,resolution_status,notes) VALUES(?,?,?,?,?,?)").bind(id,sessionId,actor.id,incidentType,resolution,notes).run();
  await log(env,actor.id,"multipart_upload_incident_recorded","multipart_upload",sessionId,{incident_id:id,incident_type:incidentType,resolution_status:resolution});
  return out({ok:true,incident_id:id,recorded:true},201);
 }
 // Admin-only operational view of multipart upload sessions; no R2 credentials or object keys returned.
 if(m==="GET"&&p==="/v1/admin/multipart-uploads"){
  await user(req,env,["admin","staff"]);
  const stats=await env.DB.prepare("SELECT status,COUNT(*) AS sessions,COALESCE(SUM(total_size_bytes),0) AS bytes FROM multipart_upload_sessions GROUP BY status").all();
  const recent=await env.DB.prepare("SELECT s.id,s.purpose,s.original_filename,s.total_size_bytes,s.expected_parts,s.status,s.created_at,s.expires_at,COALESCE(x.parts_uploaded,0) AS parts_uploaded,COALESCE(x.bytes_uploaded,0) AS bytes_uploaded,u.email,u.role,COALESCE(cp.display_name,ep.display_name,u.email) AS uploader_name,p.public_project_code,p.title AS project_title FROM multipart_upload_sessions s JOIN users u ON u.id=s.uploaded_by LEFT JOIN client_profiles cp ON cp.user_id=u.id LEFT JOIN editor_profiles ep ON ep.user_id=u.id LEFT JOIN projects p ON p.id=s.project_id LEFT JOIN (SELECT session_id,COUNT(*) AS parts_uploaded,SUM(size_bytes) AS bytes_uploaded FROM multipart_upload_parts GROUP BY session_id) x ON x.session_id=s.id ORDER BY s.created_at DESC LIMIT 50").all();
  const totals={open:0,completed:0,aborted:0,unknown:0,completing:0,expired_open:0,total_bytes:0};
  for(const row of stats.results||[]){totals[row.status]=Number(row.sessions);totals.total_bytes+=Number(row.bytes||0);}
  const now=new Date().toISOString(),staleBefore=new Date(Date.now()-15*60*1000).toISOString();
  const expired=await env.DB.prepare("SELECT COUNT(*) AS n FROM multipart_upload_sessions WHERE status='open' AND expires_at<=?").bind(now).first();
  const attention=await env.DB.prepare("SELECT s.id,s.purpose,s.original_filename,s.total_size_bytes,s.expected_parts,s.status,s.created_at,s.expires_at,u.email,u.role,COALESCE(cp.display_name,ep.display_name,u.email) AS uploader_name,p.public_project_code FROM multipart_upload_sessions s JOIN users u ON u.id=s.uploaded_by LEFT JOIN client_profiles cp ON cp.user_id=u.id LEFT JOIN editor_profiles ep ON ep.user_id=u.id LEFT JOIN projects p ON p.id=s.project_id WHERE s.status='unknown' OR (s.status='completing' AND s.created_at<=?) OR (s.status='open' AND s.expires_at<=?) ORDER BY s.created_at ASC LIMIT 30").bind(staleBefore,now).all();
  const uploads=(recent.results||[]).map(r=>({...r,total_size_bytes:Number(r.total_size_bytes),expected_parts:Number(r.expected_parts),parts_uploaded:Number(r.parts_uploaded),bytes_uploaded:Number(r.bytes_uploaded),expired_open:r.status==="open"&&new Date(r.expires_at).getTime()<=Date.now()}));
  const needsReview=(attention.results||[]).map(r=>({...r,total_size_bytes:Number(r.total_size_bytes),expected_parts:Number(r.expected_parts),age_minutes:Math.max(0,Math.floor((Date.now()-new Date(r.created_at).getTime())/60000)),reason:r.status==="unknown"?"Storage completion outcome is uncertain; reconcile before retrying.":r.status==="completing"?"Completion has remained in progress for over 15 minutes; inspect storage and metadata.":"Session expired and is awaiting scheduled cleanup."}));
  totals.expired_open=Number(expired?.n||0);
  return out({ok:true,totals,uploads,attention:needsReview});
 }
 // Admin-only history for hourly multipart cleanup executions.
 if(m==="GET"&&p==="/v1/admin/multipart-cleanup-runs"){
  await user(req,env,["admin","staff"]);
  const rows=await env.DB.prepare("SELECT id,started_at,finished_at,status,checked,aborted,failed,error_message FROM multipart_cleanup_runs ORDER BY started_at DESC LIMIT 30").all();
  return out({ok:true,runs:(rows.results||[]).map(r=>({...r,checked:Number(r.checked||0),aborted:Number(r.aborted||0),failed:Number(r.failed||0)}))});
 }
 // Recent multipart upload history is limited to the authenticated account.
 if(m==="GET"&&p==="/v1/uploads/multipart/history"){
  const a=await user(req,env,["client","editor"]);
  const rows=await env.DB.prepare("SELECT s.id,s.project_id,s.assignment_id,s.purpose,s.original_filename,s.total_size_bytes,s.expected_parts,s.status,s.created_at,s.expires_at,s.completed_at,COALESCE(x.parts_uploaded,0) AS parts_uploaded,COALESCE(x.bytes_uploaded,0) AS bytes_uploaded FROM multipart_upload_sessions s LEFT JOIN (SELECT session_id,COUNT(*) AS parts_uploaded,SUM(size_bytes) AS bytes_uploaded FROM multipart_upload_parts GROUP BY session_id) x ON x.session_id=s.id WHERE s.uploaded_by=? ORDER BY s.created_at DESC LIMIT 30").bind(a.id).all();
  return out({ok:true,uploads:(rows.results||[]).map(r=>({...r,total_size_bytes:Number(r.total_size_bytes),expected_parts:Number(r.expected_parts),parts_uploaded:Number(r.parts_uploaded),bytes_uploaded:Number(r.bytes_uploaded)}))});
 }
 const multipartSession=p.match(/^\/v1\/uploads\/multipart\/([\w-]+)$/);
 if(m==="GET"&&multipartSession){
  const a=await user(req,env,["client","editor"]),id=multipartSession[1];
  const session=await env.DB.prepare("SELECT id,purpose,original_filename,total_size_bytes,part_size_bytes,expected_parts,status,expires_at,uploaded_by FROM multipart_upload_sessions WHERE id=?").bind(id).first();
  if(!session)return bad("Upload session not found.",404);
  if(session.uploaded_by!==a.id)return bad("This upload session belongs to another account.",403);
  if(session.status!=="open"||new Date(session.expires_at).getTime()<Date.now())return bad("Upload session is not active or has expired.",410);
  const rows=await env.DB.prepare("SELECT part_number,size_bytes,sha256 FROM multipart_upload_parts WHERE session_id=? ORDER BY part_number").bind(id).all();
  return out({ok:true,upload_id:id,status:session.status,filename:session.original_filename,total_size_bytes:session.total_size_bytes,expected_parts:session.expected_parts,part_size_bytes:session.part_size_bytes,uploaded_parts:(rows.results||[]).map(x=>({part_number:Number(x.part_number),size_bytes:Number(x.size_bytes),sha256:x.sha256||null})),expires_at:session.expires_at});
 }
 if(m==="PUT"&&multipartPart){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const a=await user(req,env,["client","editor"]),id=multipartPart[1],partNumber=Number(multipartPart[2]);
  const session=await env.DB.prepare("SELECT * FROM multipart_upload_sessions WHERE id=?").bind(id).first();
  if(!session)return bad("Upload session not found.",404);
  if(session.uploaded_by!==a.id)return bad("This upload session belongs to another account.",403);
  if(session.status!=="open"||new Date(session.expires_at).getTime()<Date.now())return bad("Upload session is not active or has expired.",410);
  if(!Number.isInteger(partNumber)||partNumber<1||partNumber>session.expected_parts)return bad("Invalid part number.");
  const expected=Math.min(session.part_size_bytes,session.total_size_bytes-(partNumber-1)*session.part_size_bytes);
  const declared=Number(req.headers.get("content-length")||0);if(declared&&declared!==expected)return bad("Part Content-Length does not match the expected chunk size.",400,"part_size_mismatch");
  const data=await req.arrayBuffer(),actual=data.byteLength;
  if(actual!==expected)return bad("Uploaded part byte count does not match the expected size.",actual>expected?413:400,"part_size_mismatch");
  const digest=await crypto.subtle.digest("SHA-256",data),partSha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
  let uploaded;
  try{uploaded=await env.MEDIA.resumeMultipartUpload(session.r2_object_key,session.r2_upload_id).uploadPart(partNumber,data);}
  catch(e){throw e;}
  await env.DB.prepare("INSERT INTO multipart_upload_parts(session_id,part_number,etag,size_bytes,sha256) VALUES(?,?,?,?,?) ON CONFLICT(session_id,part_number) DO UPDATE SET etag=excluded.etag,size_bytes=excluded.size_bytes,sha256=excluded.sha256,uploaded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(id,partNumber,uploaded.etag,actual,partSha256).run();
  return out({ok:true,upload_id:id,part_number:partNumber,size_bytes:actual,etag:uploaded.etag});
 }
 if(m==="POST"&&multipartAction){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const a=await user(req,env,["client","editor"]),id=multipartAction[1],action=multipartAction[2];
  const session=await env.DB.prepare("SELECT * FROM multipart_upload_sessions WHERE id=?").bind(id).first();
  if(!session)return bad("Upload session not found.",404);
  if(session.uploaded_by!==a.id)return bad("This upload session belongs to another account.",403);
  if(action==="abort"){
   if(session.status!=="open")return bad("Only an open upload can be aborted.",409);
   await env.MEDIA.resumeMultipartUpload(session.r2_object_key,session.r2_upload_id).abort();
   await env.DB.prepare("UPDATE multipart_upload_sessions SET status='aborted' WHERE id=? AND status='open'").bind(id).run();
   await log(env,a.id,"multipart_upload_aborted","multipart_upload",id,{});
   return out({ok:true,status:"aborted"});
  }
  if(session.status!=="open"||new Date(session.expires_at).getTime()<Date.now())return bad("Upload session is not active or has expired.",410);
  if(session.purpose==="project_file"){
   const project=await env.DB.prepare("SELECT id,client_id FROM projects WHERE id=?").bind(session.project_id).first();
   if(!project)return bad("Project no longer exists.",404);
   if(a.role==="client"&&project.client_id!==a.id)return bad("You no longer have access to this project.",403);
   if(a.role==="editor"){
    const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND editor_id=? AND status IN ('active','submitted','quality_check','revision')").bind(session.project_id,a.id).first();
    if(!assignment)return bad("Your project assignment is no longer active.",403);
   }
  }else{
   const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE id=? AND editor_id=? AND status IN ('active','revision')").bind(session.assignment_id,a.id).first();
   if(!assignment)return bad("Assignment is no longer active for submission.",403);
  }
  const rows=await env.DB.prepare("SELECT part_number,etag,size_bytes FROM multipart_upload_parts WHERE session_id=? ORDER BY part_number").bind(id).all();
  const parts=rows.results||[];
  if(parts.length!==session.expected_parts||parts.some((x,i)=>Number(x.part_number)!==i+1))return bad("Some upload parts are missing. Upload all parts before completing.",409,"parts_incomplete");
  if(parts.reduce((n,x)=>n+Number(x.size_bytes),0)!==session.total_size_bytes)return bad("Uploaded part sizes do not match the original file size.",400,"total_size_mismatch");
  const claimed=await env.DB.prepare("UPDATE multipart_upload_sessions SET status='completing' WHERE id=? AND status='open'").bind(id).run();
  if(!claimed.meta?.changes)return bad("Upload completion is already in progress or finished.",409);
  let object;
  try{object=await env.MEDIA.resumeMultipartUpload(session.r2_object_key,session.r2_upload_id).complete(parts.map(x=>({partNumber:Number(x.part_number),etag:x.etag})));}
  catch(e){await env.DB.prepare("UPDATE multipart_upload_sessions SET status='unknown' WHERE id=?").bind(id).run();return bad("Storage completion outcome is uncertain. Contact CSA before retrying this upload.",502,"multipart_completion_unknown");}
  try{
   if(session.purpose==="project_file"){
    await env.DB.prepare("INSERT INTO project_files(id,project_id,uploaded_by,r2_object_key,original_filename,mime_type,size_bytes,access_scope) VALUES(?,?,?,?,?,?,?,'assigned_editor')").bind(uid("file"),session.project_id,a.id,session.r2_object_key,session.original_filename,session.mime_type,session.total_size_bytes).run();
   }else{
    const last=await env.DB.prepare("SELECT COALESCE(MAX(version_number),0) AS n FROM work_submissions WHERE assignment_id=?").bind(session.assignment_id).first(),version=Number(last.n)+1,submissionId=uid("sub");
    await env.DB.batch([
     env.DB.prepare("INSERT INTO work_submissions(id,assignment_id,submitted_by,r2_object_key,version_number,notes,qc_status,original_filename,mime_type,size_bytes) VALUES(?,?,?,?,?,?,'pending',?,?,?)").bind(submissionId,session.assignment_id,a.id,session.r2_object_key,version,session.notes,session.original_filename,session.mime_type,session.total_size_bytes),
     env.DB.prepare("UPDATE assignments SET status='submitted' WHERE id=?").bind(session.assignment_id),
     env.DB.prepare("UPDATE projects SET status='quality_check',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(session.project_id)
    ]);
   }
   await env.DB.prepare("UPDATE multipart_upload_sessions SET status='completed',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).run();
  }catch(e){await env.DB.prepare("UPDATE multipart_upload_sessions SET status='unknown' WHERE id=?").bind(id).run();return bad("File is stored but CSA metadata finalization needs manual reconciliation.",500,"multipart_finalize_unknown");}
  await log(env,a.id,"multipart_upload_completed","multipart_upload",id,{purpose:session.purpose,size_bytes:session.total_size_bytes,etag:object?.etag||null});
  return out({ok:true,status:"completed",purpose:session.purpose,size_bytes:session.total_size_bytes});
 }
 if(m==="PUT"&&p.startsWith("/v1/projects/")&&p.endsWith("/files")){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const projectId=p.split("/")[3],a=await user(req,env,["client","editor","admin"]);
  const project=await env.DB.prepare("SELECT id,client_id FROM projects WHERE id=?").bind(projectId).first();
  if(!project)return bad("Project not found.",404);
  if(a.role==="client"&&project.client_id!==a.id)return bad("You cannot upload to this project.",403);
  if(a.role==="editor"){
   const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND editor_id=? AND status IN ('active','submitted','quality_check','revision')").bind(projectId,a.id).first();
   if(!assignment)return bad("Only the assigned editor can upload to this project.",403);
  }
  const size=Number(req.headers.get("content-length")||0),mime=txt(req.headers.get("content-type"),100).split(";")[0].toLowerCase();
  if(!size||size>90*1024*1024)return bad("File must include Content-Length and be 90 MB or smaller for this staging uploader.",413);
  const allowed=["video/mp4","video/quicktime","video/x-matroska","audio/mpeg","audio/wav","audio/x-wav","image/jpeg","image/png","application/pdf","application/zip","application/octet-stream"];
  if(!allowed.includes(mime))return bad("This file type is not allowed.",415);
  const rawName=txt(req.headers.get("x-file-name"),180)||"upload.bin",name=rawName.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||"upload.bin";
  const fileId=uid("file"),key="projects/"+projectId+"/source/"+fileId+"/"+name;
  let actualSize=0;
  const limitedBody=req.body.pipeThrough(new TransformStream({
   transform(chunk,controller){
    actualSize+=chunk.byteLength;
    if(actualSize>90*1024*1024){controller.error(new Error("upload_too_large"));return;}
    controller.enqueue(chunk);
   }
  }));
  try{
   await env.MEDIA.put(key,limitedBody,{httpMetadata:{contentType:mime,contentDisposition:"attachment; filename*=UTF-8''"+encodeURIComponent(name)}});
  }catch(e){
   if(String(e?.message||"").includes("upload_too_large"))return bad("Actual uploaded file size exceeds the 90 MB staging limit.",413,"file_too_large");
   throw e;
  }
  if(actualSize!==size){
   await env.MEDIA.delete(key);
   return bad("Uploaded byte count does not match Content-Length. Please retry the upload.",400,"content_length_mismatch");
  }
  await env.DB.prepare("INSERT INTO project_files(id,project_id,uploaded_by,r2_object_key,original_filename,mime_type,size_bytes,access_scope) VALUES(?,?,?,?,?,?,?,'assigned_editor')").bind(fileId,projectId,a.id,key,name,mime,actualSize).run();
  await log(env,a.id,"project_file_uploaded","project_file",fileId,{project_id:projectId,size_bytes:size,mime_type:mime});
  return out({ok:true,file_id:fileId,filename:name,size_bytes:size,status:"stored_privately"},201);
 }
 const projectFiles=p.match(/^\/v1\/projects\/([\w-]+)\/files$/);
 if(m==="GET"&&projectFiles){
  const a=await user(req,env,["client","editor","admin","staff"]),project=await env.DB.prepare("SELECT id,client_id FROM projects WHERE id=?").bind(projectFiles[1]).first();
  if(!project)return bad("Project not found.",404);
  let allowed=a.role==="admin"||a.role==="staff"||a.id===project.client_id;
  if(a.role==="editor"){const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND editor_id=? AND status IN ('active','submitted','quality_check','revision','approved','completed')").bind(project.id,a.id).first();allowed=!!assignment;}
  if(!allowed)return bad("You cannot view files for this project.",403);
  const r=await env.DB.prepare("SELECT id,original_filename,mime_type,size_bytes,created_at FROM project_files WHERE project_id=? ORDER BY created_at ASC").bind(project.id).all();
  return out({ok:true,files:r.results||[]});
 }
 const deliver=p.match(/^\/v1\/client\/projects\/([\w-]+)\/deliverables$/);
 if(m==="GET"&&deliver){
  const a=await user(req,env,["client"]),project=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND client_id=?").bind(deliver[1],a.id).first();
  if(!project)return bad("Project not found.",404);
  const r=await env.DB.prepare("SELECT s.id,s.version_number,s.original_filename,s.mime_type,s.size_bytes,s.submitted_at FROM work_submissions s JOIN assignments x ON x.id=s.assignment_id WHERE x.project_id=? AND s.qc_status='approved' ORDER BY s.version_number DESC").bind(project.id).all();
  return out({ok:true,deliverables:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/editor/assignments"){
  const a=await user(req,env,["editor"]);
  const r=await env.DB.prepare("SELECT a.id,a.project_id,a.due_at,a.status,p.public_project_code,p.title,p.category,p.brief,o.delivery_days FROM assignments a JOIN projects p ON p.id=a.project_id JOIN project_offers o ON o.id=a.offer_id WHERE a.editor_id=? AND a.status IN ('active','submitted','quality_check','revision') ORDER BY a.due_at ASC").bind(a.id).all();
  return out({ok:true,assignments:r.results||[]});
 }
 if(m==="PUT"&&p.startsWith("/v1/assignments/")&&p.endsWith("/submissions")){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const assignmentId=p.split("/")[3],a=await user(req,env,["editor"]);
  const assignment=await env.DB.prepare("SELECT id,project_id,status FROM assignments WHERE id=? AND editor_id=? AND status IN ('active','revision')").bind(assignmentId,a.id).first();
  if(!assignment)return bad("Assignment is not active for this editor.",403);
  const size=Number(req.headers.get("content-length")||0),mime=txt(req.headers.get("content-type"),100).split(";")[0].toLowerCase();
  if(!size||size>90*1024*1024)return bad("Submission must be 90 MB or smaller in this staging uploader.",413);
  const allowed=["video/mp4","video/quicktime","video/x-matroska","audio/mpeg","audio/wav","audio/x-wav","image/jpeg","image/png","application/pdf","application/zip","application/octet-stream"];
  if(!allowed.includes(mime))return bad("Submission file type is not allowed.",415);
  const last=await env.DB.prepare("SELECT COALESCE(MAX(version_number),0) AS n FROM work_submissions WHERE assignment_id=?").bind(assignmentId).first(),version=Number(last.n)+1;
  const rawName=txt(req.headers.get("x-file-name"),180)||"submission.bin",name=rawName.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||"submission.bin",submissionId=uid("sub"),key="assignments/"+assignmentId+"/submissions/"+version+"/"+submissionId+"/"+name;
  const saved=await env.MEDIA.put(key,req.body,{httpMetadata:{contentType:mime,contentDisposition:"attachment; filename*=UTF-8''"+encodeURIComponent(name)}});
  if(saved.size>90*1024*1024){await env.MEDIA.delete(key);return bad("Submission exceeds the staging upload size limit.",413);}
  await env.DB.batch([
   env.DB.prepare("INSERT INTO work_submissions(id,assignment_id,submitted_by,r2_object_key,version_number,notes,qc_status,original_filename,mime_type,size_bytes) VALUES(?,?,?,?,?,?,'pending',?,?,?)").bind(submissionId,assignmentId,a.id,key,version,txt(req.headers.get("x-submission-notes"),2000)||null,name,mime,saved.size),
   env.DB.prepare("UPDATE assignments SET status='submitted' WHERE id=?").bind(assignmentId),
   env.DB.prepare("UPDATE projects SET status='quality_check',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(assignment.project_id)
  ]);
  await log(env,a.id,"work_submission_uploaded","submission",submissionId,{assignment_id:assignmentId,version});
  return out({ok:true,submission_id:submissionId,version,status:"pending_quality_check"},201);
 }
 if(m==="GET"&&p==="/v1/admin/submissions/pending"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT s.id,s.assignment_id,s.version_number,s.notes,s.submitted_at,s.original_filename,s.mime_type,s.size_bytes,a.project_id,a.editor_id,p.public_project_code,p.title,e.public_editor_code,e.display_name FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN projects p ON p.id=a.project_id JOIN editor_profiles e ON e.user_id=a.editor_id WHERE s.qc_status='pending' ORDER BY s.submitted_at ASC LIMIT 100").all();
  return out({ok:true,submissions:r.results||[]});
 }
 const qc=p.match(/^\/v1\/admin\/submissions\/([\w-]+)\/review$/);
 if(m==="POST"&&qc){
  const a=await user(req,env,["admin"]),b=await req.json(),status=b.status;
  if(!["approved","changes_requested","rejected"].includes(status))return bad("Invalid QC decision.");
  const sub=await env.DB.prepare("SELECT s.id,s.assignment_id,a.project_id FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=? AND s.qc_status='pending'").bind(qc[1]).first();
  if(!sub)return bad("Submission is not awaiting QC.",409);
  await env.DB.batch([
   env.DB.prepare("UPDATE work_submissions SET qc_status=? WHERE id=?").bind(status,qc[1]),
   env.DB.prepare("UPDATE assignments SET status=? WHERE id=?").bind(status==="approved"?"approved":status==="changes_requested"?"revision":"active",sub.assignment_id),
   env.DB.prepare("UPDATE projects SET status=?,client_visible_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(status==="approved"?"client_review":status==="changes_requested"?"revision":"in_progress",status==="approved"?"reviewing":"in_progress",sub.project_id)
  ]);
  await log(env,a.id,"quality_review_completed","submission",qc[1],{status});
  return out({ok:true,status});
 }
 if(m==="GET"&&p==="/v1/admin/deposits/refunds/eligible"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT p.id AS payment_id,p.amount_minor,p.currency,p.provider_payment_id,p.created_at AS paid_at,o.id AS offer_id,pr.id AS project_id,pr.public_project_code,pr.title,e.display_name,e.public_editor_code,s.id AS approved_submission_id,s.submitted_at AS quality_approved_at FROM payments p JOIN project_offers o ON o.id=p.offer_id JOIN projects pr ON pr.id=o.project_id JOIN editor_profiles e ON e.user_id=p.user_id JOIN assignments a ON a.offer_id=o.id AND a.editor_id=p.user_id JOIN work_submissions s ON s.assignment_id=a.id AND s.qc_status='approved' WHERE p.payment_type='editor_security_deposit' AND p.status='succeeded' AND NOT EXISTS(SELECT 1 FROM editor_deposit_refunds x WHERE x.payment_id=p.id) GROUP BY p.id ORDER BY s.submitted_at ASC LIMIT 100").all();
  return out({ok:true,eligible:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/editor/deposit-refunds"){
  const a=await user(req,env,["editor"]);
  const r=await env.DB.prepare("SELECT r.id,r.amount_minor,r.currency,r.status,r.provider_refund_id,r.created_at,r.updated_at,pr.public_project_code,pr.title FROM editor_deposit_refunds r JOIN payments p ON p.id=r.payment_id JOIN projects pr ON pr.id=p.project_id WHERE r.editor_id=? ORDER BY r.created_at DESC LIMIT 100").bind(a.id).all();
  return out({ok:true,refunds:r.results||[]});
 }
 const refundMatch=p.match(/^\/v1\/admin\/deposits\/([\w-]+)\/refund$/);
 if(m==="POST"&&refundMatch){
  const a=await user(req,env,["admin"]);
  if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)return bad("Razorpay credentials are not configured.",503);
  const payment=await env.DB.prepare("SELECT p.id,p.user_id,p.project_id,p.offer_id,p.amount_minor,p.currency,p.provider_payment_id,p.status,pr.public_project_code,pr.title FROM payments p JOIN projects pr ON pr.id=p.project_id WHERE p.id=? AND p.payment_type='editor_security_deposit' AND p.provider='razorpay'").bind(refundMatch[1]).first();
  if(!payment)return bad("Security deposit payment not found.",404);
  if(payment.status!=="succeeded"||!payment.provider_payment_id)return bad("Only a captured and verified security deposit can be refunded.",409);
  const approved=await env.DB.prepare("SELECT s.id FROM assignments x JOIN work_submissions s ON s.assignment_id=x.id WHERE x.offer_id=? AND x.editor_id=? AND x.project_id=? AND s.qc_status='approved' ORDER BY s.submitted_at DESC LIMIT 1").bind(payment.offer_id,payment.user_id,payment.project_id).first();
  if(!approved)return bad("Refund is locked until CSA quality approval is recorded for this project.",409,"quality_approval_required");
  const refundId=uid("rfd"),idempotencyKey=crypto.randomUUID();
  try{
   await env.DB.prepare("INSERT INTO editor_deposit_refunds(id,payment_id,editor_id,project_id,amount_minor,currency,idempotency_key,status,requested_by) VALUES(?,?,?,?,?,?,?,'requesting',?)").bind(refundId,payment.id,payment.user_id,payment.project_id,payment.amount_minor,payment.currency,idempotencyKey,a.id).run();
  }catch(e){return bad("A refund request already exists for this deposit. Check its status before taking any further action.",409,"refund_already_requested");}
  let response;
  try{
   response=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(payment.provider_payment_id)+"/refund",{method:"POST",headers:{Authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET),"Content-Type":"application/json","X-Refund-Idempotency":idempotencyKey},body:JSON.stringify({amount:payment.amount_minor,notes:{csa_project_code:payment.public_project_code,csa_payment_id:payment.id,csa_reason:"Security deposit refund after CSA quality approval"}})});
  }catch(e){
   await env.DB.prepare("UPDATE editor_deposit_refunds SET status='unknown',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(txt(String(e),1000),refundId).run();
   await log(env,a.id,"editor_deposit_refund_unknown","deposit_refund",refundId,{payment_id:payment.id});
   return bad("Razorpay response was interrupted. Refund status is marked unknown; reconcile in Razorpay before any retry.",502,"refund_status_unknown");
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.id){
   await env.DB.prepare("UPDATE editor_deposit_refunds SET status='failed',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(JSON.stringify(payload).slice(0,3000),refundId).run();
   await log(env,a.id,"editor_deposit_refund_failed","deposit_refund",refundId,{payment_id:payment.id,http_status:response.status});
   return bad("Razorpay did not accept the refund. Check Razorpay dashboard before deciding next steps.",502,"refund_provider_rejected");
  }
  const providerMatches=payload.payment_id===payment.provider_payment_id&&Number(payload.amount)===Number(payment.amount_minor)&&String(payload.currency||"").toUpperCase()===String(payment.currency||"").toUpperCase();
  if(!providerMatches){
   await env.DB.prepare("UPDATE editor_deposit_refunds SET provider_refund_id=?,status='unknown',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payload.id,JSON.stringify({reason:"Razorpay refund response did not match the full deposit.",payment_id:payload.payment_id??null,amount:payload.amount??null,currency:payload.currency??null}).slice(0,3000),refundId).run();
   await log(env,a.id,"editor_deposit_refund_unknown","deposit_refund",refundId,{payment_id:payment.id,provider_refund_id:payload.id});
   return bad("Razorpay returned a refund response that did not match the full deposit. Status is unknown; reconcile in Razorpay before any retry.",502,"refund_response_mismatch");
  }
  const refundStatus=["processed","pending"].includes(payload.status)?payload.status:"pending";
  await env.DB.batch([
   env.DB.prepare("UPDATE editor_deposit_refunds SET provider_refund_id=?,status=CASE WHEN status IN ('processed','failed') THEN status ELSE ? END,provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payload.id,refundStatus,JSON.stringify(payload).slice(0,3000),refundId),
   ...(refundStatus==="processed"?[
    env.DB.prepare("UPDATE payments SET status='refunded',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payment.id),
    env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_refunded',?,?,?,?)").bind(uid("dep"),payment.user_id,payment.project_id,payment.offer_id,payment.id,payment.amount_minor,payment.currency,"Full security deposit refunded after CSA quality approval; Razorpay refund "+payload.id,a.id)
   ]:[])
  ]);
  await log(env,a.id,"editor_deposit_refund_initiated","deposit_refund",refundId,{payment_id:payment.id,provider_refund_id:payload.id,status:refundStatus});
  return out({ok:true,refund_id:refundId,provider_refund_id:payload.id,status:refundStatus,amount_minor:payment.amount_minor,currency:payment.currency});
 }
 const fileMatch=p.match(/^\/v1\/files\/([\w-]+)$/);
 if(m==="GET"&&fileMatch){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const a=await user(req,env,["client","editor","admin","staff"]);
  let file=await env.DB.prepare("SELECT f.id,f.project_id,f.uploaded_by,f.r2_object_key,f.original_filename,f.mime_type,f.size_bytes,f.access_scope,p.client_id,'source' AS kind FROM project_files f JOIN projects p ON p.id=f.project_id WHERE f.id=?").bind(fileMatch[1]).first();
  if(!file)file=await env.DB.prepare("SELECT s.id,a.project_id,s.submitted_by AS uploaded_by,s.r2_object_key,s.original_filename,s.mime_type,s.size_bytes,'admin_only' AS access_scope,p.client_id,'submission' AS kind,s.qc_status,a.editor_id FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN projects p ON p.id=a.project_id WHERE s.id=?").bind(fileMatch[1]).first();
  if(!file)return bad("File not found.",404);
  let allowed=a.role==="admin"||a.role==="staff"||a.id===file.client_id||a.id===file.uploaded_by;
  if(a.role==="editor"&&!allowed){const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND editor_id=? AND status IN ('active','submitted','quality_check','revision','approved','completed')").bind(file.project_id,a.id).first();allowed=!!assignment&&file.access_scope==="assigned_editor";}
  if(a.role==="client"&&file.kind==="submission")allowed=allowed&&file.qc_status==="approved";
  if(!allowed)return bad("You do not have permission to access this file.",403);
  const object=await env.MEDIA.get(file.r2_object_key);if(!object)return bad("Stored object is missing.",404);
  return new Response(object.body,{status:200,headers:{"content-type":file.mime_type||"application/octet-stream","content-length":String(file.size_bytes||object.size||0),"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(file.original_filename||"download"),"x-content-type-options":"nosniff","cache-control":"private, no-store"}});
 }
 if(m==="POST"&&p==="/v1/projects"){
  const a=await user(req,env,["client"]),b=await req.json(),title=txt(b.title,180),cat=txt(b.category,80),brief=txt(b.brief,12000),budget=amt(b.budget_amount_minor),cur=txt(b.budget_currency,3).toUpperCase();
  if(!title||!cat||!brief||!budget||!/^[A-Z]{3}$/.test(cur))return bad("Project title, category, brief, budget and ISO currency are required.");
  const pid=uid("prj"),code="CSA-"+new Date().getUTCFullYear()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.DB.prepare("INSERT INTO projects(id,public_project_code,client_id,title,category,brief,raw_footage_minutes,final_duration_minutes,video_count,resolution,aspect_ratio,requirements_json,reference_url,budget_amount_minor,budget_currency,budget_type,preferred_deadline,priority,revisions_included,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted')").bind(pid,code,a.id,title,cat,brief,Number.isInteger(b.raw_footage_minutes)?b.raw_footage_minutes:null,Number.isInteger(b.final_duration_minutes)?b.final_duration_minutes:null,Number.isInteger(b.video_count)?b.video_count:null,txt(b.resolution,20)||null,txt(b.aspect_ratio,20)||null,JSON.stringify(b.requirements||{}),txt(b.reference_url,1000)||null,budget,cur,["fixed","flexible","recommend"].includes(b.budget_type)?b.budget_type:"fixed",txt(b.preferred_deadline,40)||null,["normal","urgent","flexible"].includes(b.priority)?b.priority:"normal",Number.isInteger(b.revisions_included)?Math.max(0,Math.min(10,b.revisions_included)):2).run();
  await log(env,a.id,"project_submitted","project",pid);
  return out({ok:true,project_id:pid,project_code:code,status:"submitted"},201);
 }
 if(m==="GET"&&p==="/v1/editor/agreements"){
  await user(req,env,["editor"]);
  const r=await env.DB.prepare("SELECT id,version,title,body_markdown FROM agreement_versions WHERE agreement_type='project_specific' AND active=1 ORDER BY created_at DESC").all();
  return out({ok:true,agreements:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/editor/offers"){
  const a=await user(req,env,["editor"]),r=await env.DB.prepare("SELECT o.id,o.offer_message,o.proposed_fee_minor,o.fee_currency,o.delivery_days,o.deposit_amount_minor,o.deposit_currency,o.offer_expires_at,o.status,p.public_project_code,p.title,p.category,p.brief,p.preferred_deadline,p.revisions_included FROM project_offers o JOIN projects p ON p.id=o.project_id WHERE o.editor_id=? AND o.status IN ('offered','accepted_pending_terms','terms_accepted_pending_deposit','deposit_pending','ready_for_assignment','assigned') ORDER BY o.created_at DESC").bind(a.id).all();
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
 if(m==="POST"&&p.startsWith("/v1/admin/offers/")&&p.endsWith("/assign")){
  const a=await user(req,env,["admin"]),offerId=p.split("/")[4],o=await env.DB.prepare("SELECT id,project_id,editor_id,delivery_days,status FROM project_offers WHERE id=?").bind(offerId).first();
  if(!o||o.status!=="ready_for_assignment")return bad("Offer is not paid and ready for assignment.",409);
  const due=new Date(Date.now()+o.delivery_days*86400000).toISOString(),assignmentId=uid("asn");
  await env.DB.batch([
   env.DB.prepare("INSERT INTO assignments(id,project_id,offer_id,editor_id,assigned_by,due_at,status) VALUES(?,?,?,?,?,?,'active')").bind(assignmentId,o.project_id,o.id,o.editor_id,a.id,due),
   env.DB.prepare("UPDATE project_offers SET status='assigned' WHERE id=? AND status='ready_for_assignment'").bind(o.id),
   env.DB.prepare("UPDATE projects SET status='assigned',client_visible_status='in_progress',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(o.project_id)
  ]);
  await log(env,a.id,"project_assignment_confirmed","assignment",assignmentId,{project_id:o.project_id,offer_id:o.id});
  return out({ok:true,assignment_id:assignmentId,status:"assigned",due_at:due},201);
 }
 if(m==="POST"&&p.startsWith("/v1/offers/")&&p.endsWith("/deposit/checkout")){
  const offerId=p.split("/")[3],a=await user(req,env,["editor"]);
  if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)return bad("Razorpay API keys are not configured in Cloudflare secrets.",503,"razorpay_not_configured");
  const offer=await env.DB.prepare("SELECT o.id,o.project_id,o.status,o.deposit_amount_minor,o.deposit_currency,p.title FROM project_offers o JOIN projects p ON p.id=o.project_id WHERE o.id=? AND o.editor_id=?").bind(offerId,a.id).first();
  if(!offer||!["terms_accepted_pending_deposit","deposit_pending"].includes(offer.status))return bad("Accept the offer and project agreement before paying the deposit.",409);
  if(!Number.isSafeInteger(offer.deposit_amount_minor)||offer.deposit_amount_minor<=0)return bad("Invalid deposit amount.",409);
  const prior=await env.DB.prepare("SELECT id,provider_order_id,amount_minor,currency,status FROM payments WHERE offer_id=? AND payment_type='editor_security_deposit' AND status IN ('created','pending') ORDER BY created_at DESC LIMIT 1").bind(offer.id).first();
  if(prior?.provider_order_id)return out({ok:true,key_id:env.RAZORPAY_KEY_ID,order_id:prior.provider_order_id,amount:prior.amount_minor,currency:prior.currency,payment_id:prior.id,checkout_name:"CSA Global",description:"Project-specific editor security deposit"});
  const idem="editor-deposit:"+offer.id+":"+uid("try");
  const orderRes=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET),"content-type":"application/json"},body:JSON.stringify({amount:offer.deposit_amount_minor,currency:offer.deposit_currency,receipt:offer.id.slice(0,40),notes:{offer_id:offer.id,project_id:offer.project_id,payment_type:"editor_security_deposit"}})});
  const order=await orderRes.json();
  if(!orderRes.ok||!order.id||order.amount!==offer.deposit_amount_minor||order.currency!==offer.deposit_currency)return bad("Razorpay order creation failed or amount/currency mismatch.",502,"razorpay_order_failed");
  const paymentId=uid("pay");
  await env.DB.prepare("INSERT INTO payments(id,user_id,project_id,offer_id,payment_type,amount_minor,currency,provider,provider_order_id,idempotency_key,status) VALUES(?,?,?,?, 'editor_security_deposit',?,?, 'razorpay',?,?, 'created')").bind(paymentId,a.id,offer.project_id,offer.id,offer.deposit_amount_minor,offer.deposit_currency,order.id,idem).run();
  await env.DB.prepare("UPDATE project_offers SET status='deposit_pending' WHERE id=?").bind(offer.id).run();
  await log(env,a.id,"razorpay_deposit_order_created","payment",paymentId,{offer_id:offer.id});
  return out({ok:true,key_id:env.RAZORPAY_KEY_ID,order_id:order.id,amount:order.amount,currency:order.currency,payment_id:paymentId,checkout_name:"CSA Global",description:"Project-specific editor security deposit"},201);
 }
 if(m==="POST"&&p==="/v1/payments/razorpay/verify"){
  const a=await user(req,env,["editor"]),b=await req.json(),orderId=txt(b.razorpay_order_id,100),paymentId=txt(b.razorpay_payment_id,100),signature=txt(b.razorpay_signature,200);
  if(!orderId||!paymentId||!signature||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID)return bad("Payment verification details or Razorpay keys are missing.",503);
  const record=await env.DB.prepare("SELECT * FROM payments WHERE provider_order_id=? AND user_id=? AND payment_type='editor_security_deposit'").bind(orderId,a.id).first();
  if(!record)return bad("Payment order does not belong to this editor.",404);
  const expected=await hmacHex(env.RAZORPAY_KEY_SECRET,orderId+"|"+paymentId);
  if(!constantTime(expected,signature))return bad("Razorpay payment signature did not match.",400,"signature_invalid");
  const pr=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET)}});
  const payment=await pr.json();
  if(!pr.ok||payment.order_id!==orderId||payment.amount!==record.amount_minor||payment.currency!==record.currency||payment.status!=="captured")return bad("Razorpay has not confirmed a captured payment. Assignment remains locked.",409,"payment_not_captured");
  if(record.status!=="succeeded"){
   await env.DB.batch([
    env.DB.prepare("UPDATE payments SET provider_payment_id=?,status='succeeded',verified_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status!='succeeded'").bind(paymentId,record.id),
    env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_received',?,?,?,?)").bind(uid("dep"),a.id,record.project_id,record.offer_id,record.id,record.amount_minor,record.currency,"Razorpay captured payment",a.id),
    env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_locked',?,?,?,?)").bind(uid("dep"),a.id,record.project_id,record.offer_id,record.id,record.amount_minor,record.currency,"Locked to project pending CSA release/refund decision",a.id),
    env.DB.prepare("UPDATE project_offers SET status='ready_for_assignment' WHERE id=? AND status='deposit_pending'").bind(record.offer_id)
   ]);
   await log(env,a.id,"razorpay_deposit_verified","payment",record.id,{provider_payment_id:paymentId});
  }
  return out({ok:true,status:"captured",next_step:"await_csa_assignment"});
 }
 if(m==="POST"&&p==="/v1/webhooks/razorpay"){
  if(!env.RAZORPAY_WEBHOOK_SECRET)return bad("Razorpay webhook secret is not configured.",503);
  const raw=await req.text(),sig=req.headers.get("x-razorpay-signature")||"",eventId=req.headers.get("x-razorpay-event-id")||"";
  if(!sig||!eventId||!constantTime(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET,raw),sig))return bad("Webhook signature verification failed.",401,"webhook_signature_invalid");
  const body=JSON.parse(raw),event=txt(body.event,100);
  const refundEntity=body.payload?.refund?.entity;
  if(event.startsWith("refund.")&&refundEntity?.payment_id){
   const payment=await env.DB.prepare("SELECT * FROM payments WHERE provider='razorpay' AND provider_payment_id=? AND payment_type='editor_security_deposit'").bind(refundEntity.payment_id).first();
   if(!payment)return out({ok:true,ignored:true});
   const refund=await env.DB.prepare("SELECT id,provider_refund_id,status FROM editor_deposit_refunds WHERE payment_id=?").bind(payment.id).first();
   try{await env.DB.prepare("INSERT INTO payment_webhook_events(id,provider,event_id,event_type,payment_id,payload_json) VALUES(?, 'razorpay',?,?,?,?)").bind(uid("evt"),eventId,event,payment.id,JSON.stringify({event,refund_id:refundEntity.id,payment_id:refundEntity.payment_id,amount:refundEntity.amount??null,currency:refundEntity.currency??null})).run();}
   catch(e){if(String(e.message||"").includes("UNIQUE"))return out({ok:true,duplicate:true});throw e;}
   if(!refund)return out({ok:true,ignored:true,reason:"No CSA refund request exists for this payment."});
   const amountMatches=Number(refundEntity.amount)===Number(payment.amount_minor);
   const currencyMatches=String(refundEntity.currency||"").toUpperCase()===String(payment.currency||"").toUpperCase();
   const refundIdMatches=!refund.provider_refund_id||refund.provider_refund_id===refundEntity.id;
   if(!amountMatches||!currencyMatches||!refundIdMatches){
    const detail={event,refund_id:refundEntity.id,received_amount:refundEntity.amount??null,received_currency:refundEntity.currency??null,expected_amount:payment.amount_minor,expected_currency:payment.currency,refund_id_conflict:!refundIdMatches};
    await env.DB.prepare("UPDATE editor_deposit_refunds SET status='unknown',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE payment_id=?").bind(JSON.stringify(detail).slice(0,3000),payment.id).run();
    await log(env,payment.user_id,"editor_deposit_refund_unknown","deposit_refund",payment.id,detail);
    return out({ok:true,processed:false,refund_status:"unknown",reason:"Refund amount, currency or provider reference did not match the full CSA deposit."});
   }
   const status=event==="refund.processed"?"processed":event==="refund.failed"?"failed":"pending";
   await env.DB.prepare("UPDATE editor_deposit_refunds SET provider_refund_id=COALESCE(provider_refund_id,?),status=?,provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE payment_id=?").bind(refundEntity.id,status,JSON.stringify({event,refund_id:refundEntity.id,amount:refundEntity.amount,currency:refundEntity.currency}).slice(0,3000),payment.id).run();
   if(status==="processed"){
    const existing=await env.DB.prepare("SELECT id FROM deposit_ledger WHERE payment_id=? AND entry_type='deposit_refunded' LIMIT 1").bind(payment.id).first();
    if(!existing)await env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_refunded',?,?,?,?)").bind(uid("dep"),payment.user_id,payment.project_id,payment.offer_id,payment.id,payment.amount_minor,payment.currency,"Full Razorpay refund processed: "+refundEntity.id,payment.user_id).run();
    await env.DB.prepare("UPDATE payments SET status='refunded',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payment.id).run();
   }
   await log(env,payment.user_id,"editor_deposit_refund_"+status,"deposit_refund",payment.id,{provider_refund_id:refundEntity.id,amount_minor:refundEntity.amount,currency:refundEntity.currency});
   return out({ok:true,processed:true,refund_status:status});
  }
  const entity=body.payload?.payment?.entity||body.payload?.order?.entity,orderId=entity?.order_id||entity?.id;
  if(!orderId)return out({ok:true,ignored:true});
  const record=await env.DB.prepare("SELECT * FROM payments WHERE provider_order_id=? AND provider='razorpay'").bind(orderId).first();
  if(!record)return out({ok:true,ignored:true});
  try{await env.DB.prepare("INSERT INTO payment_webhook_events(id,provider,event_id,event_type,payment_id,payload_json) VALUES(?, 'razorpay',?,?,?,?)").bind(uid("evt"),eventId,event,record.id,JSON.stringify({event,order_id:orderId,provider_payment_id:entity.id||null})).run();}
  catch(e){if(String(e.message||"").includes("UNIQUE"))return out({ok:true,duplicate:true});throw e;}
  if(event==="payment.captured"){
   const pid=entity.id||record.provider_payment_id;
   if(!pid||entity.status!=="captured"||entity.amount!==record.amount_minor||entity.currency!==record.currency)return bad("Captured webhook amount or currency mismatch.",409);
   await env.DB.batch([
    env.DB.prepare("UPDATE payments SET provider_payment_id=COALESCE(provider_payment_id,?),status='succeeded',verified_at=COALESCE(verified_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(pid,record.id),
    env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_received',?,?,?,?)").bind(uid("dep"),record.user_id,record.project_id,record.offer_id,record.id,record.amount_minor,record.currency,"Razorpay webhook captured payment",record.user_id),
    env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_locked',?,?,?,?)").bind(uid("dep"),record.user_id,record.project_id,record.offer_id,record.id,record.amount_minor,record.currency,"Locked to project pending CSA release/refund decision",record.user_id),
    env.DB.prepare("UPDATE project_offers SET status='ready_for_assignment' WHERE id=? AND status='deposit_pending'").bind(record.offer_id)
   ]);
  }else if(event==="payment.failed"){
   await env.DB.prepare("UPDATE payments SET status='failed',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status!='succeeded'").bind(record.id).run();
  }
  return out({ok:true,processed:true});
 }
 if(m==="GET"&&p==="/v1/admin/agreements"){
  await user(req,env,["admin"]);
  const r=await env.DB.prepare("SELECT id,agreement_type,version,title,active,created_at FROM agreement_versions ORDER BY created_at DESC LIMIT 100").all();
  return out({ok:true,agreements:r.results||[]});
 }
 if(m==="POST"&&p==="/v1/admin/agreements"){
  const a=await user(req,env,["admin"]),b=await req.json(),type=txt(b.agreement_type,40),version=txt(b.version,40),title=txt(b.title,180),body=txt(b.body_markdown,30000);
  if(!["editor_master","project_specific","client_service"].includes(type)||!version||!title||!body)return bad("Agreement type, version, title and full text are required.");
  const idg=uid("agrv");
  await env.DB.prepare("INSERT INTO agreement_versions(id,agreement_type,version,title,body_markdown,active) VALUES(?,?,?,?,?,0)").bind(idg,type,version,title,body).run();
  await log(env,a.id,"agreement_version_created","agreement",idg,{agreement_type:type,version});
  return out({ok:true,agreement_id:idg,active:false,requires_legal_review:true},201);
 }
 const activateAgreement=p.match(/^\/v1\/admin\/agreements\/([\w-]+)\/activate$/);
 if(m==="POST"&&activateAgreement){
  const a=await user(req,env,["admin"]),ag=await env.DB.prepare("SELECT id,agreement_type FROM agreement_versions WHERE id=?").bind(activateAgreement[1]).first();
  if(!ag)return bad("Agreement version not found.",404);
  await env.DB.batch([
   env.DB.prepare("UPDATE agreement_versions SET active=0 WHERE agreement_type=?").bind(ag.agreement_type),
   env.DB.prepare("UPDATE agreement_versions SET active=1 WHERE id=?").bind(ag.id)
  ]);
  await log(env,a.id,"agreement_version_activated","agreement",ag.id,{agreement_type:ag.agreement_type});
  return out({ok:true,active:true,agreement_id:ag.id});
 }
 if(m==="GET"&&p==="/v1/admin/projects"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT id,public_project_code,title,category,brief,budget_amount_minor,budget_currency,budget_type,preferred_deadline,priority,status,created_at FROM projects WHERE status IN ('submitted','under_review','approved','matching','assigned','in_progress','quality_check','client_review','revision') ORDER BY created_at DESC LIMIT 100").all();
  return out({ok:true,projects:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/editors/verified"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT u.id,e.public_editor_code,e.display_name,e.country,e.specializations_json FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.role='editor' AND u.account_status='active' AND e.verification_status='verified' ORDER BY e.display_name LIMIT 300").all();
  return out({ok:true,editors:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/editors/pending"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT u.id,u.email,e.public_editor_code,e.display_name,e.country,e.city,e.specializations_json,e.software_json,e.portfolio_url,e.verification_status,e.created_at FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE e.verification_status IN ('pending','in_review') ORDER BY e.created_at ASC LIMIT 100").all();
  return out({ok:true,editors:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/offers/ready"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT o.id,o.project_id,o.editor_id,o.proposed_fee_minor,o.fee_currency,o.delivery_days,o.deposit_amount_minor,o.deposit_currency,o.status,p.public_project_code,p.title,e.public_editor_code,e.display_name FROM project_offers o JOIN projects p ON p.id=o.project_id JOIN editor_profiles e ON e.user_id=o.editor_id WHERE o.status='ready_for_assignment' ORDER BY o.created_at ASC LIMIT 100").all();
  return out({ok:true,offers:r.results||[]});
 }
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
async function cleanupExpiredMultipartUploads(env){
 const now=new Date().toISOString();
 const rows=await env.DB.prepare("SELECT id,r2_object_key,r2_upload_id FROM multipart_upload_sessions WHERE status='open' AND expires_at<=? ORDER BY expires_at LIMIT 100").bind(now).all();
 let aborted=0,failed=0;
 for(const session of rows.results||[]){
  try{
   await env.MEDIA.resumeMultipartUpload(session.r2_object_key,session.r2_upload_id).abort();
   const result=await env.DB.prepare("UPDATE multipart_upload_sessions SET status='aborted' WHERE id=? AND status='open'").bind(session.id).run();
   if(result.meta?.changes)aborted++;
  }catch(error){
   failed++;
   console.warn(JSON.stringify({event:"multipart_cleanup_abort_failed",session_id:session.id,error:String(error?.message||error)}));
  }
 }
 console.log(JSON.stringify({event:"multipart_cleanup_completed",checked:(rows.results||[]).length,aborted,failed,at:now}));
 return {checked:(rows.results||[]).length,aborted,failed};
}
export default {async scheduled(controller,env){
 if(!env.MEDIA||!env.DB)throw new Error("Cleanup requires the staging R2 and D1 bindings.");
 const id=crypto.randomUUID(),started=new Date().toISOString();
 await env.DB.prepare("INSERT INTO multipart_cleanup_runs(id,started_at,status) VALUES(?,?,'running')").bind(id,started).run();
 try{
  const result=await cleanupExpiredMultipartUploads(env),finished=new Date().toISOString(),status=result.failed?"partial":"success";
  await env.DB.prepare("UPDATE multipart_cleanup_runs SET finished_at=?,status=?,checked=?,aborted=?,failed=? WHERE id=?").bind(finished,status,result.checked,result.aborted,result.failed,id).run();
 }catch(error){
  const message=String(error?.message||"Cleanup failed").slice(0,500);
  await env.DB.prepare("UPDATE multipart_cleanup_runs SET finished_at=?,status='failed',error_message=? WHERE id=?").bind(new Date().toISOString(),message,id).run();
  throw error;
 }
},async fetch(req,env){
 // File uploads use PUT; include it in CORS so browser preflight succeeds for client and editor uploads.
 const origin=req.headers.get("Origin")||"",allowed=(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean),ch={"vary":"Origin","access-control-allow-methods":"GET,POST,PUT,OPTIONS","access-control-allow-headers":"Authorization,Content-Type,X-File-Name,X-Submission-Notes","access-control-max-age":"86400"};
 if(allowed.includes(origin))ch["access-control-allow-origin"]=origin;
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:ch});
 try{const r=await handle(req,env),h=new Headers(r.headers);Object.entries(ch).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});}
 catch(e){const auth=/token|identity|account is|role is|verified email/i.test(e.message||"");return new Response(JSON.stringify({ok:false,error:{code:auth?"auth_error":"server_error",message:auth?e.message:"Request failed safely."}}),{status:auth?401:500,headers:{...H,...ch}});}
}};
