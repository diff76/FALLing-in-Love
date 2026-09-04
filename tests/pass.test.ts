import assert from "node:assert/strict";
import test from "node:test";
import { generatePassToken, hashPassToken, isPassTokenShape, passUrl } from "@fil/domain";

test("pass tokens are opaque, url-safe and hashed before storage", async () => {
  const token = generatePassToken();
  assert.ok(isPassTokenShape(token), token);
  assert.notEqual(token, generatePassToken());
  const hash = await hashPassToken(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, await hashPassToken(token));
  assert.equal(passUrl("https://fallinginlove.kr/", token), `https://fallinginlove.kr/pass/${token}`);
});

test("token shape rejects short or unsafe strings", () => {
  assert.ok(!isPassTokenShape("short"));
  assert.ok(!isPassTokenShape("a".repeat(30) + "/"));
});
