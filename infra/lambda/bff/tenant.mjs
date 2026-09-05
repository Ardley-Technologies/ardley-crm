import { createHash } from "node:crypto";

/**
 * Tenant identity for the BFF.
 *
 * `tenants.id` is derived, never looked up or minted:
 * `uuid5(uuid5(DNS, "ardley-crm.tenants"), ardley_customer_id)`. Three
 * implementations have to agree -- this one, `scripts/tenant_uuid.py`, and
 * `uuid_generate_v5` in `sql/seed_w0.sql` -- so that `100081` is the same UUID in
 * local Docker, dev and demo (poc-plan.md section 8, "UUID map").
 *
 * uuid5 is hand-rolled: `uuid` is not a dependency of either BFF, and adding a
 * package is a supply-chain decision rather than a detail (see
 * .claude/rules/dependency-safety.md).
 *
 * This file lives in the Lambda asset directory because that is what gets bundled
 * and deployed; the local BFF imports it from here so the two cannot drift.
 */

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export function uuid5(namespace, name) {
  const bytes = createHash("sha1")
    .update(
      Buffer.concat([
        Buffer.from(namespace.replace(/-/g, ""), "hex"),
        Buffer.from(name, "utf8"),
      ]),
    )
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export const CRM_TENANT_NS = uuid5(DNS_NAMESPACE, "ardley-crm.tenants");

export function tenantUuidFor(customerId) {
  return uuid5(CRM_TENANT_NS, String(customerId));
}

/** Cosmetic only: friendlier slugs for the two tenants the CRM seeds. */
export const KNOWN_SLUGS = { 100004: "woodley", 100081: "envoy" };

/** An Ardley customer id is a digit string. Anything else is not a principal. */
export function normalizeCustomerId(value) {
  if (value === undefined || value === null) return null;
  const customerId = String(value).trim();
  return /^\d+$/.test(customerId) ? customerId : null;
}

/**
 * Postgres FKs need a `tenants` row before anything can reference it, and a real
 * principal may belong to a customer the CRM has never seen. RLS on `tenants` is
 * `using (id = current_tenant_id())` with no `with check`, so Postgres applies that
 * same expression to INSERT -- which passes precisely because `app.tenant_id` is
 * already set to this id.
 *
 * Slug and name are placeholders. The real name belongs to the
 * `ardley-customers-{env}` catalog, which the membership tier will read (W6.2).
 */
export async function ensureTenant(client, principal) {
  await client.query(
    `insert into tenants (id, ardley_customer_id, slug, name)
     values ($1, $2, $3, $4)
     on conflict (id) do nothing`,
    [
      principal.tenantUuid,
      principal.customerId,
      principal.slug || `customer-${principal.customerId}`,
      principal.name || `Customer ${principal.customerId}`,
    ],
  );
}
