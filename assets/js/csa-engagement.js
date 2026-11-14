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
let firebaseReady=false,auth=null,db=null,rtdb=null,currentUser=null,latestComments=[];
const ADMIN_EMAIL="amravati.csa@gmail.com";
function isAdmin(){return !!(currentUser&&currentUser.email&&currentUser.email.toLowerCase()===ADMIN_EMAIL&&currentUser.emailVerified);}
function setLive(s){const el=document.getElementById("csa-live-text");if(el)el.textContent=s}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function boot(){
 if(!ready){setLive("Live visitors setup pending");if(onArticle)renderArticle("Firebase project configuration pending. Google Login, Likes and Comments will activate after setup.");return}
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
 const connected=firebase.database().ref(".info/connected");
 connected.on("value",snap=>{
  if(snap.val()!==true)return;
  const session=Math.random().toString(36).slice(2)+Date.now().toString(36);
  const presence=firebase.database().ref("presence/"+session);
  presence.onDisconnect().remove().then(()=>presence.set({connectedAt:firebase.database.ServerValue.TIMESTAMP}));
 });
 rtdb.ref("presence").on("value",snap=>{const count=snap.numChildren();setLive(count+" visitors online now");},()=>setLive("Live visitors unavailable"));
}
function renderArticle(note){
 const article=document.querySelector("main article.article, article.article, .article");if(!article||document.getElementById("csa-engagement"))return;
 const box=document.createElement("section");box.id="csa-engagement";
 box.innerHTML='<h2>आपको यह Article कैसा लगा?</h2><p>अपनी प्रतिक्रिया दें, इसे शेयर करें या सवाल पूछें।</p><div class="csa-eng-actions"><button class="csa-eng-btn primary" id="csa-like" type="button">👍 Like <span id="csa-like-count">0</span></button><button class="csa-eng-btn" id="csa-share" type="button">↗ Share</button><button class="csa-eng-btn" id="csa-google-login" type="button">Continue with Google</button></div><div id="csa-comment-area"><form id="csa-comment-form"><textarea id="csa-comment-text" maxlength="1000" placeholder="अपनी राय या सवाल लिखें (1000 characters तक)" required></textarea><button class="csa-eng-btn primary" id="csa-comment-submit" type="submit">Post Comment</button></form><div id="csa-comment-list" aria-live="polite"></div></div><p class="csa-eng-note" id="csa-eng-note"></p>';
 article.appendChild(box);
 document.getElementById("csa-share").addEventListener("click",async()=>{const data={title:document.title,url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);noteText("Article link copied.");}}catch(e){}});
 document.getElementById("csa-google-login").onclick=signIn;
 document.getElementById("csa-like").addEventListener("click",toggleLike);
 document.getElementById("csa-comment-form").addEventListener("submit",postComment);
 noteText(note||"Google Login is required to Like or Comment. Share is available to everyone.");
}
function renderComments(){
 const list=document.getElementById("csa-comment-list");if(!list)return;list.replaceChildren();
 if(!latestComments.length){const p=document.createElement("p");p.className="csa-eng-note";p.textContent="अभी तक कोई comment नहीं है। पहला comment आप करें।";list.appendChild(p);return}
 latestComments.forEach(({id,data:d})=>{
  const item=document.createElement("div");item.className="csa-comment";
  const h=document.createElement("strong");h.textContent=d.displayName||"Google user";
  const small=document.createElement("small");small.textContent=d.createdAt&&d.createdAt.toDate?d.createdAt.toDate().toLocaleDateString("en-IN"):"";
  const p=document.createElement("p");p.textContent=d.text||"";item.append(h,small,p);
  if(currentUser&&(isAdmin()||currentUser.uid===d.uid)){
   const del=document.createElement("button");del.type="button";del.className="csa-comment-delete";del.textContent="Delete comment";
   del.addEventListener("click",async()=>{
    if(!confirm("Is comment ko permanently delete karna hai?"))return;
    del.disabled=true;
    try{await db.collection("csaArticles").doc(postId).collection("comments").doc(id).delete();noteText("Comment delete ho gaya.");}
    catch(e){noteText("Comment delete nahi hua. Firebase moderation rules check karein.");del.disabled=false;}
   });
   item.appendChild(del);
  }
  list.appendChild(item);
 });
}
function noteText(t){const el=document.getElementById("csa-eng-note");if(el)el.textContent=t}
async function signIn(){if(!firebaseReady)return;try{const p=new firebase.auth.GoogleAuthProvider();const result=await auth.signInWithPopup(p);currentUser=result.user;refreshAuthUI();}catch(e){noteText(e.code==="auth/popup-blocked"?"Popup blocked. Please allow popups and try again.":e.message)}}
function refreshAuthUI(){
 renderComments();
 const b=document.getElementById("csa-google-login");if(b)b.textContent=currentUser?"Signed in: "+(currentUser.displayName||"Google user")+" · Sign out":"Continue with Google";
 if(b)b.onclick=currentUser?()=>auth.signOut():signIn;
 const form=document.getElementById("csa-comment-form");if(form){form.querySelector("textarea").disabled=!currentUser;form.querySelector("button").disabled=!currentUser;form.querySelector("textarea").placeholder=currentUser?"अपनी राय या सवाल लिखें":"Comment करने के लिए Google से sign in करें";}
}
async function setupArticle(){
 renderArticle();
 const likeRef=db.collection("csaArticles").doc(postId).collection("likes");
 const commentRef=db.collection("csaArticles").doc(postId).collection("comments");
 likeRef.onSnapshot(s=>{const el=document.getElementById("csa-like-count");if(el)el.textContent=s.size;});
 commentRef.orderBy("createdAt","desc").limit(30).onSnapshot(s=>{
  const list=document.getElementById("csa-comment-list");if(!list)return;list.replaceChildren();
  if(s.empty){const p=document.createElement("p");p.className="csa-eng-note";p.textContent="अभी तक कोई comment नहीं है। पहला comment आप करें।";list.appendChild(p);return}
  latestComments=s.docs.map(doc=>({id:doc.id,data:doc.data()}));renderComments();
 },e=>noteText("Comments could not load. Check Firebase security rules."));
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
async function postComment(e){
 e.preventDefault();if(!currentUser){noteText("Comment के लिए Google Login जरूरी है.");return}
 const input=document.getElementById("csa-comment-text");const text=input.value.trim();if(!text)return;
 const btn=document.getElementById("csa-comment-submit");btn.disabled=true;
 try{await db.collection("csaArticles").doc(postId).collection("comments").add({uid:currentUser.uid,displayName:currentUser.displayName||"Google user",text,createdAt:firebase.firestore.FieldValue.serverTimestamp()});input.value="";noteText("आपका comment publish हो गया.");}
 catch(e){noteText("Comment publish नहीं हुआ. Firebase rules check करें.");}finally{btn.disabled=false}
}
boot();
})();