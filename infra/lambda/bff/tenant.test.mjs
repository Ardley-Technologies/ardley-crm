import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { normalizeCustomerId, tenantUuidFor, uuid5 } from "./tenant.mjs";

const REPO = path.resolve(import.meta.dirname, "../../..");

// From scripts/tenant_uuid.py, which asserts the same two values, and from the rows
// sql/seed_w0.sql writes with uuid_generate_v5.
const SEEDED = {
  100004: "4b51bd26-ea4f-5777-b9d9-780dbb91853e",
  100081: "28dd4130-fe59-5ada-a3ce-78c82259e9dd",
};

describe("tenant uuid derivation", () => {
  test("reproduces the UUIDs the database is already seeded with", () => {
    for (const [customerId, expected] of Object.entries(SEEDED)) {
      expect(tenantUuidFor(customerId)).toBe(expected);
    }
  });

  // The whole point of deriving rather than looking up is that every environment
  // agrees. If this drifts, a tenant silently points at a UUID with no rows behind
  // it, and the failure looks like "the CRM is empty" rather than like a bug here.
  test("agrees with the Python implementation used by the seed generators", () => {
    const customerIds = ["100004", "100081", "100033", "1", "999999"];
    const script = [
      "import sys",
      "sys.path.insert(0, 'scripts')",
      "from tenant_uuid import tenant_uuid",
      `print(" ".join(str(tenant_uuid(c)) for c in ${JSON.stringify(customerIds)}))`,
    ].join("\n");
    const fromPython = execFileSync("python3", ["-c", script], {
      cwd: REPO,
      encoding: "utf8",
    })
      .trim()
      .split(" ");

    expect(fromPython).toHaveLength(customerIds.length);
    expect(customerIds.map(tenantUuidFor)).toEqual(fromPython);
  });

  test("is a version 5, RFC 4122 variant UUID", () => {
    const uuid = tenantUuidFor("100004");
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  test("distinct customers never collide", () => {
    const ids = ["100004", "100081", "100033", "100011", "100000", "100034"];
    expect(new Set(ids.map(tenantUuidFor)).size).toBe(ids.length);
  });

  test("matches the RFC 4122 worked example", () => {
    // uuid5(DNS, "python.org") from the RFC/reference implementations, so a broken
    // hash or bit-twiddle is caught independently of our own fixtures.
    expect(uuid5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "python.org")).toBe(
      "886313e1-3b8a-5372-9b90-0c9aee199e5d",
    );
  });
});

describe("customer id normalisation", () => {
  test("accepts a digit string, trimming whitespace", () => {
    expect(normalizeCustomerId(" 100004 ")).toBe("100004");
    expect(normalizeCustomerId(100004)).toBe("100004");
  });

  test("refuses anything that is not a plain customer id", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "  ",
      "abc",
      "100004; drop table tenants",
      "100004 or 1=1",
      "../100004",
      "1e5",
    ]) {
      expect(normalizeCustomerId(bad)).toBeNull();
    }
  });
});
