(async()=>{"use strict";
// CSA Global is a separate portal: preserve its own lightweight sign-in shell.
if(location.pathname.startsWith("/global-platform/"))return;
async function loadSharedShell(){
 try{
  const [hr,fr]=await Promise.all([fetch("/components/header.html",{cache:"no-cache"}),fetch("/components/footer.html",{cache:"no-cache"})]);
  if(!hr.ok||!fr.ok)throw new Error("Shared shell unavailable");
  const [ht,ft]=await Promise.all([hr.text(),fr.text()]);
  const hp=document.createElement("template");hp.innerHTML=ht.trim();
  const fp=document.createElement("template");fp.innerHTML=ft.trim();
  const newTop=hp.content.querySelector(".topbar"),newHeader=hp.content.querySelector(".site-header"),newFooter=fp.content.querySelector(".site-footer");
  if(!newHeader||!newFooter)throw new Error("Shared shell markup incomplete");
  const oldTop=document.querySelector(".topbar"),oldHeader=document.querySelector(".site-header"),oldFooter=document.querySelector(".site-footer");
  if(oldTop)oldTop.replaceWith(newTop);else if(oldHeader)oldHeader.before(newTop);
  if(oldHeader)oldHeader.replaceWith(newHeader);else document.body.prepend(newHeader);
  if(oldFooter)oldFooter.replaceWith(newFooter);else document.body.append(newFooter);
  const p=location.pathname.replace(/\\/g,"/");
  let active=p.startsWith("/blog/")?"/blog.html":p.startsWith("/portfolio/")?"/portfolio.html":p==="/"?"/index.html":p;
  newHeader.querySelectorAll(".main-nav a").forEach(a=>{if(new URL(a.href,location.href).pathname===active)a.setAttribute("aria-current","page")});
 }catch(e){console.warn("CSA shared header/footer fallback:",e)}
}
await loadSharedShell();\n// Public pages keep account sign-in routes out of visitor navigation.\nreturn;\n})();\n