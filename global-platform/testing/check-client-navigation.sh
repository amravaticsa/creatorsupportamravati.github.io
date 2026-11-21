#!/usr/bin/env bash
set -euo pipefail

client_page="global-platform/client-project.html"
client_login="global-platform/login.html"
editor_register="global-platform/editor-register.html"
editor_login="global-platform/editor-login.html"

test -s "$client_page"
test -s "$client_login"
test -s "$editor_register"
test -s "$editor_login"

grep -Eq '<a[^>]*href="login.html"[^>]*>Continue to Client Portal</a>' "$client_page" || {
  echo "FAIL: client project page must direct clients to Client Login."
  exit 1
}
grep -Fq '<a href="editor-register.html">Editor registration</a>' "$client_page" || {
  echo "FAIL: Editor registration link must open editor-register.html."
  exit 1
}
grep -Fq 'id="role" hidden><option value="client" selected>Client</option>' "$client_login" || {
  echo "FAIL: client login page must default to client role."
  exit 1
}
grep -Fq 'href="editor-login.html"' "$editor_register" || {
  echo "FAIL: editor registration page must link to editor login."
  exit 1
}
grep -Fq 'option value="editor" selected' "$editor_login" || {
  echo "FAIL: editor login page must default to editor role."
  exit 1
}

echo "PASS: client and editor navigation/role entry points are consistent."
