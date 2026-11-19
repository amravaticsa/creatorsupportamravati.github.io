const ORIGIN = "https://creatorsupportamravati.in";
const PART = 16 * 1024 * 1024;
const MAX = 100 * 1024 * 1024 * 1024;
const STATUSES = ["Order Received","Files Under Review","Editing in Progress","Preview Ready","Revision Requested","Final Editing","Completed – Download Available","On Hold","Cancelled"];
const CORS = {"access-control-allow-origin":ORIGIN,"access-control-allow-methods":"GET,POST,PUT,PATCH,OPTIONS","access-control-allow-headers":"Content-Type,Authorization,X-Part-Number","cache-control":"no-store","vary":"Origin"};
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...CORS,"content-type":"application/json"}});
const bearer=r=>(r.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,"0")).join("");
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,"0")).join("");
const clean=(v,n=1000)=>String(v??"").trim().slice(0,n);
async function customer(env,code,req){const t=bearer(req);if(!t)return null;const r=await env.CSA_VIDEO_DB.prepare("SELECT id,customer_access_hash,is_draft FROM video_editing_orders WHERE order_code=?").bind(code).first();return r&&await digest(t)===r.customer_access_hash?r:null;}
async function isAdmin(req,env){const a=bearer(req),b=env.CSA_VIDEO_ADMIN_SECRET||"";if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function validFile(name,type,size){const ext=name.split(".").pop().toLowerCase();return ["mp4","mov","m4v","mkv","avi","webm","mp3","wav","aac","m4a","zip","7z","rar","jpg","jpeg","png","pdf"].includes(ext)&&Number.isSafeInteger(size)&&size>0&&size<=MAX&&(type.startsWith("video/")||type.startsWith("audio/")||type.startsWith("image/")||["application/zip","application/x-7z-compressed","application/vnd.rar","application/pdf","application/octet-stream"].includes(type));}
async function beginUpload(env,order,b,role,who){const name=clean(b.filename,180),type=clean(b.contentType,120)||"application/octet-stream",size=Number(b.size);if(!validFile(name,type,size))throw Error("Unsupported file or size (maximum 100 GB).");const id=crypto.randomUUID(),key=role+"/"+order.order_code+"/"+id,mp=await env.CSA_VIDEO_BUCKET.createMultipartUpload(key,{httpMetadata:{contentType:type},customMetadata:{orderCode:order.order_code,role}});await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_files (id,order_id,object_key,original_filename,content_type,file_size_bytes,file_role,uploaded_by,multipart_upload_id,upload_state) VALUES (?,?,?,?,?,?,?,?,?,'uploading')").bind(id,order.id,key,name,type,size,role,who,mp.uploadId).run();return {fileId:id,partSize:PART,totalParts:Math.ceil(size/PART)};}
async function sendFile(env,orderId,fileId){const f=await env.CSA_VIDEO_DB.prepare("SELECT * FROM video_editing_files WHERE id=? AND order_id=? AND upload_state='complete'").bind(fileId,orderId).first();if(!f)return json({error:"File not found"},404);const o=await env.CSA_VIDEO_BUCKET.get(f.object_key);if(!o)return json({error:"File unavailable"},404);return new Response(o.body,{headers:{...CORS,"content-type":f.content_type||"application/octet-stream","content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(f.original_filename),"x-content-type-options":"nosniff"}});}
export default {async fetch(req,env){
 const u=new URL(req.url),p=u.pathname.split("/").filter(Boolean);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.headers.get("Origin")&&req.headers.get("Origin")!==ORIGIN)return json({error:"Origin not allowed"},403);
 if(u.pathname==="/health")return json({ok:true,service:"CSA Video Editing API",database:"connected",storage:"private"});
 try{
  if(u.pathname==="/api/orders/draft"&&req.method==="POST"){
   const b=await req.json(),name=clean(b.name,100),email=clean(b.email,160).toLowerCase(),phone=clean(b.phone,30),budget=Number(b.projectBudgetPaise);
   if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.replace(/\D/g,"").length<7||!Number.isSafeInteger(budget)||budget<10000||budget>50000000)return json({error:"Enter valid contact details and a project budget between ₹100 and ₹5,00,000."},400);
   const id=crypto.randomUUID(),draftCode="DRAFT-"+random(6).toUpperCase(),accessToken=random(32);
   await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_orders (id,order_code,customer_name,customer_email,customer_phone,country,service_package,project_type,video_duration,aspect_ratio,deadline,instructions,quoted_amount_paise,currency,payment_status,order_status,customer_access_hash,is_draft,project_budget_paise) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'INR','awaiting_payment','Draft - Awaiting Payment',?,1,?)").bind(id,draftCode,name,email,phone,clean(b.country,80),clean(b.package,100),clean(b.projectType,100),clean(b.duration,60),clean(b.aspectRatio,30),clean(b.deadline,60),clean(b.instructions,3000),budget,await digest(accessToken),budget).run();
   return json({ok:true,draftCode,accessToken,message:"Secure upload draft created. Your application is not submitted yet."},201);
  }
  if(u.pathname==="/api/orders"&&req.method==="POST")return json({error:"Please upload your raw clips and complete verified payment before submitting an editing request."},403);
  if(u.pathname==="/api/orders/legacy-disabled"&&req.method==="POST"){
   const b=await req.json(),name=clean(b.name,100),email=clean(b.email,160).toLowerCase(),phone=clean(b.phone,30);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.replace(/\D/g,"").length<7)return json({error:"Enter valid name, email and phone."},400);
   const id=crypto.randomUUID(),orderCode="CSA-VE-"+random(4).toUpperCase(),accessToken=random(32);
   await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_orders (id,order_code,customer_name,customer_email,customer_phone,country,service_package,project_type,video_duration,aspect_ratio,deadline,instructions,quoted_amount_paise,currency,payment_status,order_status,customer_access_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,'INR','quote_pending','Order Received',?)").bind(id,orderCode,name,email,phone,clean(b.country,80),clean(b.package,100),clean(b.projectType,100),clean(b.duration,60),clean(b.aspectRatio,30),clean(b.deadline,60),clean(b.instructions,3000),await digest(accessToken)).run();
   await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_status_history (id,order_id,old_status,new_status,note,changed_by) VALUES (?,?,NULL,'Order Received','Order created by customer','customer')").bind(crypto.randomUUID(),id).run();
   return json({ok:true,orderCode,accessToken,message:"Save the Order ID and access token securely. The token cannot be recovered."},201);
  }
  if(p[0]==="api"&&p[1]==="drafts"&&p.length===4&&p[3]==="finalize"&&req.method==="POST"){
   const a=await customer(env,p[2],req);if(!a||Number(a.is_draft)!==1)return json({error:"Invalid upload draft or access code."},401);
   const b=await req.json(),paymentOrderId=clean(b.paymentOrderId,64),paymentId=clean(b.paymentId,64);
   if(!/^order_[A-Za-z0-9]+$/.test(paymentOrderId)||!/^pay_[A-Za-z0-9]+$/.test(paymentId))return json({error:"Verified payment details are required."},400);
   const draft=await env.CSA_VIDEO_DB.prepare("SELECT * FROM video_editing_orders WHERE id=? AND is_draft=1").bind(a.id).first();if(!draft)return json({error:"Draft not found."},404);
   const files=await env.CSA_VIDEO_DB.prepare("SELECT COUNT(*) AS total FROM video_editing_files WHERE order_id=? AND file_role='raw' AND upload_state='complete'").bind(a.id).first();if(Number(files?.total||0)<1)return json({error:"Upload at least one raw clip before submitting your request."},400);
   const paid=await env.CSA_VIDEO_DB.prepare("SELECT o.*,p.razorpay_payment_id,p.amount_paise AS captured_amount,p.status AS captured_status FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.razorpay_order_id=? AND p.razorpay_payment_id=? AND o.status='paid' AND p.status='captured' LIMIT 1").bind(paymentOrderId,paymentId).first();
   if(!paid)return json({error:"Payment is not verified as captured. Your application has not been submitted."},402);
   const expected=paid.payment_type==="advance"?Math.round(Number(draft.project_budget_paise)/2):Number(draft.project_budget_paise);
   if(Number(paid.project_total_paise)!==Number(draft.project_budget_paise)||Number(paid.amount_due_paise)!==expected||Number(paid.captured_amount)!==expected)return json({error:"The verified payment does not match this project's budget and payment option."},400);
   const orderCode="CSA-VE-"+random(4).toUpperCase(),paymentStatus=paid.payment_type==="advance"?"advance_paid":"paid";
   await env.CSA_VIDEO_DB.prepare("UPDATE video_editing_orders SET order_code=?,is_draft=0,quoted_amount_paise=project_budget_paise,payment_status=?,payment_reference=?,payment_amount_paise=?,payment_type=?,order_status='Order Received',updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_draft=1").bind(orderCode,paymentStatus,paymentId,expected,paid.payment_type,a.id).run();
   await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_status_history (id,order_id,old_status,new_status,note,changed_by) VALUES (?,?,NULL,?,?, 'customer')").bind(crypto.randomUUID(),a.id,"Order Received","Application submitted after verified "+paid.payment_type+" payment ("+paymentId+")").run();
   return json({ok:true,orderCode,message:"Payment verified. Your editing application has been submitted."},201);
  }
  if(p[0]==="api"&&p[1]==="orders"&&p.length===3&&req.method==="GET"){
   const a=await customer(env,p[2],req);if(!a||Number(a.is_draft)===1)return json({error:"Invalid Order ID or access token"},401);
   const order=await env.CSA_VIDEO_DB.prepare("SELECT order_code,customer_name,service_package,project_type,video_duration,aspect_ratio,deadline,instructions,quoted_amount_paise,currency,payment_status,order_status,created_at,updated_at FROM video_editing_orders WHERE id=?").bind(a.id).first();
   const files=await env.CSA_VIDEO_DB.prepare("SELECT id,original_filename,content_type,file_size_bytes,file_role,upload_state,created_at FROM video_editing_files WHERE order_id=? ORDER BY created_at").bind(a.id).all();
   const history=await env.CSA_VIDEO_DB.prepare("SELECT old_status,new_status,note,created_at FROM video_editing_status_history WHERE order_id=? ORDER BY created_at").bind(a.id).all();
   const feedback=await env.CSA_VIDEO_DB.prepare("SELECT rating,comment,created_at FROM video_editing_feedback WHERE order_id=?").bind(a.id).first().catch(()=>null);
   return json({order,files:files.results||[],history:history.results||[],feedback:feedback||null});
  }
  if(p[0]==="api"&&p[1]==="orders"&&p.length===4&&p[3]==="feedback"&&req.method==="POST"){
   const a=await customer(env,p[2],req);if(!a)return json({error:"Unauthorized"},401);
   const order=await env.CSA_VIDEO_DB.prepare("SELECT id,order_status FROM video_editing_orders WHERE id=?").bind(a.id).first();
   if(!order||!order.order_status.toLowerCase().includes("completed"))return json({error:"You can rate CSA after your project is completed."},403);
   const b=await req.json(),rating=Number(b.rating),comment=clean(b.comment,1200);
   if(!Number.isInteger(rating)||rating<1||rating>5)return json({error:"Choose a rating from 1 to 5 stars."},400);
   await env.CSA_VIDEO_DB.prepare("CREATE TABLE IF NOT EXISTS video_editing_feedback (order_id TEXT PRIMARY KEY, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
   await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_feedback (order_id,rating,comment) VALUES (?,?,?) ON CONFLICT(order_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,created_at=CURRENT_TIMESTAMP").bind(a.id,rating,comment).run();
   return json({ok:true,message:"Thank you for rating Creator Support Amravati."});
  }
  if(p[0]==="api"&&p[1]==="drafts"&&p.length===4&&p[3]==="files"&&req.method==="POST"){
   const a=await customer(env,p[2],req);if(!a||Number(a.is_draft)!==1)return json({error:"Invalid upload draft or access code."},401);
   const draft=await env.CSA_VIDEO_DB.prepare("SELECT id,order_code FROM video_editing_orders WHERE id=? AND is_draft=1").bind(a.id).first();if(!draft)return json({error:"Draft not found."},404);
   return json({ok:true,...await beginUpload(env,draft,await req.json(),"raw","customer")},201);
  }
  if(p[0]==="api"&&p[1]==="orders"&&p.length===5&&p[3]==="files"&&p[4]==="initiate"&&req.method==="POST"){
   const a=await customer(env,p[2],req);if(!a)return json({error:"Unauthorized"},401);const order=await env.CSA_VIDEO_DB.prepare("SELECT id,order_code FROM video_editing_orders WHERE id=?").bind(a.id).first();return json({ok:true,...await beginUpload(env,order,await req.json(),"raw","customer")},201);
  }
  if(p[0]==="api"&&p[1]==="uploads"&&p.length===3&&req.method==="PUT"){
   const f=await env.CSA_VIDEO_DB.prepare("SELECT f.*,o.customer_access_hash FROM video_editing_files f JOIN video_editing_orders o ON o.id=f.order_id WHERE f.id=?").bind(p[2]).first();if(!f||f.upload_state!=="uploading")return json({error:"Upload not found"},404);const t=bearer(req),adm=await isAdmin(req,env);if(f.uploaded_by==="customer"){if(!t||await digest(t)!==f.customer_access_hash)return json({error:"Unauthorized"},401);}else if(!adm)return json({error:"Unauthorized"},401);
   const n=Number(req.headers.get("x-part-number")),body=await req.arrayBuffer();const expected=Math.min(PART,f.file_size_bytes-(n-1)*PART);if(!Number.isInteger(n)||n<1||n>Math.ceil(f.file_size_bytes/PART)||body.byteLength!==expected)return json({error:"Invalid part size or number"},400);
   const mp=env.CSA_VIDEO_BUCKET.resumeMultipartUpload(f.object_key,f.multipart_upload_id),r=await mp.uploadPart(n,body);await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_upload_parts (id,file_id,part_number,etag) VALUES (?,?,?,?) ON CONFLICT(file_id,part_number) DO UPDATE SET etag=excluded.etag").bind(crypto.randomUUID(),f.id,n,r.etag).run();return json({ok:true,partNumber:n,etag:r.etag});
  }
  if(p[0]==="api"&&p[1]==="uploads"&&p.length===3&&req.method==="POST"){
   const f=await env.CSA_VIDEO_DB.prepare("SELECT f.*,o.customer_access_hash FROM video_editing_files f JOIN video_editing_orders o ON o.id=f.order_id WHERE f.id=?").bind(p[2]).first();if(!f||f.upload_state!=="uploading")return json({error:"Upload not found"},404);const t=bearer(req),adm=await isAdmin(req,env);if(f.uploaded_by==="customer"){if(!t||await digest(t)!==f.customer_access_hash)return json({error:"Unauthorized"},401);}else if(!adm)return json({error:"Unauthorized"},401);
   const r=await env.CSA_VIDEO_DB.prepare("SELECT part_number,etag FROM video_editing_upload_parts WHERE file_id=? ORDER BY part_number").bind(f.id).all(),total=Math.ceil(f.file_size_bytes/PART);if((r.results||[]).length!==total)return json({error:"Upload incomplete",received:(r.results||[]).length,expected:total},400);
   const mp=env.CSA_VIDEO_BUCKET.resumeMultipartUpload(f.object_key,f.multipart_upload_id);await mp.complete(r.results.map(x=>({partNumber:x.part_number,etag:x.etag})));await env.CSA_VIDEO_DB.prepare("UPDATE video_editing_files SET upload_state='complete',multipart_upload_id=NULL WHERE id=?").bind(f.id).run();return json({ok:true,fileId:f.id,status:"complete"});
  }
  if(p[0]==="api"&&p[1]==="orders"&&p.length===6&&p[3]==="files"&&p[5]==="download"&&req.method==="GET"){const a=await customer(env,p[2],req);if(!a)return json({error:"Unauthorized"},401);return sendFile(env,a.id,p[4]);}
  if(p[0]==="api"&&p[1]==="admin"){
   if(!await isAdmin(req,env))return json({error:"Admin authentication required"},401);
   if(p[2]==="orders"&&p.length===3&&req.method==="GET"){const r=await env.CSA_VIDEO_DB.prepare("SELECT order_code,customer_name,customer_email,customer_phone,country,service_package,project_type,quoted_amount_paise,currency,payment_status,order_status,created_at,updated_at FROM video_editing_orders WHERE is_draft=0 ORDER BY created_at DESC LIMIT 250").all();return json({orders:r.results||[]});}
   if(p[2]==="orders"&&p.length===4&&req.method==="GET"){const o=await env.CSA_VIDEO_DB.prepare("SELECT * FROM video_editing_orders WHERE order_code=?").bind(p[3]).first();if(!o)return json({error:"Order not found"},404);const f=await env.CSA_VIDEO_DB.prepare("SELECT id,original_filename,content_type,file_size_bytes,file_role,upload_state,created_at FROM video_editing_files WHERE order_id=? ORDER BY created_at").bind(o.id).all();const h=await env.CSA_VIDEO_DB.prepare("SELECT old_status,new_status,note,created_at FROM video_editing_status_history WHERE order_id=? ORDER BY created_at").bind(o.id).all();return json({order:o,files:f.results||[],history:h.results||[]});}
   if(p[2]==="orders"&&p.length===4&&req.method==="PATCH"){const b=await req.json(),status=clean(b.status,80),note=clean(b.note,1000);if(!STATUSES.includes(status))return json({error:"Invalid status",allowed:STATUSES},400);const o=await env.CSA_VIDEO_DB.prepare("SELECT id,order_status FROM video_editing_orders WHERE order_code=?").bind(p[3]).first();if(!o)return json({error:"Order not found"},404);await env.CSA_VIDEO_DB.prepare("UPDATE video_editing_orders SET order_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,o.id).run();await env.CSA_VIDEO_DB.prepare("INSERT INTO video_editing_status_history (id,order_id,old_status,new_status,note,changed_by) VALUES (?,?,?,?,?,'admin')").bind(crypto.randomUUID(),o.id,o.order_status,status,note).run();return json({ok:true,status});}
   if(p[2]==="orders"&&p.length===6&&p[4]==="files"&&p[5]==="initiate"&&req.method==="POST"){const o=await env.CSA_VIDEO_DB.prepare("SELECT id,order_code FROM video_editing_orders WHERE order_code=?").bind(p[3]).first();if(!o)return json({error:"Order not found"},404);const b=await req.json(),role=["preview","final"].includes(b.role)?b.role:"final";return json({ok:true,...await beginUpload(env,o,b,role,"admin")},201);}
   if(p[2]==="orders"&&p.length===7&&p[4]==="files"&&p[6]==="download"&&req.method==="GET"){const o=await env.CSA_VIDEO_DB.prepare("SELECT id FROM video_editing_orders WHERE order_code=?").bind(p[3]).first();if(!o)return json({error:"Order not found"},404);return sendFile(env,o.id,p[5]);}
  }
  return json({error:"Not found"},404);
 }catch(e){return json({error:"Request failed",detail:String(e?.message||e).slice(0,200)},500);}
}};