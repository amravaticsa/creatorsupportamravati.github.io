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
 finance_admin:[],
 support_admin:["support.manage"],
 regional_admin:[]
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
 if(m==="GET"&&/^\/v1\/admin\/client-refunds\/[\w-]+$/.test(p))return "finance.read";
 if(m==="GET"&&p==="/v1/admin/finance/overview")return "finance.read";
 if(m==="GET"&&p==="/v1/admin/finance/client-balances")return "finance.read";
 if(m==="GET"&&p==="/v1/admin/finance/refund-summary")return "finance.read";
 if(m==="GET"&&p==="/v1/admin/finance/refund-dashboard")return "finance.read";
 if(m==="GET"&&p==="/v1/admin/finance/reconciliation")return "finance.read";
 if(m==="GET"&&p==="/v1/admin/finance/editor-payouts")return "finance.read";
 if(m==="POST"&&p==="/v1/admin/finance/editor-payouts")return "finance.payouts";
 if(m==="POST"&&/^\/v1\/admin\/finance\/editor-payouts\/[\w-]+\/(approve|mark-paid)$/.test(p))return "finance.payouts";
 if(m==="PATCH"&&/^\/v1\/admin\/client-refunds\/[\w-]+$/.test(p))return "finance.refunds";
 if(m==="POST"&&/^\/v1\/admin\/client-refunds\/[\w-]+\/process$/.test(p))return "finance.refunds";
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
 if((m==="GET"||m==="POST")&&/^\/v1\/admin\/countries\/[A-Z]{2}\/legal-evidence$/.test(p))return "projects.manage";
 if(m==="GET"&&/^\/v1\/admin\/countries\/[A-Z]{2}\/legal-evidence\/[\w-]+\/file$/.test(p))return "projects.manage";
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
 if(u.role==="admin"){const a=await env.DB.prepare("SELECT source_role,source_admin_id,finance_access_level FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'").bind(u.email).first();if(!a||!GLOBAL_ROLE_PERMISSIONS[a.source_role])throw Error("CSA Super Admin authorization is inactive.");if(a.source_role==="regional_admin")throw Error("Regional Admin access is restricted to the country-scoped Regional Admin portal.");const required=adminPermissionFor(req);if(required==="__deny__")throw Error("No Global permission is defined for this admin route.");const rolePermissions=[...(GLOBAL_ROLE_PERMISSIONS[a.source_role]||[])];if(a.source_role==="finance_admin"&&["read","write","manage"].includes(a.finance_access_level))rolePermissions.push("finance.read");if(a.source_role==="finance_admin"&&["write","manage"].includes(a.finance_access_level))rolePermissions.push("finance.refunds","finance.payouts");if(required!==null){const needs=Array.isArray(required)?required:[required];if(!needs.some(permission=>rolePermissions.includes(permission)))throw Error("Global admin permission denied.");}return {...u,source_role:a.source_role,source_admin_id:a.source_admin_id,finance_access_level:a.finance_access_level||"none"};}return u;
}
async function hmacHex(secret,message){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));return [...sig].map(x=>x.toString(16).padStart(2,"0")).join("");}
function constantTime(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function log(env,actor,action,type,entity,meta={}){
 await env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)").bind(uid("log"),actor,action,type,entity,JSON.stringify(meta)).run();
}
async function notifyInApp(env,recipient,type,title,body,meta={}){
 if(!recipient)return false;
 try{
  const pref=await env.DB.prepare("SELECT in_app_enabled FROM notification_preferences WHERE user_id=?").bind(recipient).first();
  if(pref&&Number(pref.in_app_enabled)===0)return false;
  const id=uid("ntf");
  await env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status,sent_at) VALUES(?,?,'in_app',?,?,'sent',strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(id,recipient,type,JSON.stringify({title:txt(title,180),body:txt(body,4000),source:"csa_workflow",...meta})).run();
  return true;
 }catch(error){return false;}
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
 if(m==="POST"&&p.startsWith("/internal/regional/")){
  // Signed server-to-server Regional Admin data bridge. The caller validates the live
  // Regional Admin session, active assignment, country legal status and permission level.
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Regional data bridge is not configured.",503,"regional_bridge_unavailable");
  const raw=await req.text();if(raw.length>12000)return bad("Regional request is too large.",413,"regional_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"",seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/i.test(sig))return bad("Invalid regional bridge authentication headers.",401,"regional_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))),bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join(""),canonical="POST\n"+p+"\n"+ts+"\n"+nonce+"\n"+bodyHash,validSignature=await verifyGlobalApiHmac(env,canonical,sig);
  if(!validSignature)return bad("Regional bridge signature is invalid.",401,"regional_signature_invalid");
  try{await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();}catch{return bad("Regional request nonce was already used.",409,"regional_replay");}
  let b;try{b=JSON.parse(raw)}catch{return bad("Invalid regional request JSON.");}
  const cc=txt(b.country_code,2).toUpperCase(),level=txt(b.access_level,10),permission=txt(b.permission_key,60);
  if(!/^[A-Z]{2}$/.test(cc)||!txt(b.regional_admin_id,100)||!txt(b.assignment_id,100)||!["read","write","manage"].includes(level))return bad("Regional scope or permission is invalid.",400,"regional_scope_invalid");
  const expectedPermission={"/internal/regional/dashboard":"overview.read","/internal/regional/projects":"projects.read","/internal/regional/clients":"clients.read","/internal/regional/editors":"editors.read","/internal/regional/tenders":"tenders.read"}[p];
  if(!expectedPermission||permission!==expectedPermission)return bad("Regional permission does not match the requested resource.",403,"permission_denied");
  const country=await env.DB.prepare("SELECT country_code FROM countries WHERE country_code=?").bind(cc).first();
  if(!country)return bad("Country not found.",404,"country_not_found");
  const rank={none:0,read:1,write:2,manage:3},has=(need)=>rank[level]>=rank[need];
  try{
   if(p==="/internal/regional/dashboard"){
    if(!has("read"))return bad("Regional overview permission denied.",403,"permission_denied");
    const [clients,editors,projects]=await Promise.all([
     env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='client' AND country_code=? AND account_status<>'closed'").bind(cc).first(),
     env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='editor' AND country_code=? AND account_status<>'closed'").bind(cc).first(),
     env.DB.prepare("SELECT COUNT(*) AS n FROM v_project_country_scope WHERE country_code=? AND country_scope_status='assigned'").bind(cc).first()
    ]);
    const statuses=await env.DB.prepare("SELECT project_status AS status,COUNT(*) AS count FROM v_project_country_scope WHERE country_code=? AND country_scope_status='assigned' GROUP BY project_status ORDER BY project_status").bind(cc).all();
    return out({ok:true,summary:{clients:clients?.n||0,editors:editors?.n||0,projects:projects?.n||0,project_statuses:statuses.results||[]}},200);
   }
   if(p==="/internal/regional/projects"){
    if(!has("read"))return bad("Regional projects permission denied.",403,"permission_denied");
    const r=await env.DB.prepare("SELECT p.id,p.public_project_code,p.title,p.category,p.status,p.priority,p.created_at,cp.display_name AS client_name FROM projects p JOIN v_project_country_scope s ON s.project_id=p.id LEFT JOIN client_profiles cp ON cp.user_id=p.client_id WHERE s.country_code=? AND s.country_scope_status='assigned' ORDER BY p.created_at DESC LIMIT 100").bind(cc).all();
    return out({ok:true,country_code:cc,items:r.results||[],count:(r.results||[]).length},200);
   }
   if(p==="/internal/regional/clients"){
    if(!has("read"))return bad("Regional clients permission denied.",403,"permission_denied");
    const r=await env.DB.prepare("SELECT u.id,u.email,u.account_status,u.created_at,cp.display_name,cp.company_name FROM users u LEFT JOIN client_profiles cp ON cp.user_id=u.id WHERE u.role='client' AND u.country_code=? AND u.account_status<>'closed' ORDER BY u.created_at DESC LIMIT 100").bind(cc).all();
    return out({ok:true,country_code:cc,items:r.results||[],count:(r.results||[]).length},200);
   }
   if(p==="/internal/regional/editors"){
    if(!has("read"))return bad("Regional editors permission denied.",403,"permission_denied");
    const r=await env.DB.prepare("SELECT u.id,u.email,u.account_status,u.created_at,ep.display_name,ep.verification_status,ep.city,ep.state FROM users u LEFT JOIN editor_profiles ep ON ep.user_id=u.id WHERE u.role='editor' AND u.country_code=? AND u.account_status<>'closed' ORDER BY u.created_at DESC LIMIT 100").bind(cc).all();
    return out({ok:true,country_code:cc,items:r.results||[],count:(r.results||[]).length},200);
   }
   if(p==="/internal/regional/tenders"){
    if(!has("read"))return bad("Regional tender permission denied.",403,"permission_denied");
    const r=await env.DB.prepare("SELECT t.id,t.project_id,t.title,t.scope_summary,t.bid_deadline,t.status,t.created_at FROM project_tenders t JOIN v_project_country_scope s ON s.project_id=t.project_id WHERE s.country_code=? AND s.country_scope_status='assigned' ORDER BY t.created_at DESC LIMIT 100").bind(cc).all();
    return out({ok:true,country_code:cc,items:r.results||[],count:(r.results||[]).length},200);
   }
   if(p==="/internal/regional/finance")return bad("Sensitive finance access requires separate legal and finance approval.",403,"sensitive_permission_locked");
   return bad("Regional endpoint not found.",404,"not_found");
  }catch(e){console.error("Regional data query failed",String(e&&e.message||e));return bad("Regional data is temporarily unavailable.",503,"regional_data_unavailable");}
}

if(m==="POST"&&p==="/internal/admin-authorizations/sync"){
  // Private server-to-server snapshot from the CSA Super Admin Worker only.
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Admin authorization sync is not configured.",503,"sync_unavailable");
  const raw=await req.text();
  if(raw.length>65536)return bad("Authorization snapshot is too large.",413,"sync_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"";
  const seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/i.test(sig))return bad("Invalid sync authentication headers.",401,"sync_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  const bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/admin-authorizations/sync\n"+ts+"\n"+nonce+"\n"+bodyHash;
  const validSignature=await verifyGlobalApiHmac(env,canonical,sig);
  if(!validSignature)return bad("Sync signature is invalid.",401,"sync_signature_invalid");
  let snapshot;
  try{snapshot=JSON.parse(raw);}catch{return bad("Invalid JSON snapshot.");}
  if(!Array.isArray(snapshot)||snapshot.length>100)return bad("Snapshot must be an array of at most 100 admin records.");
  const seenIds=new Set(),seenEmails=new Set(),records=[];
  for(const item of snapshot){
   const sourceId=txt(item?.source_admin_id,100),email=txt(item?.email,254).toLowerCase(),role=txt(item?.source_role,40),status=txt(item?.status,20),financeAccess=txt(item?.finance_access_level,10)||"none";
   if(!sourceId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["project_admin","editor_admin","finance_admin","support_admin","regional_admin"].includes(role)||!["active","suspended","revoked"].includes(status)||!["none","read","write","manage"].includes(financeAccess))return bad("Snapshot contains an invalid admin record.");
   if(seenIds.has(sourceId)||seenEmails.has(email))return bad("Snapshot contains duplicate admin identities.");
   seenIds.add(sourceId);seenEmails.add(email);records.push({sourceId,email,role,status,financeAccess});
  }
  try{
   await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();
  }catch{return bad("Sync nonce was already used.",409,"sync_replay");}
  const statements=[env.DB.prepare("UPDATE global_admin_authorizations SET status='revoked',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),synced_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")];
  for(const a of records){
   statements.push(env.DB.prepare("INSERT INTO global_admin_authorizations(id,source_admin_id,email,source_role,status,finance_access_level) VALUES(?,?,?,?,?,?) ON CONFLICT(source_admin_id) DO UPDATE SET email=excluded.email,source_role=excluded.source_role,status=excluded.status,finance_access_level=excluded.finance_access_level,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),synced_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(uid("gauth"),a.sourceId,a.email,a.role,a.status,a.financeAccess));
   statements.push(env.DB.prepare("DELETE FROM global_admin_department_access WHERE source_admin_id=?").bind(a.sourceId));
   if(a.role!=="regional_admin")statements.push(env.DB.prepare("DELETE FROM regional_admins WHERE source_admin_id=?").bind(a.sourceId));
   else if(a.status!=="active")statements.push(env.DB.prepare("UPDATE regional_admins SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE source_admin_id=? AND status IN ('active','pending')").bind(a.status==="suspended"?"suspended":"revoked",a.sourceId));
   const departmentIds=({editor_admin:["dept-content-video","dept-hr-admin"],project_admin:["dept-operations-events"],finance_admin:["dept-finance-accounts"],support_admin:["dept-sales-client"]})[a.role]||[];
   if(a.status==="active")for(const departmentId of departmentIds){const level=a.role==="finance_admin"?(a.financeAccess==="read"?"read":(["write","manage"].includes(a.financeAccess)?"manage":"none")):"manage";if(level!=="none")statements.push(env.DB.prepare("INSERT INTO global_admin_department_access(id,source_admin_id,department_id,access_level,granted_by) VALUES(?,?,?,?,?)").bind(uid("deptaccess"),a.sourceId,departmentId,level,"superadmin_role_sync"));}
  }
  statements.push(env.DB.prepare("DELETE FROM admin_sync_nonces WHERE expires_at<?").bind(nowSeconds));
  await env.DB.batch(statements);
  return out({ok:true,synced:records.length,revoked_if_absent:true},200);
 }
 if(m==="POST"&&p==="/internal/superadmin/regional-admin-data"){
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Regional Admin bridge unavailable.",503,"regional_bridge_unavailable");
  const raw=await req.text();if(raw.length>15*1024*1024)return bad("Regional Admin request too large.",413,"regional_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"",seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return bad("Invalid regional bridge authentication headers.",401,"regional_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))),bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/superadmin/regional-admin-data\n"+ts+"\n"+nonce+"\n"+bodyHash,validSignature=await verifyGlobalApiHmac(env,canonical,sig);
  if(!validSignature)return bad("Regional bridge signature is invalid.",401,"regional_signature_invalid");
  let b;try{b=JSON.parse(raw)}catch{return bad("Invalid regional bridge JSON.",400,"regional_json_invalid");}
  try{await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();}catch{return bad("Regional bridge nonce was already used.",409,"regional_replay");}
  const actorId=String(b.actor_admin_id||""),actorRole=String(b.actor_role||"");
  if(!actorId)return bad("Regional bridge actor missing.",400,"regional_actor_missing");
  const regionalWriteActions=new Set(["regional_project_status_update","regional_editor_verification_update","regional_tender_status_update","regional_submission_qc_update"]);if(b.action!=="list"&&actorRole!=="super_admin"&&!(actorRole==="regional_admin"&&regionalWriteActions.has(b.action)))return bad("This actor cannot perform the requested regional operation.",403,"regional_write_forbidden");
  const audit=async(action,target,country,details)=>env.DB.prepare("INSERT INTO regional_admin_audit_logs(id,actor_source_admin_id,action,target_source_admin_id,country_code,details_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actorId,action,target||null,country||null,JSON.stringify(details||{}));
  if(b.action==="regional_project_status_update"){
   if(actorRole!=="regional_admin")return bad("Regional Admin role required.",403,"regional_role_required");
   const projectId=String(b.project_id||""),next=String(b.status||""),note=String(b.note||"").trim();
   if(!projectId||projectId.length>128||note.length>1000)return bad("Invalid project status request.",400,"regional_project_update_invalid");
   const assignment=await env.DB.prepare("SELECT country_code FROM regional_admins WHERE source_admin_id=? AND status='active'").bind(actorId).first();
   if(!assignment)return bad("An active country assignment is required.",403,"regional_assignment_required");
   const permission=await env.DB.prepare("SELECT 1 AS ok FROM regional_admin_permissions WHERE source_admin_id=? AND permission_key='projects.manage'").bind(actorId).first();
   if(!permission)return bad("The projects.manage permission is required.",403,"regional_permission_required");
   const project=await env.DB.prepare("SELECT p.id,p.client_id,p.public_project_code,p.status FROM projects p JOIN users cu ON cu.id=p.client_id WHERE p.id=? AND cu.country_code=?").bind(projectId,assignment.country_code).first();
   if(!project)return bad("Project not found in your assigned country.",404,"regional_project_not_found");
   const transitions={submitted:["under_review","cancelled"],under_review:["quotation_pending","cancelled"],quotation_pending:["approved","cancelled"],approved:["matching"],matching:["assigned"],assigned:["in_progress"],in_progress:["quality_check"]};
   if(!(transitions[project.status]||[]).includes(next))return bad("This project status transition is not allowed.",409,"regional_project_transition_invalid");
   if(next==="cancelled"&&note.length<5)return bad("A cancellation reason of at least five characters is required.",400,"regional_project_cancel_note_required");
   if(next==="approved"){const quote=await env.DB.prepare("SELECT id FROM client_quotes WHERE project_id=? AND status='accepted' ORDER BY created_at DESC LIMIT 1").bind(projectId).first();if(!quote)return bad("A client-accepted quote is required before project approval.",409,"regional_project_quote_required");}
   if(next==="assigned"){const row=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND status IN ('active','submitted','quality_check','revision','approved') LIMIT 1").bind(projectId).first();if(!row)return bad("An active editor assignment is required before this project can be marked assigned.",409,"regional_project_assignment_required");}
   if(next==="in_progress"){const row=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND status IN ('active','submitted','revision') LIMIT 1").bind(projectId).first();if(!row)return bad("An active editor assignment is required before work can start.",409,"regional_project_assignment_required");}
   if(next==="quality_check"){const row=await env.DB.prepare("SELECT s.id FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.project_id=? AND s.qc_status='pending' ORDER BY s.submitted_at DESC LIMIT 1").bind(projectId).first();if(!row)return bad("A pending work submission is required before quality check.",409,"regional_project_submission_required");}
   const visible={under_review:"reviewing",quotation_pending:"quotation_pending",approved:"approved",matching:"matching",assigned:"in_progress",in_progress:"in_progress",quality_check:"quality_review",cancelled:"closed"}[next]||next;
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE projects SET status=?,client_visible_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status=?").bind(next,visible,projectId,project.status),
    env.DB.prepare("INSERT INTO project_status_history(id,project_id,old_status,new_status,note,changed_by,source_system) SELECT ?,?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),projectId,project.status,next,note||null,actorId,"regional_admin"),
    env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status) SELECT ?,?,?,?,?,'queued' WHERE changes()=1").bind(crypto.randomUUID(),project.client_id,"in_app","regional_project_status_changed",JSON.stringify({project_code:project.public_project_code,old_status:project.status,new_status:next,note:note||null})),
    env.DB.prepare("INSERT INTO regional_admin_audit_logs(id,actor_source_admin_id,action,target_source_admin_id,country_code,details_json) SELECT ?,?,?,NULL,?,? WHERE changes()=1").bind(crypto.randomUUID(),actorId,"regional_admin.project_status_updated",assignment.country_code,JSON.stringify({project_id:projectId,project_code:project.public_project_code,old_status:project.status,new_status:next,note:note||null}))
   ]);
   if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Project status changed elsewhere. Refresh and retry.",409,"regional_project_update_conflict");
   return out({ok:true,project_id:projectId,project_code:project.public_project_code,old_status:project.status,status:next},200);
  }
  if(b.action==="regional_editor_verification_update"){
   if(actorRole!=="regional_admin")return bad("Regional Admin role required.",403,"regional_role_required");
   const editorId=String(b.editor_id||""),next=String(b.verification_status||""),note=String(b.note||"").trim();
   if(!editorId||editorId.length>128||note.length>1000||!["in_review","verified","rejected"].includes(next))return bad("Invalid editor verification request.",400,"regional_editor_update_invalid");
   const assignment=await env.DB.prepare("SELECT country_code FROM regional_admins WHERE source_admin_id=? AND status='active'").bind(actorId).first();if(!assignment)return bad("An active country assignment is required.",403,"regional_assignment_required");
   const permission=await env.DB.prepare("SELECT 1 AS ok FROM regional_admin_permissions WHERE source_admin_id=? AND permission_key='editors.manage'").bind(actorId).first();if(!permission)return bad("The editors.manage permission is required.",403,"regional_permission_required");
   const editor=await env.DB.prepare("SELECT e.user_id,e.verification_status,e.portfolio_url,e.sample_url,u.account_status FROM editor_profiles e JOIN users u ON u.id=e.user_id WHERE e.user_id=? AND u.role='editor' AND COALESCE(e.country_code,u.country_code)=?").bind(editorId,assignment.country_code).first();
   if(!editor)return bad("Editor not found in your assigned country.",404,"regional_editor_not_found");
   const transitions={pending:["in_review","rejected"],in_review:["verified","rejected"],rejected:["in_review"]};
   if(!(transitions[editor.verification_status]||[]).includes(next))return bad("This editor verification transition is not allowed.",409,"regional_editor_transition_invalid");
   if(next==="verified"&&!editor.portfolio_url&&!editor.sample_url)return bad("A portfolio or sample link is required before verification.",409,"regional_editor_evidence_required");if(next==="verified"){const kyc=await env.DB.prepare("SELECT id FROM editor_kyc_documents WHERE editor_id=? AND status='verified' ORDER BY reviewed_at DESC LIMIT 1").bind(editorId).first();if(!kyc)return bad("Verified KYC is required before editor approval.",409,"regional_editor_kyc_required");}
   if(next==="rejected"&&note.length<5)return bad("A rejection reason of at least five characters is required.",400,"regional_editor_rejection_note_required");
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE editor_profiles SET verification_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND verification_status=?").bind(next,editorId,editor.verification_status),
    env.DB.prepare("INSERT INTO regional_admin_audit_logs(id,actor_source_admin_id,action,target_source_admin_id,country_code,details_json) SELECT ?,?,?,NULL,?,? WHERE changes()=1").bind(crypto.randomUUID(),actorId,"regional_admin.editor_verification_"+next,assignment.country_code,JSON.stringify({editor_id:editorId,old_status:editor.verification_status,new_status:next,note:note||null})),
    env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status) SELECT ?,?,'in_app','regional_editor_verification_changed',?,'queued' WHERE changes()=1").bind(crypto.randomUUID(),editorId,JSON.stringify({verification_status:next,note:note||null})),
    env.DB.prepare("UPDATE users SET account_status=CASE WHEN ?='rejected' THEN 'suspended' WHEN ?='verified' THEN 'pending' ELSE account_status END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND role='editor' AND ? IN ('verified','rejected') AND changes()=1").bind(next,next,editorId,next)
   ]);
   if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Editor status changed elsewhere. Refresh and retry.",409,"regional_editor_update_conflict");if(["verified","rejected"].includes(next)&&Number(results?.[3]?.meta?.changes||0)!==1)return bad("Editor account state could not be synchronized. Contact Super Admin.",500,"regional_editor_account_sync_failed");
   return out({ok:true,editor_id:editorId,verification_status:next},200);
  }
  if(b.action==="regional_tender_status_update"){
   if(actorRole!=="regional_admin")return bad("Regional Admin role required.",403,"regional_role_required");
   const tenderId=String(b.tender_id||""),next=String(b.status||""),note=String(b.note||"").trim();
   if(!tenderId||tenderId.length>128||note.length>1000||!["published","closed","cancelled"].includes(next))return bad("Invalid tender status request.",400,"regional_tender_update_invalid");
   const assignment=await env.DB.prepare("SELECT country_code FROM regional_admins WHERE source_admin_id=? AND status='active'").bind(actorId).first();if(!assignment)return bad("An active country assignment is required.",403,"regional_assignment_required");
   const permission=await env.DB.prepare("SELECT 1 AS ok FROM regional_admin_permissions WHERE source_admin_id=? AND permission_key='tenders.manage'").bind(actorId).first();if(!permission)return bad("The tenders.manage permission is required.",403,"regional_permission_required");
   const tender=await env.DB.prepare("SELECT t.id,t.project_id,t.status,t.bid_deadline,p.client_id,p.public_project_code,p.status AS project_status FROM project_tenders t JOIN projects p ON p.id=t.project_id JOIN users cu ON cu.id=p.client_id WHERE t.id=? AND cu.country_code=?").bind(tenderId,assignment.country_code).first();
   if(!tender)return bad("Tender not found in your assigned country.",404,"regional_tender_not_found");
   const transitions={draft:["published","cancelled"],published:["closed","cancelled"],closed:["cancelled"]};
   if(!(transitions[tender.status]||[]).includes(next))return bad("This tender status transition is not allowed.",409,"regional_tender_transition_invalid");
   if(next==="published"){if(!tender.bid_deadline||new Date(tender.bid_deadline).getTime()<=Date.now())return bad("A future bid deadline is required before publishing.",409,"regional_tender_deadline_required");if(!["approved","matching"].includes(tender.project_status))return bad("The project must be approved before its tender can be published.",409,"regional_tender_project_not_ready");}
   if(next==="closed"&&new Date(tender.bid_deadline).getTime()>Date.now())return bad("The bid deadline has not passed; only Super Admin may close a tender early.",409,"regional_tender_deadline_not_reached");
   if(next==="cancelled"&&note.length<5)return bad("A cancellation reason of at least five characters is required.",400,"regional_tender_cancel_note_required");
   const now=new Date().toISOString();
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE project_tenders SET status=?,published_by=CASE WHEN ?='published' THEN ? ELSE published_by END,published_at=CASE WHEN ?='published' THEN ? ELSE published_at END,closed_at=CASE WHEN ? IN ('closed','cancelled') THEN ? ELSE closed_at END,updated_at=? WHERE id=? AND status=?").bind(next,next,actorId,next,now,next,now,now,tenderId,tender.status),
    env.DB.prepare("INSERT INTO regional_admin_audit_logs(id,actor_source_admin_id,action,target_source_admin_id,country_code,details_json) SELECT ?,?,?,NULL,?,? WHERE changes()=1").bind(crypto.randomUUID(),actorId,"regional_admin.tender_status_"+next,assignment.country_code,JSON.stringify({tender_id:tenderId,project_id:tender.project_id,old_status:tender.status,new_status:next,note:note||null})),
    env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status) SELECT ?,?,'in_app','regional_tender_status_changed',?,'queued' WHERE changes()=1").bind(crypto.randomUUID(),tender.client_id,JSON.stringify({tender_id:tenderId,project_code:tender.public_project_code,status:next,note:note||null}))
   ]);
   if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Tender status changed elsewhere. Refresh and retry.",409,"regional_tender_update_conflict");
   return out({ok:true,tender_id:tenderId,status:next},200);
  }
  if(b.action==="regional_submission_qc_update"){
   if(actorRole!=="regional_admin")return bad("Regional Admin role required.",403,"regional_role_required");
   const submissionId=String(b.submission_id||""),status=String(b.qc_status||""),note=String(b.note||"").trim();
   if(!submissionId||submissionId.length>128||!["approved","changes_requested","rejected"].includes(status)||note.length>2000)return bad("Invalid content review request.",400,"regional_content_review_invalid");
   if(status!=="approved"&&note.length<5)return bad("A review note of at least five characters is required.",400,"regional_content_review_note_required");
   const assignment=await env.DB.prepare("SELECT country_code FROM regional_admins WHERE source_admin_id=? AND status='active'").bind(actorId).first();if(!assignment)return bad("An active country assignment is required.",403,"regional_assignment_required");
   const permission=await env.DB.prepare("SELECT 1 AS ok FROM regional_admin_permissions WHERE source_admin_id=? AND permission_key='content.manage'").bind(actorId).first();if(!permission)return bad("The content.manage permission is required.",403,"regional_permission_required");
   const sub=await env.DB.prepare("SELECT s.id,s.assignment_id,s.version_number,s.submitted_by,a.project_id,a.editor_id,a.status AS assignment_status,p.client_id,p.public_project_code,p.status AS project_status FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN projects p ON p.id=a.project_id JOIN users cu ON cu.id=p.client_id WHERE s.id=? AND s.qc_status='pending' AND s.id=(SELECT s2.id FROM work_submissions s2 WHERE s2.assignment_id=s.assignment_id ORDER BY s2.version_number DESC LIMIT 1) AND cu.country_code=?").bind(submissionId,assignment.country_code).first();
   if(!sub)return bad("Pending latest submission not found in your assigned country.",404,"regional_submission_not_found");
   if(sub.project_status!=="quality_check")return bad("The project is not awaiting quality review.",409,"regional_submission_project_state_invalid");
   if(status==="approved"){const open=await env.DB.prepare("SELECT id FROM client_revision_requests WHERE assignment_id=? AND status IN ('open','in_progress') LIMIT 1").bind(sub.assignment_id).first();if(open)return bad("Resolve the open client revision request before approving this delivery.",409,"regional_open_revision_exists");}
   const assignmentStatus=status==="approved"?"approved":status==="changes_requested"?"revision":"active";
   const projectStatus=status==="approved"?"client_review":status==="changes_requested"?"revision":"in_progress";
   const clientStatus=status==="approved"?"reviewing":status==="changes_requested"?"revision":"in_progress";
   const payload=JSON.stringify({project_id:sub.project_id,project_code:sub.public_project_code,submission_id:submissionId,version:sub.version_number,qc_status:status,note:note||null});
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE work_submissions SET qc_status=? WHERE id=? AND qc_status='pending'").bind(status,submissionId),
    env.DB.prepare("UPDATE assignments SET status=? WHERE id=? AND EXISTS(SELECT 1 FROM work_submissions WHERE id=? AND qc_status=?)").bind(assignmentStatus,sub.assignment_id,submissionId,status),
    env.DB.prepare("UPDATE projects SET status=?,client_visible_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='quality_check' AND EXISTS(SELECT 1 FROM work_submissions WHERE id=? AND qc_status=?)").bind(projectStatus,clientStatus,sub.project_id,submissionId,status),
    env.DB.prepare("INSERT INTO project_status_history(id,project_id,old_status,new_status,note,changed_by,source_system) SELECT ?,?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),sub.project_id,sub.project_status,projectStatus,note||null,actorId,"regional_admin"),
    env.DB.prepare("INSERT INTO regional_admin_audit_logs(id,actor_source_admin_id,action,target_source_admin_id,country_code,details_json) SELECT ?,?,?,NULL,?,? WHERE changes()=1").bind(crypto.randomUUID(),actorId,"regional_admin.submission_qc_"+status,assignment.country_code,payload),
    env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status) SELECT ?,?,'in_app','regional_submission_qc_changed',?,'queued' WHERE changes()=1").bind(crypto.randomUUID(),sub.client_id,payload),
    env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status) SELECT ?,?,'in_app','regional_submission_qc_changed',?,'queued' WHERE changes()=1").bind(crypto.randomUUID(),sub.editor_id,payload)
   ]);
   if(Number(results?.[0]?.meta?.changes||0)!==1||Number(results?.[1]?.meta?.changes||0)!==1||Number(results?.[2]?.meta?.changes||0)!==1)return bad("Submission or project state changed elsewhere. Refresh and retry.",409,"regional_content_review_conflict");
   return out({ok:true,submission_id:submissionId,qc_status:status,project_status:projectStatus},200);
  }
   if(b.action==="legal_evidence_download"){
    if(actorRole!=="super_admin")return bad("Only Super Admin may download country legal evidence.",403,"legal_evidence_forbidden");
    const cc=String(b.country_code||"").toUpperCase(),id=String(b.evidence_id||"");if(!/^[A-Z]{2}$/.test(cc)||!/^[0-9a-f-]{36}$/i.test(id))return bad("Invalid evidence reference.",400,"legal_evidence_reference_invalid");
    const row=await env.DB.prepare("SELECT r2_object_key,mime_type,original_filename,size_bytes,sha256 FROM country_legal_evidence WHERE id=? AND country_code=? AND deleted_at IS NULL").bind(id,cc).first();if(!row)return bad("Legal evidence not found.",404,"legal_evidence_not_found");
    const object=await env.MEDIA.get(row.r2_object_key);if(!object)return bad("Legal evidence file is missing from private storage.",410,"legal_evidence_storage_missing");
    const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.byteLength!==row.size_bytes)return bad("Evidence file integrity check failed.",409,"legal_evidence_integrity_failed");
    const digest=await crypto.subtle.digest("SHA-256",bytes),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");if(sha!==row.sha256)return bad("Evidence file integrity check failed.",409,"legal_evidence_integrity_failed");
    let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    const downloadAudit=await audit("country.legal_evidence_downloaded",id,cc,{sha256:sha,size_bytes:row.size_bytes});await downloadAudit.run();
    return out({ok:true,evidence:{mime_type:row.mime_type,filename:row.original_filename,size_bytes:row.size_bytes,sha256:sha,file_base64:btoa(binary)}});
   }
   if(b.action==="legal_evidence_list"){
    if(actorRole!=="super_admin")return bad("Only Super Admin may read country legal evidence.",403,"legal_evidence_forbidden");
    const cc=String(b.country_code||"").toUpperCase();if(!/^[A-Z]{2}$/.test(cc))return bad("Invalid country code.",400,"country_code_invalid");
    const rows=await env.DB.prepare("SELECT id,country_code,evidence_category AS category,title,original_filename AS filename,mime_type,size_bytes,sha256,created_at FROM country_legal_evidence WHERE country_code=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100").bind(cc).all();
    return out({ok:true,country_code:cc,evidence:rows.results||[]});
   }
   if(b.action==="legal_evidence_upload"){
    if(actorRole!=="super_admin")return bad("Only Super Admin may upload country legal evidence.",403,"legal_evidence_forbidden");
    if(!env.MEDIA)return bad("Private evidence storage is not configured.",503);
    const cc=String(b.country_code||"").toUpperCase(),category=String(b.category||""),title=txt(b.title,160),filename=txt(b.filename,180)||"evidence.bin",mime=String(b.mime_type||"").toLowerCase(),encoded=String(b.file_base64||"");
    if(!/^[A-Z]{2}$/.test(cc)||!["corporate_registration","tax_registration","privacy_data_protection","consumer_protection","payments_regulatory","licensing","other"].includes(category)||!title)return bad("Evidence metadata is invalid.",400,"legal_evidence_metadata_invalid");
    const country=await env.DB.prepare("SELECT country_code FROM countries WHERE country_code=?").bind(cc).first();if(!country)return bad("Country not found.",404,"country_not_found");
    if(!["application/pdf","image/jpeg","image/png"].includes(mime)||encoded.length<4||encoded.length>Math.ceil(10*1024*1024*4/3)+8)return bad("Evidence must be a PDF, JPG or PNG up to 10 MB.",415,"legal_evidence_type_or_size_invalid");
    let binary;try{binary=atob(encoded);}catch{return bad("Invalid base64 evidence data.",400,"legal_evidence_encoding_invalid");}
    if(binary.length<1||binary.length>10*1024*1024)return bad("Evidence file must be between 1 byte and 10 MB.",413,"legal_evidence_size_invalid");
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),head=bytes.slice(0,12),valid=mime==="application/pdf"?String.fromCharCode(...head.slice(0,5))==="%PDF-":mime==="image/jpeg"?head[0]===255&&head[1]===216&&head[2]===255:head.length>=8&&head[0]===137&&String.fromCharCode(...head.slice(1,4))==="PNG";if(!valid)return bad("File signature does not match its declared MIME type.",415,"legal_evidence_signature_invalid");
    const id=crypto.randomUUID(),ext=mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg",safeName=filename.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,120)||("evidence."+ext),key="country-legal-evidence/"+cc+"/"+id+"."+ext,digest=await crypto.subtle.digest("SHA-256",bytes),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
    await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:"private, no-store",contentDisposition:"attachment"}});
    try{await env.DB.batch([env.DB.prepare("INSERT INTO country_legal_evidence(id,country_code,uploaded_by_source_admin_id,evidence_category,title,original_filename,mime_type,size_bytes,r2_object_key,sha256) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,cc,actorId,category,title,safeName,mime,bytes.byteLength,key,sha),await audit("country.legal_evidence_uploaded",null,cc,{evidence_id:id,category,mime_type:mime,size_bytes:bytes.byteLength,sha256:sha})]);}catch(e){await env.MEDIA.delete(key);throw e;}
    return out({ok:true,evidence:{id,country_code:cc,category,title,filename:safeName,mime_type:mime,size_bytes:bytes.byteLength,sha256:sha,created_at:new Date().toISOString()}},201);
   }
  if(b.action==="country_update"){
   const cc=String(b.country_code||"").toUpperCase(),status=b.commercial_status;
   if(!/^[A-Z]{2}$/.test(cc)||!["planned","review","active","restricted","disabled"].includes(status))return bad("Invalid country update.",400,"country_update_invalid");
   const country=await env.DB.prepare("SELECT country_code FROM countries WHERE country_code=?").bind(cc).first();if(!country)return bad("Country not found.",404,"country_not_found");
   const legal=await env.DB.prepare("SELECT review_status FROM country_legal_reviews WHERE country_code=? ORDER BY created_at DESC LIMIT 1").bind(cc).first();
   const payment=b.payment_enabled===true||b.payment_enabled===1?1:0,payout=b.payout_enabled===true||b.payout_enabled===1?1:0;
   if(status==="active"&&legal?.review_status!=="approved")return bad("Country cannot be activated before legal approval.",409,"country_legal_approval_required");
   if((payment||payout)&&(status!=="active"||legal?.review_status!=="approved"))return bad("Payments and payouts require an active, legally approved country.",409,"country_payment_approval_required");
   const currency=b.currency_code===undefined?null:b.currency_code,timezone=b.timezone===undefined?null:b.timezone;
   if(currency!==null&&currency!==undefined&&(typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency)))return bad("Invalid currency code.",400,"country_currency_invalid");
   if(timezone!==null&&timezone!==undefined&&(typeof timezone!=="string"||!timezone.trim()||timezone.length>80))return bad("Invalid timezone.",400,"country_timezone_invalid");if(timezone!==null&&timezone!==undefined){try{new Intl.DateTimeFormat("en-US",{timeZone:timezone}).format();}catch{return bad("Timezone must be a valid IANA timezone identifier.",400,"country_timezone_invalid");}}
   const r=await env.DB.prepare("UPDATE countries SET commercial_status=?,payment_enabled=?,payout_enabled=?,currency_code=COALESCE(?,currency_code),timezone=COALESCE(?,timezone),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE country_code=?").bind(status,payment,payout,currency,timezone,cc).run();
   await audit("country.settings_updated",null,cc,{commercial_status:status,payment_enabled:payment,payout_enabled:payout,currency_code:currency,timezone});
   return out({ok:true,updated:!!(r.meta?.changes||0),country_code:cc},200);
  }
  if(b.action==="legal_review_list"){if(actorRole!=="super_admin")return bad("Only Super Admin may read legal review history.",403,"legal_review_forbidden");const cc=String(b.country_code||"").toUpperCase();if(!/^[A-Z]{2}$/.test(cc))return bad("Invalid country code.",400,"country_code_invalid");const r=await env.DB.prepare("SELECT id,country_code,review_status,reviewer_source_admin_id,evidence_reference,legal_notes,reviewed_at,created_at,updated_at FROM country_legal_reviews WHERE country_code=? ORDER BY created_at DESC LIMIT 100").bind(cc).all();return out({ok:true,country_code:cc,reviews:r.results||[]},200);}
  if(b.action==="legal_review_create"){
   const cc=String(b.country_code||"").toUpperCase(),status=String(b.review_status||""),evidence=String(b.evidence_reference||"").trim(),notes=String(b.legal_notes||"").trim();
   if(!/^[A-Z]{2}$/.test(cc)||!["pending","approved","rejected"].includes(status)||evidence.length>1000||notes.length>5000||(status==="approved"&&!evidence))return bad("Invalid legal review or missing approval evidence.",400,"legal_review_invalid");
    if(status==="approved"){const ev=await env.DB.prepare("SELECT id FROM country_legal_evidence WHERE id=? AND country_code=? AND deleted_at IS NULL").bind(evidence,cc).first();if(!ev)return bad("Approval requires an uploaded legal evidence record for this country; free-text references are not accepted.",409,"legal_evidence_required");}
   const exists=await env.DB.prepare("SELECT country_code FROM countries WHERE country_code=?").bind(cc).first();if(!exists)return bad("Country not found.",404,"country_not_found");
   const id=crypto.randomUUID(),reviewedAt=status==="pending"?null:new Date().toISOString();
   await env.DB.batch([env.DB.prepare("INSERT INTO country_legal_reviews(id,country_code,review_status,reviewer_source_admin_id,evidence_reference,legal_notes,reviewed_at) VALUES(?,?,?,?,?,?,?)").bind(id,cc,status,actorId,evidence||null,notes||null,reviewedAt),audit("country.legal_review."+status,null,cc,{review_id:id,evidence_reference:evidence||null})]);
   return out({ok:true,review:{id,country_code:cc,review_status:status,reviewed_at:reviewedAt}},201);
  }
  if(b.action==="regional_assignment_set"){
   const sid=String(b.source_admin_id||""),cc=String(b.country_code||"").toUpperCase(),status=String(b.status||"pending"),primary=b.is_primary===false||b.is_primary===0?0:1;
   if(!sid||sid.length>128||!/^[A-Z]{2}$/.test(cc)||!["pending","active","suspended","revoked"].includes(status))return bad("Invalid Regional Admin assignment.",400,"regional_assignment_invalid");
   const admin=await env.DB.prepare("SELECT source_admin_id,status,source_role FROM global_admin_authorizations WHERE source_admin_id=?").bind(sid).first();
   if(!admin||admin.source_role!=="regional_admin"||admin.status!=="active")return bad("An active authorized Regional Admin account is required.",409,"regional_admin_identity_required");
   const country=await env.DB.prepare("SELECT commercial_status FROM countries WHERE country_code=?").bind(cc).first();if(!country)return bad("Country not found.",404,"country_not_found");
   const legal=await env.DB.prepare("SELECT review_status FROM country_legal_reviews WHERE country_code=? ORDER BY created_at DESC LIMIT 1").bind(cc).first();
   if(status==="active"&&(admin.status!=="active"||country.commercial_status!=="active"||legal?.review_status!=="approved"))return bad("Active assignment requires an active identity and an active, legally approved country.",409,"regional_assignment_readiness_required");
   if(primary&&status==="active"){const other=await env.DB.prepare("SELECT source_admin_id FROM regional_admins WHERE country_code=? AND is_primary=1 AND status='active' AND source_admin_id<>?").bind(cc,sid).first();if(other)return bad("A primary active Regional Admin already exists for this country.",409,"primary_regional_admin_exists");}
   await env.DB.batch([env.DB.prepare("INSERT INTO regional_admins(source_admin_id,country_code,is_primary,status,assigned_by) VALUES(?,?,?,?,?) ON CONFLICT(source_admin_id) DO UPDATE SET country_code=excluded.country_code,is_primary=excluded.is_primary,status=excluded.status,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(sid,cc,primary,status,actorId),audit("regional_admin.assignment_"+status,sid,cc,{is_primary:primary})]);
   return out({ok:true,source_admin_id:sid,country_code:cc,status,is_primary:primary},200);
  }
  if(b.action==="regional_permissions_replace"){
   const sid=String(b.source_admin_id||""),keys=b.permission_keys;
   const allowed=["projects.manage","content.manage","finance.read","finance.refunds","support.manage","clients.read","editors.manage","tenders.manage"];
   if(!sid||!Array.isArray(keys)||keys.length>allowed.length||keys.some(k=>!allowed.includes(k))||new Set(keys).size!==keys.length)return bad("Invalid Regional Admin permission set.",400,"regional_permissions_invalid");
   const assignment=await env.DB.prepare("SELECT r.country_code,r.status,a.status AS account_status FROM regional_admins r JOIN global_admin_authorizations a ON a.source_admin_id=r.source_admin_id WHERE r.source_admin_id=?").bind(sid).first();if(!assignment||assignment.status!=="active"||assignment.account_status!=="active")return bad("An active Regional Admin account and assignment are required.",409,"regional_assignment_required");
   const statements=[env.DB.prepare("DELETE FROM regional_admin_permissions WHERE source_admin_id=?").bind(sid),...keys.map(k=>env.DB.prepare("INSERT INTO regional_admin_permissions(source_admin_id,permission_key,granted_by) VALUES(?,?,?)").bind(sid,k,actorId)),audit("regional_admin.permissions_replaced",sid,assignment.country_code,{permission_keys:keys})];
   await env.DB.batch(statements);return out({ok:true,source_admin_id:sid,permission_keys:keys},200);
  }
  if(b.action==="regional_audit_list"){if(actorRole!=="super_admin")return bad("Only Super Admin may read Regional Admin audit logs.",403,"regional_audit_forbidden");const r=await env.DB.prepare("SELECT id,actor_source_admin_id,action,target_source_admin_id,country_code,details_json,created_at FROM regional_admin_audit_logs ORDER BY created_at DESC LIMIT 200").all();return out({ok:true,logs:r.results||[]},200);}
  if(b.action==="regional_identity_list"){
   if(actorRole!=="super_admin")return bad("Only Super Admin may list Regional Admin identities.",403,"regional_write_forbidden");
   const r=await env.DB.prepare("SELECT a.source_admin_id,a.email,a.status,(SELECT r.country_code FROM regional_admins r WHERE r.source_admin_id=a.source_admin_id) AS assigned_country,(SELECT r.status FROM regional_admins r WHERE r.source_admin_id=a.source_admin_id) AS assignment_status,COALESCE((SELECT GROUP_CONCAT(p.permission_key, ',') FROM regional_admin_permissions p WHERE p.source_admin_id=a.source_admin_id),'') AS permission_keys FROM global_admin_authorizations a WHERE a.source_role='regional_admin' AND a.status IN ('active','suspended') ORDER BY a.email").all();
   return out({ok:true,identities:r.results||[]},200);
  }
  if(b.action!=="list")return bad("Unsupported regional bridge action.",400,"regional_action_invalid");
  try{
   const countrySql="SELECT c.country_code,c.country_name,c.currency_code,c.timezone,c.commercial_status,c.payment_enabled,c.payout_enabled,(SELECT r.review_status FROM country_legal_reviews r WHERE r.country_code=c.country_code ORDER BY r.created_at DESC LIMIT 1) AS legal_review_status,(SELECT r.evidence_reference FROM country_legal_reviews r WHERE r.country_code=c.country_code ORDER BY r.created_at DESC LIMIT 1) AS legal_evidence_reference,(SELECT r.reviewed_at FROM country_legal_reviews r WHERE r.country_code=c.country_code ORDER BY r.created_at DESC LIMIT 1) AS legal_reviewed_at FROM countries c "+(actorRole==="regional_admin"?"WHERE c.country_code=(SELECT country_code FROM regional_admins WHERE source_admin_id=? AND status='active') ":"")+"ORDER BY c.country_name"; const countries=actorRole==="regional_admin"?await env.DB.prepare(countrySql).bind(actorId).all():await env.DB.prepare(countrySql).all();
   const assignmentSql="SELECT r.source_admin_id,r.source_admin_id AS user_id,a.email,a.email AS display_name,a.source_role,a.status AS account_status,r.country_code,c.country_name,CASE WHEN r.is_primary=1 THEN 'primary' ELSE 'secondary' END AS assignment_type,r.status AS assignment_status,r.assigned_at,r.updated_at,COALESCE((SELECT GROUP_CONCAT(permission_key, ', ') FROM regional_admin_permissions p WHERE p.source_admin_id=r.source_admin_id),'') AS enabled_permissions FROM regional_admins r JOIN global_admin_authorizations a ON a.source_admin_id=r.source_admin_id JOIN countries c ON c.country_code=r.country_code "+(actorRole==="regional_admin"?"WHERE r.source_admin_id=? ":"")+"ORDER BY c.country_name,a.email"; const assignments=actorRole==="regional_admin"?await env.DB.prepare(assignmentSql).bind(actorId).all():await env.DB.prepare(assignmentSql).all();
   const invitations=[];
   const permissionSql="SELECT permission_key,module_key,description,default_access_level,is_sensitive FROM regional_admin_permission_catalog "+(actorRole==="regional_admin"?"WHERE permission_key IN (SELECT permission_key FROM regional_admin_permissions WHERE source_admin_id=?) ":"")+"ORDER BY module_key,permission_key"; const permissions=actorRole==="regional_admin"?await env.DB.prepare(permissionSql).bind(actorId).all():await env.DB.prepare(permissionSql).all();
   const eligible=actorRole==="regional_admin"?{n:0}:await env.DB.prepare("SELECT COUNT(*) AS n FROM countries c WHERE c.commercial_status='active' AND (SELECT r.review_status FROM country_legal_reviews r WHERE r.country_code=c.country_code ORDER BY r.created_at DESC LIMIT 1)='approved'").first();
   const pending=actorRole==="regional_admin"?{n:0}:await env.DB.prepare("SELECT COUNT(*) AS n FROM regional_admins WHERE status='pending'").first();
   const regional={country_scope:null,clients:[],projects:[],editors:[],tenders:[],submissions:[],support_messages:[],finance_summary:[],refunds:[]};
   if(actorRole==="regional_admin"){
    const country=(countries.results||[])[0],cc=country?.country_code||null,granted=new Set((permissions.results||[]).map(x=>x.permission_key));
    regional.country_scope=cc;
    if(cc){
     if(granted.has("clients.read")){const r=await env.DB.prepare("SELECT u.id AS user_id,u.email,u.account_status,u.created_at,cp.display_name,cp.company_name FROM users u LEFT JOIN client_profiles cp ON cp.user_id=u.id WHERE u.role='client' AND u.country_code=? ORDER BY u.created_at DESC LIMIT 50").bind(cc).all();regional.clients=r.results||[];}
     if(granted.has("projects.manage")){const r=await env.DB.prepare("SELECT p.id,p.public_project_code,p.title,p.status,p.client_visible_status,p.preferred_deadline,p.created_at,cp.display_name AS client_name,cp.company_name FROM projects p JOIN users cu ON cu.id=p.client_id LEFT JOIN client_profiles cp ON cp.user_id=cu.id WHERE cu.country_code=? ORDER BY p.created_at DESC LIMIT 50").bind(cc).all();regional.projects=r.results||[];}
     if(granted.has("editors.manage")){const r=await env.DB.prepare("SELECT u.id AS user_id,u.email,u.account_status,e.public_editor_code,e.display_name,e.city,e.verification_status,e.reliability_score,e.created_at FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.role='editor' AND COALESCE(e.country_code,u.country_code)=? ORDER BY e.created_at DESC LIMIT 50").bind(cc).all();regional.editors=r.results||[];}
     if(granted.has("tenders.manage")){const r=await env.DB.prepare("SELECT t.id,t.title,t.status,t.bid_deadline,t.published_at,p.public_project_code,p.title AS project_title,p.status AS project_status FROM project_tenders t JOIN projects p ON p.id=t.project_id JOIN users cu ON cu.id=p.client_id WHERE cu.country_code=? ORDER BY t.created_at DESC LIMIT 50").bind(cc).all();regional.tenders=r.results||[];}
     if(granted.has("content.manage")){const r=await env.DB.prepare("SELECT ws.id,ws.assignment_id,ws.version_number,ws.qc_status,ws.submitted_at,p.public_project_code,p.title AS project_title,e.display_name AS editor_name FROM work_submissions ws JOIN assignments a ON a.id=ws.assignment_id JOIN projects p ON p.id=a.project_id JOIN users cu ON cu.id=p.client_id LEFT JOIN editor_profiles e ON e.user_id=ws.submitted_by WHERE cu.country_code=? ORDER BY ws.submitted_at DESC LIMIT 50").bind(cc).all();regional.submissions=r.results||[];}
     if(granted.has("support.manage")){const r=await env.DB.prepare("SELECT m.id,m.project_id,p.public_project_code,p.title AS project_title,u.email AS sender_email,COALESCE(cp.display_name,ep.display_name) AS sender_name,m.recipient_role,m.body,m.created_at FROM messages m JOIN projects p ON p.id=m.project_id JOIN users cu ON cu.id=p.client_id LEFT JOIN users u ON u.id=m.sender_id LEFT JOIN client_profiles cp ON cp.user_id=u.id LEFT JOIN editor_profiles ep ON ep.user_id=u.id WHERE cu.country_code=? ORDER BY m.created_at DESC LIMIT 50").bind(cc).all();regional.support_messages=r.results||[];}
     if(granted.has("finance.read")){const r=await env.DB.prepare("SELECT p.payment_type,p.currency,p.status,COUNT(*) AS payment_count,COALESCE(SUM(p.amount_minor),0) AS total_minor FROM payments p WHERE p.project_id IN (SELECT pr.id FROM projects pr JOIN users cu ON cu.id=pr.client_id WHERE cu.country_code=?) OR p.user_id IN (SELECT eu.id FROM users eu LEFT JOIN editor_profiles ep ON ep.user_id=eu.id WHERE eu.role='editor' AND COALESCE(ep.country_code,eu.country_code)=?) GROUP BY p.payment_type,p.currency,p.status ORDER BY p.currency,p.payment_type,p.status").bind(cc,cc).all();regional.finance_summary=r.results||[];}
     if(granted.has("finance.refunds")){const r=await env.DB.prepare("SELECT rr.id,rr.project_id,rr.amount_minor,rr.currency,rr.status,rr.reason,rr.created_at,cp.display_name AS client_name FROM client_refund_requests rr JOIN users cu ON cu.id=rr.client_id LEFT JOIN client_profiles cp ON cp.user_id=cu.id WHERE cu.country_code=? ORDER BY rr.created_at DESC LIMIT 50").bind(cc).all();regional.refunds=r.results||[];}
    }
   }
   const regional_summary={clients:regional.clients.length,projects:regional.projects.length,editors:regional.editors.length,tenders:regional.tenders.length,submissions:regional.submissions.length,support_messages:regional.support_messages.length,refunds:regional.refunds.length};
   return out({ok:true,countries:countries.results||[],assignments:assignments.results||[],invitations,pending_assignments:pending?.n||0,pending_invitations:0,eligible_countries:eligible?.n||0,permissions:permissions.results||[],regional,regional_summary},200);
  }catch(e){console.error("Regional bridge read failed",String(e&&e.message||e));return bad("Regional data unavailable.",503,"regional_data_unavailable");}
 }
 if(m==="POST"&&p==="/internal/superadmin/pricing-policy"){
  // Dedicated Super Admin bridge. Never accepts Global Admin JWT/session roles.
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Super Admin pricing bridge is not configured.",503,"pricing_bridge_unavailable");
  const raw=await req.text();
  if(raw.length>8192)return bad("Pricing request is too large.",413,"pricing_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"";
  const seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return bad("Invalid pricing bridge authentication headers.",401,"pricing_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  const bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/superadmin/pricing-policy\n"+ts+"\n"+nonce+"\n"+bodyHash;
  const validSignature=await verifyGlobalApiHmac(env,canonical,sig);
  if(!validSignature)return bad("Pricing bridge signature is invalid.",401,"pricing_signature_invalid");
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
 if(m==="POST"&&p==="/internal/superadmin/finance-data"){
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Super Admin finance bridge is not configured.",503,"finance_bridge_unavailable");
  const raw=await req.text();if(raw.length>8192)return bad("Finance request is too large.",413,"finance_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"",seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return bad("Invalid finance bridge authentication headers.",401,"finance_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))),bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join(""),canonical="POST\n/internal/superadmin/finance-data\n"+ts+"\n"+nonce+"\n"+bodyHash;
  if(!await verifyGlobalApiHmac(env,canonical,sig))return bad("Finance bridge signature is invalid.",401,"finance_signature_invalid");
  let actor;try{actor=JSON.parse(raw)}catch{return bad("Invalid finance request JSON.",400,"finance_json_invalid")}
  const actorId=txt(actor?.actor_admin_id,100),actorEmail=txt(actor?.actor_email,254).toLowerCase(),actorRole=txt(actor?.actor_role,40),action=txt(actor?.action,40);
  if(!actorId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail)||!["super_admin","finance_admin"].includes(actorRole))return bad("Finance actor is not permitted.",403,"finance_actor_denied");
  let financeLevel=actorRole==="super_admin"?"manage":"none";if(actorRole==="finance_admin"){const auth=await env.DB.prepare("SELECT finance_access_level FROM global_admin_authorizations WHERE source_admin_id=? AND email=? COLLATE NOCASE AND source_role='finance_admin' AND status='active' LIMIT 1").bind(actorId,actorEmail).first();if(!auth||!["read","write","manage"].includes(auth.finance_access_level))return bad("Finance read access is not active for this account.",403,"finance_access_denied");financeLevel=auth.finance_access_level;}
  try{await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run()}catch{return bad("Finance bridge nonce was already used.",409,"finance_replay")}
  const logFinance=async(name,details)=>env.DB.prepare("INSERT INTO finance_bridge_audit_logs(id,actor_source_admin_id,actor_email,actor_role,action,details_json) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actorId,actorEmail,actorRole,name,JSON.stringify(details||{})).run();
  if(action==="approve_payout"||action==="mark_payout_paid"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required for payout actions.",403,"finance_write_access_denied");
   const payoutId=txt(actor.payout_id,128),note=txt(actor.note,500),reference=String(actor.payment_reference||"").trim();
   if(!payoutId)return bad("Payout ID is required.",400,"payout_id_required");
   if(action==="mark_payout_paid"&&(reference.length<3||reference.length>120))return bad("Enter the actual bank/UPI transfer reference (3–120 characters).",400,"payment_reference_required");
   const current=await env.DB.prepare("SELECT id,offer_id,project_id,editor_id,amount_minor,currency,status,payment_reference FROM editor_payouts WHERE id=?").bind(payoutId).first();
   if(!current)return bad("Payout record not found.",404,"payout_not_found");
   if(action==="approve_payout"){
    if(current.status==="approved"||current.status==="paid")return out({ok:true,payout:current,idempotent:true,transfer_initiated:false});
    if(current.status!=="pending_approval")return bad("Only pending payouts can be approved.",409,"invalid_payout_state");
    const details=JSON.stringify({payout_id:payoutId,amount_minor:current.amount_minor,currency:current.currency,note:note||null});
    const results=await env.DB.batch([
     env.DB.prepare("UPDATE editor_payouts SET status='approved',approved_by=?,approved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),note=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='pending_approval'").bind(actorId,note||null,payoutId),
     env.DB.prepare("INSERT INTO finance_bridge_audit_logs(id,actor_source_admin_id,actor_email,actor_role,action,details_json) SELECT ?,?,?,?,'editor_payout_approved',? WHERE changes()=1").bind(crypto.randomUUID(),actorId,actorEmail,actorRole,details)
    ]);
    if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Payout state changed elsewhere. Refresh and retry.",409,"payout_state_conflict");await notifyInApp(env,current.editor_id,"editor_payout_approved","Editor payout approved","Your editor payout has been approved by CSA Finance.",{payout_id:payoutId,amount_minor:current.amount_minor,currency:current.currency,note:note||null});
   }else{
    if(current.status==="paid")return out({ok:true,payout:current,idempotent:true,transfer_initiated:false});
    if(current.status!=="approved")return bad("Only Finance-approved payouts can be marked paid.",409,"payout_not_approved");
    const duplicateReference=await env.DB.prepare("SELECT id FROM editor_payouts WHERE payment_reference=? AND status='paid' AND id<>? LIMIT 1").bind(reference,payoutId).first();if(duplicateReference)return bad("This bank/UPI reference is already recorded for another payout.",409,"payment_reference_duplicate");
    const details=JSON.stringify({payout_id:payoutId,amount_minor:current.amount_minor,currency:current.currency,payment_reference:reference,note:note||null});
    const results=await env.DB.batch([
     env.DB.prepare("UPDATE editor_payouts SET status='paid',paid_by=?,paid_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),payment_reference=?,note=COALESCE(?,note),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='approved'").bind(actorId,reference,note||null,payoutId),
     env.DB.prepare("INSERT INTO finance_bridge_audit_logs(id,actor_source_admin_id,actor_email,actor_role,action,details_json) SELECT ?,?,?,?,'editor_payout_marked_paid',? WHERE changes()=1").bind(crypto.randomUUID(),actorId,actorEmail,actorRole,details)
    ]);
    if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Payout state changed elsewhere. Refresh and retry.",409,"payout_state_conflict");await notifyInApp(env,current.editor_id,"editor_payout_paid","Editor payout marked paid","CSA Finance has recorded your payout payment reference.",{payout_id:payoutId,amount_minor:current.amount_minor,currency:current.currency,payment_reference:reference});
   }
   const updated=await env.DB.prepare("SELECT * FROM editor_payouts WHERE id=?").bind(payoutId).first();
   return out({ok:true,payout:updated,transfer_initiated:false,note:"This records Finance approval/payment confirmation only. It does not initiate a bank or Razorpay transfer."});
  }
  if(action==="process_client_refund"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required to process refunds.",403,"finance_write_access_denied");
   if(env.ENVIRONMENT!=="staging"||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_"))return bad("Refund processing is restricted to Razorpay Test Mode on Staging.",503,"refund_test_mode_required");
   const refundId=txt(actor.refund_id,128);if(!refundId)return bad("Refund ID is required.",400,"refund_id_required");
   const refund=await env.DB.prepare("SELECT r.*,p.provider_payment_id,p.amount_minor AS payment_amount_minor,p.currency AS payment_currency,p.status AS payment_status,p.provider,p.payment_type FROM client_refund_requests r JOIN payments p ON p.id=r.payment_id WHERE r.id=?").bind(refundId).first();
   if(!refund)return bad("Client refund request not found.",404,"refund_not_found");
   if(!["approved","unknown"].includes(refund.status))return bad("Only approved or safely retryable unknown refunds can be processed.",409,"refund_state_not_processable");
   if(refund.provider!=="razorpay"||!refund.provider_payment_id||!["client_advance","client_balance"].includes(refund.payment_type))return bad("Original Razorpay client payment is not eligible.",409,"refund_payment_not_eligible");
   if(!["succeeded","partially_refunded"].includes(refund.payment_status))return bad("Original payment is not in a refundable captured state.",409,"refund_payment_not_captured");if(!Number.isSafeInteger(Number(refund.amount_minor))||Number(refund.amount_minor)<=0||String(refund.currency||"").toUpperCase()!==String(refund.payment_currency||"").toUpperCase())return bad("Refund amount or currency does not match the original payment.",409,"refund_amount_currency_invalid");
   const idempotencyKey=("csa_refund_"+refund.id).replace(/[^A-Za-z0-9_-]/g,"").slice(0,36);
   const lock=await env.DB.prepare("UPDATE client_refund_requests SET status='processing',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status IN ('approved','unknown')").bind(refund.id).run();
   if(!lock.meta?.changes)return bad("Refund is already processing or its status changed. Refresh the queue.",409,"refund_processing_conflict");
   const activeRefunds=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM client_refund_requests WHERE payment_id=? AND status IN ('processing','unknown','processed')").bind(refund.payment_id).first();if(Number(activeRefunds?.total||0)>Number(refund.payment_amount_minor)){await env.DB.prepare("UPDATE client_refund_requests SET status='approved',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(refund.id).run();return bad("Combined processed, processing and uncertain refunds exceed the captured payment amount. Reconcile existing requests before retrying.",409,"refund_total_exceeds_payment");}
   const auth="Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET);
   let providerPayment,verify;
   try{verify=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(refund.provider_payment_id),{headers:{Authorization:auth}});providerPayment=await verify.json().catch(()=>({}));}
   catch(e){await env.DB.prepare("UPDATE client_refund_requests SET status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(JSON.stringify({stage:"payment_verification",error:txt(String(e),1000)}),refund.id).run();await logFinance("client_refund_unknown",{refund_id:refund.id,payment_id:refund.payment_id,stage:"payment_verification"});return bad("Payment verification was interrupted. No refund was sent.",502,"refund_payment_verification_interrupted");}
   if(!verify.ok||providerPayment.id!==refund.provider_payment_id||providerPayment.status!=="captured"||Number(providerPayment.amount)!==Number(refund.payment_amount_minor)||String(providerPayment.currency||"").toUpperCase()!==String(refund.payment_currency||"").toUpperCase()){
    await env.DB.prepare("UPDATE client_refund_requests SET status='approved',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(JSON.stringify({stage:"payment_verification",http_status:verify.status,response:providerPayment}).slice(0,3000),refund.id).run();
    await logFinance("client_refund_payment_verification_failed",{refund_id:refund.id,http_status:verify.status});
    return bad("Razorpay could not verify captured payment, amount and currency. No refund was sent.",409,"refund_payment_verification_failed");
   }
   let response,payload;
   try{response=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(refund.provider_payment_id)+"/refund",{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json","X-Refund-Idempotency":idempotencyKey},body:JSON.stringify({amount:Number(refund.amount_minor),notes:{csa_refund_request_id:refund.id,csa_payment_id:refund.payment_id,csa_source:"CSA Global"}})});payload=await response.json().catch(()=>({}));}
   catch(e){await env.DB.prepare("UPDATE client_refund_requests SET status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(JSON.stringify({stage:"refund_request",error:txt(String(e),1000),idempotency_key:idempotencyKey}),refund.id).run();await logFinance("client_refund_unknown",{refund_id:refund.id,payment_id:refund.payment_id,stage:"refund_request"});return bad("Razorpay response was interrupted. Refund state is unknown; retry this same request to reuse its idempotency key.",502,"refund_status_unknown");}
   if(!response.ok||!payload.id){const uncertain=response.status===409||response.status>=500,nextStatus=uncertain?"unknown":"failed";await env.DB.prepare("UPDATE client_refund_requests SET status=?,provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(nextStatus,JSON.stringify({http_status:response.status,response:payload,idempotency_key:idempotencyKey}).slice(0,3000),refund.id).run();await logFinance("client_refund_"+nextStatus,{refund_id:refund.id,payment_id:refund.payment_id,http_status:response.status});return bad(uncertain?"Razorpay reports an uncertain or in-progress request. Reconcile before retrying.":"Razorpay rejected the refund request; review the provider response.",502,"refund_provider_response");}
   if(payload.payment_id!==refund.provider_payment_id||Number(payload.amount)!==Number(refund.amount_minor)||String(payload.currency||"").toUpperCase()!==String(refund.currency||"").toUpperCase()){
    await env.DB.prepare("UPDATE client_refund_requests SET provider_refund_id=?,status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payload.id,JSON.stringify({reason:"Provider response mismatch",payment_id:payload.payment_id??null,amount:payload.amount??null,currency:payload.currency??null}).slice(0,3000),refund.id).run();
    await logFinance("client_refund_unknown",{refund_id:refund.id,provider_refund_id:payload.id,reason:"provider_response_mismatch"});
    return bad("Razorpay response mismatch. Refund status is unknown and needs reconciliation.",502,"refund_response_mismatch");
   }
   const nextStatus=payload.status==="processed"?"processed":payload.status==="failed"?"failed":"processing";
   await env.DB.prepare("UPDATE client_refund_requests SET provider_refund_id=?,status=?,provider_response_json=?,processed_at=CASE WHEN ?='processed' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE processed_at END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status NOT IN ('processed','failed','rejected','cancelled')").bind(payload.id,nextStatus,JSON.stringify(payload).slice(0,3000),nextStatus,refund.id).run();
   const finalRefund=await env.DB.prepare("SELECT status FROM client_refund_requests WHERE id=?").bind(refund.id).first(),finalStatus=finalRefund?.status||nextStatus;
   if(finalStatus==="processed"){const totals=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM client_refund_requests WHERE payment_id=? AND status='processed'").bind(refund.payment_id).first();await env.DB.prepare("UPDATE payments SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(Number(totals?.total||0)>=Number(refund.payment_amount_minor)?"refunded":"partially_refunded",refund.payment_id).run();}
   await logFinance("client_refund_"+finalStatus,{refund_id:refund.id,payment_id:refund.payment_id,provider_refund_id:payload.id,amount_minor:refund.amount_minor,currency:refund.currency});
   if(finalStatus!==refund.status){const title=finalStatus==="processed"?"Refund completed":finalStatus==="failed"?"Refund failed":"Refund processing update";const body=finalStatus==="processed"?"Your refund has been processed by the payment provider.":finalStatus==="failed"?"The payment provider could not complete your refund. Please contact CSA Finance.":"Your refund is now being processed by the payment provider.";await notifyInApp(env,refund.client_id,"client_refund_provider_"+finalStatus,title,body,{refund_id:refund.id,provider_refund_id:payload.id,amount_minor:refund.amount_minor,currency:refund.currency});}
   return out({ok:true,refund_id:refund.id,provider_refund_id:payload.id,status:finalStatus,amount_minor:refund.amount_minor,currency:refund.currency,mode:"razorpay_test",idempotency_key:idempotencyKey});
  }
  if(action==="review_client_refund"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required to review refunds.",403,"finance_write_access_denied");
   const refundId=txt(actor.refund_id,128),reviewAction=txt(actor.review_action,30),note=txt(actor.review_note,1000);
   const transitions={under_review:"under_review",approve:"approved",reject:"rejected"};
   if(!refundId||!Object.prototype.hasOwnProperty.call(transitions,reviewAction))return bad("Refund review action is invalid.",400,"refund_review_invalid");
   if(reviewAction==="reject"&&note.length<3)return bad("A rejection reason is required.",400,"refund_rejection_note_required");
   const current=await env.DB.prepare("SELECT id,status,client_id,amount_minor,currency,payment_id FROM client_refund_requests WHERE id=?").bind(refundId).first();
   if(!current)return bad("Client refund request not found.",404,"refund_not_found");
   if(!["requested","under_review"].includes(current.status))return bad("This refund request has already been decided.",409,"refund_review_state_invalid");
   const next=transitions[reviewAction],now=new Date().toISOString();
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE client_refund_requests SET status=?,reviewed_by=?,review_note=?,updated_at=? WHERE id=? AND status IN ('requested','under_review')").bind(next,actorId,note||null,now,refundId),
    env.DB.prepare("INSERT INTO finance_bridge_audit_logs(id,actor_source_admin_id,actor_email,actor_role,action,details_json) SELECT ?,?,?,?,'client_refund_reviewed',? WHERE changes()=1").bind(crypto.randomUUID(),actorId,actorEmail,actorRole,JSON.stringify({refund_id:refundId,old_status:current.status,new_status:next,review_action:reviewAction,review_note:note||null})),
   ]);
   if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Refund request was updated by another reviewer. Refresh and retry.",409,"refund_review_conflict");
   const title=next==="approved"?"Refund approved":next==="rejected"?"Refund request declined":"Refund under review",body=next==="approved"?"Your refund request has been approved and is awaiting provider processing.":next==="rejected"?"Your refund request was declined. Please review the note or contact CSA Finance.":"Your refund request is now under review.";await notifyInApp(env,current.client_id,"client_refund_"+next,title,body,{refund_id:refundId,amount_minor:current.amount_minor,currency:current.currency,status:next,review_note:note||null});
   return out({ok:true,refund_id:refundId,status:next,client_notified:true,provider_refund_started:false});
  }
  if(action==="send_balance_reminder"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required to send client reminders.",403,"finance_write_access_denied");
   const quoteId=txt(actor.quote_id,128);if(!quoteId)return bad("Quote ID is required.",400,"quote_id_required");
   const quote=await env.DB.prepare("SELECT q.id,q.client_id,q.project_id,q.total_amount_minor,q.currency,q.status,p.public_project_code,p.title,COALESCE((SELECT SUM(pay.amount_minor) FROM payments pay WHERE pay.quote_id=q.id AND pay.payment_type IN ('client_advance','client_balance') AND pay.status='succeeded'),0) AS paid_minor FROM client_quotes q JOIN projects p ON p.id=q.project_id WHERE q.id=? AND q.status='accepted'").bind(quoteId).first();
   if(!quote)return bad("Accepted quote not found.",404,"accepted_quote_not_found");
   const balance=Math.max(0,Number(quote.total_amount_minor||0)-Number(quote.paid_minor||0));if(balance<=0)return bad("This quote has no outstanding balance.",409,"quote_already_paid");
   const recent=await env.DB.prepare("SELECT id FROM notifications WHERE user_id=? AND template_key='client_balance_payment_reminder' AND json_extract(payload_json,'$.quote_id')=? AND created_at>datetime('now','-24 hours') LIMIT 1").bind(quote.client_id,quoteId).first();
   if(recent)return out({ok:true,idempotent:true,reminder_id:recent.id,balance_minor:balance,currency:quote.currency,note:"A reminder was already sent within the last 24 hours."});
   const delivered=await notifyInApp(env,quote.client_id,"client_balance_payment_reminder","Payment balance reminder","An outstanding balance of "+balance+" "+quote.currency+" is due for project "+(quote.public_project_code||quote.title)+". Open your CSA Client Dashboard to complete payment.",{quote_id:quoteId,project_id:quote.project_id,project_code:quote.public_project_code,project_title:quote.title,amount_minor:balance,currency:quote.currency});await logFinance(delivered?"client_balance_reminder_sent":"client_balance_reminder_skipped",{quote_id:quoteId,project_id:quote.project_id,balance_minor:balance,currency:quote.currency,delivery:delivered?"in_app":"disabled_by_preference"});const reminder=delivered?await env.DB.prepare("SELECT id FROM notifications WHERE user_id=? AND template_key='client_balance_payment_reminder' AND json_extract(payload_json,'$.quote_id')=? ORDER BY created_at DESC LIMIT 1").bind(quote.client_id,quoteId).first():null;return out({ok:true,reminder_id:reminder?.id||null,client_id:quote.client_id,balance_minor:balance,currency:quote.currency,delivery:delivered?"in_app":"disabled_by_preference",note:delivered?"An in-app reminder was sent. No email or payment was sent.":"The client has in-app notifications disabled; no reminder was sent."});
  }
  if(action==="reconcile_deposit_refund"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required to reconcile editor deposit refunds.",403,"finance_write_access_denied");
   if(env.ENVIRONMENT!=="staging"||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_")||!env.RAZORPAY_KEY_SECRET)return bad("Deposit refund reconciliation is restricted to Razorpay Test Mode on Staging.",503,"deposit_refund_test_mode_required");
   const refundId=txt(actor.refund_id,128);if(!refundId)return bad("Deposit refund ID is required.",400,"deposit_refund_id_required");
   const refund=await env.DB.prepare("SELECT r.*,p.provider_payment_id,p.amount_minor AS payment_amount_minor,p.currency AS payment_currency FROM editor_deposit_refunds r JOIN payments p ON p.id=r.payment_id WHERE r.id=?").bind(refundId).first();
   if(!refund)return bad("Editor deposit refund not found.",404,"deposit_refund_not_found");
   if(!refund.provider_refund_id)return bad("No provider refund ID is recorded. Manual Razorpay dashboard reconciliation is required; do not create a second refund.",409,"deposit_refund_manual_reconciliation_required");
   if(["processed","failed"].includes(refund.status))return out({ok:true,idempotent:true,refund_id:refund.id,status:refund.status,provider_refund_id:refund.provider_refund_id});
   const auth="Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET);let response,payload;
   try{response=await fetch("https://api.razorpay.com/v1/refunds/"+encodeURIComponent(refund.provider_refund_id),{headers:{Authorization:auth}});payload=await response.json().catch(()=>({}));}
   catch(e){await logFinance("editor_deposit_refund_reconciliation_interrupted",{refund_id:refund.id,provider_refund_id:refund.provider_refund_id});return bad("Razorpay status lookup was interrupted. No new refund was created.",502,"deposit_refund_reconciliation_interrupted");}
   const matches=response.ok&&payload.id===refund.provider_refund_id&&payload.payment_id===refund.provider_payment_id&&Number(payload.amount)===Number(refund.amount_minor)&&String(payload.currency||"").toUpperCase()===String(refund.currency||"").toUpperCase();
   if(!matches){await env.DB.prepare("UPDATE editor_deposit_refunds SET status='unknown',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(JSON.stringify({http_status:response.status,reason:"Provider refund reconciliation mismatch",provider_response:payload}).slice(0,3000),refund.id).run();await logFinance("editor_deposit_refund_reconciliation_mismatch",{refund_id:refund.id,provider_refund_id:refund.provider_refund_id,http_status:response.status});return bad("Razorpay refund details did not match the stored payment, amount or currency. Manual review is required.",409,"deposit_refund_reconciliation_mismatch");}
   const next=payload.status==="processed"?"processed":payload.status==="failed"?"failed":"pending";
   await env.DB.prepare("UPDATE editor_deposit_refunds SET status=?,provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status NOT IN ('processed','failed')").bind(next,JSON.stringify(payload).slice(0,3000),refund.id).run();
   if(next==="processed"){await env.DB.batch([
    env.DB.prepare("UPDATE payments SET status='refunded',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(refund.payment_id),
    env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by,created_by_admin_id) SELECT ?,?,?,?,?, 'deposit_refunded',?,?,?,NULL,? WHERE NOT EXISTS(SELECT 1 FROM deposit_ledger WHERE payment_id=? AND entry_type='deposit_refunded')").bind(uid("dep"),refund.editor_id,refund.project_id,(await env.DB.prepare("SELECT offer_id FROM payments WHERE id=?").bind(refund.payment_id).first())?.offer_id,refund.payment_id,refund.amount_minor,refund.currency,"Full security deposit refund confirmed by Razorpay reconciliation; refund "+refund.provider_refund_id,actorId,refund.payment_id)
   ]);}
   await logFinance("editor_deposit_refund_reconciled",{refund_id:refund.id,provider_refund_id:refund.provider_refund_id,status:next});
   await notifyInApp(env,refund.editor_id,"editor_deposit_refund_"+next,next==="processed"?"Security deposit refund completed":next==="failed"?"Security deposit refund failed":"Security deposit refund pending",next==="processed"?"Razorpay confirms your security deposit refund is complete.":next==="failed"?"Razorpay confirms the security deposit refund failed. Please contact CSA Finance.":"Razorpay confirms your security deposit refund is still pending.",{refund_id:refund.id,provider_refund_id:refund.provider_refund_id,amount_minor:refund.amount_minor,currency:refund.currency});
   return out({ok:true,refund_id:refund.id,provider_refund_id:refund.provider_refund_id,status:next,reconciled:true});
  }
  if(action==="eligible_deposit_refunds"){
   const r=await env.DB.prepare("SELECT p.id AS payment_id,p.user_id AS editor_id,p.amount_minor,p.currency,p.created_at AS paid_at,o.id AS offer_id,pr.id AS project_id,pr.public_project_code,pr.title,e.display_name,e.public_editor_code,s.id AS approved_submission_id,s.submitted_at AS quality_approved_at FROM payments p JOIN project_offers o ON o.id=p.offer_id JOIN projects pr ON pr.id=o.project_id JOIN editor_profiles e ON e.user_id=p.user_id JOIN assignments a ON a.offer_id=o.id AND a.editor_id=p.user_id JOIN work_submissions s ON s.assignment_id=a.id AND s.qc_status='approved' WHERE p.payment_type='editor_security_deposit' AND p.provider='razorpay' AND p.status='succeeded' AND NOT EXISTS(SELECT 1 FROM editor_deposit_refunds x WHERE x.payment_id=p.id) GROUP BY p.id ORDER BY s.submitted_at ASC LIMIT 100").all();
   await logFinance("finance_eligible_deposit_refunds_viewed",{count:(r.results||[]).length});
   return out({ok:true,eligible:r.results||[],count:(r.results||[]).length},200);
  }
  if(action==="process_deposit_refund"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required to process editor deposit refunds.",403,"finance_write_access_denied");
   if(env.ENVIRONMENT!=="staging"||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_")||!env.RAZORPAY_KEY_SECRET)return bad("Editor deposit refunds are restricted to Razorpay Test Mode on Staging.",503,"deposit_refund_test_mode_required");
   const paymentId=txt(actor.payment_id,128);if(!paymentId)return bad("Security deposit payment ID is required.",400,"deposit_payment_id_required");
   const payment=await env.DB.prepare("SELECT p.id,p.user_id,p.project_id,p.offer_id,p.amount_minor,p.currency,p.provider_payment_id,p.status,p.provider,pr.public_project_code,pr.title FROM payments p JOIN projects pr ON pr.id=p.project_id WHERE p.id=? AND p.payment_type='editor_security_deposit' AND p.provider='razorpay'").bind(paymentId).first();
   if(!payment)return bad("Security deposit payment not found.",404,"deposit_payment_not_found");
   if(payment.status!=="succeeded"||!payment.provider_payment_id||Number(payment.amount_minor)<=0)return bad("Only a captured and verified security deposit can be refunded.",409,"deposit_payment_not_refundable");
   const existing=await env.DB.prepare("SELECT id,status,provider_refund_id FROM editor_deposit_refunds WHERE payment_id=?").bind(payment.id).first();
   if(existing)return out({ok:true,created:false,idempotent:true,refund_id:existing.id,status:existing.status,provider_refund_id:existing.provider_refund_id});
   const approved=await env.DB.prepare("SELECT s.id FROM assignments x JOIN work_submissions s ON s.assignment_id=x.id WHERE x.offer_id=? AND x.editor_id=? AND x.project_id=? AND s.qc_status='approved' ORDER BY s.submitted_at DESC LIMIT 1").bind(payment.offer_id,payment.user_id,payment.project_id).first();
   if(!approved)return bad("Refund is locked until CSA quality approval is recorded for this project.",409,"quality_approval_required");
   const auth="Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET);let verifyPayment,providerPayment;try{verifyPayment=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(payment.provider_payment_id),{headers:{Authorization:auth}});providerPayment=await verifyPayment.json().catch(()=>({}));}catch(e){return bad("Razorpay payment verification was interrupted. No deposit refund was sent.",502,"deposit_payment_verification_interrupted")}if(!verifyPayment.ok||providerPayment.id!==payment.provider_payment_id||providerPayment.status!=="captured"||Number(providerPayment.amount)!==Number(payment.amount_minor)||String(providerPayment.currency||"").toUpperCase()!==String(payment.currency||"").toUpperCase())return bad("Razorpay could not verify the captured deposit payment, amount and currency. No refund was sent.",409,"deposit_payment_verification_failed");const refundId=uid("rfd"),idempotencyKey=crypto.randomUUID();
   try{await env.DB.prepare("INSERT INTO editor_deposit_refunds(id,payment_id,editor_id,project_id,amount_minor,currency,idempotency_key,status,requested_by,requested_by_admin_id) VALUES(?,?,?,?,?,?,?,'requesting',NULL,?)").bind(refundId,payment.id,payment.user_id,payment.project_id,payment.amount_minor,payment.currency,idempotencyKey,actorId).run();}
   catch(e){const again=await env.DB.prepare("SELECT id,status,provider_refund_id FROM editor_deposit_refunds WHERE payment_id=?").bind(payment.id).first();if(again)return out({ok:true,created:false,idempotent:true,refund_id:again.id,status:again.status,provider_refund_id:again.provider_refund_id});return bad("A refund request already exists for this deposit. Check its status before taking any further action.",409,"deposit_refund_already_requested");}
   let response,payload;
   try{response=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(payment.provider_payment_id)+"/refund",{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json","X-Refund-Idempotency":idempotencyKey},body:JSON.stringify({amount:payment.amount_minor,notes:{csa_project_code:payment.public_project_code,csa_payment_id:payment.id,csa_reason:"Security deposit refund after CSA quality approval"}})});payload=await response.json().catch(()=>({}));}
   catch(e){await env.DB.prepare("UPDATE editor_deposit_refunds SET status='unknown',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(txt(String(e),1000),refundId).run();await logFinance("editor_deposit_refund_unknown",{refund_id:refundId,payment_id:payment.id,stage:"provider_request"});await notifyInApp(env,payment.user_id,"editor_deposit_refund_unknown","Deposit refund status needs checking","Razorpay did not return a confirmed response for your security deposit refund. CSA Finance is reconciling the provider status.",{refund_id:refundId,payment_id:payment.id,amount_minor:payment.amount_minor,currency:payment.currency});return bad("Razorpay response was interrupted. Refund status is marked unknown; reconcile in Razorpay before any retry.",502,"deposit_refund_status_unknown");}
   if(!response.ok||!payload.id){await env.DB.prepare("UPDATE editor_deposit_refunds SET status='failed',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(JSON.stringify(payload).slice(0,3000),refundId).run();await logFinance("editor_deposit_refund_failed",{refund_id:refundId,payment_id:payment.id,http_status:response.status});await notifyInApp(env,payment.user_id,"editor_deposit_refund_failed","Deposit refund failed","Razorpay did not accept the security deposit refund. CSA Finance will review the provider response.",{refund_id:refundId,payment_id:payment.id,amount_minor:payment.amount_minor,currency:payment.currency});return bad("Razorpay did not accept the refund. Check Razorpay dashboard before deciding next steps.",502,"deposit_refund_provider_rejected");}
   const providerMatches=payload.payment_id===payment.provider_payment_id&&Number(payload.amount)===Number(payment.amount_minor)&&String(payload.currency||"").toUpperCase()===String(payment.currency||"").toUpperCase();
   if(!providerMatches){await env.DB.prepare("UPDATE editor_deposit_refunds SET provider_refund_id=?,status='unknown',provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payload.id,JSON.stringify({reason:"Razorpay refund response did not match the full deposit.",payment_id:payload.payment_id??null,amount:payload.amount??null,currency:payload.currency??null}).slice(0,3000),refundId).run();await logFinance("editor_deposit_refund_unknown",{refund_id:refundId,payment_id:payment.id,provider_refund_id:payload.id,reason:"provider_response_mismatch"});await notifyInApp(env,payment.user_id,"editor_deposit_refund_unknown","Deposit refund needs reconciliation","Razorpay returned details that did not match the full security deposit. CSA Finance is reconciling the refund.",{refund_id:refundId,payment_id:payment.id,provider_refund_id:payload.id});return bad("Razorpay returned a refund response that did not match the full deposit. Status is unknown; reconcile in Razorpay before any retry.",502,"deposit_refund_response_mismatch");}
   const refundStatus=["processed","pending"].includes(payload.status)?payload.status:"pending";
   await env.DB.batch([
    env.DB.prepare("UPDATE editor_deposit_refunds SET provider_refund_id=?,status=CASE WHEN status IN ('processed','failed') THEN status ELSE ? END,provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payload.id,refundStatus,JSON.stringify(payload).slice(0,3000),refundId),
    ...(refundStatus==="processed"?[
     env.DB.prepare("UPDATE payments SET status='refunded',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payment.id),
     env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by,created_by_admin_id) VALUES(?,?,?,?,?,'deposit_refunded',?,?,?,NULL,?)").bind(uid("dep"),payment.user_id,payment.project_id,payment.offer_id,payment.id,payment.amount_minor,payment.currency,"Full security deposit refunded after CSA quality approval; Razorpay refund "+payload.id,actorId)
    ]:[])
   ]);
   await logFinance("editor_deposit_refund_initiated",{refund_id:refundId,payment_id:payment.id,provider_refund_id:payload.id,status:refundStatus,amount_minor:payment.amount_minor,currency:payment.currency});
   await notifyInApp(env,payment.user_id,"editor_deposit_refund_"+refundStatus,refundStatus==="processed"?"Security deposit refunded":"Security deposit refund initiated",refundStatus==="processed"?"Your security deposit refund has been processed.":"Your security deposit refund has been accepted by Razorpay and is awaiting completion.",{refund_id:refundId,payment_id:payment.id,provider_refund_id:payload.id,amount_minor:payment.amount_minor,currency:payment.currency});
   return out({ok:true,refund_id:refundId,provider_refund_id:payload.id,status:refundStatus,amount_minor:payment.amount_minor,currency:payment.currency,mode:"razorpay_test"});
  }
  if(action==="eligible_payouts"){
   const r=await env.DB.prepare("SELECT o.id AS offer_id,o.project_id,o.editor_id,o.proposed_fee_minor AS amount_minor,o.fee_currency AS currency,p.public_project_code,p.title AS project_title,COALESCE(e.display_name,u.email) AS editor_name,u.email AS editor_email,o.created_at FROM project_offers o JOIN assignments x ON x.offer_id=o.id AND x.editor_id=o.editor_id JOIN projects p ON p.id=o.project_id JOIN users u ON u.id=o.editor_id LEFT JOIN editor_profiles e ON e.user_id=o.editor_id WHERE o.status='accepted' AND o.proposed_fee_minor>0 AND EXISTS(SELECT 1 FROM work_submissions s WHERE s.assignment_id=x.id AND s.qc_status='approved') AND NOT EXISTS(SELECT 1 FROM editor_payouts ep WHERE ep.offer_id=o.id) ORDER BY o.created_at ASC LIMIT 200").all();
   await logFinance("finance_eligible_payouts_viewed",{count:(r.results||[]).length});
   return out({ok:true,eligible:r.results||[],count:(r.results||[]).length},200);
  }
  if(action==="create_editor_payout"){
   if(actorRole==="finance_admin"&&!["write","manage"].includes(financeLevel))return bad("Finance write access is required to create payout records.",403,"finance_write_access_denied");
   const offerId=txt(actor.offer_id,128);if(!offerId)return bad("Accepted offer ID is required.",400,"offer_id_required");
   const existing=await env.DB.prepare("SELECT * FROM editor_payouts WHERE offer_id=?").bind(offerId).first();
   if(existing)return out({ok:true,payout:existing,created:false,idempotent:true});
   const eligible=await env.DB.prepare("SELECT o.id AS offer_id,o.project_id,o.editor_id,o.proposed_fee_minor AS amount_minor,o.fee_currency AS currency FROM project_offers o JOIN assignments x ON x.offer_id=o.id AND x.editor_id=o.editor_id WHERE o.id=? AND o.status='accepted' AND o.proposed_fee_minor>0 AND EXISTS(SELECT 1 FROM work_submissions s WHERE s.assignment_id=x.id AND s.qc_status='approved') LIMIT 1").bind(offerId).first();
   if(!eligible)return bad("Payout can be created only for an accepted offer with QC-approved work and a positive fee.",409,"not_payout_eligible");
   const id=uid("payout");
   const inserted=await env.DB.prepare("INSERT OR IGNORE INTO editor_payouts(id,offer_id,project_id,editor_id,amount_minor,currency,status,created_by) VALUES(?,?,?,?,?,?,'pending_approval',?)").bind(id,eligible.offer_id,eligible.project_id,eligible.editor_id,eligible.amount_minor,eligible.currency,actorId).run();
   if(!inserted.meta?.changes){const again=await env.DB.prepare("SELECT * FROM editor_payouts WHERE offer_id=?").bind(offerId).first();if(again)return out({ok:true,payout:again,created:false,idempotent:true});return bad("Payout could not be created. Refresh and retry.",409,"payout_create_conflict");}
   await logFinance("editor_payout_created",{payout_id:id,offer_id:offerId,project_id:eligible.project_id,editor_id:eligible.editor_id,amount_minor:eligible.amount_minor,currency:eligible.currency});
   await notifyInApp(env,eligible.editor_id,"editor_payout_pending","Payout entered finance review","Your QC-approved work has been added to the Finance payout queue.",{payout_id:id,amount_minor:eligible.amount_minor,currency:eligible.currency});
   const payout=await env.DB.prepare("SELECT * FROM editor_payouts WHERE id=?").bind(id).first();
   return out({ok:true,payout,created:true},201);
  }
  if(action==="finance_audit_list"){await logFinance("finance_audit_viewed",{limit:100});const r=await env.DB.prepare("SELECT id,actor_source_admin_id,actor_email,actor_role,action,details_json,created_at FROM finance_bridge_audit_logs ORDER BY created_at DESC LIMIT 100").all();return out({ok:true,logs:r.results||[]},200);}
  if(action==="client_balances"){
   const q=await env.DB.prepare("SELECT q.id AS quote_id,q.project_id,q.client_id,u.email AS client_email,q.total_amount_minor,q.currency,q.status AS quote_status,q.payment_status,q.created_at,COALESCE(paid.paid_minor,0) AS paid_minor,MAX(0,q.total_amount_minor-COALESCE(paid.paid_minor,0)) AS balance_minor FROM client_quotes q JOIN users u ON u.id=q.client_id LEFT JOIN (SELECT quote_id,SUM(amount_minor) AS paid_minor FROM payments WHERE status='succeeded' AND payment_type IN ('client_advance','client_balance') AND quote_id IS NOT NULL GROUP BY quote_id) paid ON paid.quote_id=q.id WHERE q.total_amount_minor>COALESCE(paid.paid_minor,0) AND q.status='accepted' ORDER BY q.created_at ASC LIMIT 300").all();
   const rows=(q.results||[]).map(x=>({...x,total_amount_minor:Number(x.total_amount_minor||0),paid_minor:Number(x.paid_minor||0),balance_minor:Number(x.balance_minor||0)})),totals={quotes:rows.length,amount_minor:rows.reduce((n,x)=>n+x.total_amount_minor,0),paid_minor:rows.reduce((n,x)=>n+x.paid_minor,0),outstanding_minor:rows.reduce((n,x)=>n+x.balance_minor,0)},byCurrency={};
   for(const x of rows){const c=x.currency||"UNKNOWN";byCurrency[c]??={quotes:0,outstanding_minor:0};byCurrency[c].quotes++;byCurrency[c].outstanding_minor+=x.balance_minor;}
   await logFinance("finance_client_balances_viewed",{quotes:rows.length});
   return out({ok:true,balances:rows,summary:totals,by_currency:byCurrency,read_only:true,note:"Outstanding balance is accepted quotation value minus successful captured client advance and balance payments."});
  }
  if(action==="editor_payouts"){
   const q=await env.DB.prepare("SELECT ep.id,ep.offer_id,ep.project_id,ep.editor_id,ep.amount_minor,ep.currency,ep.status,ep.created_at,ep.approved_at,ep.paid_at,ep.payment_reference,ep.note,ep.approved_by,ep.paid_by,COALESCE(e.display_name,u.email) AS editor_name,u.email AS editor_email FROM editor_payouts ep JOIN users u ON u.id=ep.editor_id LEFT JOIN editor_profiles e ON e.user_id=ep.editor_id ORDER BY CASE ep.status WHEN 'pending_approval' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,ep.created_at DESC LIMIT 200").all();
   const rows=q.results||[];await logFinance("finance_editor_payouts_viewed",{records:rows.length});
   return out({ok:true,payouts:rows,summary:{count:rows.length,pending_approval:rows.filter(x=>x.status==="pending_approval").length,approved:rows.filter(x=>x.status==="approved").length,paid:rows.filter(x=>x.status==="paid").length,total_minor:rows.reduce((n,x)=>n+Number(x.amount_minor||0),0)},note:"No bank transfer is initiated by this read-only endpoint."});
  }
  if(action==="reconciliation"){
   const results=await env.DB.batch([
    env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM client_refund_requests GROUP BY status,currency ORDER BY status"),
    env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM editor_deposit_refunds GROUP BY status,currency ORDER BY status"),
    env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM editor_payouts GROUP BY status,currency ORDER BY status"),
    env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM payments GROUP BY status,currency ORDER BY status"),
    env.DB.prepare("SELECT COUNT(*) AS events FROM payment_webhook_events"),
    env.DB.prepare("SELECT id,payment_id,client_id,project_id,amount_minor,currency,reason,status,provider_refund_id,created_at,updated_at FROM client_refund_requests WHERE status IN ('requested','under_review','approved','processing','unknown','failed') ORDER BY created_at DESC LIMIT 100"),
    env.DB.prepare("SELECT id,payment_id,editor_id,project_id,amount_minor,currency,status,provider_refund_id,created_at,updated_at FROM editor_deposit_refunds WHERE status IN ('requesting','unknown','failed','pending') ORDER BY created_at DESC LIMIT 100"),
    env.DB.prepare("SELECT id,offer_id,project_id,editor_id,amount_minor,currency,status,payment_reference,created_at,updated_at FROM editor_payouts WHERE status IN ('pending_approval','approved') ORDER BY created_at DESC LIMIT 100")
   ]);
   const rows=results.map(x=>x.results||[]);await logFinance("finance_reconciliation_viewed",{client_refunds:rows[5].length,deposit_refunds:rows[6].length,editor_payouts:rows[7].length});
   return out({ok:true,reconciliation:{client_refunds_by_status:rows[0],deposit_refunds_by_status:rows[1],editor_payouts_by_status:rows[2],payments_by_status:rows[3],webhook_event_count:Number(rows[4][0]?.events||0),client_refunds_needing_attention:rows[5],deposit_refunds_needing_attention:rows[6],editor_payouts_waiting:rows[7]},read_only:true,note:"Read-only reconciliation. No refund retry, provider refund or bank transfer is initiated."});
  }
  return bad("Unsupported finance data action.",400,"finance_action_invalid");
 }
 if(m==="POST"&&p==="/internal/superadmin/finance/refund-dashboard"){
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Super Admin finance bridge is not configured.",503,"finance_bridge_unavailable");
  const raw=await req.text();
  if(raw.length>8192)return bad("Finance dashboard request is too large.",413,"finance_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"";
  const seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return bad("Invalid finance bridge authentication headers.",401,"finance_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  const bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/superadmin/finance/refund-dashboard\n"+ts+"\n"+nonce+"\n"+bodyHash;
  const validSignature=await verifyGlobalApiHmac(env,canonical,sig);
  if(!validSignature)return bad("Finance bridge signature is invalid.",401,"finance_signature_invalid");
  let actor;try{actor=JSON.parse(raw)}catch{return bad("Invalid finance dashboard request JSON.");}
  const actorId=txt(actor?.actor_admin_id,100),actorEmail=txt(actor?.actor_email,254).toLowerCase(),actorRole=txt(actor?.actor_role,40);
  if(!actorId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail)||!["super_admin","finance_admin"].includes(actorRole))return bad("Finance dashboard actor is not permitted.",403,"finance_actor_denied");
  if(actorRole==="finance_admin"){
   const authorized=await env.DB.prepare("SELECT finance_access_level FROM global_admin_authorizations WHERE source_admin_id=? AND email=? COLLATE NOCASE AND source_role='finance_admin' AND status='active' LIMIT 1").bind(actorId,actorEmail).first();
   if(!authorized||!["read","write","manage"].includes(authorized.finance_access_level))return bad("Finance read access is not active for this account.",403,"finance_access_denied");
  }
  try{await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();}
  catch{return bad("Finance bridge nonce was already used.",409,"finance_replay");}
  const results=await env.DB.batch([
   env.DB.prepare("SELECT status,currency,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor FROM client_refund_requests GROUP BY status,currency ORDER BY currency,status"),
   env.DB.prepare("SELECT currency,COUNT(*) AS total_requests,COALESCE(SUM(amount_minor),0) AS total_amount_minor,COALESCE(SUM(CASE WHEN status='processed' THEN amount_minor ELSE 0 END),0) AS processed_amount_minor,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN amount_minor ELSE 0 END),0) AS pending_amount_minor,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN 1 ELSE 0 END),0) AS pending_records,COALESCE(SUM(CASE WHEN status IN ('failed','unknown') THEN 1 ELSE 0 END),0) AS attention_records FROM client_refund_requests GROUP BY currency ORDER BY currency"),
   env.DB.prepare("SELECT COUNT(*) AS total_records,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN 1 ELSE 0 END),0) AS pending_records,COALESCE(SUM(CASE WHEN status='processed' THEN 1 ELSE 0 END),0) AS processed_records,COALESCE(SUM(CASE WHEN status IN ('failed','unknown') THEN 1 ELSE 0 END),0) AS attention_records FROM client_refund_requests"),
   env.DB.prepare("SELECT r.id,r.payment_id,r.client_id,r.project_id,r.amount_minor,r.currency,r.reason,r.status,r.review_note,r.provider_refund_id,r.created_at,r.updated_at,u.email AS client_email FROM client_refund_requests r JOIN users u ON u.id=r.client_id ORDER BY CASE r.status WHEN 'requested' THEN 0 WHEN 'under_review' THEN 1 WHEN 'approved' THEN 2 WHEN 'processing' THEN 3 WHEN 'unknown' THEN 4 WHEN 'failed' THEN 5 ELSE 6 END,r.created_at DESC LIMIT 10")
  ]);
  const rows=results.map(x=>x.results||[]);
  try{const actorUser=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE LIMIT 1").bind(actorEmail).first();if(actorUser?.id)await log(env,actorUser.id,"finance_refund_dashboard_viewed","finance","refund_dashboard",{source:"superadmin_bridge",source_admin_id:actorId,source_role:actorRole});}catch{}
  return out({ok:true,dashboard:{status_and_currency:rows[0],currency_totals:rows[1],record_counts:rows[2][0]||{total_records:0,pending_records:0,processed_records:0,attention_records:0},priority_queue:rows[3]},meta:{queue_limit:10,amount_unit:"minor currency units",pending_statuses:["requested","under_review","approved","processing","unknown"],attention_statuses:["failed","unknown"],read_only:true,source:"superadmin_bridge"},note:"Read-only Global refund dashboard. Currency totals remain separate. No refund, transfer, or payment mutation is initiated."});
 }
 if(m==="POST"&&p==="/internal/superadmin/editor-sessions"){
  if(env.ENVIRONMENT!=="staging"||(!env.ADMIN_SYNC_HMAC_SECRET&&!env.GLOBAL_API_SYNC_HMAC_SECRET))return bad("Super Admin editor session bridge is not configured.",503,"editor_session_bridge_unavailable");
  const raw=await req.text();if(raw.length>8192)return bad("Editor session request is too large.",413,"editor_session_payload_too_large");
  const ts=req.headers.get("x-csa-sync-timestamp")||"",nonce=req.headers.get("x-csa-sync-nonce")||"",sig=req.headers.get("x-csa-sync-signature")||"",seconds=Number(ts),nowSeconds=Math.floor(Date.now()/1000);
  if(!/^\d{10}$/.test(ts)||Math.abs(nowSeconds-seconds)>60||!/^[a-f0-9-]{20,80}$/i.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return bad("Invalid editor session bridge authentication headers.",401,"editor_session_auth_invalid");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))),bodyHash=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  const canonical="POST\n/internal/superadmin/editor-sessions\n"+ts+"\n"+nonce+"\n"+bodyHash,validSignature=await verifyGlobalApiHmac(env,canonical,sig);
  if(!validSignature)return bad("Editor session bridge signature is invalid.",401,"editor_session_signature_invalid");
  let body;try{body=JSON.parse(raw)}catch{return bad("Invalid editor session request JSON.");}
  const actorId=txt(body?.actor_admin_id,100),actorEmail=txt(body?.actor_email,254).toLowerCase(),actorRole=txt(body?.actor_role,40),editorId=txt(body?.editor_id,100),action=txt(body?.action,20),allow=(env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!actorId||!actorEmail||actorRole!=="super_admin"||!allow.includes(actorEmail))return bad("Super Admin identity is not permitted.",403,"editor_session_actor_denied");
  if(!editorId||!["list","revoke_one","revoke_all"].includes(action))return bad("Editor ID and a supported session action are required.");
  try{await env.DB.prepare("INSERT INTO admin_sync_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce,nowSeconds+300).run();}catch{return bad("Editor session bridge nonce was already used.",409,"editor_session_replay");}
  const target=await env.DB.prepare("SELECT id,role FROM users WHERE id=?").bind(editorId).first();if(!target||target.role!=="editor")return bad("Editor account not found.",404,"editor_not_found");
  if(action==="list"){
   const rows=await env.DB.prepare("SELECT created_at,expires_at FROM editor_sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 50").bind(editorId,new Date().toISOString()).all();
   const sessions=(rows.results||[]).map(x=>({session_ref:btoa(x.created_at+"\n"+x.expires_at).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"),created_at:x.created_at,expires_at:x.expires_at}));
   return out({ok:true,editor_id:editorId,active_sessions:sessions.length,sessions});
  }
  let actorUser=null;try{actorUser=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE LIMIT 1").bind(actorEmail).first();}catch{}
  if(action==="revoke_one"){
   const ref=txt(body.session_ref,300);if(!ref)return bad("Session reference is required.");
   let decoded;try{decoded=atob(ref.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-ref.length%4)%4));}catch{return bad("Invalid session reference.");}
   const parts=decoded.split("\n");if(parts.length!==2||!parts[0]||!parts[1])return bad("Invalid session reference.");
   const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM editor_sessions WHERE user_id=? AND created_at=? AND expires_at=? AND expires_at>?").bind(editorId,parts[0],parts[1],new Date().toISOString()).first();
   if(Number(count?.n||0)!==1)return bad(Number(count?.n||0)>1?"Session reference is ambiguous.":"Session is no longer active.",409,"session_not_unique");
   await env.DB.prepare("DELETE FROM editor_sessions WHERE user_id=? AND created_at=? AND expires_at=?").bind(editorId,parts[0],parts[1]).run();
   await log(env,actorUser?.id||null,"superadmin_editor_session_revoked","editor",editorId,{scope:"single_session",source_admin_id:actorId});
   return out({ok:true,revoked:true});
  }
  const result=await env.DB.prepare("DELETE FROM editor_sessions WHERE user_id=?").bind(editorId).run(),revoked=Number(result.meta?.changes||0);
  await log(env,actorUser?.id||null,"superadmin_editor_sessions_force_revoked","editor",editorId,{revoked_sessions:revoked,source_admin_id:actorId});
  return out({ok:true,revoked_sessions:revoked});
 }
  const legalEvidencePath=p.match(/^\/v1\/admin\/countries\/([A-Z]{2})\/legal-evidence(?:\/([\w-]+)\/file)?$/);
 if(legalEvidencePath){
  const actor=await user(req,env,["admin"]);if(actor.source_role!=="super_admin")return bad("Only Super Admin may manage country legal evidence.",403,"legal_evidence_forbidden");
  const cc=legalEvidencePath[1],evidenceId=legalEvidencePath[2]||null,country=await env.DB.prepare("SELECT country_code FROM countries WHERE country_code=?").bind(cc).first();if(!country)return bad("Country not found.",404,"country_not_found");
  if(m==="POST"&&!evidenceId){
   if(!env.MEDIA)return bad("Private evidence storage is not configured.",503);
   const category=txt(req.headers.get("x-csa-evidence-category"),40),title=txt(req.headers.get("x-csa-evidence-title"),160),mime=(req.headers.get("content-type")||"").split(";")[0].toLowerCase(),declared=Number(req.headers.get("content-length")||0);
   if(!title||!["corporate_registration","tax_registration","privacy_data_protection","consumer_protection","payments_regulatory","licensing","other"].includes(category))return bad("Evidence title and valid category are required.",400,"legal_evidence_metadata_invalid");
   if(!["application/pdf","image/jpeg","image/png"].includes(mime))return bad("Evidence must be PDF, JPG or PNG.",415,"legal_evidence_type_invalid");
   if(!Number.isSafeInteger(declared)||declared<1||declared>10*1024*1024)return bad("Evidence file must be between 1 byte and 10 MB.",413,"legal_evidence_size_invalid");
   const bytes=await req.arrayBuffer();if(bytes.byteLength!==declared)return bad("Uploaded file size does not match Content-Length.",400,"legal_evidence_size_mismatch");
   const head=new Uint8Array(bytes.slice(0,12)),valid=mime==="application/pdf"?String.fromCharCode(...head.slice(0,5))==="%PDF-":mime==="image/jpeg"?head[0]===255&&head[1]===216&&head[2]===255:head.length>=8&&head[0]===137&&String.fromCharCode(...head.slice(1,4))==="PNG";if(!valid)return bad("File signature does not match its declared MIME type.",415,"legal_evidence_signature_invalid");
   const id=crypto.randomUUID(),ext=mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg",filename=(txt(req.headers.get("x-csa-evidence-filename"),180)||("evidence."+ext)).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,120)||("evidence."+ext),key="country-legal-evidence/"+cc+"/"+id+"."+ext;
   const digest=await crypto.subtle.digest("SHA-256",bytes),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
   await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:"private, no-store",contentDisposition:"attachment"}});
try{await env.DB.batch([env.DB.prepare("INSERT INTO country_legal_evidence(id,country_code,uploaded_by_source_admin_id,evidence_category,title,original_filename,mime_type,size_bytes,r2_object_key,sha256) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,cc,actor.source_admin_id,category,title,filename,mime,bytes.byteLength,key,sha),env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)").bind(uid("log"),actor.id,"country_legal_evidence_uploaded","country_legal_evidence",id,JSON.stringify({country_code:cc,category,mime_type:mime,size_bytes:bytes.byteLength,sha256:sha}))]);}catch(e){await env.MEDIA.delete(key);throw e;}
   return out({ok:true,evidence:{id,country_code:cc,category,title,filename,mime_type:mime,size_bytes:bytes.byteLength,sha256:sha,created_at:new Date().toISOString()}},201);
  }
  if(m==="GET"&&!evidenceId){const r=await env.DB.prepare("SELECT id,country_code,evidence_category AS category,title,original_filename AS filename,mime_type,size_bytes,sha256,created_at FROM country_legal_evidence WHERE country_code=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100").bind(cc).all();return out({ok:true,country_code:cc,evidence:r.results||[]});}
  if(m==="GET"&&evidenceId){const row=await env.DB.prepare("SELECT r2_object_key,mime_type,original_filename FROM country_legal_evidence WHERE id=? AND country_code=? AND deleted_at IS NULL").bind(evidenceId,cc).first();if(!row)return bad("Legal evidence not found.",404,"legal_evidence_not_found");const object=await env.MEDIA.get(row.r2_object_key);if(!object)return bad("Legal evidence file is missing from private storage.",410,"legal_evidence_storage_missing");const bytes=new Uint8Array(await object.arrayBuffer());const digest=await crypto.subtle.digest("SHA-256",bytes),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");const check=await env.DB.prepare("SELECT sha256,size_bytes FROM country_legal_evidence WHERE id=? AND country_code=?").bind(evidenceId,cc).first();if(!check||bytes.byteLength!==check.size_bytes||sha!==check.sha256)return bad("Evidence file integrity check failed.",409,"legal_evidence_integrity_failed");await log(env,actor.id,"country_legal_evidence_downloaded","country_legal_evidence",evidenceId,{country_code:cc,sha256:sha,size_bytes:bytes.byteLength});return new Response(bytes,{headers:{"content-type":row.mime_type,"content-disposition":"attachment; filename="+JSON.stringify(String(row.original_filename).replace(/[\r\n"]/g,"_")),"cache-control":"private, no-store","x-content-type-options":"nosniff","content-length":String(bytes.byteLength)}});}
  return bad("Method not allowed.",405,"method_not_allowed");
 }
if(m==="GET"&&p==="/health"){const requiredTables=["users","client_profiles","projects","project_files","payments","editor_profiles","editor_portfolio_videos","editor_kyc_documents","project_tenders","csa_pricing_policies","notifications","notification_preferences","client_refund_requests","countries","country_legal_reviews","regional_admins","regional_admin_permissions","regional_admin_permission_catalog","regional_admin_audit_logs","editor_payouts","assignments","work_submissions","project_status_history","client_quotes","messages","finance_bridge_audit_logs"];let d1=false,schemaReady=false,missingTables=requiredTables;try{const row=await env.DB.prepare("SELECT 1 AS ok").first();d1=row?.ok===1;if(d1){const tableRows=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+requiredTables.map(()=>"?").join(",")+")").bind(...requiredTables).all();const found=new Set((tableRows?.results||[]).map(x=>x.name));missingTables=requiredTables.filter(name=>!found.has(name));schemaReady=missingTables.length===0;}}catch{}const legacyRequired=["video_editing_orders","video_editing_files","video_editing_status_history"];let legacyDb=false,legacySchemaReady=false,missingLegacyTables=legacyRequired;try{if(env.LEGACY_VIDEO_DB){const row=await env.LEGACY_VIDEO_DB.prepare("SELECT 1 AS ok").first();legacyDb=row?.ok===1;if(legacyDb){const rows=await env.LEGACY_VIDEO_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+legacyRequired.map(()=>"?").join(",")+")").bind(...legacyRequired).all();const found=new Set((rows?.results||[]).map(x=>x.name));missingLegacyTables=legacyRequired.filter(name=>!found.has(name));legacySchemaReady=missingLegacyTables.length===0;}}}catch{}const mediaBucket=!!env.MEDIA,legacyVideoBucket=!!env.LEGACY_VIDEO_BUCKET,payment=razorpayRuntime(env),healthy=d1&&schemaReady&&legacyDb&&legacySchemaReady&&mediaBucket&&legacyVideoBucket;return out({ok:true,service:"CSA Global API",status:healthy?"healthy":"degraded",d1_connected:d1,schema_ready:schemaReady,missing_tables:missingTables,legacy_video_db_connected:legacyDb,legacy_video_schema_ready:legacySchemaReady,missing_legacy_video_tables:missingLegacyTables,media_bucket_configured:mediaBucket,legacy_video_bucket_configured:legacyVideoBucket,google_login:!!env.GOOGLE_CLIENT_ID,razorpay_checkout:payment.ready,razorpay_mode:payment.mode,mode:env.ENVIRONMENT||"unknown"});}
if(m==="GET"&&p==="/v1/config"){const payment=razorpayRuntime(env);return out({ok:true,google_client_id:env.GOOGLE_CLIENT_ID||null,razorpay_key_id:payment.ready?env.RAZORPAY_KEY_ID:null,razorpay_checkout:payment.ready,razorpay_mode:payment.mode,environment:env.ENVIRONMENT||"unknown"});}
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
 await env.DB.prepare("UPDATE editor_credentials SET password_salt=?,password_hash=?,must_change_password=0,failed_attempts=0,locked_until=NULL WHERE user_id=?").bind(salt64,hash,a.id).run();await log(env,a.id,"editor_password_changed","editor",a.id,{forced_change:true});return out({ok:true,password_changed:true});
 }
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
   if(role==="editor"){const k=await env.DB.prepare("SELECT status,review_note FROM editor_kyc_documents WHERE editor_id=? ORDER BY created_at DESC LIMIT 1").bind(old.id).first();return out({ok:true,user_id:old.id,role:old.role,status:old.account_status,email:old.email,existing_editor:true,kyc_status:k?.status||"not_submitted",kyc_review_note:k?.review_note||null});}
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
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'client',?,?, 'active',NULL)").bind(newId,c.sub,c.email,new Date().toISOString()).run();
   await env.DB.prepare("INSERT INTO client_profiles(user_id,display_name,company_name,country,timezone,preferred_language) VALUES(?,?,?,?,?,?)").bind(newId,name,txt(profile.company_name,160)||null,txt(profile.country,100)||null,txt(profile.timezone,80)||null,txt(profile.language,40)||"English").run();
  }else{
   const country=txt(profile.country,100),legalName=txt(profile.legal_name,160),skills=Array.isArray(profile.specializations)?profile.specializations.map(x=>txt(x,80)).filter(Boolean).slice(0,20):[];
   if(!legalName||!country||!skills.length)return bad("Legal name, country and at least one specialization are required.");
   await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'editor',?,?, 'pending',NULL)").bind(newId,c.sub,c.email,new Date().toISOString()).run();
   await env.DB.prepare("INSERT INTO editor_profiles(user_id,public_editor_code,display_name,legal_name,country,country_code,state,district,city,village,postal_code,address_line,languages_json,experience_level,software_json,specializations_json,portfolio_url,sample_url,availability,bio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(newId,"CSA-ED-"+crypto.randomUUID().slice(0,8).toUpperCase(),name,legalName,country,txt(profile.country_code,2).toUpperCase()||null,txt(profile.state,120)||null,txt(profile.district,120)||null,txt(profile.city,120)||null,txt(profile.village,120)||null,txt(profile.postal_code,20)||null,txt(profile.address_line,240)||null,JSON.stringify(Array.isArray(profile.languages)?profile.languages:[]),txt(profile.experience_level,40)||null,JSON.stringify(Array.isArray(profile.software)?profile.software:[]),JSON.stringify(skills),null,null,txt(profile.availability,40)||"project-based",txt(profile.bio,2000)||null).run();
  }
  await log(env,newId,"google_account_registered",role,newId,{email_domain:c.email.split("@")[1]});
  return out({ok:true,user_id:newId,role,status:role==="editor"?"pending":"active",email:c.email},201);
 }
 if(m==="POST"&&p==="/v1/onboarding/editor"){
  const c=await claims(req,env),b=await req.json(),name=txt(b.display_name,120),legalName=txt(b.legal_name,160),country=txt(b.country,100);
  if(!name||!legalName||!country||!Array.isArray(b.specializations)||!b.specializations.length)return bad("Display name, legal name, country and specializations are required.");
  const idu=uid("usr");
  await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'editor',?,?, 'pending',NULL)").bind(idu,c.sub,c.email,new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO editor_profiles(user_id,public_editor_code,display_name,legal_name,country,country_code,state,district,city,village,postal_code,address_line,languages_json,experience_level,software_json,specializations_json,portfolio_url,sample_url,availability,bio) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(idu,"CSA-ED-"+crypto.randomUUID().slice(0,8).toUpperCase(),name,legalName,country,txt(b.country_code,2).toUpperCase()||null,txt(b.state,120)||null,txt(b.district,120)||null,txt(b.city,120)||null,txt(b.village,120)||null,txt(b.postal_code,20)||null,txt(b.address_line,240)||null,JSON.stringify(b.languages||[]),txt(b.experience_level,40)||null,JSON.stringify(b.software||[]),JSON.stringify(b.specializations),null,null,txt(b.availability,40)||"project-based",txt(b.bio,2000)||null).run();
  await log(env,idu,"editor_registration_submitted","editor",idu);
  return out({ok:true,status:"pending_verification",message:"Registration is free. No deposit is charged until an editor chooses to accept a project offer."},201);
 }

 if(m==="POST"&&p==="/v1/editor/kyc-document"){
  if(!env.MEDIA)return bad("Private KYC storage is not configured.",503);
  const identity=await claims(req,env),editor=await env.DB.prepare("SELECT u.id,u.role,u.account_status FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.auth_subject=? AND u.email=? COLLATE NOCASE").bind(identity.sub,identity.email).first();
  if(!editor||editor.role!=="editor"||!["pending","active"].includes(editor.account_status))return bad("An eligible editor registration is required.",403);
  const docType=txt(req.headers.get("x-csa-kyc-document-type"),40).toLowerCase(),consent=req.headers.get("x-csa-kyc-consent")==="true",consentVersion=txt(req.headers.get("x-csa-kyc-consent-version"),20),mime=(req.headers.get("content-type")||"").split(";")[0].toLowerCase(),declared=Number(req.headers.get("content-length")||0);
  if(!["passport","national_id","pan","voter_id","driving_licence","aadhaar","residence_permit","tax_id","other_government_id"].includes(docType)||!consent||consentVersion!=="1.0")return bad("Select an accepted government ID type and accept the current KYC privacy notice.");
  if(!["application/pdf","image/jpeg","image/png"].includes(mime))return bad("KYC document must be a PDF, JPG or PNG.",415);
  if(!Number.isSafeInteger(declared)||declared<1||declared>10*1024*1024)return bad("KYC document must be between 1 byte and 10 MB.",413);
  const pending=await env.DB.prepare("SELECT id FROM editor_kyc_documents WHERE editor_id=? AND status IN ('pending','in_review')").bind(editor.id).first();
  if(pending)return bad("A KYC document is already awaiting review. Contact CSA if you need to replace it.",409);
  const bytes=await req.arrayBuffer();if(bytes.byteLength!==declared)return bad("Uploaded file size does not match Content-Length.");
  const head=new Uint8Array(bytes.slice(0,12));
  const valid=mime==="application/pdf"?String.fromCharCode(...head.slice(0,5))==="%PDF-":mime==="image/jpeg"?head[0]===0xff&&head[1]===0xd8&&head[2]===0xff:head.length>=8&&head[0]===0x89&&String.fromCharCode(...head.slice(1,4))==="PNG";
  if(!valid)return bad("The document file signature does not match its selected type.",415);
  const id=uid("kyc"),key="private-kyc/"+editor.id+"/"+id+(mime==="application/pdf"?".pdf":mime==="image/png"?".png":".jpg");
  await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:"private, no-store"}});
  try{await env.DB.prepare("INSERT INTO editor_kyc_documents(id,editor_id,document_type,r2_object_key,mime_type,size_bytes,status,consent_version,consented_at) VALUES(?,?,?,?,?,?,'pending',?,?)").bind(id,editor.id,docType,key,mime,bytes.byteLength,consentVersion,new Date().toISOString()).run();await log(env,editor.id,"editor_kyc_document_submitted","editor_kyc",id,{document_type:docType,mime_type:mime,size_bytes:bytes.byteLength});}
  catch(e){await env.MEDIA.delete(key);throw e;}
  return out({ok:true,status:"pending_review",message:"KYC document submitted securely for CSA review."},201);
 }
 if(m==="POST"&&p==="/v1/editor/portfolio-videos"){
  if(!env.MEDIA)return bad("Private media storage is not configured.",503);
  const c=await claims(req,env),editor=await env.DB.prepare("SELECT u.id,u.role,u.account_status,e.verification_status FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.auth_subject=? AND u.email=? COLLATE NOCASE").bind(c.sub,c.email).first();
  if(!editor||editor.role!=="editor"||!["pending","active"].includes(editor.account_status)||!["pending","in_review","verified"].includes(editor.verification_status))return bad("An eligible editor registration is required.",403);
  const title=txt(req.headers.get("x-csa-video-title"),120),description=txt(req.headers.get("x-csa-video-description"),1200),category=txt(req.headers.get("x-csa-video-category"),80),mime=(req.headers.get("content-type")||"").split(";")[0].toLowerCase(),rights=req.headers.get("x-csa-video-rights-confirmed")==="true",terms=txt(req.headers.get("x-csa-terms-version"),20),declared=Number(req.headers.get("content-length")||0);
  if(!title||!description||!category||!rights||terms!=="1.0")return bad("Video details, rights confirmation and current terms acceptance are required.");
  if(!["video/mp4","video/quicktime"].includes(mime))return bad("Only MP4 and MOV videos are accepted.",415);
  if(!Number.isSafeInteger(declared)||declared<1||declared>80*1024*1024)return bad("Each portfolio video must be between 1 byte and 80 MB.",413);
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM editor_portfolio_videos WHERE editor_id=?").bind(editor.id).first();
  if(Number(count?.n||0)>=3)return bad("A maximum of 3 portfolio videos is allowed.",409);
  const bytes=await req.arrayBuffer();if(bytes.byteLength!==declared)return bad("Uploaded file size does not match Content-Length.",400);
  const head=new Uint8Array(bytes.slice(0,12));if(head.length<8||String.fromCharCode(...head.slice(4,8))!=="ftyp")return bad("The uploaded file does not have a valid MP4/MOV container signature.",415);
  const id=uid("pvid"),key="editor-portfolio/"+editor.id+"/"+id+(mime==="video/quicktime"?".mov":".mp4");
  await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:"private, no-store"}});
  try{await env.DB.prepare("INSERT INTO editor_portfolio_videos(id,editor_id,title,description,category,r2_object_key,mime_type,size_bytes,rights_confirmed,terms_version,terms_accepted_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)").bind(id,editor.id,title,description,category,key,mime,bytes.byteLength,terms,new Date().toISOString()).run();await log(env,editor.id,"editor_portfolio_video_uploaded","editor_portfolio_video",id,{category,mime_type:mime,size_bytes:bytes.byteLength,terms_version:terms});}
  catch(e){await env.MEDIA.delete(key);throw e;}
  return out({ok:true,video_id:id,review_status:"pending"},201);
 }
 const portfolioPreview=p.match(/^\/v1\/admin\/editor-portfolio-videos\/([\w-]+)\/preview$/);
 if(m==="GET"&&portfolioPreview){
  const a=await user(req,env,["admin"]),video=await env.DB.prepare("SELECT r2_object_key,mime_type,title FROM editor_portfolio_videos WHERE id=?").bind(portfolioPreview[1]).first();
  if(!video)return bad("Portfolio video not found.",404);
  const object=await env.MEDIA.get(video.r2_object_key);if(!object)return bad("Portfolio video file is missing from private storage.",404);
  return new Response(object.body,{headers:{"content-type":video.mime_type,"content-disposition":"inline","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }
 if(m==="GET"&&p==="/v1/admin/editor-portfolio-videos"){
  const a=await user(req,env,["admin"]),status=txt(u.searchParams.get("status"),20)||"pending";
  if(!["pending","approved","rejected","all"].includes(status))return bad("Invalid review status.");
  const query=env.DB.prepare("SELECT v.id,v.editor_id,e.display_name,e.country,v.title,v.description,v.category,v.mime_type,v.size_bytes,v.review_status,v.client_visible,v.terms_version,v.terms_accepted_at,v.created_at FROM editor_portfolio_videos v JOIN editor_profiles e ON e.user_id=v.editor_id "+(status==="all"?"":"WHERE v.review_status=?")+" ORDER BY v.created_at DESC LIMIT 200");
  const rows=status==="all"?await query.all():await query.bind(status).all();
  return out({ok:true,videos:rows.results||[]});
 }
 const portfolioReview=p.match(/^\/v1\/admin\/editor-portfolio-videos\/([\w-]+)\/review$/);
 if(m==="POST"&&portfolioReview){
  const a=await user(req,env,["admin"]),b=await req.json(),status=txt(b.status,20),note=txt(b.note,1000);
  if(!["approved","rejected"].includes(status))return bad("Review status must be approved or rejected.");
  const video=await env.DB.prepare("SELECT id FROM editor_portfolio_videos WHERE id=?").bind(portfolioReview[1]).first();
  if(!video)return bad("Portfolio video not found.",404);
  await env.DB.prepare("UPDATE editor_portfolio_videos SET review_status=?,client_visible=?,reviewed_by=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),review_note=? WHERE id=?").bind(status,status==="approved"?1:0,a.id,note||null,video.id).run();
  await log(env,a.id,"editor_portfolio_video_reviewed","editor_portfolio_video",video.id,{status,note});
  return out({ok:true,status,client_visible:status==="approved"});
 }
 if(m==="POST"&&p==="/v1/onboarding/client"){
  const c=await claims(req,env),b=await req.json(),name=txt(b.display_name,120);if(!name)return bad("Name is required.");
  const idu=uid("usr");
  await env.DB.prepare("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status,country_code) VALUES(?,?, 'client',?,?, 'active',NULL)").bind(idu,c.sub,c.email,new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO client_profiles(user_id,display_name,company_name,country,timezone,preferred_language) VALUES(?,?,?,?,?,?)").bind(idu,name,txt(b.company_name,160)||null,txt(b.country,100)||null,txt(b.timezone,80)||null,txt(b.language,40)||null).run();
  return out({ok:true,status:"active"},201);
 }

 if(m==="GET"&&p==="/v1/client/editor-portfolio-videos"){
  const a=await user(req,env,["client"]);
  const rows=await env.DB.prepare("SELECT v.id,v.title,v.description,v.category,v.mime_type FROM editor_portfolio_videos v JOIN editor_profiles e ON e.user_id=v.editor_id JOIN users u ON u.id=v.editor_id WHERE v.review_status='approved' AND v.client_visible=1 AND e.verification_status='verified' AND u.account_status='active' AND EXISTS(SELECT 1 FROM editor_kyc_documents k WHERE k.editor_id=v.editor_id AND k.status='verified') ORDER BY v.reviewed_at DESC,v.created_at DESC LIMIT 100").all();
  return out({ok:true,videos:rows.results||[]});
 }
 const clientPortfolioStream=p.match(/^\/v1\/client\/editor-portfolio-videos\/([\w-]+)\/stream$/);
 if(m==="GET"&&clientPortfolioStream){
  const a=await user(req,env,["client"]),video=await env.DB.prepare("SELECT v.r2_object_key,v.mime_type FROM editor_portfolio_videos v JOIN editor_profiles e ON e.user_id=v.editor_id JOIN users u ON u.id=v.editor_id WHERE v.id=? AND v.review_status='approved' AND v.client_visible=1 AND e.verification_status='verified' AND u.account_status='active' AND EXISTS(SELECT 1 FROM editor_kyc_documents k WHERE k.editor_id=v.editor_id AND k.status='verified')").bind(clientPortfolioStream[1]).first();
  if(!video)return bad("Showcase video not found.",404);
  const object=await env.MEDIA.get(video.r2_object_key);if(!object)return bad("Showcase video is temporarily unavailable.",404);
  return new Response(object.body,{headers:{"content-type":video.mime_type,"content-disposition":"inline","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }
 if(m==="POST"&&p==="/v1/client/legacy-video-orders/claim"){
  const a=await user(req,env,["client"]);
  if(!env.LEGACY_VIDEO_DB)return bad("Legacy order claim is not configured in this environment.",503);
  const b=await req.json(),code=txt(b.order_code,40).toUpperCase(),accessToken=txt(b.access_token,160);
  if(!/^CSA-VE-[A-F0-9]{8}$/.test(code)||accessToken.length<32||accessToken.length>128)return bad("Enter the original Video Editing Order ID and its access token.");
  const legacy=await env.LEGACY_VIDEO_DB.prepare("SELECT id,order_code,customer_name,customer_email,customer_phone,country,service_package,project_type,video_duration,aspect_ratio,deadline,instructions,quoted_amount_paise,project_budget_paise,currency,payment_status,order_status,customer_access_hash,created_at,updated_at,is_draft FROM video_editing_orders WHERE order_code=? AND is_draft=0").bind(code).first();
  const digestBytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(accessToken)));
  const suppliedHash=[...digestBytes].map(x=>x.toString(16).padStart(2,"0")).join("");
  if(!legacy||!legacy.customer_access_hash||!constantTime(suppliedHash,legacy.customer_access_hash))return bad("Order ID or access token is invalid. Check the original details and try again.",401,"legacy_claim_invalid");
  const existing=await env.DB.prepare("SELECT project_id,client_id FROM legacy_video_order_claims WHERE legacy_order_id=? OR legacy_order_code=?").bind(legacy.id,code).first();
  if(existing){
   if(existing.client_id!==a.id)return bad("This legacy order has already been linked to another CSA Global account. Contact CSA Support for ownership review.",409,"legacy_order_already_claimed");
   const project=await env.DB.prepare("SELECT public_project_code FROM projects WHERE id=?").bind(existing.project_id).first();
   return out({ok:true,already_claimed:true,project_id:existing.project_id,project_code:project?.public_project_code||code});
  }
  const amount=Number(legacy.quoted_amount_paise||legacy.project_budget_paise||0),currency=txt(legacy.currency,3).toUpperCase()||"INR";
  const rawStatus=txt(legacy.order_status,100),payStatus=txt(legacy.payment_status,60)||"quote_pending";
  const status=/draft|awaiting.payment/i.test(rawStatus)?"quotation_pending":/completed|delivered/i.test(rawStatus)?"completed":/progress|editing/i.test(rawStatus)?"in_progress":/cancel/i.test(rawStatus)?"cancelled":"submitted";
  const title=(txt(legacy.service_package,100)||"Video Editing")+" — "+(txt(legacy.project_type,100)||"Legacy order");
  const requirements={communication_language:"Not provided",source_language:"Not provided",output_language:"Not provided",subtitle_languages:"",client_country:txt(legacy.country,100)||"Not provided",client_region:"",client_city:"Not provided",project_mode:"remote",project_location:"",client_timezone:"Asia/Kolkata",contact_name:txt(legacy.customer_name,100),contact_phone:txt(legacy.customer_phone,30),content_style:txt(legacy.project_type,100)||"Not provided",dialect:"",service_package:txt(legacy.service_package,100),project_type:txt(legacy.project_type,120),raw_footage_duration:txt(legacy.video_duration,80),legacy_order_code:code};
  const projectId=uid("prj"),files=await env.LEGACY_VIDEO_DB.prepare("SELECT id,object_key,original_filename,content_type,file_size_bytes,file_role,created_at FROM video_editing_files WHERE order_id=? AND upload_state='complete' ORDER BY created_at").bind(legacy.id).all();
  const history=await env.LEGACY_VIDEO_DB.prepare("SELECT id,old_status,new_status,note,changed_by,created_at FROM video_editing_status_history WHERE order_id=? ORDER BY created_at").bind(legacy.id).all();
  const statements=[
   env.DB.prepare("INSERT INTO projects(id,public_project_code,client_id,title,category,brief,raw_footage_minutes,aspect_ratio,requirements_json,budget_amount_minor,budget_currency,budget_type,preferred_deadline,priority,revisions_included,status,client_visible_status,legacy_payment_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?, 'normal',2,?,?,?,?,?)").bind(projectId,code,a.id,title,"Video Editing",txt(legacy.instructions,12000)||"Imported legacy Video Editing request.",null,txt(legacy.aspect_ratio,20)||null,JSON.stringify(requirements),amount>0?amount:null,currency,amount>0?"fixed":"recommend",txt(legacy.deadline,40)||null,status,status,payStatus,legacy.created_at||new Date().toISOString(),legacy.updated_at||new Date().toISOString()),
   env.DB.prepare("INSERT INTO legacy_video_order_claims(legacy_order_id,legacy_order_code,project_id,client_id) VALUES(?,?,?,?)").bind(legacy.id,code,projectId,a.id),
   env.DB.prepare("INSERT INTO project_status_history(id,project_id,old_status,new_status,note,changed_by,source_system,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(uid("hist"),projectId,null,status,"Legacy order claimed into CSA Global. Original status: "+rawStatus,"client","legacy_video",legacy.created_at||new Date().toISOString())
  ];
  for(const f of files.results||[])statements.push(env.DB.prepare("INSERT INTO project_files(id,project_id,uploaded_by,r2_object_key,original_filename,mime_type,size_bytes,access_scope,created_at) VALUES(?,?,?,?,?,?,?,'client_and_admin',?)").bind(uid("file"),projectId,a.id,"legacyvideo/"+f.object_key,f.original_filename,f.content_type||"application/octet-stream",Number(f.file_size_bytes||0),f.created_at||legacy.created_at||new Date().toISOString()));
  for(const h of history.results||[])statements.push(env.DB.prepare("INSERT INTO project_status_history(id,project_id,old_status,new_status,note,changed_by,source_system,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(uid("hist"),projectId,h.old_status,h.new_status,h.note||"",txt(h.changed_by,40)||"legacy_system","legacy_video",h.created_at||legacy.created_at||new Date().toISOString()));
  try{await env.DB.batch(statements);}catch(e){
   const race=await env.DB.prepare("SELECT project_id,client_id FROM legacy_video_order_claims WHERE legacy_order_id=? OR legacy_order_code=?").bind(legacy.id,code).first();
   if(race?.client_id===a.id){const project=await env.DB.prepare("SELECT public_project_code FROM projects WHERE id=?").bind(race.project_id).first();return out({ok:true,already_claimed:true,project_id:race.project_id,project_code:project?.public_project_code||code});}
   throw e;
  }
  await log(env,a.id,"legacy_video_order_claimed","project",projectId,{legacy_order_code:code,legacy_files_imported:(files.results||[]).length});
  return out({ok:true,project_id:projectId,project_code:code,files_imported:(files.results||[]).length,status},201);
 }
 if(m==="GET"&&p==="/v1/client/projects"){
  const a=await user(req,env,["client"]);
  const r=await env.DB.prepare("SELECT id,public_project_code,title,category,brief,requirements_json,json(requirements_json) AS requirements,video_count,raw_footage_minutes,final_duration_minutes,resolution,aspect_ratio,budget_type,budget_amount_minor,budget_currency,COALESCE((SELECT pay.status FROM payments pay WHERE pay.project_id=projects.id AND pay.payment_type IN ('client_advance','client_balance') ORDER BY pay.created_at DESC LIMIT 1),projects.legacy_payment_status,'quotation_pending') AS payment_status,priority,revisions_included,CASE WHEN client_visible_status='reviewing' THEN 'client_review' WHEN client_visible_status='in_progress' THEN 'in_progress' WHEN status IN ('submitted','under_review') THEN status WHEN status IN ('approved','matching','assigned','in_progress','revision') THEN CASE WHEN status IN ('approved','matching') THEN status ELSE 'in_progress' END WHEN status='quality_check' THEN 'quality_review' WHEN status IN ('client_review','completed') THEN status WHEN status IN ('cancelled','rejected') THEN 'closed' ELSE 'submitted' END AS status,CASE WHEN status IN ('approved','matching','assigned','in_progress','quality_check','client_review','revision','completed') THEN 1 ELSE 0 END AS application_locked,preferred_deadline,created_at,updated_at FROM projects WHERE client_id=? ORDER BY created_at DESC LIMIT 100").bind(a.id).all();
  const projects=(r.results||[]).map(p=>{let requirements={};try{requirements=JSON.parse(p.requirements_json||"{}");}catch{}return {...p,requirements};});
  return out({ok:true,projects});
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
  const rawName=txt(b.filename,180)||"upload.bin",name=rawName.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||"upload.bin";
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
  // Verify the completed R2 object itself before writing a trusted file/submission record.
  let storedObject;
  try{storedObject=await env.MEDIA.head(session.r2_object_key);}catch(e){
   await env.DB.prepare("UPDATE multipart_upload_sessions SET status='unknown' WHERE id=?").bind(id).run();
   return bad("Upload completed but storage verification failed. Contact CSA before retrying.",502,"multipart_storage_verification_unknown");
  }
  if(!storedObject||Number(storedObject.size)!==Number(session.total_size_bytes)){
   await env.DB.prepare("UPDATE multipart_upload_sessions SET status='unknown' WHERE id=?").bind(id).run();
   return bad("Stored file size could not be verified. Contact CSA before retrying.",502,"multipart_storage_size_mismatch");
  }
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
  const rawName=txt(req.headers.get("x-file-name"),180)||"upload.bin",name=rawName.split(/[\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||"upload.bin";
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
 if(m==="GET"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/deliverables")){
  const projectId=p.split("/")[4],a=await user(req,env,["client"]),project=await env.DB.prepare("SELECT id,status,revisions_included FROM projects WHERE id=? AND client_id=?").bind(projectId,a.id).first();
  if(!project)return bad("Project not found.",404);
  const r=await env.DB.prepare("SELECT s.id,s.assignment_id,s.version_number,s.original_filename,s.mime_type,s.size_bytes,s.submitted_at FROM work_submissions s JOIN assignments x ON x.id=s.assignment_id WHERE x.project_id=? AND s.qc_status='approved' ORDER BY s.submitted_at DESC").bind(project.id).all();
  const history=await env.DB.prepare("SELECT id,request_number,submission_id,notes,status,created_at,resolved_at FROM client_revision_requests WHERE project_id=? ORDER BY request_number DESC").bind(project.id).all();
  const used=(history.results||[]).length,remaining=Math.max(0,Number(project.revisions_included||0)-used),open=(history.results||[]).some(x=>x.status==="open"||x.status==="in_progress");
  return out({ok:true,deliverables:r.results||[],revision_requests:history.results||[],revision_policy:{included:Number(project.revisions_included||0),used,remaining,can_request:project.status==="client_review"&&remaining>0&&!open}});
 }
 if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/approve")){
  const projectId=p.split("/")[4],a=await user(req,env,["client"]);
  const current=await env.DB.prepare("SELECT p.id,p.public_project_code,p.title,p.status,p.client_id,x.id AS assignment_id,x.editor_id,s.id AS submission_id FROM projects p JOIN assignments x ON x.project_id=p.id JOIN work_submissions s ON s.assignment_id=x.id WHERE p.id=? AND p.client_id=? AND p.status='client_review' AND x.status='approved' AND s.qc_status='approved' AND s.id=(SELECT s2.id FROM work_submissions s2 JOIN assignments x2 ON x2.id=s2.assignment_id WHERE x2.project_id=p.id AND s2.qc_status='approved' ORDER BY s2.submitted_at DESC LIMIT 1) AND NOT EXISTS(SELECT 1 FROM client_revision_requests rr WHERE rr.project_id=p.id AND rr.status IN ('open','in_progress')) LIMIT 1").bind(projectId,a.id).first();
  if(!current)return bad("Only the latest QC-approved delivery with no open revision request can be approved.",409,"delivery_not_approvable");
  const results=await env.DB.batch([
   env.DB.prepare("UPDATE projects SET status='completed',client_visible_status='completed',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND client_id=? AND status='client_review' AND EXISTS(SELECT 1 FROM work_submissions s JOIN assignments x ON x.id=s.assignment_id WHERE x.project_id=projects.id AND x.status='approved' AND s.qc_status='approved' AND s.id=(SELECT s2.id FROM work_submissions s2 JOIN assignments x2 ON x2.id=s2.assignment_id WHERE x2.project_id=projects.id AND s2.qc_status='approved' ORDER BY s2.submitted_at DESC LIMIT 1)) AND NOT EXISTS(SELECT 1 FROM client_revision_requests rr WHERE rr.project_id=projects.id AND rr.status IN ('open','in_progress'))").bind(projectId,a.id),
   env.DB.prepare("UPDATE assignments SET status='completed' WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM projects WHERE id=? AND status='completed')").bind(current.assignment_id,projectId)
  ]);
  if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("The delivery state changed before approval. Refresh your dashboard.",409,"delivery_approval_conflict");
  if(Number(results?.[1]?.meta?.changes||0)!==1)return bad("Project approval was recorded but assignment completion needs CSA reconciliation.",500,"assignment_completion_mismatch");
  await log(env,a.id,"client_final_delivery_approved","project",projectId,{submission_id:current.submission_id,assignment_id:current.assignment_id});
  await notifyInApp(env,current.editor_id,"client_final_delivery_approved","Client approved final video · "+current.public_project_code,"The client has approved the final delivery. The project is marked complete; any outstanding client balance and editor payout remain subject to CSA finance reconciliation.",{project_id:projectId,submission_id:current.submission_id});
  return out({ok:true,status:"completed",project_code:current.public_project_code,finance_reconciliation_required:true});
 }
 if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/revisions")){
  const projectId=p.split("/")[4],a=await user(req,env,["client"]),b=await req.json(),notes=txt(b.notes,2000),submissionId=txt(b.submission_id,100);
  if(notes.length<5)return bad("Please describe the requested changes in at least 5 characters.");
  if(!submissionId)return bad("Select the approved delivery you want revised.");
  const project=await env.DB.prepare("SELECT id,status,revisions_included FROM projects WHERE id=? AND client_id=?").bind(projectId,a.id).first();
  if(!project)return bad("Project not found.",404);
  if(project.status!=="client_review")return bad("Revision requests are available only while a QC-approved delivery is awaiting your review.",409,"delivery_not_in_review");
  const usedRow=await env.DB.prepare("SELECT COUNT(*) AS used FROM client_revision_requests WHERE project_id=?").bind(project.id).first(),used=Number(usedRow?.used||0),included=Number(project.revisions_included||0);
  if(used>=included)return bad("Your included revision limit has been reached. Contact CSA for additional changes.",409,"revision_limit_reached");
  const requestId=uid("rev");
  const results=await env.DB.batch([
   env.DB.prepare("INSERT INTO client_revision_requests(id,project_id,assignment_id,submission_id,client_id,request_number,notes) SELECT ?,p.id,x.id,s.id,?,(SELECT COUNT(*)+1 FROM client_revision_requests WHERE project_id=p.id),? FROM projects p JOIN assignments x ON x.project_id=p.id JOIN work_submissions s ON s.assignment_id=x.id WHERE p.id=? AND p.client_id=? AND p.status='client_review' AND s.id=? AND s.qc_status='approved' AND x.status='approved' AND s.id=(SELECT s2.id FROM work_submissions s2 JOIN assignments x2 ON x2.id=s2.assignment_id WHERE x2.project_id=p.id AND s2.qc_status='approved' ORDER BY s2.submitted_at DESC LIMIT 1) AND (SELECT COUNT(*) FROM client_revision_requests WHERE project_id=p.id)<p.revisions_included AND NOT EXISTS(SELECT 1 FROM client_revision_requests WHERE project_id=p.id AND status IN ('open','in_progress')) LIMIT 1").bind(requestId,a.id,notes,project.id,a.id,submissionId),
   env.DB.prepare("UPDATE projects SET status='revision',client_visible_status='revision',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='client_review' AND EXISTS(SELECT 1 FROM client_revision_requests WHERE id=?)").bind(project.id,requestId),
   env.DB.prepare("UPDATE assignments SET status='revision' WHERE project_id=? AND status='approved' AND EXISTS(SELECT 1 FROM client_revision_requests WHERE id=? AND assignment_id=assignments.id)").bind(project.id,requestId)
  ]);
  if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("A revision request is already open, the delivery changed, or your included revision limit was reached. Refresh your dashboard.",409,"revision_request_conflict");
  if(Number(results?.[1]?.meta?.changes||0)!==1||Number(results?.[2]?.meta?.changes||0)!==1)return bad("Revision request needs CSA reconciliation before work continues.",500,"revision_request_state_mismatch");
  await log(env,a.id,"client_revision_requested","project",project.id,{revision_request_id:requestId,request_number:used+1,submission_id:submissionId});
  const assigned=await env.DB.prepare("SELECT x.editor_id,p.public_project_code,p.title FROM assignments x JOIN projects p ON p.id=x.project_id WHERE x.project_id=? AND x.status='revision' LIMIT 1").bind(project.id).first();
  if(assigned)await notifyInApp(env,assigned.editor_id,"client_revision_requested","New client revision request · "+assigned.public_project_code,"The client requested changes: "+notes,{project_id:project.id,revision_request_id:requestId});
  return out({ok:true,revision_request_id:requestId,request_number:used+1,remaining_revisions:Math.max(0,included-used-1),status:"revision"},201);
 }
 if(m==="GET"&&p.startsWith("/v1/editor/assignments/")&&p.endsWith("/submissions")){
  const a=await user(req,env,["editor"]),assignmentId=p.split("/")[4];
  const owned=await env.DB.prepare("SELECT id,status,due_at FROM assignments WHERE id=? AND editor_id=?").bind(assignmentId,a.id).first();
  if(!owned)return bad("Assignment not found for this editor.",404);
  const r=await env.DB.prepare("SELECT id,version_number,original_filename,mime_type,size_bytes,notes,qc_status,submitted_at FROM work_submissions WHERE assignment_id=? ORDER BY version_number DESC").bind(assignmentId).all();
  return out({ok:true,assignment:{id:owned.id,status:owned.status,due_at:owned.due_at},submissions:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/editor/assignments"){
  const a=await user(req,env,["editor"]);
  const r=await env.DB.prepare("SELECT a.id,a.project_id,a.due_at,a.status,p.public_project_code,p.title,p.category,p.brief,p.revisions_included,o.delivery_days,(SELECT rr.notes FROM client_revision_requests rr WHERE rr.assignment_id=a.id AND rr.status IN ('open','in_progress') ORDER BY rr.created_at DESC LIMIT 1) AS revision_notes,(SELECT COUNT(*) FROM client_revision_requests rr WHERE rr.assignment_id=a.id) AS revisions_used FROM assignments a JOIN projects p ON p.id=a.project_id JOIN project_offers o ON o.id=a.offer_id WHERE a.editor_id=? AND a.status IN ('active','submitted','quality_check','revision') ORDER BY a.due_at ASC").bind(a.id).all();
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
  const rawName=txt(req.headers.get("x-file-name"),180)||"submission.bin",name=rawName.split(/[\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||"submission.bin",submissionId=uid("sub"),key="assignments/"+assignmentId+"/submissions/"+version+"/"+submissionId+"/"+name;
  const saved=await env.MEDIA.put(key,req.body,{httpMetadata:{contentType:mime,contentDisposition:"attachment; filename*=UTF-8''"+encodeURIComponent(name)}});
  if(saved.size>90*1024*1024){await env.MEDIA.delete(key);return bad("Submission exceeds the staging upload size limit.",413);}
  await env.DB.batch([
   env.DB.prepare("INSERT INTO work_submissions(id,assignment_id,submitted_by,r2_object_key,version_number,notes,qc_status,original_filename,mime_type,size_bytes) VALUES(?,?,?,?,?,?,'pending',?,?,?)").bind(submissionId,assignmentId,a.id,key,version,txt(req.headers.get("x-submission-notes"),2000)||null,name,mime,saved.size),
   env.DB.prepare("UPDATE assignments SET status='submitted' WHERE id=?").bind(assignmentId),
   env.DB.prepare("UPDATE projects SET status='quality_check',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(assignment.project_id)
  ]);
  await log(env,a.id,"work_submission_uploaded","submission",submissionId,{assignment_id:assignmentId,version});
  const client=await env.DB.prepare("SELECT p.client_id,p.public_project_code FROM projects p WHERE p.id=?").bind(assignment.project_id).first();
  if(client)await notifyInApp(env,client.client_id,"work_submitted_for_qc","Updated video submitted · "+client.public_project_code,"Your updated video has been submitted to CSA and is waiting for quality review.",{project_id:assignment.project_id,submission_id:submissionId,version});
  return out({ok:true,submission_id:submissionId,version,status:"pending_quality_check"},201);
 }
 if(m==="GET"&&p==="/v1/admin/submissions/pending"){
  const a=await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT s.id,s.assignment_id,s.version_number,s.notes,s.submitted_at,s.original_filename,s.mime_type,s.size_bytes,a.project_id,a.editor_id,p.public_project_code,p.title,e.public_editor_code,e.display_name FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN projects p ON p.id=a.project_id JOIN editor_profiles e ON e.user_id=a.editor_id WHERE s.qc_status='pending' AND (? IS NULL OR EXISTS(SELECT 1 FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=p.id AND dr.route_key='tender' AND da.source_admin_id=?)) ORDER BY s.submitted_at ASC LIMIT 100").bind(a.source_admin_id||null,a.source_admin_id||null).all();
  return out({ok:true,submissions:r.results||[]});
 }
 const qc=p.match(/^\/v1\/admin\/submissions\/([\w-]+)\/review$/);
 if(m==="POST"&&qc){
  const a=await user(req,env,["admin"]),b=await req.json(),status=b.status;
  if(!["approved","changes_requested","rejected"].includes(status))return bad("Invalid QC decision.");
  const sub=await env.DB.prepare("SELECT s.id,s.assignment_id,a.project_id,a.editor_id,p.client_id,p.public_project_code,p.title FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN projects p ON p.id=a.project_id WHERE s.id=? AND s.qc_status='pending'").bind(qc[1]).first();
  if(!sub)return bad("Submission is not awaiting QC.",409);
  const departmentAccess=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=? AND dr.route_key='tender' AND da.source_admin_id=?").bind(sub.project_id,a.source_admin_id).first();
  if(!departmentAccess)return bad("Tender department access is required to review this submission.",403);
  const assignmentStatus=status==="approved"?"approved":status==="changes_requested"?"revision":"active";
  const projectStatus=status==="approved"?"client_review":status==="changes_requested"?"revision":"in_progress";
  const clientStatus=status==="approved"?"reviewing":"in_progress";
  const results=await env.DB.batch([
   env.DB.prepare("UPDATE work_submissions SET qc_status=? WHERE id=? AND qc_status='pending'").bind(status,qc[1]),
   env.DB.prepare("UPDATE assignments SET status=? WHERE id=? AND EXISTS(SELECT 1 FROM work_submissions WHERE id=? AND qc_status=?)").bind(assignmentStatus,sub.assignment_id,qc[1],status),
   env.DB.prepare("UPDATE projects SET status=?,client_visible_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND EXISTS(SELECT 1 FROM work_submissions WHERE id=? AND qc_status=?)").bind(projectStatus,clientStatus,sub.project_id,qc[1],status),
   env.DB.prepare("UPDATE client_revision_requests SET status='completed',resolved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),handled_by=? WHERE assignment_id=? AND status IN ('open','in_progress') AND submission_id<>? AND ?='approved'").bind(a.id,sub.assignment_id,qc[1],status)
  ]);
  if(Number(results?.[0]?.meta?.changes||0)!==1)return bad("Submission QC was already processed. Refresh the queue before taking another action.",409,"qc_already_processed");
  await log(env,a.id,"quality_review_completed","submission",qc[1],{status});
  const qcTitle=status==="approved"?"Video passed CSA quality review · "+sub.public_project_code:status==="changes_requested"?"Changes requested by CSA · "+sub.public_project_code:"CSA quality review update · "+sub.public_project_code;
  const qcBody=status==="approved"?"Your video passed quality review and is ready for your review in the Client Dashboard.":status==="changes_requested"?"CSA has requested changes to this submission. Please check your assignment and upload a revised version.":"CSA could not approve this submission. Please contact CSA support for the next steps.";
  await Promise.all([notifyInApp(env,sub.client_id,"quality_review_"+status,qcTitle,qcBody,{project_id:sub.project_id,submission_id:qc[1],status}),notifyInApp(env,sub.editor_id,"quality_review_"+status,qcTitle,qcBody,{project_id:sub.project_id,submission_id:qc[1],status})]);
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
  if(env.ENVIRONMENT!=="staging"||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_")||!env.RAZORPAY_KEY_SECRET)return bad("Editor deposit refunds are restricted to Razorpay Test Mode on Staging.",503);
  const payment=await env.DB.prepare("SELECT p.id,p.user_id,p.project_id,p.offer_id,p.amount_minor,p.currency,p.provider_payment_id,p.status,pr.public_project_code,pr.title FROM payments p JOIN projects pr ON pr.id=p.project_id WHERE p.id=? AND p.payment_type='editor_security_deposit' AND p.provider='razorpay'").bind(refundMatch[1]).first();
  if(!payment)return bad("Security deposit payment not found.",404);
  if(payment.status!=="succeeded"||!payment.provider_payment_id)return bad("Only a captured and verified security deposit can be refunded.",409);
  const approved=await env.DB.prepare("SELECT s.id FROM assignments x JOIN work_submissions s ON s.assignment_id=x.id WHERE x.offer_id=? AND x.editor_id=? AND x.project_id=? AND s.qc_status='approved' ORDER BY s.submitted_at DESC LIMIT 1").bind(payment.offer_id,payment.user_id,payment.project_id).first();
  if(!approved)return bad("Refund is locked until CSA quality approval is recorded for this project.",409,"quality_approval_required");
  const auth="Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET);let verifyPayment,providerPayment;try{verifyPayment=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(payment.provider_payment_id),{headers:{Authorization:auth}});providerPayment=await verifyPayment.json().catch(()=>({}));}catch(e){return bad("Razorpay payment verification was interrupted. No deposit refund was sent.",502,"deposit_payment_verification_interrupted")}if(!verifyPayment.ok||providerPayment.id!==payment.provider_payment_id||providerPayment.status!=="captured"||Number(providerPayment.amount)!==Number(payment.amount_minor)||String(providerPayment.currency||"").toUpperCase()!==String(payment.currency||"").toUpperCase())return bad("Razorpay could not verify the captured deposit payment, amount and currency. No refund was sent.",409,"deposit_payment_verification_failed");
  const refundId=uid("rfd"),idempotencyKey=crypto.randomUUID();
  try{
   await env.DB.prepare("INSERT INTO editor_deposit_refunds(id,payment_id,editor_id,project_id,amount_minor,currency,idempotency_key,status,requested_by) VALUES(?,?,?,?,?,?,?,'requesting',?)").bind(refundId,payment.id,payment.user_id,payment.project_id,payment.amount_minor,payment.currency,idempotencyKey,a.id).run();
  }catch(e){return bad("A refund request already exists for this deposit. Check its status before taking any further action.",409,"refund_already_requested");}
  let response;
  try{
   response=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(payment.provider_payment_id)+"/refund",{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json","X-Refund-Idempotency":idempotencyKey},body:JSON.stringify({amount:payment.amount_minor,notes:{csa_project_code:payment.public_project_code,csa_payment_id:payment.id,csa_reason:"Security deposit refund after CSA quality approval"}})});
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
  await log(env,a.id,"editor_deposit_refund_initiated","deposit_refund",refundId,{payment_id:payment.id,provider_refund_id:payload.id,status:refundStatus});await notifyInApp(env,payment.user_id,"editor_deposit_refund_"+refundStatus,refundStatus==="processed"?"Security deposit refunded":"Security deposit refund initiated",refundStatus==="processed"?"Your security deposit refund has been processed.":"Your security deposit refund has been accepted by Razorpay and is awaiting completion.",{refund_id:refundId,payment_id:payment.id,provider_refund_id:payload.id,amount_minor:payment.amount_minor,currency:payment.currency});
  return out({ok:true,refund_id:refundId,provider_refund_id:payload.id,status:refundStatus,amount_minor:payment.amount_minor,currency:payment.currency});
 }
 const fileMatch=p.match(/^\/v1\/files\/([\w-]+)$/);
 if(m==="GET"&&fileMatch){
  if(!env.MEDIA&&!env.LEGACY_VIDEO_BUCKET)return bad("Private media storage is not configured.",503);
  const a=await user(req,env,["client","editor","admin","staff"]);
  let file=await env.DB.prepare("SELECT f.id,f.project_id,f.uploaded_by,f.r2_object_key,f.original_filename,f.mime_type,f.size_bytes,f.access_scope,p.client_id,'source' AS kind FROM project_files f JOIN projects p ON p.id=f.project_id WHERE f.id=?").bind(fileMatch[1]).first();
  if(!file)file=await env.DB.prepare("SELECT s.id,a.project_id,s.submitted_by AS uploaded_by,s.r2_object_key,s.original_filename,s.mime_type,s.size_bytes,'admin_only' AS access_scope,p.client_id,'submission' AS kind,s.qc_status,a.editor_id FROM work_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN projects p ON p.id=a.project_id WHERE s.id=?").bind(fileMatch[1]).first();
  if(!file)return bad("File not found.",404);
  if(a.role==="admin"&&!globalAdminCan(a,file.kind==="submission"?"content.manage":"projects.manage"))return bad("Your Global admin role cannot access this file type.",403);
  let allowed=a.role==="admin"||a.role==="staff"||a.id===file.client_id||a.id===file.uploaded_by;
  if(a.role==="editor"&&!allowed){const assignment=await env.DB.prepare("SELECT id FROM assignments WHERE project_id=? AND editor_id=? AND status IN ('active','submitted','quality_check','revision','approved','completed')").bind(file.project_id,a.id).first();allowed=!!assignment&&file.access_scope==="assigned_editor";}
  if(a.role==="client"&&file.kind==="submission")allowed=allowed&&file.qc_status==="approved";
  if(!allowed)return bad("You do not have permission to access this file.",403);
  const legacyObject=file.r2_object_key.startsWith("legacyvideo/");
  const object=legacyObject?await env.LEGACY_VIDEO_BUCKET?.get(file.r2_object_key.slice("legacyvideo/".length)):await env.MEDIA?.get(file.r2_object_key);if(!object)return bad("Stored object is missing.",404);
  return new Response(object.body,{status:200,headers:{"content-type":file.mime_type||"application/octet-stream","content-length":String(file.size_bytes||object.size||0),"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(file.original_filename||"download"),"x-content-type-options":"nosniff","cache-control":"private, no-store"}});
 }

 // Tender, editor bidding, Super Admin pricing and client quote lifecycle.
 if(m==="GET"&&p==="/v1/admin/pricing-policy"){
  const a=await user(req,env,["admin"]);if(a.source_role!=="super_admin")return bad("Only Super Admin can manage CSA pricing policy.",403);
  const r=await env.DB.prepare("SELECT currency,margin_bps,minimum_margin_minor,client_advance_bps,status,updated_at FROM csa_pricing_policies ORDER BY currency").all();return out({ok:true,policies:r.results||[]});
 }
 if(m==="POST"&&p==="/v1/admin/pricing-policy"){
  const a=await user(req,env,["admin"]);if(a.source_role!=="super_admin")return bad("Only Super Admin can change CSA pricing policy.",403);
  const b=await req.json(),currency=txt(b.currency,3).toUpperCase(),bps=b.margin_bps,min=amt(b.minimum_margin_minor??0),advance=b.client_advance_bps===undefined||b.client_advance_bps===null||b.client_advance_bps===""?null:Number(b.client_advance_bps);
  if(!/^[A-Z]{3}$/.test(currency)||!Number.isInteger(bps)||bps<0||bps>10000||min===null||(advance!==null&&(!Number.isInteger(advance)||advance<1||advance>10000)))return bad("Valid currency, markup basis points, minimum markup and optional advance percentage (1–100%) are required.");
  await env.DB.prepare("INSERT INTO csa_pricing_policies(currency,margin_bps,minimum_margin_minor,client_advance_bps,status,updated_by) VALUES(?,?,?,?,'active',?) ON CONFLICT(currency) DO UPDATE SET margin_bps=excluded.margin_bps,minimum_margin_minor=excluded.minimum_margin_minor,client_advance_bps=excluded.client_advance_bps,status='active',updated_by=excluded.updated_by,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(currency,bps,min,advance,a.id).run();
  await log(env,a.id,"csa_pricing_policy_updated","pricing_policy",currency,{margin_bps:bps,minimum_margin_minor:min,client_advance_bps:advance});return out({ok:true,currency,margin_bps:bps,minimum_margin_minor:min,client_advance_bps:advance,status:"active"});
 }
 if(m==="GET"&&p==="/v1/admin/tenders"){
  const a=await user(req,env,["admin"]);if(!a.source_admin_id)return bad("Department access is not configured.",403);
  const r=await env.DB.prepare("SELECT t.id,t.project_id,t.title,t.scope_summary,t.bid_deadline,t.status,t.published_at,p.public_project_code,p.title AS project_title,p.category,p.budget_currency,(SELECT COUNT(*) FROM editor_tender_bids b WHERE b.tender_id=t.id AND b.status IN ('submitted','shortlisted')) AS bid_count FROM project_tenders t JOIN projects p ON p.id=t.project_id WHERE EXISTS(SELECT 1 FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=p.id AND dr.route_key='tender' AND da.source_admin_id=?) ORDER BY t.created_at DESC LIMIT 100").bind(a.source_admin_id).all();
  return out({ok:true,tenders:r.results||[]});
 }
 const tenderDraft=p.match(/^\/v1\/admin\/projects\/([\w-]+)\/tender$/);
 if(m==="POST"&&tenderDraft){
  const a=await user(req,env,["admin"]),b=await req.json(),pr=await env.DB.prepare("SELECT id,title FROM projects WHERE id=?").bind(tenderDraft[1]).first();if(!pr)return bad("Application not found.",404);
  const access=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=? AND dr.route_key='tender' AND da.source_admin_id=?").bind(pr.id,a.source_admin_id).first();if(!access)return bad("Operations & Events tender access is required.",403);
  const title=txt(b.title,180)||pr.title,scope=txt(b.scope_summary,8000),deadline=txt(b.bid_deadline,40);
  if(!scope||!deadline||!Number.isFinite(Date.parse(deadline))||Date.parse(deadline)<=Date.now())return bad("Tender scope and future bid deadline are required.");
  const oldTender=await env.DB.prepare("SELECT id,status FROM project_tenders WHERE project_id=?").bind(pr.id).first();if(oldTender&&oldTender.status!=="draft")return bad("Only a draft tender can be edited.",409);
  const id=oldTender?.id||uid("tnd");
  await env.DB.prepare("INSERT INTO project_tenders(id,project_id,title,scope_summary,bid_deadline,status) VALUES(?,?,?,?,?,'draft') ON CONFLICT(project_id) DO UPDATE SET title=excluded.title,scope_summary=excluded.scope_summary,bid_deadline=excluded.bid_deadline,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(id,pr.id,title,scope,deadline).run();
  await log(env,a.id,"tender_draft_saved","tender",id,{project_id:pr.id});return out({ok:true,tender_id:id,status:"draft"},201);
 }
 const ta=p.match(/^\/v1\/admin\/tenders\/([\w-]+)\/(publish|close|award|quote)$/);
 if(ta){
  const a=await user(req,env,["admin"]),id=ta[1],action=ta[2],t=await env.DB.prepare("SELECT t.*,p.client_id,p.budget_currency FROM project_tenders t JOIN projects p ON p.id=t.project_id WHERE t.id=?").bind(id).first();if(!t)return bad("Tender not found.",404);
  const access=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=? AND dr.route_key='tender' AND da.source_admin_id=?").bind(t.project_id,a.source_admin_id).first();if(!access)return bad("Operations & Events department access is required.",403);
  if(action==="publish"){if(t.status!=="draft"||Date.parse(t.bid_deadline)<=Date.now())return bad("Only a draft tender with a future deadline can be published.",409);await env.DB.prepare("UPDATE project_tenders SET status='published',published_by=?,published_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='draft'").bind(a.id,id).run();await log(env,a.id,"tender_published","tender",id);return out({ok:true,status:"published"});}
  if(action==="close"){if(t.status!=="published")return bad("Only a published tender can be closed.",409);await env.DB.prepare("UPDATE project_tenders SET status='closed',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='published'").bind(id).run();await log(env,a.id,"tender_closed","tender",id);return out({ok:true,status:"closed"});}
  if(action==="award"){
   if(t.status!=="closed")return bad("Close the tender before awarding a bid.",409);const b=await req.json(),bid=await env.DB.prepare("SELECT id,editor_id,bid_amount_minor,currency,delivery_days FROM editor_tender_bids WHERE id=? AND tender_id=? AND status IN ('submitted','shortlisted')").bind(txt(b.bid_id,100),id).first();
   if(!bid)return bad("Selected bid is not eligible.",404);if(bid.currency!==t.budget_currency)return bad("Bid currency must match application currency.",409);const eligibleEditor=await env.DB.prepare("SELECT u.id FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.id=? AND u.role='editor' AND u.account_status='active' AND e.verification_status='verified' AND EXISTS(SELECT 1 FROM editor_kyc_documents k WHERE k.editor_id=u.id AND k.status='verified')").bind(bid.editor_id).first();if(!eligibleEditor)return bad("Only active editors with verified KYC can win a tender.",409,"editor_kyc_required");
   await env.DB.batch([env.DB.prepare("UPDATE editor_tender_bids SET status=CASE WHEN id=? THEN 'won' ELSE 'rejected' END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE tender_id=? AND status IN ('submitted','shortlisted')").bind(bid.id,id),env.DB.prepare("UPDATE project_tenders SET status='awarded',awarded_bid_id=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='closed'").bind(bid.id,id)]);
   await log(env,a.id,"tender_bid_awarded","tender",id,{bid_id:bid.id});return out({ok:true,status:"awarded",winning_bid:bid,next_step:"create_client_quote_and_send_managed_editor_offer"});
  }
  if(action==="quote"){
   if(t.status!=="awarded"||!t.awarded_bid_id)return bad("Award a bid before creating a client quote.",409);
   const policy=await env.DB.prepare("SELECT margin_bps,minimum_margin_minor,status FROM csa_pricing_policies WHERE currency=?").bind(t.budget_currency).first();if(!policy||policy.status!=="active"||policy.margin_bps===null)return bad("CSA pricing policy is not configured for "+t.budget_currency+". Super Admin must configure it first.",409,"pricing_policy_unconfigured");
   const bid=await env.DB.prepare("SELECT id,bid_amount_minor,currency FROM editor_tender_bids WHERE id=? AND status='won'").bind(t.awarded_bid_id).first();if(!bid||bid.currency!==t.budget_currency)return bad("Winning bid currency mismatch.",409);
   const markup=Math.max(Math.ceil(bid.bid_amount_minor*policy.margin_bps/10000),policy.minimum_margin_minor),total=bid.bid_amount_minor+markup,qid=uid("quo"),validUntil=new Date(Date.now()+7*86400000).toISOString();
   await env.DB.batch([env.DB.prepare("UPDATE client_quotes SET status='superseded',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE project_id=? AND status IN ('draft','sent')").bind(t.project_id),env.DB.prepare("INSERT INTO client_quotes(id,project_id,tender_id,winning_bid_id,client_id,base_cost_minor,margin_minor,total_amount_minor,currency,pricing_margin_bps,status,valid_until,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,'draft',?,?)").bind(qid,t.project_id,id,bid.id,t.client_id,bid.bid_amount_minor,markup,total,t.budget_currency,policy.margin_bps,validUntil,a.id),env.DB.prepare("INSERT INTO client_quote_events(id,quote_id,actor_user_id,event_type,details_json) VALUES(?,?,?,'created',?)").bind(uid("qev"),qid,a.id,JSON.stringify({margin_bps:policy.margin_bps,base_cost_minor:bid.bid_amount_minor,margin_minor:markup,total_amount_minor:total}))]);
   await log(env,a.id,"client_quote_created","client_quote",qid,{project_id:t.project_id});return out({ok:true,quote_id:qid,status:"draft",base_cost_minor:bid.bid_amount_minor,margin_minor:markup,total_amount_minor:total,currency:t.budget_currency,valid_until:validUntil});
  }
 }
 if(m==="POST"&&/^\/v1\/admin\/quotes\/[\w-]+\/send$/.test(p)){
  const a=await user(req,env,["admin"]),id=p.split("/")[4],q=await env.DB.prepare("SELECT id,status,project_id FROM client_quotes WHERE id=?").bind(id).first();if(!q||q.status!=="draft")return bad("Only a draft quote can be sent.",409);const access=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=? AND dr.route_key='tender' AND da.source_admin_id=?").bind(q.project_id,a.source_admin_id).first();if(!access)return bad("Tender department access is required to send this quote.",403);
  await env.DB.batch([env.DB.prepare("UPDATE client_quotes SET status='sent',sent_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id),env.DB.prepare("INSERT INTO client_quote_events(id,quote_id,actor_user_id,event_type) VALUES(?,?,?,'sent')").bind(uid("qev"),id,a.id)]);await log(env,a.id,"client_quote_sent","client_quote",id);return out({ok:true,status:"sent"});
 }
 if(m==="GET"&&p==="/v1/editor/tenders"){
  const a=await user(req,env,["editor"]),r=await env.DB.prepare("SELECT t.id,t.title,t.scope_summary,t.bid_deadline,p.public_project_code,p.category,p.budget_currency,p.preferred_deadline,p.priority FROM project_tenders t JOIN projects p ON p.id=t.project_id WHERE t.status='published' AND t.bid_deadline>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND NOT EXISTS(SELECT 1 FROM editor_tender_bids b WHERE b.tender_id=t.id AND b.editor_id=?) ORDER BY t.bid_deadline LIMIT 100").bind(a.id).all();return out({ok:true,tenders:r.results||[]});
 }
 const eb=p.match(/^\/v1\/editor\/tenders\/([\w-]+)\/bids$/);
 if(m==="POST"&&eb){
  const a=await user(req,env,["editor"]),b=await req.json(),t=await env.DB.prepare("SELECT t.id,t.project_id,t.status,t.bid_deadline,p.budget_currency FROM project_tenders t JOIN projects p ON p.id=t.project_id WHERE t.id=?").bind(eb[1]).first();
  if(!t||t.status!=="published"||Date.parse(t.bid_deadline)<=Date.now())return bad("Tender is not open for bidding.",409);
  const amount=amt(b.bid_amount_minor),currency=txt(b.currency,3).toUpperCase();if(!amount||currency!==t.budget_currency||!Number.isInteger(b.delivery_days)||b.delivery_days<1||b.delivery_days>365)return bad("Positive bid, matching currency and delivery days (1–365) are required.");
  const id=uid("bid");await env.DB.prepare("INSERT INTO editor_tender_bids(id,tender_id,project_id,editor_id,bid_amount_minor,currency,delivery_days,proposal) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tender_id,editor_id) DO UPDATE SET bid_amount_minor=excluded.bid_amount_minor,currency=excluded.currency,delivery_days=excluded.delivery_days,proposal=excluded.proposal,status='submitted',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(id,t.id,t.project_id,a.id,amount,currency,b.delivery_days,txt(b.proposal,3000)||null).run();await log(env,a.id,"editor_tender_bid_submitted","tender",t.id,{amount_minor:amount,currency});return out({ok:true,status:"submitted"});
 }
 if(m==="GET"&&p==="/v1/admin/tenders/bids"){
  const a=await user(req,env,["admin"]),tenderId=txt(new URL(req.url).searchParams.get("tender_id"),100);if(!tenderId)return bad("Tender ID is required.");
  const access=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=(SELECT project_id FROM project_tenders WHERE id=?) AND dr.route_key='tender' AND da.source_admin_id=?").bind(tenderId,a.source_admin_id).first();if(!access)return bad("Tender department access denied.",403);
  const r=await env.DB.prepare("SELECT b.id,b.editor_id,b.bid_amount_minor,b.currency,b.delivery_days,b.proposal,b.status,b.submitted_at,e.display_name,e.public_editor_code,e.country,e.languages_json,e.specializations_json FROM editor_tender_bids b JOIN editor_profiles e ON e.user_id=b.editor_id WHERE b.tender_id=? ORDER BY b.bid_amount_minor ASC,b.submitted_at ASC").bind(tenderId).all();return out({ok:true,bids:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/client/quotes"){
  const a=await user(req,env,["client"]),r=await env.DB.prepare("SELECT q.id,q.project_id,q.base_cost_minor,q.margin_minor,q.total_amount_minor,q.currency,q.status,q.payment_status,q.valid_until,q.created_at,q.sent_at,p.public_project_code,p.title,COALESCE(pol.client_advance_bps,0) AS client_advance_bps,COALESCE((SELECT SUM(pay.amount_minor) FROM payments pay WHERE pay.quote_id=q.id AND pay.payment_type IN ('client_advance','client_balance') AND pay.status='succeeded'),0) AS paid_amount_minor FROM client_quotes q JOIN projects p ON p.id=q.project_id LEFT JOIN csa_pricing_policies pol ON pol.currency=q.currency WHERE q.client_id=? AND q.status IN ('sent','accepted','rejected','expired') ORDER BY q.created_at DESC").bind(a.id).all();return out({ok:true,quotes:r.results||[]});
 }
 const qd=p.match(/^\/v1\/client\/quotes\/([\w-]+)\/decision$/);
 if(m==="POST"&&qd){
  const a=await user(req,env,["client"]),b=await req.json(),status=b.decision==="accept"?"accepted":b.decision==="reject"?"rejected":null;if(!status)return bad("Decision must be accept or reject.");
  const q=await env.DB.prepare("SELECT id,status,valid_until FROM client_quotes WHERE id=? AND client_id=?").bind(qd[1],a.id).first();if(!q||q.status!=="sent")return bad("Quote is not available for a decision.",404);
  if(q.valid_until&&Date.parse(q.valid_until)<=Date.now()){await env.DB.prepare("UPDATE client_quotes SET status='expired' WHERE id=?").bind(q.id).run();return bad("Quote has expired.",409);}
  await env.DB.batch([env.DB.prepare("UPDATE client_quotes SET status=?,client_decision_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='sent'").bind(status,q.id),env.DB.prepare("INSERT INTO client_quote_events(id,quote_id,actor_user_id,event_type) VALUES(?,?,?,?)").bind(uid("qev"),q.id,a.id,status)]);await log(env,a.id,"client_quote_"+status,"client_quote",q.id);return out({ok:true,status,next_step:status==="accepted"?"client_payment_checkout":"none"});
 }

 // Client quote checkout: staging is explicitly restricted to Razorpay Test Mode.
 const clientCheckout=p.match(/^\/v1\/client\/quotes\/([\w-]+)\/checkout$/);
 if(m==="POST"&&clientCheckout){
  const a=await user(req,env,["client"]),quote=await env.DB.prepare("SELECT id,project_id,total_amount_minor,currency,status,payment_status,valid_until FROM client_quotes WHERE id=? AND client_id=?").bind(clientCheckout[1],a.id).first();
  if(!quote||quote.status!=="accepted")return bad("Accept the client quotation before making payment.",409);
  if(quote.valid_until&&Date.parse(quote.valid_until)<=Date.now())return bad("This quotation has expired.",409);
  if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_"))return bad("Client checkout is locked until Razorpay Test Mode credentials are confirmed on the staging Worker.",503,"test_mode_required");
  const policy=await env.DB.prepare("SELECT client_advance_bps,status FROM csa_pricing_policies WHERE currency=?").bind(quote.currency).first();
  if(!policy||policy.status!=="active"||!Number.isInteger(policy.client_advance_bps))return bad("Client advance percentage is not configured by Super Admin for this currency.",409,"client_payment_policy_unconfigured");
  const paidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS paid FROM payments WHERE quote_id=? AND payment_type IN ('client_advance','client_balance') AND status='succeeded'").bind(quote.id).first(),paid=Number(paidRow?.paid||0),remaining=quote.total_amount_minor-paid;
  if(remaining<=0){await env.DB.prepare("UPDATE client_quotes SET payment_status='paid' WHERE id=?").bind(quote.id).run();return out({ok:true,already_paid:true,payment_status:"paid"});}
  const type=paid===0?"client_advance":"client_balance",amount=paid===0?Math.min(remaining,Math.max(1,Math.ceil(quote.total_amount_minor*policy.client_advance_bps/10000))):remaining;
  const prior=await env.DB.prepare("SELECT id,provider_order_id,amount_minor,currency FROM payments WHERE quote_id=? AND payment_type=? AND status IN ('created','pending') ORDER BY created_at DESC LIMIT 1").bind(quote.id,type).first();
  if(prior?.provider_order_id)return out({ok:true,key_id:env.RAZORPAY_KEY_ID,order_id:prior.provider_order_id,amount:prior.amount_minor,currency:prior.currency,payment_id:prior.id,payment_stage:type});
  const paymentId=uid("pay"),idem="client-quote:"+quote.id+":"+type+":"+crypto.randomUUID();
  const orderRes=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET),"content-type":"application/json"},body:JSON.stringify({amount,currency:quote.currency,receipt:paymentId.slice(0,40),notes:{quote_id:quote.id,project_id:quote.project_id,payment_type:type}})});
  const order=await orderRes.json().catch(()=>({}));
  if(!orderRes.ok||!order.id||order.amount!==amount||String(order.currency).toUpperCase()!==quote.currency)return bad("Razorpay test order creation failed or amount/currency mismatch.",502,"razorpay_order_failed");
  await env.DB.prepare("INSERT INTO payments(id,user_id,project_id,offer_id,payment_type,amount_minor,currency,provider,provider_order_id,idempotency_key,status,quote_id) VALUES(?,?,?,NULL,?,?,?,'razorpay',?,?,'created',?)").bind(paymentId,a.id,quote.project_id,type,amount,quote.currency,order.id,idem,quote.id).run();
  await log(env,a.id,"client_quote_payment_order_created","payment",paymentId,{quote_id:quote.id,payment_type:type,amount_minor:amount});
  return out({ok:true,key_id:env.RAZORPAY_KEY_ID,order_id:order.id,amount:order.amount,currency:order.currency,payment_id:paymentId,payment_stage:type,checkout_name:"CSA Global",description:type==="client_advance"?"Client quotation advance":"Client quotation balance"},201);
 }
 if(m==="POST"&&p==="/v1/client/payments/razorpay/verify"){
  const a=await user(req,env,["client"]),b=await req.json(),orderId=txt(b.razorpay_order_id,100),paymentId=txt(b.razorpay_payment_id,100),signature=txt(b.razorpay_signature,200);
  if(!orderId||!paymentId||!signature||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"))return bad("Test-mode payment verification details are missing.",503);
  const record=await env.DB.prepare("SELECT * FROM payments WHERE provider_order_id=? AND user_id=? AND quote_id IS NOT NULL AND payment_type IN ('client_advance','client_balance')").bind(orderId,a.id).first();if(!record)return bad("Payment order does not belong to this client.",404);
  const expected=await hmacHex(env.RAZORPAY_KEY_SECRET,orderId+"|"+paymentId);if(!constantTime(expected,signature))return bad("Razorpay payment signature did not match.",400,"signature_invalid");
  const pr=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET)}}),payment=await pr.json().catch(()=>({}));
  if(!pr.ok||payment.order_id!==orderId||payment.amount!==record.amount_minor||String(payment.currency||"").toUpperCase()!==record.currency||payment.status!=="captured")return bad("Razorpay has not confirmed the captured client payment. Quote remains unpaid/partial.",409,"payment_not_captured");
  await env.DB.prepare("UPDATE payments SET provider_payment_id=?,status='succeeded',verified_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status!='succeeded'").bind(paymentId,record.id).run();
  const paidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS paid FROM payments WHERE quote_id=? AND payment_type IN ('client_advance','client_balance') AND status='succeeded'").bind(record.quote_id).first(),quote=await env.DB.prepare("SELECT total_amount_minor FROM client_quotes WHERE id=? AND client_id=?").bind(record.quote_id,a.id).first();
  if(!quote)return bad("Client quotation record not found.",404);
  const paymentStatus=Number(paidRow?.paid||0)>=quote.total_amount_minor?"paid":"partial";
  await env.DB.prepare("UPDATE client_quotes SET payment_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(paymentStatus,record.quote_id).run();
  await log(env,a.id,"client_quote_payment_verified","payment",record.id,{quote_id:record.quote_id,payment_type:record.payment_type,payment_status:paymentStatus});
  return out({ok:true,status:"captured",payment_status:paymentStatus,paid_minor:Number(paidRow?.paid||0),total_minor:quote.total_amount_minor});
 }
 if(m==="POST"&&p==="/v1/projects"){
  const a=await user(req,env,["client"]),b=await req.json(),title=txt(b.title,180),cat=txt(b.category,80),brief=txt(b.brief,12000),budget=amt(b.budget_amount_minor),cur=txt(b.budget_currency,3).toUpperCase();
  const rawReq=b.requirements&&typeof b.requirements==="object"&&!Array.isArray(b.requirements)?b.requirements:{};
  const requirements={
   communication_language:txt(rawReq.communication_language,40),
   source_language:txt(rawReq.source_language,40),
   output_language:txt(rawReq.output_language,40),
   subtitle_languages:txt(rawReq.subtitle_languages,200),
   client_country:txt(rawReq.client_country,100),
   client_region:txt(rawReq.client_region,100),
   client_city:txt(rawReq.client_city,100),
   project_mode:txt(rawReq.project_mode,20),
   project_location:txt(rawReq.project_location,300),
   client_timezone:txt(rawReq.client_timezone,80),
   contact_name:txt(rawReq.contact_name,100),
   contact_phone:txt(rawReq.contact_phone,30),
   content_style:txt(rawReq.content_style,100),
   dialect:txt(rawReq.dialect,100),
   service_package:txt(rawReq.service_package,100),
   project_type:txt(rawReq.project_type,120),
   raw_footage_duration:txt(rawReq.raw_footage_duration,80)
  };
  if(!requirements.communication_language||!requirements.source_language||!requirements.output_language||!requirements.client_country||!requirements.client_city||!["remote","onsite","hybrid"].includes(requirements.project_mode))return bad("Communication language, source language, output language, country, city and project mode are required.");

  const recommendBudget=b.budget_type==="recommend";
  if(!title||!cat||!brief||(!budget&&!recommendBudget)||!/^[A-Z]{3}$/.test(cur))return bad("Project title, category, brief, and a valid ISO currency are required. A budget is optional when you select Recommend a budget.");
  const pid=uid("prj"),code="CSA-"+new Date().getUTCFullYear()+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.DB.prepare("INSERT INTO projects(id,public_project_code,client_id,title,category,brief,raw_footage_minutes,final_duration_minutes,video_count,resolution,aspect_ratio,requirements_json,reference_url,budget_amount_minor,budget_currency,budget_type,preferred_deadline,priority,revisions_included,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted')").bind(pid,code,a.id,title,cat,brief,Number.isInteger(b.raw_footage_minutes)?b.raw_footage_minutes:null,Number.isInteger(b.final_duration_minutes)?b.final_duration_minutes:null,Number.isInteger(b.video_count)?b.video_count:null,txt(b.resolution,20)||null,txt(b.aspect_ratio,20)||null,JSON.stringify(requirements),txt(b.reference_url,1000)||null,budget,cur,["fixed","flexible","recommend"].includes(b.budget_type)?b.budget_type:"fixed",txt(b.preferred_deadline,40)||null,["normal","urgent","flexible"].includes(b.priority)?b.priority:"normal",Number.isInteger(b.revisions_included)?Math.max(0,Math.min(10,b.revisions_included)):2).run();
  await env.DB.prepare("UPDATE client_profiles SET country=?,preferred_language=? WHERE user_id=?").bind(requirements.client_country,requirements.communication_language,a.id).run();
  await log(env,a.id,"project_submitted","project",pid);
  return out({ok:true,project_id:pid,project_code:code,status:"submitted"},201);
 }
 if(m==="GET"&&p==="/v1/editor/agreements"){
  await user(req,env,["editor"]);
  const r=await env.DB.prepare("SELECT id,version,title,body_markdown FROM agreement_versions WHERE agreement_type='project_specific' AND active=1 ORDER BY created_at DESC").all();
  return out({ok:true,agreements:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/editor/offers"){
  const a=await user(req,env,["editor"]),r=await env.DB.prepare("SELECT o.id,o.offer_message,o.proposed_fee_minor,o.fee_currency,o.delivery_days,o.deposit_amount_minor,o.deposit_currency,o.offer_expires_at,o.status,p.public_project_code,p.title,p.category,p.brief,p.requirements_json,p.preferred_deadline,p.revisions_included FROM project_offers o JOIN projects p ON p.id=o.project_id WHERE o.editor_id=? AND o.status IN ('offered','accepted_pending_terms','terms_accepted_pending_deposit','deposit_pending','ready_for_assignment','assigned') ORDER BY o.created_at DESC").bind(a.id).all();
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
  const a=await user(req,env,["admin"]),offerId=p.split("/")[4],o=await env.DB.prepare("SELECT o.id,o.project_id,o.editor_id,o.delivery_days,o.status,e.verification_status,u.account_status,EXISTS(SELECT 1 FROM editor_kyc_documents k WHERE k.editor_id=o.editor_id AND k.status='verified') AS kyc_verified,EXISTS(SELECT 1 FROM agreement_acceptances aa WHERE aa.offer_id=o.id AND aa.user_id=o.editor_id) AS terms_accepted,EXISTS(SELECT 1 FROM payments pay WHERE pay.offer_id=o.id AND pay.user_id=o.editor_id AND pay.payment_type='editor_security_deposit' AND pay.status='succeeded' AND pay.provider_payment_id IS NOT NULL) AS deposit_verified FROM project_offers o JOIN users u ON u.id=o.editor_id AND u.role='editor' JOIN editor_profiles e ON e.user_id=o.editor_id WHERE o.id=?").bind(offerId).first();
  if(!o||o.status!=="ready_for_assignment")return bad("Offer is not paid and ready for assignment.",409);
  if(o.account_status!=="active"||o.verification_status!=="verified"||!o.kyc_verified)return bad("Editor must remain active with verified profile and KYC before assignment.",409,"editor_verification_required");
  if(!o.terms_accepted||!o.deposit_verified)return bad("Accepted project agreement and captured security deposit are required before assignment.",409,"offer_requirements_incomplete");
  const departmentAccess=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=? AND dr.route_key='tender' AND da.source_admin_id=?").bind(o.project_id,a.source_admin_id).first();
  if(!departmentAccess)return bad("Tender department access is required to confirm project assignment.",403);
  const due=new Date(Date.now()+o.delivery_days*86400000).toISOString(),assignmentId=uid("asn");
  try{
   await env.DB.batch([
    env.DB.prepare("INSERT INTO assignments(id,project_id,offer_id,editor_id,assigned_by,due_at,status) SELECT ?,?,?,?,?,?,'active' WHERE EXISTS(SELECT 1 FROM project_offers WHERE id=? AND status='ready_for_assignment') AND NOT EXISTS(SELECT 1 FROM assignments WHERE offer_id=?)").bind(assignmentId,o.project_id,o.id,o.editor_id,a.id,due,o.id,o.id),
    env.DB.prepare("UPDATE project_offers SET status='assigned' WHERE id=? AND status='ready_for_assignment' AND EXISTS(SELECT 1 FROM assignments WHERE offer_id=?)").bind(o.id,o.id),
    env.DB.prepare("UPDATE projects SET status='assigned',client_visible_status='in_progress',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND EXISTS(SELECT 1 FROM assignments WHERE offer_id=?)").bind(o.project_id,o.id)
   ]);
  }catch(error){
   const message=String(error?.message||error);
   if(/UNIQUE constraint failed: assignments\.offer_id/i.test(message))return bad("This offer already has an assignment. Refresh the dashboard to see its current status.",409,"assignment_already_exists");
   throw error;
  }
  const created=await env.DB.prepare("SELECT id,due_at FROM assignments WHERE offer_id=?").bind(o.id).first();
  if(!created)return bad("Assignment could not be created. Refresh and retry only after checking the offer status.",409,"assignment_not_created");
  await log(env,a.id,"project_assignment_confirmed","assignment",created.id,{project_id:o.project_id,offer_id:o.id});
  return out({ok:true,assignment_id:created.id,status:"assigned",due_at:created.due_at},201);
 }
 if(m==="POST"&&p.startsWith("/v1/offers/")&&p.endsWith("/deposit/checkout")){
  const offerId=p.split("/")[3],a=await user(req,env,["editor"]);
  if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_"))return bad("Razorpay Test Mode credentials are required on the staging Worker.",503,"test_mode_required");
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
  if(!orderId||!paymentId||!signature||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_"))return bad("Test-mode payment verification details are missing.",503,"test_mode_required");
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

   const payment=await env.DB.prepare("SELECT * FROM payments WHERE provider='razorpay' AND provider_payment_id=?").bind(refundEntity.payment_id).first();
   if(!payment)return out({ok:true,ignored:true});
   if(["client_advance","client_balance"].includes(payment.payment_type)){
    const noteRequestId=refundEntity.notes?.csa_refund_request_id||"";
    const refund=await env.DB.prepare("SELECT id,amount_minor,currency,provider_refund_id,status FROM client_refund_requests WHERE payment_id=? AND (provider_refund_id=? OR id=?) ORDER BY created_at DESC LIMIT 1").bind(payment.id,refundEntity.id,noteRequestId).first();
    if(!refund)return out({ok:true,ignored:true,reason:"No matching CSA client refund request."});
    try{await env.DB.prepare("INSERT INTO payment_webhook_events(id,provider,event_id,event_type,payment_id,payload_json) VALUES(?, 'razorpay',?,?,?,?)").bind(uid("evt"),eventId,event,payment.id,JSON.stringify({event,refund_id:refundEntity.id,payment_id:refundEntity.payment_id,amount:refundEntity.amount??null,currency:refundEntity.currency??null})).run();}
    catch(e){if(String(e.message||"").includes("UNIQUE"))return out({ok:true,duplicate:true});throw e;}
    const valid=Number(refundEntity.amount)===Number(refund.amount_minor)&&String(refundEntity.currency||"").toUpperCase()===String(refund.currency||"").toUpperCase()&&(!refund.provider_refund_id||refund.provider_refund_id===refundEntity.id);
    if(!valid){
     await env.DB.prepare("UPDATE client_refund_requests SET status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status!='processed'").bind(JSON.stringify({event,refund_id:refundEntity.id,amount:refundEntity.amount??null,currency:refundEntity.currency??null}).slice(0,3000),refund.id).run();
     await log(env,payment.user_id,"client_refund_unknown","client_refund",refund.id,{provider_refund_id:refundEntity.id});
     return out({ok:true,processed:false,refund_status:"unknown",reason:"Refund webhook amount, currency or provider reference mismatch."});
    }
    if(["processed","failed","rejected","cancelled"].includes(refund.status))return out({ok:true,duplicate:true,terminal:true});
    const next=event==="refund.processed"?"processed":event==="refund.failed"?"failed":event==="refund.created"?"processing":refund.status;
    if(next!==refund.status)await env.DB.prepare("UPDATE client_refund_requests SET provider_refund_id=COALESCE(provider_refund_id,?),status=?,provider_response_json=?,processed_at=CASE WHEN ?='processed' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE processed_at END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status NOT IN ('processed','failed','rejected','cancelled')").bind(refundEntity.id,next,JSON.stringify({event,refund_id:refundEntity.id,amount:refundEntity.amount,currency:refundEntity.currency}).slice(0,3000),next,refund.id).run();
    if(next!==refund.status){
     const title=next==="processed"?"Refund completed":next==="failed"?"Refund failed": "Refund processing update";
     const body=next==="processed"?"Your refund has been processed by the payment provider.":next==="failed"?"The payment provider could not complete your refund. Please contact CSA Finance if you need help.":"Your refund is now being processed by the payment provider.";
     await notifyInApp(env,payment.user_id,"client_refund_provider_"+next,title,body,{refund_id:refund.id,provider_refund_id:refundEntity.id,amount_minor:refund.amount,currency:refund.currency});
    }
    if(next==="processed"){
     const totals=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM client_refund_requests WHERE payment_id=? AND status='processed'").bind(payment.id).first();
     await env.DB.prepare("UPDATE payments SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(Number(totals?.total||0)>=Number(payment.amount_minor)?"refunded":"partially_refunded",payment.id).run();
    }
    await log(env,payment.user_id,"client_refund_"+next,"client_refund",refund.id,{provider_refund_id:refundEntity.id,amount_minor:refundEntity.amount,currency:refundEntity.currency});
    return out({ok:true,processed:true,refund_status:next});
   }
   if(payment.payment_type!=="editor_security_deposit")return out({ok:true,ignored:true});

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
   const status=event==="refund.processed"?"processed":event==="refund.failed"?"failed":"pending";if(["processed","failed"].includes(refund.status)&&refund.status!==status){await log(env,payment.user_id,"editor_deposit_refund_terminal_event_ignored","deposit_refund",payment.id,{stored_status:refund.status,incoming_status:status,provider_refund_id:refundEntity.id});return out({ok:true,ignored:true,reason:"terminal_refund_state"});}
   await env.DB.prepare("UPDATE editor_deposit_refunds SET provider_refund_id=COALESCE(provider_refund_id,?),status=?,provider_response=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE payment_id=?").bind(refundEntity.id,status,JSON.stringify({event,refund_id:refundEntity.id,amount:refundEntity.amount,currency:refundEntity.currency}).slice(0,3000),payment.id).run();
   if(status==="processed"){
    const existing=await env.DB.prepare("SELECT id FROM deposit_ledger WHERE payment_id=? AND entry_type='deposit_refunded' LIMIT 1").bind(payment.id).first();
    if(!existing)await env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by,created_by_admin_id) VALUES(?,?,?,?,?,'deposit_refunded',?,?,?,NULL,NULL)").bind(uid("dep"),payment.user_id,payment.project_id,payment.offer_id,payment.id,payment.amount_minor,payment.currency,"Full Razorpay refund processed: "+refundEntity.id).run();
    await env.DB.prepare("UPDATE payments SET status='refunded',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payment.id).run();
   }
   if(refund.status!==status){const title=status==="processed"?"Security deposit refund completed":status==="failed"?"Security deposit refund failed":"Security deposit refund pending";const message=status==="processed"?"Razorpay confirms your security deposit refund is complete.":status==="failed"?"Razorpay confirms the security deposit refund failed. Please contact CSA Finance.":"Razorpay confirms your security deposit refund is still pending.";await notifyInApp(env,payment.user_id,"editor_deposit_refund_"+status,title,message,{refund_id:refund.id,provider_refund_id:refundEntity.id,amount_minor:refundEntity.amount,currency:refundEntity.currency});}await log(env,payment.user_id,"editor_deposit_refund_"+status,"deposit_refund",payment.id,{provider_refund_id:refundEntity.id,amount_minor:refundEntity.amount,currency:refundEntity.currency});
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
   if(!pid||entity.status!=="captured"||entity.amount!==record.amount_minor||String(entity.currency||"").toUpperCase()!==String(record.currency||"").toUpperCase())return bad("Captured webhook amount or currency mismatch.",409);
   await env.DB.prepare("UPDATE payments SET provider_payment_id=COALESCE(provider_payment_id,?),status='succeeded',verified_at=COALESCE(verified_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(pid,record.id).run();
   if(record.payment_type==="editor_security_deposit"){
    await env.DB.batch([
     env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_received',?,?,?,?)").bind(uid("dep"),record.user_id,record.project_id,record.offer_id,record.id,record.amount_minor,record.currency,"Razorpay webhook captured payment",record.user_id),
     env.DB.prepare("INSERT OR IGNORE INTO deposit_ledger(id,editor_id,project_id,offer_id,payment_id,entry_type,amount_minor,currency,notes,created_by) VALUES(?,?,?,?,?,'deposit_locked',?,?,?,?)").bind(uid("dep"),record.user_id,record.project_id,record.offer_id,record.id,record.amount_minor,record.currency,"Locked to project pending CSA release/refund decision",record.user_id),
     env.DB.prepare("UPDATE project_offers SET status='ready_for_assignment' WHERE id=? AND status='deposit_pending'").bind(record.offer_id)
    ]);
   }else if(record.quote_id&&["client_advance","client_balance"].includes(record.payment_type)){
    const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM payments WHERE quote_id=? AND payment_type IN ('client_advance','client_balance') AND status='succeeded'").bind(record.quote_id).first(),quote=await env.DB.prepare("SELECT total_amount_minor FROM client_quotes WHERE id=?").bind(record.quote_id).first();
    if(quote)await env.DB.prepare("UPDATE client_quotes SET payment_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(Number(paid?.total||0)>=quote.total_amount_minor?"paid":"partial",record.quote_id).run();
   }
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
 if(m==="GET"&&p==="/v1/admin/departments"){
  const a=await user(req,env,["admin"]);
  const r=await env.DB.prepare("SELECT d.id,d.name,d.status,x.access_level FROM global_admin_department_access x JOIN global_departments d ON d.id=x.department_id WHERE x.source_admin_id=? AND d.status='active' ORDER BY d.name").bind(a.source_admin_id).all();
  return out({ok:true,departments:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/projects"){
  const a=await user(req,env,["admin"]);
  if(!a.source_admin_id)return bad("Department access is not configured for this admin.",403,"department_access_missing");
  const r=await env.DB.prepare("SELECT p.id,p.public_project_code,p.title,p.category,p.brief,p.requirements_json,p.budget_amount_minor,p.budget_currency,p.budget_type,p.preferred_deadline,p.priority,p.status,p.department_id,GROUP_CONCAT(DISTINCT d.name) AS department_names,GROUP_CONCAT(DISTINCT dr.route_key) AS department_routes,p.created_at FROM projects p JOIN project_department_routes dr ON dr.project_id=p.id JOIN global_departments d ON d.id=dr.department_id WHERE dr.department_id IN (SELECT department_id FROM global_admin_department_access WHERE source_admin_id=?) AND p.status IN ('submitted','under_review','approved','matching','assigned','in_progress','quality_check','client_review','revision') GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100").bind(a.source_admin_id).all();
  return out({ok:true,projects:r.results||[]});
 }
 const kycPreview=p.match(/^\/v1\/admin\/editors\/([\w-]+)\/kyc-preview$/);
 if(m==="GET"&&kycPreview){
  const a=await user(req,env,["admin"]);const doc=await env.DB.prepare("SELECT id,r2_object_key,mime_type FROM editor_kyc_documents WHERE editor_id=? ORDER BY created_at DESC LIMIT 1").bind(kycPreview[1]).first();
  if(!doc)return bad("KYC document not found.",404);await log(env,a.id,"editor_kyc_document_previewed","editor_kyc",doc.id,{editor_id:kycPreview[1]});const object=await env.MEDIA.get(doc.r2_object_key);if(!object)return bad("KYC document is missing from private storage.",404);
  return new Response(object.body,{headers:{"content-type":doc.mime_type,"content-disposition":"inline","cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"}});
 }
 if(m==="GET"&&p==="/v1/admin/editors/kyc/pending"){
  await user(req,env,["admin"]);const r=await env.DB.prepare("SELECT d.id,d.editor_id,d.document_type,d.mime_type,d.size_bytes,d.status,d.consent_version,d.consented_at,d.created_at,u.email,e.display_name,e.legal_name,e.public_editor_code,e.country,e.city FROM editor_kyc_documents d JOIN users u ON u.id=d.editor_id JOIN editor_profiles e ON e.user_id=d.editor_id WHERE d.status IN ('pending','in_review') ORDER BY d.created_at ASC LIMIT 100").all();
  return out({ok:true,documents:r.results||[]});
 }
 const kycReview=p.match(/^\/v1\/admin\/editors\/([\w-]+)\/kyc-review$/);
 if(m==="POST"&&kycReview){
  const a=await user(req,env,["admin"]),b=await req.json(),status=txt(b.status,20),note=txt(b.note,1000);
  if(!["verified","rejected"].includes(status))return bad("KYC status must be verified or rejected.");if(status==="rejected"&&!note)return bad("A rejection reason is required.");
  const doc=await env.DB.prepare("SELECT id FROM editor_kyc_documents WHERE editor_id=? AND status IN ('pending','in_review') ORDER BY created_at DESC LIMIT 1").bind(kycReview[1]).first();
  if(!doc)return bad("No pending KYC document was found.",404);
  await env.DB.prepare("UPDATE editor_kyc_documents SET status=?,reviewed_by=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),review_note=? WHERE id=?").bind(status,a.id,note||null,doc.id).run();
  await log(env,a.id,"editor_kyc_reviewed","editor_kyc",doc.id,{editor_id:kycReview[1],status,note});return out({ok:true,status});
 }
 if(m==="GET"&&p==="/v1/admin/editors/verified"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT u.id,u.account_status,e.public_editor_code,e.display_name,e.country,e.city,e.languages_json,e.specializations_json FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.role='editor' AND u.account_status='active' AND e.verification_status='verified' AND EXISTS(SELECT 1 FROM editor_kyc_documents k WHERE k.editor_id=u.id AND k.status='verified') ORDER BY e.display_name LIMIT 300").all();
  return out({ok:true,editors:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/editors/pending"){
  await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT u.id,u.email,e.public_editor_code,e.display_name,e.legal_name,e.country,e.country_code,e.state,e.district,e.city,e.village,e.postal_code,e.address_line,e.specializations_json,e.software_json,e.portfolio_url,e.verification_status,e.created_at,COALESCE((SELECT k.status FROM editor_kyc_documents k WHERE k.editor_id=u.id ORDER BY k.created_at DESC LIMIT 1),'not_submitted') AS kyc_status FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE e.verification_status IN ('pending','in_review') ORDER BY e.created_at ASC LIMIT 100").all();
  return out({ok:true,editors:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/offers/ready"){
  const a=await user(req,env,["admin","staff"]);
  const r=await env.DB.prepare("SELECT o.id,o.project_id,o.editor_id,o.proposed_fee_minor,o.fee_currency,o.delivery_days,o.deposit_amount_minor,o.deposit_currency,o.status,p.public_project_code,p.title,e.public_editor_code,e.display_name FROM project_offers o JOIN projects p ON p.id=o.project_id JOIN editor_profiles e ON e.user_id=o.editor_id WHERE o.status='ready_for_assignment' AND (? IS NULL OR EXISTS(SELECT 1 FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=p.id AND dr.route_key='tender' AND da.source_admin_id=?)) ORDER BY o.created_at ASC LIMIT 100").bind(a.source_admin_id||null,a.source_admin_id||null).all();
  return out({ok:true,offers:r.results||[]});
 }
 if(m==="GET"&&p==="/v1/admin/overview"){
  await user(req,env,["admin","staff"]);
  const q=await env.DB.batch([env.DB.prepare("SELECT COUNT(*) n FROM projects WHERE status IN ('submitted','under_review','matching')"),env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='editor' AND account_status='pending'"),env.DB.prepare("SELECT COUNT(*) n FROM assignments WHERE status IN ('active','submitted','quality_check','revision')"),env.DB.prepare("SELECT COUNT(*) n FROM project_disputes WHERE status IN ('open','under_review')")]);
  return out({ok:true,metrics:{projects_to_review:q[0].results[0].n,editors_pending:q[1].results[0].n,active_assignments:q[2].results[0].n,open_disputes:q[3].results[0].n}});
 }
 const ev=p.match(/^\/v1\/admin\/editors\/([\w-]+)\/verify$/);
 if(m==="POST"&&ev){
  const a=await user(req,env,["admin"]),b=await req.json();if(!["verified","rejected","in_review"].includes(b.status))return bad("Invalid verification status.");if(b.status==="verified"){const k=await env.DB.prepare("SELECT id FROM editor_kyc_documents WHERE editor_id=? AND status='verified' ORDER BY reviewed_at DESC LIMIT 1").bind(ev[1]).first();if(!k)return bad("Editor KYC must be verified before profile approval.",409,"kyc_required");}
  await env.DB.prepare("UPDATE editor_profiles SET verification_status=? WHERE user_id=?").bind(b.status,ev[1]).run();
  if(b.status==="verified")await env.DB.prepare("UPDATE users SET account_status='pending' WHERE id=? AND role='editor'").bind(ev[1]).run();
  if(b.status==="rejected")await env.DB.prepare("UPDATE users SET account_status='suspended' WHERE id=? AND role='editor'").bind(ev[1]).run();
  await log(env,a.id,"editor_verification_updated","editor",ev[1],{status:b.status});return out({ok:true,status:b.status});
 }
 const cred=p.match(/^\/v1\/admin\/editors\/([\w-]+)\/credentials$/);
 if(m==="POST"&&cred){
 const a=await user(req,env,["admin"]),ed=await env.DB.prepare("SELECT u.id,e.public_editor_code,e.verification_status FROM users u JOIN editor_profiles e ON e.user_id=u.id WHERE u.id=? AND u.role='editor'").bind(cred[1]).first();if(!ed||ed.verification_status!=="verified")return bad("Verify editor before issuing credentials.",409);
 const username=ed.public_editor_code.toUpperCase(),raw=crypto.getRandomValues(new Uint8Array(24)),temporaryPassword=btoa(String.fromCharCode(...raw)).replace(/\\+/g,"R").replace(/\//g,"S").replace(/=+$/,"")+"d8!",salt=crypto.getRandomValues(new Uint8Array(16)),km=await crypto.subtle.importKey("raw",new TextEncoder().encode(temporaryPassword),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:310000},km,256),salt64=btoa(String.fromCharCode(...salt)),hash=[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
 await env.DB.batch([env.DB.prepare("INSERT INTO editor_credentials(user_id,username,password_salt,password_hash,must_change_password,created_by) VALUES(?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,password_salt=excluded.password_salt,password_hash=excluded.password_hash,must_change_password=1,failed_attempts=0,locked_until=NULL,created_by=excluded.created_by,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(ed.id,username,salt64,hash,a.id),env.DB.prepare("UPDATE users SET account_status='active' WHERE id=?").bind(ed.id),env.DB.prepare("DELETE FROM editor_sessions WHERE user_id=?").bind(ed.id)]);
 await log(env,a.id,"editor_credentials_issued","editor",ed.id,{username,must_change_password:true});return out({ok:true,username,temporary_password:temporaryPassword,must_change_password:true,one_time_display:true},201);
 }
 const of=p.match(/^\/v1\/admin\/projects\/([\w-]+)\/offers$/);
 if(m==="POST"&&of){
  const a=await user(req,env,["admin"]),b=await req.json(),ed=await env.DB.prepare("SELECT e.user_id FROM editor_profiles e JOIN users u ON u.id=e.user_id WHERE e.user_id=? AND e.verification_status='verified' AND u.account_status='active' AND EXISTS(SELECT 1 FROM editor_kyc_documents k WHERE k.editor_id=u.id AND k.status='verified')").bind(b.editor_id).first();
  if(!ed)return bad("Only verified editors can receive offers.",409);
  const fee=amt(b.proposed_fee_minor),dep=amt(b.deposit_amount_minor),cur=txt(b.fee_currency,3).toUpperCase(),dc=txt(b.deposit_currency,3).toUpperCase();
  if(!fee||!dep||!/^[A-Z]{3}$/.test(cur)||!/^[A-Z]{3}$/.test(dc)||!Number.isInteger(b.delivery_days)||b.delivery_days<1)return bad("Valid fee, deposit, currency and delivery days are required.");
  const pr=await env.DB.prepare("SELECT id,status FROM projects WHERE id=?").bind(of[1]).first();if(!pr||!["submitted","under_review","approved","matching"].includes(pr.status))return bad("Project is not ready for matching.",409);const departmentAccess=await env.DB.prepare("SELECT 1 AS ok FROM project_department_routes dr JOIN global_admin_department_access da ON da.department_id=dr.department_id WHERE dr.project_id=? AND dr.route_key='tender' AND da.source_admin_id=?").bind(pr.id,a.source_admin_id).first();if(!departmentAccess)return bad("Tender department access is required to send a managed editor offer.",403);
  const existingOffer=await env.DB.prepare("SELECT id,status FROM project_offers WHERE project_id=? AND editor_id=? AND status IN ('offered','accepted_pending_terms','terms_accepted_pending_deposit','deposit_pending','ready_for_assignment','assigned') LIMIT 1").bind(pr.id,ed.user_id).first();if(existingOffer)return bad("An active offer already exists for this editor and project.",409,"active_offer_exists");const oid=uid("off");await env.DB.prepare("INSERT INTO project_offers(id,project_id,editor_id,offer_message,proposed_fee_minor,fee_currency,delivery_days,deposit_amount_minor,deposit_currency,offer_expires_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,'offered')").bind(oid,pr.id,ed.user_id,txt(b.offer_message,2000)||null,fee,cur,b.delivery_days,dep,dc,txt(b.offer_expires_at,40)||null).run();
  await env.DB.prepare("UPDATE projects SET status='matching',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(pr.id).run();await log(env,a.id,"project_offer_created","offer",oid,{project_id:pr.id,editor_id:ed.user_id});return out({ok:true,offer_id:oid,status:"offered"},201);
 }

 // In-app notifications and channel preferences. Email/WhatsApp are preference-only until providers are configured.
 if(m==="GET"&&p==="/v1/notifications"){
  const a=await user(req,env,["client","admin","editor"]),r=await env.DB.prepare("SELECT id,channel,template_key,payload_json,status,created_at FROM notifications WHERE user_id=? AND channel='in_app' ORDER BY created_at DESC LIMIT 100").bind(a.id).all();
  const notifications=(r.results||[]).map(n=>{let payload={};try{payload=JSON.parse(n.payload_json||"{}");}catch{}return {id:n.id,title:txt(payload.title,180),body:txt(payload.body,4000),message:txt(payload.body,4000),created_at:n.created_at,read_at:n.status==="read"?n.created_at:null,status:n.status};});
  return out({ok:true,notifications});
 }
 if(m==="POST"&&/^\/v1\/notifications\/[\w-]+\/read$/.test(p)){
  const a=await user(req,env,["client","admin","editor"]),id=p.split("/")[3],r=await env.DB.prepare("UPDATE notifications SET status='read' WHERE id=? AND user_id=? AND channel='in_app' AND status!='read'").bind(id,a.id).run();
  if(!r.meta?.changes){const exists=await env.DB.prepare("SELECT id FROM notifications WHERE id=? AND user_id=? AND channel='in_app'").bind(id,a.id).first();if(!exists)return bad("Notification not found.",404);}
  return out({ok:true,read:true});
 }
 if((m==="GET"||m==="PUT")&&p==="/v1/notifications/preferences"){
  const a=await user(req,env,["client","admin","editor"]);
  await env.DB.prepare("INSERT OR IGNORE INTO notification_preferences(user_id) VALUES(?)").bind(a.id).run();
  if(m==="GET"){
   const preferences=await env.DB.prepare("SELECT in_app_enabled,email_enabled,whatsapp_enabled,updated_at FROM notification_preferences WHERE user_id=?").bind(a.id).first();
   return out({ok:true,preferences});
  }
  const b=await req.json(),keys=["in_app_enabled","email_enabled","whatsapp_enabled"];
  if(keys.some(k=>typeof b[k]!=="boolean"))return bad("All notification preference values must be true or false.");
  await env.DB.prepare("UPDATE notification_preferences SET in_app_enabled=?,email_enabled=?,whatsapp_enabled=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=?").bind(b.in_app_enabled?1:0,b.email_enabled?1:0,b.whatsapp_enabled?1:0,a.id).run();
  await log(env,a.id,"notification_preferences_updated","notification_preferences",a.id,{whatsapp_opt_in:b.whatsapp_enabled});
  return out({ok:true,saved:true,preferences:{in_app_enabled:b.in_app_enabled?1:0,email_enabled:b.email_enabled?1:0,whatsapp_enabled:b.whatsapp_enabled?1:0}});
 }
 if(m==="POST"&&p==="/v1/admin/notifications"){
  const a=await user(req,env,["admin"]),b=await req.json(),recipient=txt(b.user_id,100),type=txt(b.type,60)||"admin_notice",title=txt(b.title,180),body=txt(b.body,4000);
  if(!recipient||!title||!body)return bad("Recipient, title and message are required.");
  const target=await env.DB.prepare("SELECT id,role,account_status FROM users WHERE id=?").bind(recipient).first();
  if(!target||target.account_status!=="active"||!["client","editor"].includes(target.role))return bad("Active client or editor recipient not found.",404);
  const pref=await env.DB.prepare("SELECT in_app_enabled FROM notification_preferences WHERE user_id=?").bind(recipient).first();
  if(pref&&Number(pref.in_app_enabled)===0)return bad("Recipient has disabled in-app notifications.",409,"notifications_disabled");
  const id=uid("ntf");
  await env.DB.prepare("INSERT INTO notifications(id,user_id,channel,template_key,payload_json,status,sent_at) VALUES(?,?,'in_app',?,?,'sent',strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(id,recipient,type,JSON.stringify({title,body,source:"csa_admin"})).run();
  await log(env,a.id,"in_app_notification_sent","notification",id,{recipient_user_id:recipient,type});
  return out({ok:true,notification_id:id,channel:"in_app",status:"sent"},201);
 }
 const clientRefundDetail=p.match(/^\/v1\/client\/refunds\/([\w-]+)$/);
 if(m==="GET"&&clientRefundDetail){
  const a=await user(req,env,["client"]);
  const refund=await env.DB.prepare("SELECT id,payment_id,project_id,amount_minor,currency,reason,status,review_note,created_at,updated_at,processed_at FROM client_refund_requests WHERE id=? AND client_id=?").bind(clientRefundDetail[1],a.id).first();
  if(!refund)return bad("Refund request not found.",404);
  const events=await env.DB.prepare("SELECT action,metadata_json,created_at FROM audit_logs WHERE entity_type='client_refund' AND entity_id=? ORDER BY created_at ASC LIMIT 50").bind(refund.id).all();
  return out({ok:true,refund,history:(events.results||[]).map(x=>({action:x.action,metadata:JSON.parse(x.metadata_json||"{}"),created_at:x.created_at}))});
 }
 if(m==="GET"&&p==="/v1/client/refunds"){
  const a=await user(req,env,["client"]),r=await env.DB.prepare("SELECT id,payment_id,project_id,amount_minor,currency,reason,status,review_note,created_at,updated_at,processed_at FROM client_refund_requests WHERE client_id=? ORDER BY created_at DESC LIMIT 100").bind(a.id).all();
  return out({ok:true,refunds:r.results||[]});
 }
 if(m==="POST"&&p==="/v1/client/refunds"){
  const a=await user(req,env,["client"]),b=await req.json(),paymentId=txt(b.payment_id,100),amount=amt(b.amount_minor),currency=txt(b.currency,3).toUpperCase(),reason=txt(b.reason,2000),key=txt(req.headers.get("Idempotency-Key")||b.idempotency_key,120);
  if(!paymentId||!amount||amount<1||!/^[A-Z]{3}$/.test(currency)||reason.length<5||!key||!/^[A-Za-z0-9._:-]{8,120}$/.test(key))return bad("Payment, positive amount, currency, reason and a valid Idempotency-Key are required.");
  const prior=await env.DB.prepare("SELECT id,payment_id,client_id,amount_minor,currency,status FROM client_refund_requests WHERE idempotency_key=?").bind(key).first();
  if(prior){if(prior.payment_id!==paymentId||prior.client_id!==a.id)return bad("Idempotency key was already used for another request.",409);return out({ok:true,refund:prior,replayed:true});}
  const payment=await env.DB.prepare("SELECT id,user_id,project_id,amount_minor,currency,payment_type,status FROM payments WHERE id=? AND user_id=?").bind(paymentId,a.id).first();
  if(!payment||!["client_advance","client_balance"].includes(payment.payment_type))return bad("Eligible CSA client payment not found.",404);
  if(payment.status!=="succeeded"&&payment.status!=="partially_refunded")return bad("Only successful payments can be submitted for refund.",409);
  if(String(payment.currency).toUpperCase()!==currency)return bad("Refund currency must match the original payment.",409);
  const id=uid("crf");
  try{
   // The refundable-balance test and insert are one SQL statement, preventing concurrent requests from reserving more than the paid amount.
   const inserted=await env.DB.prepare("INSERT INTO client_refund_requests(id,payment_id,client_id,project_id,amount_minor,currency,reason,status,idempotency_key,requested_by) SELECT ?,p.id,?,p.project_id,?,?,?,'requested',?,? FROM payments p WHERE p.id=? AND p.user_id=? AND p.payment_type IN ('client_advance','client_balance') AND p.status IN ('succeeded','partially_refunded') AND UPPER(p.currency)=? AND ? <= p.amount_minor-COALESCE((SELECT SUM(r.amount_minor) FROM client_refund_requests r WHERE r.payment_id=p.id AND r.status NOT IN ('rejected','failed','cancelled')),0) RETURNING id").bind(id,a.id,amount,currency,reason,key,a.id,paymentId,a.id,currency,amount).first();
   if(!inserted)return bad("Refund amount exceeds the remaining refundable balance or payment is no longer eligible.",409,"refund_amount_exceeded");
  }catch(e){if(String(e.message||"").includes("UNIQUE")){const duplicate=await env.DB.prepare("SELECT id,payment_id,client_id,amount_minor,currency,status FROM client_refund_requests WHERE idempotency_key=?").bind(key).first();if(duplicate){if(duplicate.client_id!==a.id||duplicate.payment_id!==paymentId)return bad("Idempotency key was already used for another request.",409);return out({ok:true,refund:duplicate,replayed:true});}}throw e;}
  await log(env,a.id,"client_refund_requested","client_refund",id,{payment_id:paymentId,amount_minor:amount,currency});
  return out({ok:true,refund:{id,payment_id:paymentId,amount_minor:amount,currency,status:"requested"}},201);
 }
 const adminClientRefundDetail=p.match(/^\/v1\/admin\/client-refunds\/([\w-]+)$/);
 if(m==="GET"&&adminClientRefundDetail){
  const a=await user(req,env,["admin"]);
  const refund=await env.DB.prepare("SELECT r.id,r.payment_id,r.client_id,r.project_id,r.amount_minor,r.currency,r.reason,r.status,r.review_note,r.reviewed_by,r.provider_refund_id,r.provider_response_json,r.created_at,r.updated_at,r.processed_at,u.email AS client_email,p.provider,p.provider_payment_id,p.status AS payment_status,p.amount_minor AS payment_amount_minor,p.currency AS payment_currency FROM client_refund_requests r JOIN users u ON u.id=r.client_id JOIN payments p ON p.id=r.payment_id WHERE r.id=?").bind(adminClientRefundDetail[1]).first();
  if(!refund)return bad("Client refund request not found.",404);
  const events=await env.DB.prepare("SELECT actor_user_id,action,metadata_json,created_at FROM audit_logs WHERE entity_type='client_refund' AND entity_id=? ORDER BY created_at ASC LIMIT 100").bind(refund.id).all();
  return out({ok:true,refund,history:(events.results||[]).map(x=>({actor_user_id:x.actor_user_id,action:x.action,metadata:JSON.parse(x.metadata_json||"{}"),created_at:x.created_at}))});
 }
 if(m==="GET"&&p==="/v1/admin/client-refunds"){
  const a=await user(req,env,["admin"]);
  const allowed=["requested","under_review","approved","processing","unknown","processed","failed","rejected","cancelled"];
  const status=txt(u.searchParams.get("status"),30),search=txt(u.searchParams.get("q"),120);
  if(status&&!allowed.includes(status))return bad("Unsupported refund status filter.");
  const pageRaw=Number(u.searchParams.get("page")||1),limitRaw=Number(u.searchParams.get("limit")||50);
  const page=Number.isSafeInteger(pageRaw)&&pageRaw>0?Math.min(pageRaw,100000):1;
  const limit=Number.isSafeInteger(limitRaw)&&limitRaw>0?Math.min(limitRaw,100):50;
  const where=[],binds=[];
  if(status){where.push("r.status=?");binds.push(status);}
  if(search){where.push("(LOWER(u.email) LIKE LOWER(?) OR LOWER(r.id) LIKE LOWER(?) OR LOWER(r.payment_id) LIKE LOWER(?))");const term="%"+search+"%";binds.push(term,term,term);}
  const clause=where.length?" WHERE "+where.join(" AND "):"";
  const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM client_refund_requests r JOIN users u ON u.id=r.client_id"+clause).bind(...binds).first();
  const offset=(page-1)*limit;
  const rows=await env.DB.prepare("SELECT r.id,r.payment_id,r.client_id,r.project_id,r.amount_minor,r.currency,r.reason,r.status,r.review_note,r.reviewed_by,r.provider_refund_id,r.created_at,r.updated_at,r.processed_at,u.email AS client_email FROM client_refund_requests r JOIN users u ON u.id=r.client_id"+clause+" ORDER BY CASE r.status WHEN 'requested' THEN 0 WHEN 'under_review' THEN 1 WHEN 'approved' THEN 2 WHEN 'processing' THEN 3 WHEN 'unknown' THEN 4 ELSE 5 END,r.created_at ASC LIMIT ? OFFSET ?").bind(...binds,limit,offset).all();
  await log(env,a.id,"finance_client_refund_queue_viewed","finance_refund_queue","all",{status:status||null,search:search||null,page,limit});
  const total=Number(count?.total||0);
  return out({ok:true,refunds:rows.results||[],pagination:{page,limit,total,total_pages:Math.ceil(total/limit),has_next:offset+limit<total,has_previous:page>1}});
 }
 const clientRefundReview=p.match(/^\/v1\/admin\/client-refunds\/([\w-]+)$/);
 if(m==="PATCH"&&clientRefundReview){
  const a=await user(req,env,["admin"]),b=await req.json(),action=txt(b.action,30),note=txt(b.review_note,1000);
  const transitions={under_review:"under_review",approve:"approved",reject:"rejected"};
  if(!Object.prototype.hasOwnProperty.call(transitions,action))return bad("Action must be under_review, approve or reject.");
  if(action==="reject"&&note.length<3)return bad("A rejection reason is required.");
  const current=await env.DB.prepare("SELECT id,status,client_id,amount_minor,currency FROM client_refund_requests WHERE id=?").bind(clientRefundReview[1]).first();
  if(!current)return bad("Client refund request not found.",404);
  if(!["requested","under_review"].includes(current.status))return bad("This refund request has already been decided.",409);
  const next=transitions[action];
  const updated=await env.DB.prepare("UPDATE client_refund_requests SET status=?,reviewed_by=?,review_note=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status IN ('requested','under_review')").bind(next,a.id,note||null,current.id).run();
  // Compare-and-set: if another reviewer decided this request first, do not report a false success or write a misleading audit event.
  if(!updated.meta?.changes)return bad("This refund request was updated by another reviewer. Refresh the queue and try again.",409,"refund_review_conflict");
  await log(env,a.id,"client_refund_"+next,"client_refund",current.id,{action,review_note:note||null,provider_refund_started:false});
  const clientTitle=action==="approve"?"Refund request approved":action==="reject"?"Refund request declined":"Refund request under review";
  const clientBody=action==="approve"?"Your refund request has been approved and is awaiting processing.":action==="reject"?"Your refund request was declined. Reason: "+note:"Your refund request is now being reviewed by CSA Finance.";
  await notifyInApp(env,current.client_id,"client_refund_"+next,clientTitle,clientBody,{refund_id:current.id,amount_minor:current.amount_minor,currency:current.currency});
  return out({ok:true,status:next,provider_refund_started:false,client_notified:true});
 }


 const clientRefundProcess=p.match(/^\/v1\/admin\/client-refunds\/([\w-]+)\/process$/);
 if(m==="POST"&&clientRefundProcess){
  const a=await user(req,env,["admin"]);
  if(env.ENVIRONMENT!=="staging"||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_KEY_ID.startsWith("rzp_test_"))return bad("Client refund processing is restricted to Razorpay Test Mode on Staging.",503);
  const refund=await env.DB.prepare("SELECT r.*,p.provider_payment_id,p.amount_minor AS payment_amount_minor,p.currency AS payment_currency,p.status AS payment_status,p.provider,p.payment_type FROM client_refund_requests r JOIN payments p ON p.id=r.payment_id WHERE r.id=?").bind(clientRefundProcess[1]).first();
  if(!refund)return bad("Client refund request not found.",404);
  if(!["approved","unknown"].includes(refund.status))return bad("Only approved or safely retryable unknown refunds can be processed.",409);
  if(refund.provider!=="razorpay"||!refund.provider_payment_id||!["client_advance","client_balance"].includes(refund.payment_type))return bad("Original Razorpay client payment is not eligible.",409);
  if(!["succeeded","partially_refunded"].includes(refund.payment_status))return bad("Original payment is not in a refundable captured state.",409);
  const idempotencyKey=("csa_refund_"+refund.id).replace(/[^A-Za-z0-9_-]/g,"").slice(0,36);
  const lock=await env.DB.prepare("UPDATE client_refund_requests SET status='processing',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status IN ('approved','unknown')").bind(refund.id).run();
  if(!lock.meta?.changes)return bad("Refund is already processing or its status changed. Refresh the queue.",409);
  const auth="Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET);
  let providerPayment,verify;
  try{
   verify=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(refund.provider_payment_id),{headers:{Authorization:auth}});
   providerPayment=await verify.json().catch(()=>({}));
  }catch(e){
   await env.DB.prepare("UPDATE client_refund_requests SET status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(JSON.stringify({stage:"payment_verification",error:txt(String(e),1000)}),refund.id).run();
   return bad("Payment verification was interrupted. No refund was sent.",502);
  }
  if(!verify.ok||providerPayment.id!==refund.provider_payment_id||providerPayment.status!=="captured"||Number(providerPayment.amount)!==Number(refund.payment_amount_minor)||String(providerPayment.currency||"").toUpperCase()!==String(refund.payment_currency||"").toUpperCase()){
   await env.DB.prepare("UPDATE client_refund_requests SET status='approved',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(JSON.stringify({stage:"payment_verification",http_status:verify.status,response:providerPayment}).slice(0,3000),refund.id).run();
   return bad("Razorpay could not verify captured payment, amount and currency. No refund was sent.",409);
  }
  let response,payload;
  try{
   response=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(refund.provider_payment_id)+"/refund",{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json","X-Refund-Idempotency":idempotencyKey},body:JSON.stringify({amount:Number(refund.amount_minor),notes:{csa_refund_request_id:refund.id,csa_payment_id:refund.payment_id,csa_source:"CSA Global"}})});
   payload=await response.json().catch(()=>({}));
  }catch(e){
   await env.DB.prepare("UPDATE client_refund_requests SET status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(JSON.stringify({stage:"refund_request",error:txt(String(e),1000),idempotency_key:idempotencyKey}),refund.id).run();
   await log(env,a.id,"client_refund_unknown","client_refund",refund.id,{payment_id:refund.payment_id});
   return bad("Razorpay response was interrupted. Refund state is unknown; retry this same request to reuse its idempotency key.",502,"refund_status_unknown");
  }
  if(!response.ok||!payload.id){
   const uncertain=response.status===409||response.status>=500,next=uncertain?"unknown":"failed";
   await env.DB.prepare("UPDATE client_refund_requests SET status=?,provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='processing'").bind(next,JSON.stringify({http_status:response.status,response:payload,idempotency_key:idempotencyKey}).slice(0,3000),refund.id).run();
   await log(env,a.id,"client_refund_"+next,"client_refund",refund.id,{payment_id:refund.payment_id,http_status:response.status});
   return bad(uncertain?"Razorpay reports an uncertain or in-progress request. Reconcile before retrying.":"Razorpay rejected the refund request; review the provider response.",502,"refund_provider_response");
  }
  if(payload.payment_id!==refund.provider_payment_id||Number(payload.amount)!==Number(refund.amount_minor)||String(payload.currency||"").toUpperCase()!==String(refund.currency||"").toUpperCase()){
   await env.DB.prepare("UPDATE client_refund_requests SET provider_refund_id=?,status='unknown',provider_response_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(payload.id,JSON.stringify({reason:"Provider response mismatch",payment_id:payload.payment_id??null,amount:payload.amount??null,currency:payload.currency??null}).slice(0,3000),refund.id).run();
   await log(env,a.id,"client_refund_unknown","client_refund",refund.id,{provider_refund_id:payload.id});
   return bad("Razorpay response mismatch. Refund status is unknown and needs reconciliation.",502,"refund_response_mismatch");
  }
  const next=payload.status==="processed"?"processed":payload.status==="failed"?"failed":"processing";
  await env.DB.prepare("UPDATE client_refund_requests SET provider_refund_id=?,status=?,provider_response_json=?,processed_at=CASE WHEN ?='processed' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE processed_at END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status NOT IN ('processed','failed','rejected','cancelled')").bind(payload.id,next,JSON.stringify(payload).slice(0,3000),next,refund.id).run();
  const finalRefund=await env.DB.prepare("SELECT status FROM client_refund_requests WHERE id=?").bind(refund.id).first();
  const finalStatus=finalRefund?.status||next;
  if(finalStatus==="processed"){
   const totals=await env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM client_refund_requests WHERE payment_id=? AND status='processed'").bind(refund.payment_id).first();
   await env.DB.prepare("UPDATE payments SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(Number(totals?.total||0)>=Number(refund.payment_amount_minor)?"refunded":"partially_refunded",refund.payment_id).run();
  }
  await log(env,a.id,"client_refund_"+finalStatus,"client_refund",refund.id,{payment_id:refund.payment_id,provider_refund_id:payload.id,amount_minor:refund.amount_minor,currency:refund.currency});
  return out({ok:true,refund_id:refund.id,provider_refund_id:payload.id,status:finalStatus,amount_minor:refund.amount_minor,currency:refund.currency});
 }

 // Read-only finance views. Monetary values are stored and returned in the currency's minor unit.
 if(m==="GET"&&p==="/v1/client/balance"){
  const a=await user(req,env,["client"]);
  const q=await env.DB.prepare("SELECT q.id AS quote_id,q.project_id,q.total_amount_minor,q.currency,q.status AS quote_status,q.payment_status,COALESCE(SUM(CASE WHEN p.status='succeeded' AND p.payment_type IN ('client_advance','client_balance') THEN p.amount_minor ELSE 0 END),0) AS paid_minor FROM client_quotes q LEFT JOIN payments p ON p.quote_id=q.id WHERE q.client_id=? GROUP BY q.id ORDER BY q.created_at DESC LIMIT 100").bind(a.id).all();
  const quotes=(q.results||[]).map(x=>({...x,total_amount_minor:Number(x.total_amount_minor||0),paid_minor:Number(x.paid_minor||0),balance_minor:Math.max(0,Number(x.total_amount_minor||0)-Number(x.paid_minor||0))}));
  return out({ok:true,quotes,summary:{quotes:quotes.length,total_minor:quotes.reduce((n,x)=>n+x.total_amount_minor,0),paid_minor:quotes.reduce((n,x)=>n+x.paid_minor,0),balance_minor:quotes.reduce((n,x)=>n+x.balance_minor,0)}});
 }
 if(m==="GET"&&p==="/v1/editor/payouts"){
  const a=await user(req,env,["editor"]);
  const q=await env.DB.prepare("SELECT o.id AS offer_id,o.project_id,o.proposed_fee_minor AS gross_fee_minor,o.fee_currency AS currency,o.status AS offer_status,x.status AS assignment_status,CASE WHEN EXISTS(SELECT 1 FROM work_submissions s WHERE s.assignment_id=x.id AND s.qc_status='approved') THEN 1 ELSE 0 END AS qc_approved,ep.id AS payout_id,ep.status AS ledger_status,ep.payment_reference,ep.paid_at FROM project_offers o JOIN assignments x ON x.offer_id=o.id AND x.editor_id=o.editor_id LEFT JOIN editor_payouts ep ON ep.offer_id=o.id WHERE o.editor_id=? AND o.status='accepted' ORDER BY o.created_at DESC LIMIT 100").bind(a.id).all();
  const offers=(q.results||[]).map(x=>({...x,gross_fee_minor:Number(x.gross_fee_minor||0),payout_status:x.ledger_status||(Number(x.qc_approved)===1?"eligible_for_finance_review":"awaiting_quality_approval")}));
  return out({ok:true,payouts:offers,summary:{assignments:offers.length,eligible_gross_minor:offers.filter(x=>Number(x.qc_approved)===1).reduce((n,x)=>n+x.gross_fee_minor,0),awaiting_qc_minor:offers.filter(x=>Number(x.qc_approved)!==1).reduce((n,x)=>n+x.gross_fee_minor,0),currency:offers[0]?.currency||"INR",note:"Payout ledger status is shown here. Bank transfers remain manual; only Finance may record a paid transfer with its reference."}});
 }
 if(m==="GET"&&p==="/v1/admin/finance/editor-payouts"){
  const a=await user(req,env,["admin"]);
  const q=await env.DB.prepare("SELECT ep.id,ep.offer_id,ep.project_id,ep.editor_id,ep.amount_minor,ep.currency,ep.status,ep.created_at,ep.approved_at,ep.paid_at,ep.payment_reference,ep.note,ep.approved_by,ep.paid_by,COALESCE(e.display_name,u.email) AS editor_name,u.email AS editor_email FROM editor_payouts ep JOIN users u ON u.id=ep.editor_id LEFT JOIN editor_profiles e ON e.user_id=ep.editor_id ORDER BY CASE ep.status WHEN 'pending_approval' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,ep.created_at DESC LIMIT 200").all();
  const rows=q.results||[];
  return out({ok:true,payouts:rows,summary:{count:rows.length,pending_approval:rows.filter(x=>x.status==="pending_approval").length,approved:rows.filter(x=>x.status==="approved").length,paid:rows.filter(x=>x.status==="paid").length,total_minor:rows.reduce((n,x)=>n+Number(x.amount_minor||0),0)},note:"Read-only finance queue. No bank transfer is initiated by this API."});
 }
 if(m==="POST"&&p==="/v1/admin/finance/editor-payouts"){
  const a=await user(req,env,["admin"]);
  let body={};try{body=await req.json();}catch{return bad("A valid JSON body is required.",400,"invalid_json");}
  const offerId=String(body.offer_id||"").trim();
  if(!/^[A-Za-z0-9_-]{4,100}$/.test(offerId))return bad("A valid accepted offer_id is required.",400,"invalid_offer_id");
  const existing=await env.DB.prepare("SELECT * FROM editor_payouts WHERE offer_id=?").bind(offerId).first();
  if(existing)return out({ok:true,payout:existing,created:false,idempotent:true});
  const eligible=await env.DB.prepare("SELECT o.id AS offer_id,o.project_id,o.editor_id,o.proposed_fee_minor AS amount_minor,o.fee_currency AS currency FROM project_offers o JOIN assignments x ON x.offer_id=o.id AND x.editor_id=o.editor_id WHERE o.id=? AND o.status='accepted' AND o.proposed_fee_minor>0 AND EXISTS(SELECT 1 FROM work_submissions s WHERE s.assignment_id=x.id AND s.qc_status='approved') LIMIT 1").bind(offerId).first();
  if(!eligible)return bad("Payout can be created only for an accepted offer with QC-approved work and a positive fee.",409,"not_payout_eligible");
  const id=uid("payout");
  await env.DB.prepare("INSERT INTO editor_payouts(id,offer_id,project_id,editor_id,amount_minor,currency,status,created_by) VALUES(?,?,?,?,?,?,'pending_approval',?)").bind(id,eligible.offer_id,eligible.project_id,eligible.editor_id,eligible.amount_minor,eligible.currency,a.id).run();
  await log(env,a.id,"editor_payout_created","editor_payout",id,{offer_id:offerId,amount_minor:eligible.amount_minor,currency:eligible.currency});
  await notifyInApp(env,eligible.editor_id,"editor_payout_pending","Payout entered finance review","Your QC-approved work has been added to the Finance payout queue.",{payout_id:id,amount_minor:eligible.amount_minor,currency:eligible.currency});
  const payout=await env.DB.prepare("SELECT * FROM editor_payouts WHERE id=?").bind(id).first();
  return out({ok:true,payout,created:true},201);
 }
 const payoutAction=p.match(/^\/v1\/admin\/finance\/editor-payouts\/([\w-]+)\/(approve|mark-paid)$/);
 if(m==="POST"&&payoutAction){
  const a=await user(req,env,["admin"]);
  const payoutId=payoutAction[1],action=payoutAction[2];
  let body={};try{body=await req.json();}catch{return bad("A valid JSON body is required.",400,"invalid_json");}
  const current=await env.DB.prepare("SELECT * FROM editor_payouts WHERE id=?").bind(payoutId).first();
  if(!current)return bad("Payout record not found.",404,"payout_not_found");
  if(action==="approve"){
   if(current.status==="approved"||current.status==="paid")return out({ok:true,payout:current,idempotent:true});
   if(current.status!=="pending_approval")return bad("Only pending payouts can be approved.",409,"invalid_payout_state");
   await env.DB.prepare("UPDATE editor_payouts SET status='approved',approved_by=?,approved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),note=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='pending_approval'").bind(a.id,body.note?String(body.note).slice(0,500):null,payoutId).run();
   await log(env,a.id,"editor_payout_approved","editor_payout",payoutId,{amount_minor:current.amount_minor,currency:current.currency});
   await notifyInApp(env,current.editor_id,"editor_payout_approved","Payout approved","Your payout has been approved and is awaiting payment confirmation.",{payout_id:payoutId,amount_minor:current.amount_minor,currency:current.currency});
  }else{
   const reference=String(body.payment_reference||"").trim();
   if(reference.length<3||reference.length>120)return bad("Enter the actual bank/UPI transfer reference (3–120 characters).",400,"payment_reference_required");
   if(current.status==="paid")return out({ok:true,payout:current,idempotent:true});
   if(current.status!=="approved")return bad("Only Finance-approved payouts can be marked paid.",409,"payout_not_approved");
   await env.DB.prepare("UPDATE editor_payouts SET status='paid',paid_by=?,paid_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),payment_reference=?,note=COALESCE(?,note),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='approved'").bind(a.id,reference,body.note?String(body.note).slice(0,500):null,payoutId).run();
   await log(env,a.id,"editor_payout_marked_paid","editor_payout",payoutId,{amount_minor:current.amount_minor,currency:current.currency,payment_reference:reference});
   await notifyInApp(env,current.editor_id,"editor_payout_paid","Payout marked paid","Finance has recorded your payout as paid.",{payout_id:payoutId,amount_minor:current.amount_minor,currency:current.currency,payment_reference:reference});
  }
  const updated=await env.DB.prepare("SELECT * FROM editor_payouts WHERE id=?").bind(payoutId).first();
  return out({ok:true,payout:updated,transfer_initiated:false,note:"This records Finance approval/payment confirmation only. It does not initiate a bank or Razorpay transfer."});
 }
 if(m==="GET"&&p==="/v1/admin/finance/refund-dashboard"){
  const a=await user(req,env,["admin"]);
  const results=await env.DB.batch([
   env.DB.prepare("SELECT status,currency,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor FROM client_refund_requests GROUP BY status,currency ORDER BY currency,status"),
   env.DB.prepare("SELECT currency,COUNT(*) AS total_requests,COALESCE(SUM(amount_minor),0) AS total_amount_minor,COALESCE(SUM(CASE WHEN status='processed' THEN amount_minor ELSE 0 END),0) AS processed_amount_minor,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN amount_minor ELSE 0 END),0) AS pending_amount_minor,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN 1 ELSE 0 END),0) AS pending_records,COALESCE(SUM(CASE WHEN status IN ('failed','unknown') THEN 1 ELSE 0 END),0) AS attention_records FROM client_refund_requests GROUP BY currency ORDER BY currency"),
   env.DB.prepare("SELECT COUNT(*) AS total_records,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN 1 ELSE 0 END),0) AS pending_records,COALESCE(SUM(CASE WHEN status='processed' THEN 1 ELSE 0 END),0) AS processed_records,COALESCE(SUM(CASE WHEN status IN ('failed','unknown') THEN 1 ELSE 0 END),0) AS attention_records FROM client_refund_requests"),
   env.DB.prepare("SELECT r.id,r.payment_id,r.client_id,r.project_id,r.amount_minor,r.currency,r.reason,r.status,r.review_note,r.provider_refund_id,r.created_at,r.updated_at,u.email AS client_email FROM client_refund_requests r JOIN users u ON u.id=r.client_id ORDER BY CASE r.status WHEN 'requested' THEN 0 WHEN 'under_review' THEN 1 WHEN 'approved' THEN 2 WHEN 'processing' THEN 3 WHEN 'unknown' THEN 4 WHEN 'failed' THEN 5 ELSE 6 END,r.created_at DESC LIMIT 10")
  ]);
  const rows=results.map(x=>x.results||[]);
  await log(env,a.id,"finance_refund_dashboard_viewed","finance","refund_dashboard",{});
  return out({ok:true,dashboard:{status_and_currency:rows[0],currency_totals:rows[1],record_counts:rows[2][0]||{total_records:0,pending_records:0,processed_records:0,attention_records:0},priority_queue:rows[3]},meta:{queue_limit:10,amount_unit:"minor currency units",pending_statuses:["requested","under_review","approved","processing","unknown"],attention_statuses:["failed","unknown"],read_only:true},note:"Unified read-only refund dashboard data. Currency totals are not combined; no refund or transfer is initiated."});
 }
 if(m==="GET"&&p==="/v1/admin/finance/refund-summary"){
  const a=await user(req,env,["admin"]);
  const results=await env.DB.batch([
   env.DB.prepare("SELECT status,currency,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor FROM client_refund_requests GROUP BY status,currency ORDER BY currency,status"),
   env.DB.prepare("SELECT currency,COUNT(*) AS total_requests,COALESCE(SUM(amount_minor),0) AS total_amount_minor,COALESCE(SUM(CASE WHEN status='processed' THEN amount_minor ELSE 0 END),0) AS processed_amount_minor,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN amount_minor ELSE 0 END),0) AS pending_amount_minor,COALESCE(SUM(CASE WHEN status IN ('requested','under_review','approved','processing','unknown') THEN 1 ELSE 0 END),0) AS pending_records,COALESCE(SUM(CASE WHEN status IN ('failed','unknown') THEN 1 ELSE 0 END),0) AS attention_records FROM client_refund_requests GROUP BY currency ORDER BY currency"),
   env.DB.prepare("SELECT status,COUNT(*) AS records FROM client_refund_requests GROUP BY status ORDER BY status")
  ]);
  const rows=results.map(x=>x.results||[]);
  await log(env,a.id,"finance_refund_summary_viewed","finance","refund_summary",{});
  return out({ok:true,client_refunds:{by_status_and_currency:rows[0],totals_by_currency:rows[1],status_counts:rows[2]},definitions:{pending_statuses:["requested","under_review","approved","processing","unknown"],processed_status:"processed",attention_statuses:["failed","unknown"],amount_unit:"minor currency units"},read_only:true,note:"Client refund summary only. Currency totals are kept separate. No refund, transfer, or payment mutation is initiated."});
 }
 if(m==="GET"&&p==="/v1/admin/finance/reconciliation"){
  const a=await user(req,env,["admin"]);
  const results=await env.DB.batch([
   env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM client_refund_requests GROUP BY status,currency ORDER BY status"),
   env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM editor_deposit_refunds GROUP BY status,currency ORDER BY status"),
   env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM editor_payouts GROUP BY status,currency ORDER BY status"),
   env.DB.prepare("SELECT status,COUNT(*) AS records,COALESCE(SUM(amount_minor),0) AS amount_minor,currency FROM payments GROUP BY status,currency ORDER BY status"),
   env.DB.prepare("SELECT COUNT(*) AS events FROM payment_webhook_events"),
   env.DB.prepare("SELECT id,payment_id,client_id,project_id,amount_minor,currency,reason,status,provider_refund_id,created_at,updated_at FROM client_refund_requests WHERE status IN ('requested','under_review','approved','processing','unknown','failed') ORDER BY created_at DESC LIMIT 100"),
   env.DB.prepare("SELECT id,payment_id,editor_id,project_id,amount_minor,currency,status,provider_refund_id,created_at,updated_at FROM editor_deposit_refunds WHERE status IN ('requesting','unknown','failed','pending') ORDER BY created_at DESC LIMIT 100"),
   env.DB.prepare("SELECT id,offer_id,project_id,editor_id,amount_minor,currency,status,payment_reference,created_at,updated_at FROM editor_payouts WHERE status IN ('pending_approval','approved') ORDER BY created_at DESC LIMIT 100")
  ]);
  const rows=results.map(x=>x.results||[]);
  await log(env,a.id,"finance_reconciliation_viewed","finance","reconciliation",{});
  return out({ok:true,reconciliation:{client_refunds_by_status:rows[0],deposit_refunds_by_status:rows[1],editor_payouts_by_status:rows[2],payments_by_status:rows[3],webhook_event_count:Number(rows[4][0]?.events||0),client_refunds_needing_attention:rows[5],deposit_refunds_needing_attention:rows[6],editor_payouts_waiting:rows[7]},read_only:true,note:"This is a read-only reconciliation view. It does not retry refunds, initiate transfers, or alter payment records."});
 }
 if(m==="GET"&&p==="/v1/admin/finance/client-balances"){
 const a=await user(req,env,["admin"]);
 const q=await env.DB.prepare("SELECT q.id AS quote_id,q.project_id,q.client_id,u.email AS client_email,q.total_amount_minor,q.currency,q.status AS quote_status,q.payment_status,q.created_at,COALESCE(paid.paid_minor,0) AS paid_minor,MAX(0,q.total_amount_minor-COALESCE(paid.paid_minor,0)) AS balance_minor FROM client_quotes q JOIN users u ON u.id=q.client_id LEFT JOIN (SELECT quote_id,SUM(amount_minor) AS paid_minor FROM payments WHERE status='succeeded' AND payment_type IN ('client_advance','client_balance') AND quote_id IS NOT NULL GROUP BY quote_id) paid ON paid.quote_id=q.id WHERE q.total_amount_minor>COALESCE(paid.paid_minor,0) AND q.status='accepted' ORDER BY q.created_at ASC LIMIT 300").all();
 const rows=(q.results||[]).map(x=>({...x,total_amount_minor:Number(x.total_amount_minor||0),paid_minor:Number(x.paid_minor||0),balance_minor:Number(x.balance_minor||0)}));
 const totals={quotes:rows.length,amount_minor:rows.reduce((n,x)=>n+x.total_amount_minor,0),paid_minor:rows.reduce((n,x)=>n+x.paid_minor,0),outstanding_minor:rows.reduce((n,x)=>n+x.balance_minor,0)};
 const byCurrency={};for(const x of rows){const c=x.currency||"UNKNOWN";byCurrency[c]??={quotes:0,outstanding_minor:0};byCurrency[c].quotes++;byCurrency[c].outstanding_minor+=x.balance_minor;}
 await log(env,a.id,"finance_client_balances_viewed","finance","client_balances",{quotes:rows.length});
 return out({ok:true,balances:rows,summary:totals,by_currency:byCurrency,read_only:true,note:"Outstanding balance is calculated from accepted quotations minus successful captured client advance/balance payments. No payment is initiated by this endpoint."});
}
 if(m==="GET"&&p==="/v1/admin/finance/overview"){
  const a=await user(req,env,["admin"]);
  const q=await env.DB.batch([
   env.DB.prepare("SELECT currency,COUNT(*) AS transactions,COALESCE(SUM(amount_minor),0) AS collected_minor FROM payments WHERE status='succeeded' GROUP BY currency"),
   env.DB.prepare("SELECT currency,COUNT(*) AS quotes,COALESCE(SUM(total_amount_minor),0) AS quoted_minor FROM client_quotes WHERE status IN ('sent','accepted') GROUP BY currency"),
   env.DB.prepare("SELECT currency,COUNT(*) AS requests,COALESCE(SUM(amount_minor),0) AS refund_requested_minor FROM client_refund_requests WHERE status IN ('requested','under_review','approved') GROUP BY currency"),
   env.DB.prepare("SELECT currency,COUNT(*) AS refunds,COALESCE(SUM(amount_minor),0) AS deposit_refund_minor FROM editor_deposit_refunds WHERE status IN ('requesting','processing','processed','succeeded') GROUP BY currency"),
   env.DB.prepare("SELECT COUNT(*) AS pending_client_refunds FROM client_refund_requests WHERE status IN ('requested','under_review')"),
   env.DB.prepare("SELECT COUNT(*) AS deposit_refund_records FROM editor_deposit_refunds WHERE status IN ('requesting','processing')")
  ]);
  await log(env,a.id,"finance_overview_viewed","finance","staging",{});
  return out({ok:true,read_only:true,collections:q[0].results||[],quotes:q[1].results||[],client_refunds:q[2].results||[],deposit_refunds:q[3].results||[],pending:{client_refunds:Number(q[4].results?.[0]?.pending_client_refunds||0),deposit_refunds:Number(q[5].results?.[0]?.deposit_refund_records||0)},limitations:["No editor payout transfers or paid-status ledger yet.","No client final-balance order creation route added in this phase.","Refund approvals do not imply a provider refund has executed."]});
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
async function verifyGlobalApiHmac(env,canonical,sig){const secrets=[env.GLOBAL_API_SYNC_HMAC_SECRET,env.ADMIN_SYNC_HMAC_SECRET].filter(Boolean);for(const secret of secrets){const expected=await hmacHex(secret,canonical);if(constantTime(expected,sig))return true;}return false;}
function razorpayRuntime(env){
 const configured=!!(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET&&env.RAZORPAY_WEBHOOK_SECRET);
 const testMode=!!(env.RAZORPAY_KEY_ID&&String(env.RAZORPAY_KEY_ID).startsWith("rzp_test_"));
 const environment=String(env.ENVIRONMENT||"").trim().toLowerCase();
 const ready=configured&&(environment==="staging"?testMode:environment==="production"?!testMode:false);
 const mode=!configured?"unconfigured":environment==="staging"?(testMode?"test":"blocked_non_test_key"):environment==="production"?(testMode?"blocked_test_key":"live"):"blocked_unknown_environment";
 return {ready,mode,testMode};
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
 const origin=req.headers.get("Origin")||"",allowed=(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean),ch={"vary":"Origin","access-control-allow-methods":"GET,POST,PUT,OPTIONS","access-control-allow-headers":"Authorization,Content-Type,X-File-Name,X-Submission-Notes,X-CSA-Video-Title,X-CSA-Video-Description,X-CSA-Video-Category,X-CSA-Video-Rights-Confirmed,X-CSA-Terms-Accepted,X-CSA-Terms-Version,X-CSA-KYC-Document-Type,X-CSA-KYC-Consent,X-CSA-KYC-Consent-Version","access-control-max-age":"86400"};
 if(allowed.includes(origin)||/^https:\/\/([a-z0-9-]+\.)?csa-global-staging\.pages\.dev$/i.test(origin))ch["access-control-allow-origin"]=origin;
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:ch});
 try{const r=await handle(req,env),h=new Headers(r.headers);Object.entries(ch).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});}
 catch(e){const auth=/token|identity|account is|role is|verified email/i.test(e.message||"");return new Response(JSON.stringify({ok:false,error:{code:auth?"auth_error":"server_error",message:auth?e.message:"Request failed safely."}}),{status:auth?401:500,headers:{...H,...ch}});}
}};
