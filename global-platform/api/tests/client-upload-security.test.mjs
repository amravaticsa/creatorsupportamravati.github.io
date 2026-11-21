import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const portal = readFileSync(new URL("../../assets/portal.js", import.meta.url), "utf8");

const start = api.indexOf("// Resumable R2 multipart uploads");
const end = api.indexOf('if(m==="PUT"&&p.startsWith("/v1/projects/")&&p.endsWith("/files"))', start);
const multipart = api.slice(start, end);

test("Multipart session creation enforces roles, purpose, file-size and MIME allowlist", () => {
  assert.match(multipart, /user\(req,env,\["client","editor"\]\)/);
  assert.match(multipart, /\["project_file","submission"\]/);
  assert.match(multipart, /total<=90\*1024\*1024\|\|total>maxSize/);
  assert.match(multipart, /maxSize=5\*1024\*1024\*1024/);
  assert.match(multipart, /if\(a\.role!=="editor"\)return bad\("Only assigned editors can submit deliverables\."/);
  assert.match(multipart, /createMultipartUpload\(key/);
});

test("Every multipart read, part, and finish operation is bound to the authenticated uploader", () => {
  assert.equal((multipart.match(/session\.uploaded_by!==a\.id/g)||[]).length, 3);
  assert.match(multipart, /SELECT id,purpose,original_filename,total_size_bytes,part_size_bytes,expected_parts,status,expires_at,uploaded_by FROM multipart_upload_sessions/);
  assert.match(multipart, /session\.status!=="open"\|\|new Date\(session\.expires_at\)\.getTime\(\)<Date\.now\(\)/);
});

test("Part uploads validate sequence bounds, exact chunk bytes and store SHA-256", () => {
  assert.match(multipart, /partNumber<1\|\|partNumber>session\.expected_parts/);
  assert.match(multipart, /actual!==expected/);
  assert.match(multipart, /crypto\.subtle\.digest\("SHA-256",data\)/);
  assert.match(multipart, /sha256\) VALUES\(\?,\?,\?,\?,\?\)/);
});

test("Completion requires all ordered parts and exact aggregate bytes, then atomically claims completion", () => {
  assert.match(multipart, /parts\.length!==session\.expected_parts/);
  assert.match(multipart, /Number\(x\.part_number\)!==i\+1/);
  assert.match(multipart, /parts\.reduce\(\(n,x\)=>n\+Number\(x\.size_bytes\),0\)!==session\.total_size_bytes/);
  assert.match(multipart, /UPDATE multipart_upload_sessions SET status='completing' WHERE id=\? AND status='open'/);
  assert.match(multipart, /if\(!claimed\.meta\?\.changes\)return bad/);
});

test("Completed R2 object is independently checked for existence and exact size before metadata finalization", () => {
  assert.match(multipart, /storedObject=await env\.MEDIA\.head\(session\.r2_object_key\)/);
  assert.match(multipart, /!storedObject\|\|Number\(storedObject\.size\)!==Number\(session\.total_size_bytes\)/);
  assert.match(multipart, /multipart_storage_size_mismatch/);
  assert.match(multipart, /multipart_storage_verification_unknown/);
});

test("Client and editor uploads re-check project ownership or active assignment at completion", () => {
  assert.match(multipart, /project\.client_id!==a\.id/);
  assert.match(multipart, /SELECT id FROM assignments WHERE project_id=\? AND editor_id=\? AND status IN \('active','submitted','quality_check','revision'\)/);
  assert.match(multipart, /SELECT id FROM assignments WHERE id=\? AND editor_id=\? AND status IN \('active','revision'\)/);
});

test("Browser resumes only matching file content, retries transient part failures, and preserves failed sessions", () => {
  assert.match(portal, /localStorage\.getItem\(resumeKey\)/);
  assert.match(portal, /crypto\.subtle\.digest\("SHA-256",await file\.slice\(from,to\)\.arrayBuffer\(\)\)/);
  assert.match(portal, /attempt<=3/);
  assert.match(portal, /err\.retryable= r\.status===408/);
  assert.match(portal, /Upload session is saved; select the same file again to resume/);
  assert.match(portal, /localStorage\.removeItem\(resumeKey\)/);
});
