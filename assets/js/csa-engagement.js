(function(){
"use strict";
const cfg=window.CSA_FIREBASE_CONFIG||{};
const ready=cfg.apiKey && !String(cfg.apiKey).includes("PASTE_") && cfg.projectId && !String(cfg.projectId).includes("PASTE_");
const onArticle=!!document.querySelector("main article.article, article.article, .article");
const postId=location.pathname.replace(/\/$/,"").replace(/[^a-zA-Z0-9_-]/g,"_").replace(/^_+|_+$/g,"")||"home";
const style=`
#csa-live-pill{position:fixed;left:14px;bottom:14px;z-index:9998;background:#10233f;color:#fff;border:1px solid #2b466b;border-radius:999px;padding:9px 13px;font:600 12px Inter,Arial,sans-serif;box-shadow:0 5px 22px #10233f30}
#csa-live-pill .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#f0ad4e;margin-right:7px}
#csa-engagement{margin:30px 0 12px;padding:22px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;font:14px/1.5 Inter,Arial,sans-serif;color:#172b4d}
#csa-engagement h2{font-size:20px;margin:0 0 8px;color:#142746}
#csa-engagement p{margin:5px 0 12px;color:#657187}
.csa-eng-actions{display:flex;gap:9px;flex-wrap:wrap;margin:14px 0}
.csa-eng-btn{border:1px solid #d2dae5;background:#fff;color:#243650;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer}
.csa-eng-btn:hover{border-color:#0f9d8c;color:#087d70}
.csa-eng-btn.primary{background:#0f9d8c;color:#fff;border-color:#0f9d8c}
.csa-eng-btn:disabled{opacity:.55;cursor:not-allowed}
#csa-comment-form{display:grid;gap:9px;margin-top:15px}
#csa-comment-form textarea{width:100%;min-height:90px;border:1px solid #d2dae5;border-radius:9px;padding:12px;font:14px Inter,Arial,sans-serif;resize:vertical}
#csa-comment-list{display:grid;gap:10px;margin-top:15px}
.csa-comment{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:12px}
.csa-comment strong{color:#142746}.csa-comment small{color:#8993a3;margin-left:8px}
.csa-comment p{margin:7px 0 0;white-space:pre-wrap;color:#39485e}
.csa-comment-delete{margin-top:9px;border:1px solid #dc2626;background:#fff;color:#b91c1c;border-radius:7px;padding:5px 9px;font-size:12px;font-weight:700;cursor:pointer}
.csa-eng-note{font-size:12px;color:#788397}
@media(max-width:600px){#csa-live-pill{left:10px;bottom:10px}.csa-eng-actions .csa-eng-btn{flex:1}}
`;
const st=document.createElement("style");st.textContent=style;document.head.appendChild(st);
const pill=document.createElement("div");pill.id="csa-live-pill";pill.innerHTML='<span class="dot"></span><span id="csa-live-text">Live visitors: connecting…</span>';document.body.appendChild(pill);
let firebaseReady=false,auth=null,db=null,rtdb=null,currentUser=null;
function setLive(s){const el=document.getElementById("csa-live-text");if(el)el.textContent=s}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function boot(){
 if(!ready){setLive("Live visitors setup pending");if(onArticle)renderArticle("Firebase project configuration pending. Article Likes are temporarily unavailable.");return}
 try{
  await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js");
  const app=firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();firebaseReady=true;
  auth.onAuthStateChanged(u=>{currentUser=u;refreshAuthUI();});
  if(cfg.databaseURL){rtdb=firebase.database();setupPresence();}else{setLive("Live visitors setup pending");}
  if(onArticle)setupArticle();
 }catch(e){console.error("CSA Firebase initialization:",e);setLive("Live visitors temporarily unavailable");if(onArticle)renderArticle("Engagement service is temporarily unavailable. Please try again later.");}
}
function setupPresence(){
 let onlineCount=0,lifetimeCount="…",todayCount="…",pageViews="…";
 function updatePill(){setLive(onlineCount+" online · "+todayCount+" today · "+lifetimeCount+" lifetime · "+pageViews+" page views");}
 const connected=firebase.database().ref(".info/connected");
 connected.on("value",snap=>{
  if(snap.val()!==true)return;
  const session=Math.random().toString(36).slice(2)+Date.now().toString(36);
  const presence=firebase.database().ref("presence/"+session);
  presence.onDisconnect().remove().then(()=>presence.set({connectedAt:firebase.database.ServerValue.TIMESTAMP}));
 });
 rtdb.ref("presence").on("value",snap=>{onlineCount=snap.numChildren();updatePill();},()=>setLive("Live visitors unavailable"));
 const fmt=v=>Number(v||0).toLocaleString("en-IN");
 const now=new Date();
 const dateKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const totalRef=rtdb.ref("stats/lifetimeVisits");
 const dailyRef=rtdb.ref("stats/dailyVisitors/"+dateKey);
 const pageRef=rtdb.ref("stats/pageViews");
 totalRef.on("value",snap=>{lifetimeCount=fmt(snap.val());updatePill();},()=>{lifetimeCount="unavailable";updatePill();});
 dailyRef.on("value",snap=>{todayCount=fmt(snap.val());updatePill();},()=>{todayCount="unavailable";updatePill();});
 pageRef.on("value",snap=>{pageViews=fmt(snap.val());updatePill();},()=>{pageViews="unavailable";updatePill();});
 const lifetimeKey="csa_lifetime_visit_counted";
 let lifetimeDone=false;
 try{lifetimeDone=sessionStorage.getItem(lifetimeKey)==="1";}catch(e){}
 if(!lifetimeDone)totalRef.transaction(current=>(Number(current)||0)+1).then(result=>{if(result.committed)try{sessionStorage.setItem(lifetimeKey,"1");}catch(e){}}).catch(err=>console.error("CSA lifetime counter:",err));
 const dailyKey="csa_daily_visit_counted_"+dateKey;
 let dailyDone=false;
 try{dailyDone=sessionStorage.getItem(dailyKey)==="1";}catch(e){}
 if(!dailyDone)dailyRef.transaction(current=>(Number(current)||0)+1).then(result=>{if(result.committed)try{sessionStorage.setItem(dailyKey,"1");}catch(e){}}).catch(err=>console.error("CSA daily counter:",err));
 pageRef.transaction(current=>(Number(current)||0)+1).catch(err=>console.error("CSA page view counter:",err));
}
function renderArticle(note){
 const article=document.querySelector("main article.article, article.article, .article");if(!article||document.getElementById("csa-engagement"))return;
 const box=document.createElement("section");box.id="csa-engagement";
 box.innerHTML='<h2>आपको यह Article कैसा लगा?</h2><p>अपनी प्रतिक्रिया दें, इसे शेयर करें या सवाल पूछें।</p><div class="csa-eng-actions"><button class="csa-eng-btn primary" id="csa-like" type="button">👍 Like <span id="csa-like-count">0</span></button><button class="csa-eng-btn" id="csa-share" type="button">↗ Share</button><button class="csa-eng-btn" id="csa-google-login" type="button">Continue with Google</button></div><p class="csa-eng-note">Public comments are temporarily paused while we review comment moderation settings.</p><p class="csa-eng-note" id="csa-eng-note"></p>';
 article.appendChild(box);
 document.getElementById("csa-share").addEventListener("click",async()=>{const data={title:document.title,url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);noteText("Article link copied.");}}catch(e){}});
 document.getElementById("csa-google-login").onclick=signIn;
 document.getElementById("csa-like").addEventListener("click",toggleLike);

 noteText(note||"Google Login is required to Like. Share is available to everyone.");
}
function noteText(t){const el=document.getElementById("csa-eng-note");if(el)el.textContent=t}
async function signIn(){if(!firebaseReady)return;try{const p=new firebase.auth.GoogleAuthProvider();const result=await auth.signInWithPopup(p);currentUser=result.user;refreshAuthUI();}catch(e){noteText(e.code==="auth/popup-blocked"?"Popup blocked. Please allow popups and try again.":e.message)}}
function refreshAuthUI(){
 const b=document.getElementById("csa-google-login");if(b)b.textContent=currentUser?"Signed in: "+(currentUser.displayName||"Google user")+" · Sign out":"Continue with Google";
 if(b)b.onclick=currentUser?()=>auth.signOut():signIn;

}
async function setupArticle(){
 renderArticle();
 const likeRef=db.collection("csaArticles").doc(postId).collection("likes");
 likeRef.onSnapshot(s=>{const el=document.getElementById("csa-like-count");if(el)el.textContent=s.size;});
 auth.onAuthStateChanged(async u=>{
  const btn=document.getElementById("csa-like");if(!btn)return;
  if(!u){btn.dataset.liked="false";btn.innerHTML='👍 Like <span id="csa-like-count">0</span>';return}
  try{const d=await likeRef.doc(u.uid).get();btn.dataset.liked=d.exists?"true":"false";btn.innerHTML=(d.exists?"💚 Liked ":"👍 Like ")+'<span id="csa-like-count">0</span>';}catch(e){}
 });
}
async function toggleLike(){
 if(!currentUser){noteText("Like करने के लिए पहले Google से sign in करें.");await signIn();if(!currentUser)return}
 const ref=db.collection("csaArticles").doc(postId).collection("likes").doc(currentUser.uid);const btn=document.getElementById("csa-like");btn.disabled=true;
 try{const d=await ref.get();if(d.exists){await ref.delete();btn.dataset.liked="false";}else{await ref.set({uid:currentUser.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()});btn.dataset.liked="true";}btn.innerHTML=(d.exists?"👍 Like ":"💚 Liked ")+'<span id="csa-like-count">'+(document.getElementById("csa-like-count")?.textContent||"0")+'</span>';}catch(e){noteText("Like save nahi hua. Firebase rules check karein.");}finally{btn.disabled=false}
}
boot();
})();