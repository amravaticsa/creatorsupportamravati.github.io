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
 if(c.iss!==env.AUTH_ISSUER||!(c.aud===env.AUTH_AUDIENCE||(Array.isArray(c.aud)&&c.aud.includes(env.AUTH_AUDIENCE)))||!Number.isFinite(c.exp)||!Number.isFinite(c.iat)||c.exp<=now||c.iat>now+60||c.email_verified!==true||typeof c.sub!=="string"||!c.sub||typeof c.email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))throw Error("Token claims or verified email are invalid.");
 return c;
}
const GLOBAL_ROLE_PERMISSIONS={
 project_admin:["projects.manage"],
 editor_admin:["content.manage"],
 finance_admin:["finance.read","finance.refunds"],
 support_admin:["support.manage"]
};
function adminPermissionFor(req){
 const p=new URL(req.url).pathname.replace(/\/$/,""),m=req.method;
 if(/^\/v1\/files\/[\w-]+$/.test(p))return null;
 if(m==="GET"&&["/v1/admin/submissions/pending","/v1/admin/offers/ready"].includes(p))return "projects.manage";
 if(m==="GET"&&p==="/v1/admin/tenders")return "projects.manage";
 if(m==="GET"&&p==="/v1/admin/pricing-policy")return "__deny__";
 if(m==="GET"&&p==="/v1/admin/tenders/bids")return "projects.manage";
 if(m==="POST"&&/^\/v1\/admin\/quotes\/[\w-]+\/send$/.test(p))return "projects.manage";
 if(m==="POST"&&(/^\/v1\/admin\/projects\/[\w-]+\/tender$/.test(p)||/^\/v1\/admin\/tenders\/[\w-]+\/(publish|close|award|quote)$/.test(p)))return "projects.manage";
 if(m==="POST"&&p==="/v1/admin/pricing-policy")return "__deny__";
 if(m==="GET"&&p==="/v1/client/quotes")return null;
 if(m==="POST"&&/^\/v1\/client\/quotes\/[\w-]+\/(decision|checkout)$/.test(p))return null;
 if(m==="POST"&&p==="/v1/client/payments/razorpay/verify")return null;
 if(m==="GET"&&p==="/v1/editor/tenders")return null;
 if(m==="POST"&&/^\/v1\/editor\/tenders\/[\w-]+\/bids$/.test(p))return null;
 if(m==="GET"&&p==="/v1/admin/projects")return ["projects.manage","content.manage"];
 if(m==="GET"&&p==="/v1/admin/departments")return ["projects.manage","content.manage","finance.read","support.manage"];
 if(m==="POST"&&(/^\/v1\/admin\/submissions\/[\w-]+\/review$/.test(p)||/^\/v1\/admin\/projects\/[\w-]+\/offers$/.test(p)||/^\/v1\/admin\/offers\/[\w-]+\/assign$/.test(p)))return "projects.manage";
 if(m==="GET"&&p==="/v1/admin/deposits/refunds/eligible")return "finance.read";
 if(m==="GET"&&p==="/v1/notifications")return ["projects.manage","content.manage","finance.read","support.manage"];
 if(m==="POST"&&/^\/v1\/notifications\/[\w-]+\/read$/.test(p))return ["projects.manage","content.manage","finance.read","support.manage"];
 if((m==="GET"||m==="PUT")&&p==="/v1/notifications/preferences")return ["projects.manage","content.manage","finance.read","support.manage"];
 if(m==="POST"&&p==="/v1/admin/notifications")return "support.manage";
 if(m==="GET"&&p==="/v1/admin/client-refunds")return "finance.read";
 if(m==="PATCH"&&/^\/v1\/admin\/client-refunds\/[\w-]+$/.test(p))return "finance.refunds";
 if(m==="POST"&&/^\/v1\/admin\/deposits\/[\w-]+\/refund$/.test(p))return "finance.refunds";
 if((m==="GET"&&p==="/v1/admin/agreements")||(m==="POST"&&(p==="/v1/admin/agreements"||/^\/v1\/admin\/agreements\/[\w-]+\/activate$/.test(p))))return "content.manage";
 if(m==="GET"&&p==="/v1/admin/editors/pending")return "content.manage";
 if(m==="GET"&&p==="/v1/admin/editors/verified")return ["projects.manage","content.manage"];
 if((m==="GET"&&(/^\/v1\/admin\/editors\/kyc\/pending$/.test(p)||/^\/v1\/admin\/editors\/[\w-]+\/kyc-preview$/.test(p)))||(m==="POST"&&/^\/v1\/admin\/editors\/[\w-]+\/(verify|credentials|kyc-review)$/.test(p)))return "content.manage";
 if(m==="GET"&&(p==="/v1/admin/editor-portfolio-videos"||/^\/v1\/admin\/editor-portfolio-videos\/[\w-]+\/preview$/.test(p)))return "content.manage";
 if(m==="GET"&&p==="/v1/client/editor-portfolio-videos")return null;
 if(m==="GET"&&/^\/v1\/client\/editor-portfolio-videos\/[\w-]+\/stream$/.test(p))return null;
 if(m==="POST"&&/^\/v1\/admin\/editor-portfolio-videos\/[\w-]+\/review$/.test(p))return "content.manage";
 if(m==="GET"&&p==="/v1/admin/overview")return ["projects.manage","content.manage","finance.read","support.manage"];
 if(m==="GET"&&(/^\/v1\/admin\/multipart-uploads$/.test(p)||/^\/v1\/admin\/multipart-cleanup-runs$/.test(p)||/^\/v1\/admin\/multipart-uploads\/[\w-]+\/(inspect|incidents)$/.test(p)))return "support.manage";
 if(m==="POST"&&/^\/v1\/admin\/multipart-uploads\/[\w-]+\/incidents$/.test(p))return "support.manage";
 return "__deny__";
}
function globalAdminCan(u,permission){
 return !!u&&u.role==="admin"&&(GLOBAL_ROLE_PERMISSIONS[u.source_role]||[]).includes(permission);
}
async function user(req,env,roles){
 const authHeader=req.headers.get("Authorization")||"",bearer=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";let u=null;
 try{const c=await claims(req,env);u=await env.DB.prepare("SELECT id,role,account_status,email FROM users WHERE auth_subject=? AND email=? COLLATE NOCASE").bind(c.sub,c.email).first();if(u?.role==="editor")throw Error("Editor Panel access requires CSA-issued User ID and Password.");}
 catch(identityError){if(!bearer)throw identityError;const th=await hmacHex("csa-editor-session-v1",bearer),x=await env.DB.prepare("SELECT u.id,u.role,u.account_status,u.email,e.verification_status,c.must_change_password FROM editor_sessions s JOIN users u ON u.id=s.user_id JOIN editor_profiles e ON e.user_id=u.id JOIN editor_credentials c ON c.user_id=u.id WHERE s.token_hash=? AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(th).first();if(!x)throw identityError;if(x.role!=="editor"||x.account_status!=="active"||x.verification_status!=="verified")throw Error("Editor account is inactive.");if(x.must_change_password&&new URL(req.url).pathname!=="/v1/editor/password/change")throw Error("Change your temporary password before accessing the Editor Panel.");u=x;}
 if(!u||u.account_status!=="active")throw Error("Account is pending or inactive.");if(!roles.includes(u.role))throw Error("Role is not permitted.");
 if(u.role==="admin"){const a=await env.DB.prepare("SELECT source_role,source_admin_id FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'").bind(u.email).first();if(!a||!GLOBAL_ROLE_PERMISSIONS[a.source_role])throw Error("CSA Super Admin authorization is inactive.");const required=adminPermissionFor(req);if(required==="__deny__")throw Error("No Global permission is defined for this admin route.");if(required!==null){const needs=Array.isArray(required)?required:[required];if(!needs.some(permission=>(GLOBAL_ROLE_PERMISSIONS[a.source_role]||[]).includes(permission)))throw Error("Global admin permission denied.");}return {...u,source_role:a.source_role,source_admin_id:a.source_admin_id};}return u;
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
 if(m==="POST"&&p==="/v1/auth/editor-password")policy={scope:"editor-password-login",limit:8,window:300};
 else if(m==="POST"&&p==="/v1/client/legacy-video-orders/claim")policy={scope:"legacy-order-claim",limit:5,window:300};
 if(m==="POST"&&p==="/v1/auth/google")policy={scope:"google-auth",limit:10,window:60};
 else if(m==="POST"&&p==="/v1/editor/portfolio-videos")policy={scope:"editor-portfolio-upload",limit:6,window:300};
 else if(m==="POST"&&p==="/v1/editor/kyc-document")policy={scope:"editor-kyc-upload",limit:4,window:300};
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
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/i.test(sig))return bad("Invalid sync authentication headers.",401,"sync_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  const bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/admin-authorizations/sync\n"+ts+"\n"+nonce+"\n"+bodyHash;
  const expected=await hmacHex(env.ADMIN_SYNC_HMAC_SECRET,canonical);
  if(!constantTime(expected,sig))return bad("Sync signature is invalid.",401,"sync_signature_invalid");
  let snapshot;
  try{snapshot=JSON.parse(raw);}catch{return bad("Invalid JSON snapshot.");}
  if(!Array.isArray(snapshot)||snapshot.length>100)return bad("Snapshot must be an array of at most 100 admin records.");
  const seenIds=new Set(),seenEmails=new Set(),records=[];
  for(const item of snapshot){
   const sourceId=txt(item?.source_admin_id,100),email=txt(item?.email,254).toLowerCase(),role=txt(item?.source_role,40),status=txt(item?.status,20);
   if(!sourceId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["project_admin","editor_admin","finance_admin","support_admin"].includes(role)||!["active","suspended","revoked"].includes(status))return bad("Snapshot contains an invalid admin record.");
   if(seenIds.has(sourceId)||seenEmails.has(email))return bad("Snapshot contains duplicate admin identities.");
   seenIds.add(sourceId);seenEmails.add(email);records.push({sourceId,email,role,status});
  }
  try{
   await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();
  }catch{return bad("Sync nonce was already used.",409,"sync_replay");}
  const statements=[env.DB.prepare("UPDATE global_admin_authorizations SET status='revoked',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),synced_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")];
  for(const a of records){
   statements.push(env.DB.prepare("INSERT INTO global_admin_authorizations(id,source_admin_id,email,source_role,status) VALUES(?,?,?,?,?) ON CONFLICT(source_admin_id) DO UPDATE SET email=excluded.email,source_role=excluded.source_role,status=excluded.status,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),synced_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(uid("gauth"),a.sourceId,a.email,a.role,a.status));
   statements.push(env.DB.prepare("DELETE FROM global_admin_department_access WHERE source_admin_id=?").bind(a.sourceId));
   const departmentIds=({editor_admin:["dept-content-video","dept-hr-admin"],project_admin:["dept-operations-events"],finance_admin:["dept-finance-accounts"],support_admin:["dept-sales-client"]})[a.role]||[];
   if(a.status==="active")for(const departmentId of departmentIds)statements.push(env.DB.prepare("INSERT INTO global_admin_department_access(id,source_admin_id,department_id,access_level,granted_by) VALUES(?,?,?,'manage','superadmin_role_sync')").bind(uid("deptaccess"),a.sourceId,departmentId));
  }
  statements.push(env.DB.prepare("DELETE FROM admin_sync_nonces WHERE expires_at<?").bind(nowSeconds));
  await env.DB.batch(statements);
  return out({ok:true,synced:records.length,revoked_if_absent:true},200);
 }
 if(m==="POST"&&p==="/internal/superadmin/pricing-policy"){
  // Dedicated Super Admin bridge. Never accepts Global Admin JWT/session roles.
  if(env.ENVIRONMENT!=="staging"||!env.ADMIN_SYNC_HMAC_SECRET)return bad("Super Admin pricing bridge is not configured.",503,"pricing_bridge_unavailable");
  const raw=await req.text();
  if(raw.length>8192)return bad("Pricing request is too large.",413,"pricing_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"";
  const seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return bad("Invalid pricing bridge authentication headers.",401,"pricing_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  const bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/superadmin/pricing-policy\n"+ts+"\n"+nonce+"\n"+bodyHash;
  const expected=await hmacHex(env.ADMIN_SYNC_HMAC_SECRET,canonical);
  if(!constantTime(expected,sig))return bad("Pricing bridge signature is invalid.",401,"pricing_signature_invalid");
  let b;try{b=JSON.parse(raw)}catch{return bad("Invalid pricing request JSON.");}
  try{await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();}
  catch{return bad("Pricing bridge nonce was already used.",409,"pricing_replay");}
  if(b.action==="list"){
   const r=await env.DB.prepare("SELECT currency,margin_bps,minimum_margin_minor,client_advance_bps,status,updated_at FROM csa_pricing_policies ORDER BY currency").all();
   const history=await env.DB.prepare("SELECT id,action,entity_id,metadata_json,created_at FROM audit_logs WHERE entity_type='pricing_policy' ORDER BY created_at DESC LIMIT 50").all();
   return out({ok:true,policies:r.results||[],history:history.results||[]});
  }
  if(b.action==="upsert"){
   const currency=txt(b.currency,3).toUpperCase(),bps=b.margin_bps,min=amt(b.minimum_margin_minor??0),advance=b.client_advance_bps===undefined||b.client_advance_bps===null||b.client_advance_bps===""?null:Number(b.client_advance_bps),actor=txt(b.super_admin_id,100);
   if(!/^[A-Z]{3}$/.test(currency)||!Number.isInteger(bps)||bps<0||bps>10000||min===null||(advance!==null&&(!Number.isInteger(advance)||advance<1||advance>10000))||!actor)return bad("Valid currency, margin, minimum margin, advance percentage and Super Admin identity are required.");
   await env.DB.prepare("INSERT INTO csa_pricing_policies(currency,margin_bps,minimum_margin_minor,client_advance_bps,status,updated_by) VALUES(?,?,?,?,'active',?) ON CONFLICT(currency) DO UPDATE SET margin_bps=excluded.margin_bps,minimum_margin_minor=excluded.minimum_margin_minor,client_advance_bps=excluded.client_advance_bps,status='active',updated_by=excluded.updated_by,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(currency,bps,min,advance,actor).run();
   await log(env,null,"superadmin_pricing_policy_updated","pricing_policy",currency,{super_admin_id:actor,margin_bps:bps,minimum_margin_minor:min,client_advance_bps:advance});
   const r=await env.DB.prepare("SELECT currency,margin_bps,minimum_margin_minor,client_advance_bps,status,updated_at FROM csa_pricing_policies WHERE currency=?").bind(currency).first();
   return out({ok:true,policy:r});
  }
  return bad("Unsupported pricing action.");
 }
 if(m==="GET"&&p==="/health")return out({ok:true,service:"CSA Global API",status:"healthy",google_login:!!env.GOOGLE_CLIENT_ID,razorpay_checkout:!!(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET&&env.RAZORPAY_WEBHOOK_SECRET),mode:env.ENVIRONMENT||"staging"});
 if(m==="GET"&&p==="/v1/config")return out({ok:true,google_client_id:env.GOOGLE_CLIENT_ID||null,razorpay_key_id:env.RAZORPAY_KEY_ID||null,environment:env.ENVIRONMENT||"staging"});
 if(m==="POST"&&p==="/v1/auth/editor-password"){
 const b=await req.json(),username=txt(b.username,80).toUpperCase(),password=typeof b.password==="string"?b.password:"";if(!username||!password||password.length>256)return bad("CSA Editor ID and password are required.");
 const row=await env.DB.prepare("SELECT c.user_id,c.password_salt,c.password_hash,c.failed_attempts,c.locked_until,c.must_change_password,u.email,u.account_status,e.verification_status FROM editor_credentials c JOIN users u ON u.id=c.user_id JOIN editor_profiles e ON e.user_id=u.id WHERE c.username=? COLLATE NOCASE").bind(username).first();if(!row)return bad("Invalid CSA Editor ID or password.",401,"credentials_invalid");if(row.locked_until&&row.locked_until>new Date().toISOString())return bad("Login temporarily locked.",429,"login_locked");
 const km=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:Uint8Array.from(atob(row.password_salt),c=>c.charCodeAt(0)),iterations:310000},km,256),actual=[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
 if(!constantTime(actual,row.password_hash)){const fails=Number(row.failed_attempts||0)+1,lock=fails>=5?new Date(Date.now()+900000).toISOString():null;await env.DB.prepare("UPDATE editor_credentials SET failed_attempts=?,locked_until=? WHERE user_id=?").bind(fails,lock,row.user_id).run();return bad("Invalid CSA Editor ID or password.",401,"credentials_invalid");}
 if(row.account_status!=="active"||row.verification_status!=="verified")return bad("Your profile is not yet activated by CSA.",403,"editor_not_activated");
  const bytes=crypto.getRandomValues(new Uint8Array(32)),token=[...bytes].map(x=>x.toString(16).padStart(2,"0")).join(""),th=await hmacHex("csa-editor-session-v1",token),expires=new Date(Date.now()+43200000).toISOString();
 await env.DB.batch([env.DB.prepare("UPDATE editor_credentials SET failed_attempts=0,locked_until=NULL WHERE user_id=?").bind(row.user_id),env.DB.prepare("INSERT INTO editor_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(th,row.user_id,expires)]);
 return out({ok:true,token,user:{id:row.user_id,role:"editor",status:"active",email:row.email,must_change_password:!!row.must_change_password},expires_at:expires});
 }
 if(m==="POST"&&p==="/v1/editor/password/change"){
 const a=await user(req,env,["editor"]),b=await req.json(),password=typeof b.new_password==="string"?b.new_password:"";if(password.length<12||password.length>128)return bad("New password must contain 12 to 128 characters.");
 const salt=crypto.getRandomValues(new Uint8Array(16)),km=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:310000},km,256),salt64=btoa(String.fromCharCode(...salt)),hash=[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
 await env.DB.prepare("UPDATE editor_credentials SET --- TRUNCATED --- 155,950 chars