(function(){
"use strict";
const cfg=window.CSA_FIREBASE_CONFIG||{},ready=!!(cfg.apiKey&&cfg.projectId&&cfg.databaseURL);
const article=document.querySelector("main article.article,article.article,.article");
const articleId=location.pathname.replace(/\/$/,"").replace(/[^a-zA-Z0-9_-]/g,"_").replace(/^_+|_+$/g,"")||"home";
const css='#csa-live-pill{position:fixed;left:16px;bottom:16px;z-index:9998;display:flex;align-items:center;gap:9px;max-width:calc(100vw - 32px);background:#10233f;color:#fff;border:1px solid #365273;border-radius:12px;padding:10px 14px;font:600 12px/1.4 Inter,Arial,sans-serif;box-shadow:0 8px 28px #10233f35}#csa-live-pill .dot{width:8px;height:8px;flex:none;border-radius:50%;background:#29c58a}#csa-engagement{margin:30px 0 12px;padding:22px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;color:#172b4d;font:14px/1.5 Inter,Arial,sans-serif}#csa-engagement h2{font-size:20px;margin:0 0 8px;color:#142746}#csa-engagement h3{font-size:17px;margin:20px 0 10px}#csa-engagement p{color:#657187}#csa-engagement .csa-eng-actions,#csa-engagement .csa-social-links{display:flex;gap:9px;flex-wrap:wrap;margin:14px 0}#csa-engagement button,#csa-engagement .csa-social-links a{border:1px solid #d2dae5;background:#fff;color:#243650;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer;text-decoration:none}#csa-engagement button.primary{background:#0f9d8c;color:#fff;border-color:#0f9d8c}#csa-engagement button:disabled{opacity:.55;cursor:not-allowed}#csa-engagement textarea{width:100%;min-height:90px;border:1px solid #d2dae5;border-radius:9px;padding:12px;font:14px Inter,Arial,sans-serif;resize:vertical}#csa-comment-list{display:grid;gap:10px;margin-top:12px}.csa-comment{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:12px}.csa-comment strong{color:#142746}.csa-comment small{color:#8993a3;margin-left:8px}.csa-comment p{margin:7px 0 0;white-space:pre-wrap;color:#39485e}.csa-comment-delete{margin-top:9px;padding:6px 9px!important;color:#b91c1c!important;border-color:#fecaca!important}.csa-eng-note{font-size:12px;color:#788397!important}@media(max-width:600px){#csa-live-pill{left:10px;bottom:10px;padding:9px 11px;font-size:11px}}';
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
let auth,db,rtdb,user=null;
const el=id=>document.getElementById(id),note=s=>{if(el("csa-eng-note"))el("csa-eng-note").textContent=s};
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
function ensurePill(){if(el("csa-live-pill"))return;const p=document.createElement("div");p.id="csa-live-pill";p.setAttribute("role","status");p.innerHTML='<span class="dot"></span><span id="csa-live-text">Live visitor data loading…</span>';document.body.appendChild(p)}
function liveText(s){if(el("csa-live-text"))el("csa-live-text").textContent=s}
function render(){
 if(!article||el("csa-engagement"))return;
 const box=document.createElement("section");box.id="csa-engagement";
 box.innerHTML='<h2>आपको यह Article कैसा लगा?</h2><p>Like करें, share करें और अपना सवाल या सुझाव comment में लिखें।</p><div class="csa-eng-actions"><button class="primary" id="csa-like" type="button">👍 Like <span id="csa-like-count">0</span></button><button id="csa-google-login" type="button">Google से Login</button></div><div class="csa-social-links"><a id="csa-wa" target="_blank" rel="noopener">WhatsApp Share</a><a id="csa-fb" target="_blank" rel="noopener">Facebook</a><a id="csa-copy" href="#">Copy Link</a><span class="csa-eng-note">Shares: <strong id="csa-share-count">0</strong></span></div><h3>💬 Comments (<span id="csa-comment-count">0</span>)</h3><form id="csa-comment-form"><textarea id="csa-comment-text" maxlength="1000" placeholder="अपना सवाल या सुझाव लिखें…" required></textarea><button class="primary" id="csa-comment-submit" type="submit">Comment भेजें</button></form><p class="csa-eng-note" id="csa-eng-note">Comment करने के लिए verified Google account से login जरूरी है।</p><div id="csa-comment-list" aria-live="polite"></div>';
 article.appendChild(box);
 const u=encodeURIComponent(location.href),t=encodeURIComponent(document.title);
 el("csa-wa").href="https://wa.me/?text="+t+"%20"+u;el("csa-fb").href="https://www.facebook.com/sharer/sharer.php?u="+u;
 el("csa-copy").addEventListener("click",async e=>{e.preventDefault();try{await navigator.clipboard.writeText(location.href);recordShare();note("Article link copied.")}catch(_){note("Browser address bar से link copy करें।")}});["csa-wa","csa-fb"].forEach(id=>el(id).addEventListener("click",recordShare));
 el("csa-google-login").addEventListener("click",login);el("csa-like").addEventListener("click",toggleLike);el("csa-comment-form").addEventListener("submit",postComment);
}
async function login(){try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())}catch(e){note(e.code==="auth/popup-blocked"?"Browser में popups allow करके फिर कोशिश करें।":"Login नहीं हो पाया: "+e.message)}}
function authUI(){const b=el("csa-google-login");if(!b)return;b.textContent=user?"Logged in: "+(user.displayName||user.email):"Google से Login";if(user)b.onclick=()=>auth.signOut()}
const articleRef=()=>db.collection("csaArticles").doc(articleId);
function watchArticle(){
 const likes=articleRef().collection("likes"),comments=articleRef().collection("comments");
 likes.onSnapshot(s=>{if(el("csa-like-count"))el("csa-like-count").textContent=s.size},e=>console.warn("CSA likes read:",e));
 comments.orderBy("createdAt","desc").limit(50).onSnapshot(s=>{
  if(el("csa-comment-count"))el("csa-comment-count").textContent=s.size;
  const list=el("csa-comment-list");if(!list)return;list.replaceChildren();
  s.forEach(doc=>{const d=doc.data(),item=document.createElement("article");item.className="csa-comment";const head=document.createElement("div"),name=document.createElement("strong"),date=document.createElement("small"),body=document.createElement("p");name.textContent=d.displayName||"CSA Reader";date.textContent=d.createdAt?.toDate?d.createdAt.toDate().toLocaleDateString("en-IN"):"";body.textContent=d.text||"";head.append(name,date);item.append(head,body);
   if(user&&(user.uid===d.uid||(user.email==="amravati.csa@gmail.com"&&user.emailVerified))){const del=document.createElement("button");del.type="button";del.className="csa-comment-delete";del.textContent="Delete comment";del.addEventListener("click",async()=>{if(!confirm("इस comment को delete करना है?"))return;try{await doc.ref.delete()}catch(e){note("Delete नहीं हुआ। Firebase rules publish होने की जाँच करें।")}});item.append(del)}
   list.append(item);
  });
 },e=>{console.warn("CSA comments read:",e);note("Comments load नहीं हो पाए। Firestore setup जाँचें।")});
}
async function toggleLike(){if(!user){note("Like करने के लिए Google से login करें।");await login();return}const btn=el("csa-like");btn.disabled=true;const ref=articleRef().collection("likes").doc(user.uid);try{const snap=await ref.get();if(snap.exists)await ref.delete();else await ref.set({uid:user.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()})}catch(e){note("Like save नहीं हुआ। Firestore rules publish होने की जाँच करें।");console.error(e)}finally{btn.disabled=false}}
async function postComment(e){e.preventDefault();const text=el("csa-comment-text").value.trim();if(!user){note("Comment करने के लिए Google से login करें।");await login();return}if(!user.emailVerified){note("Google account का email verified होना जरूरी है।");return}if(!text)return;const btn=el("csa-comment-submit");btn.disabled=true;try{await articleRef().collection("comments").add({uid:user.uid,displayName:(user.displayName||"CSA Reader").slice(0,100),text,createdAt:firebase.firestore.FieldValue.serverTimestamp()});el("csa-comment-text").value="";note("आपका comment publish हो गया।")}catch(err){console.error(err);note("Comment save नहीं हुआ। Firestore rules publish होने की जाँच करें।")}finally{btn.disabled=false}}
function recordShare(){const key=articleId;let done=false;try{done=sessionStorage.getItem("csa_shared_"+key)==="1"}catch(_){}if(done)return;const ref=rtdb.ref("stats/sharesByPath/"+key);ref.transaction(v=>(Number(v)||0)+1).then(r=>{if(r.committed)try{sessionStorage.setItem("csa_shared_"+key,"1")}catch(_){}}).catch(e=>console.warn("CSA share count:",e))}
function presence(){
 rtdb.ref(".info/connected").on("value",s=>{if(s.val()!==true)return;const key=rtdb.ref("presence").push().key,ref=rtdb.ref("presence/"+key);ref.onDisconnect().remove();ref.set({connectedAt:firebase.database.ServerValue.TIMESTAMP})});
 const stats={online:0,today:"…",total:"…",views:"…"};const fmt=n=>Number(n||0).toLocaleString("en-IN");
 function update(){liveText(stats.online+" online · "+stats.today+" today · "+stats.total+" lifetime · "+stats.views+" page views")}
 rtdb.ref("presence").on("value",s=>{stats.online=s.numChildren();update()},()=>liveText("Live visitors unavailable"));
 if(article){rtdb.ref("stats/sharesByPath/"+articleId).on("value",s=>{if(el("csa-share-count"))el("csa-share-count").textContent=Number(s.val()||0).toLocaleString("en-IN")})}
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const total=rtdb.ref("stats/lifetimeVisits"),daily=rtdb.ref("stats/dailyVisitors/"+day),views=rtdb.ref("stats/pageViews");
 total.on("value",s=>{stats.total=fmt(s.val());update()});daily.on("value",s=>{stats.today=fmt(s.val());update()});views.on("value",s=>{stats.views=fmt(s.val());update()});
 const dailyKey="csa_visit_"+day;let seen=false;try{seen=sessionStorage.getItem(dailyKey)==="1"}catch(_){}
 if(!seen){daily.transaction(v=>(Number(v)||0)+1).then(r=>{if(r.committed)try{sessionStorage.setItem(dailyKey,"1")}catch(_){}});let counted=false;try{counted=sessionStorage.getItem("csa_lifetime_once")==="1"}catch(_){}if(!counted)total.transaction(v=>(Number(v)||0)+1).then(r=>{if(r.committed)try{sessionStorage.setItem("csa_lifetime_once","1")}catch(_){}})}
 views.transaction(v=>(Number(v)||0)+1);
 const key=location.pathname.replace(/\/$/,"").replace(/[^a-zA-Z0-9_-]/g,"_").replace(/^_+|_+$/g,"").slice(0,120)||"home";rtdb.ref("stats/pageViewsByPath/"+key).transaction(v=>(Number(v)||0)+1);
}
async function boot(){
 if(!ready){liveText("Firebase setup pending");if(article)render();return}
 try{await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js");if(article){await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js")}if(!firebase.apps.length)firebase.initializeApp(cfg);rtdb=firebase.database();presence();if(article){auth=firebase.auth();db=firebase.firestore();render();auth.onAuthStateChanged(u=>{user=u;authUI()});watchArticle()}}
 catch(e){console.error("CSA engagement init:",e);liveText("Analytics temporarily unavailable");if(article){render();note("Engagement service अभी उपलब्ध नहीं है।")}}
}
function start(){ensurePill();if("requestIdleCallback"in window)requestIdleCallback(boot,{timeout:2500});else setTimeout(boot,700)}
if(document.readyState==="complete")start();else window.addEventListener("load",start,{once:true});
})();