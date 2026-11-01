// Run separately with: npm run test:rules (requires Firestore emulator and Java 21+).
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { beforeAll, afterAll, it } from "vitest";
import { readFileSync } from "node:fs";
import { demoEvent } from "../src/demo";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-gather",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
it("isolates event owners and refuses unauthenticated writes", async () => {
  const own = doc(
    env.authenticatedContext("alice").firestore(),
    "users/alice/events/test",
  );
  await assertSucceeds(setDoc(own, demoEvent()));
  await assertSucceeds(getDoc(own));
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("bob").firestore(),
        "users/alice/events/test",
      ),
    ),
  );
  await assertFails(
    setDoc(
      doc(env.unauthenticatedContext().firestore(), "users/alice/events/x"),
      demoEvent(),
    ),
  );
});
it("refuses invalid documents and quota tampering", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertFails(
    setDoc(doc(db, "users/alice/events/bad"), { ...demoEvent(), extra: true }),
  );
  await assertFails(setDoc(doc(db, "quotas/alice"), { count: 0 }));
});
