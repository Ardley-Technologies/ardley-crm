import { expect, test } from "@playwright/test";

const bff = process.env.CRM_BFF_URL ?? "http://127.0.0.1:8787";

test.describe("W3 saved views home", () => {
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

  // Below 768px CRM.tsx swaps in MobileAdmin, which registers the stock Atomic
  // CRM contact/company screens instead of the graph ones, so none of the graph
  // UI asserted below exists there. Skipped rather than deleted so the gap stays
  // visible; see docs/w5.md.
  test.skip(
    ({ viewport }) => (viewport?.width ?? 1280) < 768,
    "graph UI is desktop-only (MobileAdmin lacks the graph resources)",
  );

  test("home lists My Borrowers and My Paired Agents", async ({ page }) => {
    await page.goto("/#/");
    await expect(
      page.getByRole("heading", { name: "My Borrowers" }),
    ).toBeVisible();
    // The roster plants a duplicate of each, so Willow appears twice under My
    // Borrowers and Avery once there plus once under My Paired Agents.
    await expect(
      page.getByRole("link", { name: "Willow Woodley" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Paired Agents" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Avery Agent" }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Willow Woodley" }).first().click();
    await expect(page.getByText("borrower").first()).toBeVisible();
  });
});
