import { expect, test } from "@playwright/test";

const bff = process.env.CRM_BFF_URL ?? "http://127.0.0.1:8787";

// The seed plants a second "Willow Woodley" as an intentional duplicate, so her
// name alone matches two links. This is the original, the one on the loan.
const WILLOW_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

test.describe("W5 walkthrough harden", () => {
  test.beforeAll(async ({ request }) => {
    // A refused connection throws rather than returning a non-ok response, so
    // without the catch this guard failed the suite instead of skipping it --
    // which is why CI reported these specs as broken rather than as unrun.
    let reachable = false;
    try {
      reachable = (await request.get(`${bff}/health`)).ok();
    } catch {
      reachable = false;
    }
    test.skip(!reachable, "local BFF is not running");
  });

  // Below 768px CRM.tsx swaps DesktopAdmin for MobileAdmin, which still
  // registers the stock Atomic CRM contact/company screens and no deals
  // resource at all -- so the loan triangle, merge picker, and NMLS search do
  // not exist there. Only the dashboard is shared. Skipped rather than deleted
  // so the gap stays visible; see docs/w5.md.
  test.skip(
    ({ viewport }) => (viewport?.width ?? 1280) < 768,
    "graph walkthrough UI is desktop-only (MobileAdmin lacks the graph resources)",
  );

  test("home labels the Avery duplicate and shows the POC banner", async ({
    page,
  }) => {
    await page.goto("/#/");
    await expect(
      page.getByText("This is a POC. Design is not frozen."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Borrowers" }),
    ).toBeVisible();
    const borrowers = page
      .locator("h2", { hasText: "My Borrowers" })
      .locator("..");
    // The seed plants exactly three duplicates: Avery Agent, Willow Woodley,
    // and Blair Borrower. Willow and Blair are two borrower rows each, so five
    // rows carry the label in this view.
    await expect(
      borrowers.locator("li", {
        hasText: "Avery Agent · borrower · possible duplicate",
      }),
    ).toHaveCount(1);
    await expect(
      borrowers.locator("li", {
        hasText: "Willow Woodley · borrower · possible duplicate",
      }),
    ).toHaveCount(2);
    await expect(
      borrowers.locator("li", {
        hasText: "Blair Borrower · borrower · possible duplicate",
      }),
    ).toHaveCount(2);
    // Nothing else may be flagged. The census used to mint the same name in
    // four cohorts, which put this label on 25 unrelated borrowers.
    await expect(
      borrowers.locator("li", { hasText: "· possible duplicate" }),
    ).toHaveCount(5);
    await expect(borrowers.locator("li", { hasText: "Ada Fenn" })).toHaveCount(
      1,
    );
    await expect(
      borrowers.locator("li", {
        hasText: "Ada Fenn · borrower · possible duplicate",
      }),
    ).toHaveCount(0);
    const agents = page
      .locator("h2", { hasText: "My Paired Agents" })
      .locator("..");
    await expect(
      agents.getByText("Avery Agent · real_estate_agent"),
    ).toBeVisible();
  });

  test("Willow show lists agent, LO, and team from the loan", async ({
    page,
  }) => {
    await page.goto("/#/contacts");
    await page.locator(`a[href$="/contacts/${WILLOW_ID}/show"]`).click();
    await expect(
      page.getByRole("heading", { name: "Loan triangle" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Avery Agent" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Phil Officer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Agents with a Grin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Merge into" }),
    ).toBeVisible();
  });

  test("Phil recruiting deal and coaching stub are on the LO", async ({
    page,
  }) => {
    await page.goto("/#/");
    await expect(
      page.getByRole("heading", { name: "Recruiting" }),
    ).toBeVisible();
    const recruiting = page
      .locator("h2", { hasText: "Recruiting" })
      .locator("..");
    await recruiting.getByRole("link", { name: /hire/i }).first().click();
    // Bare "recruit" also matches the contact "Morgan Recruit" on this page.
    // Assert the pipeline instead: the point is that it is not a loan pipeline.
    await expect(page.getByText("Recruiting - All Roles")).toBeVisible();
    await page.goto("/#/contacts");
    await page.getByRole("link", { name: "Phil Officer" }).first().click();
    await expect(page.getByText("OPTAH / Coaching")).toBeVisible();
    await expect(page.getByText("Coming.")).toBeVisible();
  });

  test("Woodley never sees Ellis Envoy", async ({ page }) => {
    await page.goto("/#/contacts");
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ellis Envoy" })).toHaveCount(
      0,
    );
    await page.getByLabel("Search name or NMLS").fill("Ellis");
    await expect(page.getByRole("link", { name: "Ellis Envoy" })).toHaveCount(
      0,
    );
  });

  test("contact search filters as you type", async ({ page }) => {
    await page.goto("/#/contacts");
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }).first(),
    ).toBeVisible();
    await page.getByLabel("Search name or NMLS").fill("999001");
    // The list stays unfiltered until the query returns. Wait on the count
    // dropping rather than on a name: two contacts are called Avery Agent, so a
    // name locator trips strict mode against the pre-filter list.
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }),
    ).toHaveCount(0);
    // Only the agent carries NMLS 999001; the duplicate Avery is filtered out.
    await expect(page.getByRole("link", { name: "Avery Agent" })).toHaveCount(
      1,
    );
  });
});
