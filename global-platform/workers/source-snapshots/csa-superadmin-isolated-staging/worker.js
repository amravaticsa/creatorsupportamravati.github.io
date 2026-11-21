import dashboardHtml from "./admin-dashboard.js";
import { syncGlobalAdminAuthorizations as syncGlobalAdminAuthorizationsRaw, callGlobalPricingPolicy } from "./global-admin-sync.js";
import adminAppSource from "./admin-app-source.js";
import { validateAdminAppSyntax } from "./admin-app-validate.js";
void validateAdminAppSyntax;
const encoder = new TextEncoder();
const COOKIE = "csa_admin_session";
async function syncGlobalAdminAuthorizations(env, triggerType="lifecycle", actorAdminId=null){const id=crypto.randomUUID(),started=now();try{const result=await syncGlobalAdminAuthorizationsRaw(env);await env.DB.prepare("INSERT INTO global_admin_sync_logs(id,trigger_type,outcome,synced_count,error_code,actor_admin_id,started_at,finished_at) VALUES(?,?,?, ?,NULL,?,?,?)").bind(id,triggerType,"success",Number(result.synced||0),actorAdminId,started,now()).run();return result}catch(e){const code=String(e&&e.message||"sync_failed").slice(0,120);try{await env.DB.prepare("INSERT INTO global_admin_sync_logs(id,trigger_type,outcome,synced_count,error_code,actor_admin_id,started_at,finished_at) VALUES(?,?,?,0,?,?,?,?)").bind(id,triggerType,"failed",code,actorAdminId,started,now()).run()}catch(logError){console.error("Global sync log write failed",String(logError&&logError.message||logError))}throw e}}
const ROLES = ["super_admin","project_admin","editor_admin","finance_admin","support_admin"];
const ROLE_PERMS = {
  super_admin: ["admins.read","admins.create","admins.update","admins.suspend","audit.read","projects.manage","content.manage","finance.read","support.manage"],
  project_admin: ["projects.manage","admins.read"],
  editor_admin: ["content.manage"],
  finance_admin: ["finance.read"],
  support_admin: ["support.manage"]
};
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const html = (body) => new Response(body,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self';","x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY"}});
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const rand = (n=32) => crypto.getRandomValues(new Uint8Array(n));
const hex = (bytes) => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256",encoder.encode(s)));
const safeEq = (a,b) => { if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false; let x=0; for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i); return x===0; };
const pwHash = async (password,salt) => { const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]); return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:100000,hash:"SHA-256"},key,256)); };
const otpHash = async (otp,id) => sha(`${id}:${otp}`);
async function accessIdentity(req,env){const token=req.headers.get('cf-access-jwt-assertion')||'';const p=token.split('.');if(p.length!==3||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)return false;try{const payload=JSON.parse(new TextDecoder().decode(unb64(p[1])));const issuer=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');if(payload.iss!==issuer||!Array.isArray(payload.aud)||!payload.aud.includes(env.ACCESS_AUD)||!payload.exp||payload.exp<=Math.floor(Date.now()/1000)||String(payload.email||'').toLowerCase()!==String(env.ADMIN_EMAIL||'').toLowerCase())return false;const cr=await fetch(issuer+'/cdn-cgi/access/certs');if(!cr.ok)return false;const jwks=await cr.json();const h=JSON.parse(new TextDecoder().decode(unb64(p[0])));const jwk=(jwks.keys||[]).find(k=>k.kid===h.kid&&k.kty==='RSA');if(!jwk||h.alg!=='RS256')return false;const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unb64(p[2]),encoder.encode(p[0]+'.'+p[1]));}catch{return false;}}

const cookie = (req) => Object.fromEntries((req.headers.get("cookie")||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),x.slice(i+1)]}))[COOKIE];
const setCookie = (token,maxAge=43200) => `${COOKI --- TRUNCATED --- 122,366 chars