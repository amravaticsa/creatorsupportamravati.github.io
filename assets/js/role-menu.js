(()=>{"use strict";if(document.getElementById("csa-role-menu-root"))return;
const links=[["★","Super Admin Login","/global-platform/super-admin-login.html"],["⚙","Admin Login","/global-platform/admin-login.html"],["🌐","Regional Admin Login","/global-platform/regional-admin-login.html"],["✎","Editor Login","/global-platform/editor-login.html"],["↗","Client Login","/global-platform/login.html"]];
const nav=document.querySelector(".main-nav"),hasMobileNav=!!(nav&&document.querySelector(".menu-toggle"));
let css=`
#csa-role-menu-root{position:relative;top:auto;right:auto;z-index:21;flex:0 0 auto;margin-left:0;font-family:Inter,Arial,sans-serif}
#csa-role-menu-button{width:48px;height:48px;border:1px solid #ffffff44;border-radius:12px;background:#101b35;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 24px #08122647}
#csa-role-menu-button:hover{background:#1b3155}#csa-role-menu-button svg{width:23px;height:23px}
#csa-role-menu-panel{position:absolute;right:0;top:58px;width:min(290px,calc(100vw - 28px));padding:12px;background:#fff;border:1px solid #e5e9f0;border-radius:14px;box-shadow:0 18px 48px #08122638;display:none}
#csa-role-menu-panel.is-open{display:block}
#csa-role-menu-panel .csa-role-heading{padding:8px 10px 10px;color:#667085;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
#csa-role-menu-panel a{display:flex;align-items:center;gap:11px;padding:12px 10px;border-radius:9px;color:#172033;text-decoration:none;font-size:14px;font-weight:700}
#csa-role-menu-panel a:hover,#csa-role-menu-panel a:focus{background:#f2f5fa;outline:none}
#csa-role-menu-panel .csa-role-mark{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:#fff3d7;color:#76500a;font-size:15px}
#csa-role-menu-panel .csa-role-foot{border-top:1px solid #edf0f4;margin-top:7px;padding:10px 10px 2px;color:#7a8494;font-size:11px;line-height:1.45}
.csa-mobile-role-links{display:none}
@media(max-width:680px){#csa-role-menu-button{width:44px;height:44px}}
`;
if(hasMobileNav){css+=`
@media(max-width:680px){
#csa-role-menu-root{display:none}
.csa-mobile-role-links{display:block;width:100%;border-top:1px solid #ffffff24;margin-top:4px;padding-top:12px}
.csa-mobile-role-links .csa-role-mobile-heading{color:#f4bd45;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:0 0 5px}
.csa-mobile-role-links a{display:block;padding:9px 0;color:#e9edf5;font-size:14px;font-weight:650}
.csa-mobile-role-links a:hover{color:#f4bd45}
}`;}
const style=document.createElement("style");style.id="csa-role-menu-style";style.textContent=css;document.head.append(style);
if(hasMobileNav){const group=document.createElement("div");group.className="csa-mobile-role-links";group.innerHTML='<div class="csa-role-mobile-heading">Account Login</div>'+links.map(x=>'<a href="'+x[2]+'">'+x[1]+'</a>').join("");nav.append(group);}
const root=document.createElement("div");root.id="csa-role-menu-root";
root.innerHTML='<button id="csa-role-menu-button" type="button" aria-label="Open account menu" aria-expanded="false" aria-controls="csa-role-menu-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><nav id="csa-role-menu-panel" aria-label="Account login menu"><div class="csa-role-heading">CSA Account Access</div>'+links.map(x=>'<a href="'+x[2]+'"><span class="csa-role-mark">'+x[0]+'</span><span>'+x[1]+'</span></a>').join("")+'<div class="csa-role-foot">Restricted dashboards are available only to accounts approved by CSA.</div></nav>';
const headerSlot=nav&&nav.parentElement; if(headerSlot&&headerSlot.classList.contains("header-inner")){headerSlot.append(root);}else{const header=document.querySelector(".site-header,header");if(header){const inner=header.querySelector(".header-inner,.container");(inner||header).append(root);}else{document.body.append(root);}}const button=root.querySelector("button"),panel=root.querySelector("nav");
function close(){panel.classList.remove("is-open");button.setAttribute("aria-expanded","false");button.setAttribute("aria-label","Open account menu");}
button.addEventListener("click",()=>{const open=!panel.classList.contains("is-open");panel.classList.toggle("is-open",open);button.setAttribute("aria-expanded",String(open));button.setAttribute("aria-label",open?"Close account menu":"Open account menu");});
document.addEventListener("click",e=>{if(!root.contains(e.target))close();});document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
})();