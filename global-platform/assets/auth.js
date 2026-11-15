(()=>{"use strict";
const API="https://csa-global-api.creatorsupportamravati.workers.dev";
const $=id=>document.getElementById(id);
const role=$("role"),status=$("status"),editor=$("editor-fields"),client=$("client-fields");
role.addEventListener("change",()=>{const isEditor=role.value==="editor";editor.hidden=!isEditor;client.hidden=isEditor;});
let nonce="",clientId="";
function makeNonce(){const a=new Uint8Array(32);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,"0")).join("");}
async function boot(){
 try{
  const r=await fetch(API+"/v1/config"),c=await r.json();
  clientId=c.google_client_id||"";
  if(!clientId){status.textContent="Google OAuth Client ID abhi configure nahi hua. Cloudflare setup ke baad sign-in button yahan active hoga.";return;}
  nonce=makeNonce();
  const wait=()=>{if(!window.google?.accounts?.id){setTimeout(wait,150);return;}
   google.accounts.id.initialize({client_id:clientId,nonce,callback:onGoogleCredential,auto_select:false,ux_mode:"popup"});
   google.accounts.id.renderButton($("google-button"),{theme:"outline",size:"large",shape:"rectangular",text:"continue_with",width:280});
   status.textContent="Google sign-in ready. Apna account type aur profile details select karein.";
  };wait();
 }catch(e){status.textContent="Sign-in configuration load nahi ho paayi. Please retry later.";}
}
async function onGoogleCredential(response){
 status.textContent="Google account verify ho raha hai…";
 const isEditor=role.value==="editor";
 const profile=isEditor?{
  country:$("editor-country").value.trim(),city:$("editor-city").value.trim(),
  languages:$("langs").value.split(",").map(x=>x.trim()).filter(Boolean),
  experience_level:$("exp").value,software:$("software").value.split(",").map(x=>x.trim()).filter(Boolean),
  specializations:$("specializations").value.split(",").map(x=>x.trim()).filter(Boolean),
  portfolio_url:$("portfolio").value.trim(),sample_url:$("sample").value.trim(),bio:$("bio").value.trim(),availability:"project-based"
 }:{company_name:$("company").value.trim(),country:$("client-country").value.trim(),language:"English"};
 if(isEditor&&(!profile.country||!profile.portfolio_url||!profile.specializations.length)){status.textContent="Editor ke liye Country, Specializations aur Portfolio URL required hain. Form complete karke dobara Google sign-in karein.";return;}
 try{
  const r=await fetch(API+"/v1/auth/google",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({credential:response.credential,nonce,role:role.value,profile})});
  const data=await r.json();
  if(!r.ok||!data.ok){status.textContent=data.error?.message||"Sign-in failed. Please retry.";return;}
  sessionStorage.setItem("csa_global_token",response.credential);
  sessionStorage.setItem("csa_global_user",JSON.stringify({id:data.user_id,role:data.role,status:data.status,email:data.email}));
  location.href="portal.html";
 }catch(e){status.textContent="Network error. Please retry.";}
}
boot();
})();