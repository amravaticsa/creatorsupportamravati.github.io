import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("Client quote checkout requires Razorpay Test Mode before creating an order", () => {
  const start = source.indexOf('const clientCheckout=p.match');
  const end = source.indexOf('if(m==="POST"&&p==="/v1/client/payments/razorpay/verify")', start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  const guard = route.indexOf('startsWith("rzp_test_")');
  const webhook = route.indexOf("!env.RAZORPAY_WEBHOOK_SECRET");
  const order = route.indexOf('https://api.razorpay.com/v1/orders');
  assert.ok(guard >= 0 && webhook >= 0 && order > guard && order > webhook);
});

test("Editor security-deposit checkout requires Razorpay Test Mode before creating an order", () => {
  const start = source.indexOf('if(m==="POST"&&p.startsWith("/v1/offers/")&&p.endsWith("/deposit/checkout"))');
  const end = source.indexOf('if(m==="POST"&&p==="/v1/payments/razorpay/verify")', start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  const guard = route.indexOf('startsWith("rzp_test_")');
  const webhook = route.indexOf("!env.RAZORPAY_WEBHOOK_SECRET");
  const order = route.indexOf('https://api.razorpay.com/v1/orders');
  assert.ok(guard >= 0 && webhook >= 0 && order > guard && order > webhook);
});

test("Editor security-deposit verification rejects non-test Razorpay keys", () => {
  const start = source.indexOf('if(m==="POST"&&p==="/v1/payments/razorpay/verify")');
  const end = source.indexOf('if(m==="POST"&&p==="/v1/webhooks/razorpay")', start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(route, /!env\.RAZORPAY_KEY_ID\.startsWith\("rzp_test_"\)/);
});

test("health and public config expose only mode-safe Razorpay readiness", () => {
  assert.match(source, /environment==="staging"\?testMode:environment==="production"\?!testMode:false/);
  assert.match(source, /razorpay_checkout:payment\.ready/);
  assert.match(source, /razorpay_mode:payment\.mode/);
  assert.match(source, /razorpay_key_id:payment\.ready\?env\.RAZORPAY_KEY_ID:null/);
});
