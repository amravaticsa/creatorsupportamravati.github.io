import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const auth = readFileSync(new URL("../../assets/auth.js", import.meta.url), "utf8");
const login = readFileSync(new URL("../../login.html", import.meta.url), "utf8");

test("Google identity tokens require RS256 signature verification against configured JWKS", () => {
  assert.match(api, /if\(h\.alg!=="RS256"\|\|!h\.kid\)/);
  assert.match(api, /fetch\(env\.AUTH_JWKS_URL\)/);
  assert.match(api, /crypto\.subtle\.importKey\("jwk"/);
  assert.match(api, /crypto\.subtle\.verify\("RSASSA-PKCS1-v1_5"/);
});

test("Google identity claims validate issuer, audience, expiry, issue time and verified email", () => {
  assert.match(api, /c\.iss!==env\.AUTH_ISSUER/);
  assert.match(api, /c\.aud===env\.AUTH_AUDIENCE/);
  assert.match(api, /c\.exp<=now/);
  assert.match(api, /c\.iat>now\+60/);
  assert.match(api, /c\.email_verified!==true/);
  assert.match(api, /typeof c\.sub!=="string"/);
  assert.match(api, /typeof c\.email!=="string"/);
});

test("Google login requires a client-generated nonce and verifies the signed nonce claim", () => {
  assert.match(api, /!credential\|\|!nonce/);
  assert.match(api, /if\(c\.nonce!==nonce\)return bad\("Google login nonce validation failed/);
  assert.match(auth, /function makeNonce\(\)/);
  assert.match(auth, /crypto\.getRandomValues\(a\)/);
  assert.match(auth, /nonce,callback:onGoogleCredential/);
  assert.match(auth, /credential:response\.credential,nonce,role:role\.value/);
});

test("Global admin Google sign-in requires an active Super Admin invitation", () => {
  assert.match(api, /SELECT email,status FROM global_admin_authorizations WHERE email=\? COLLATE NOCASE AND status='active'/);
  assert.match(api, /if\(role==="admin"&&!adminAuthorization\)return bad/);
  assert.match(api, /if\(old\.role!==role\)return bad/);
  assert.match(api, /GLOBAL_ROLE_PERMISSIONS\[a\.source_role\]/);
});

test("Editor Google registration does not create an Editor Panel bearer session", () => {
  assert.match(auth, /Google is registration\/KYC identity only for editors/);
  assert.match(auth, /sessionStorage\.removeItem\("csa_global_token"\)/);
  assert.match(auth, /sessionStorage\.removeItem\("csa_global_user"\)/);
  assert.match(auth, /Google se Dashboard login nahi hoga/);
});

test("Client Google login stores a session only after successful API verification", () => {
  assert.match(auth, /if\(!r\.ok\|\|!data\.ok\)/);
  assert.match(auth, /sessionStorage\.setItem\("csa_global_token",response\.credential\)/);
  assert.match(auth, /location\.href="portal\.html"/);
  assert.match(login, /accounts\.google\.com\/gsi\/client/);
  assert.match(login, /id="google-button"/);
});
