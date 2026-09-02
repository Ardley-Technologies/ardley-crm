import { expect, test } from "@playwright/test";

// Graph UI against the local BFF + W1 seed. Skip when the Atomic
// Supabase e2e stack is the only server (no CRM_BFF_URL).
const bff = process.env.CRM_BFF_URL ?? "http://127.0.0.1:8787";

// The W3 roster plants a second "Willow Woodley" as an intentional duplicate, so
// her name alone matches two links. This is the original, the one on the loan.
const WILLOW_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

test.describe("W2 loan triangle", () => {
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

  test("opens Willow and walks spouse, team, and loan parties", async ({
    page,
  }) => {
    await page.goto("/#/contacts");
    const willow = page.locator(`a[href$="/contacts/${WILLOW_ID}/show"]`);
    await expect(willow).toBeVisible();
    await willow.click();
    await expect(page.getByText("borrower").first()).toBeVisible();

    // Scope each claim to its own section. Sam is both the spouse (Related) and
    // the co-borrower (Loan triangle), and the triangle repeats the deal link on
    // every row, so page-wide name locators match several elements.
    const section = (heading: string) =>
      page.locator("h2", { hasText: heading }).locator("..");
    await expect(
      section("Related").getByRole("link", { name: "Sam Spouse" }),
    ).toBeVisible();
    const triangle = section("Loan triangle");
    await expect(
      triangle.getByRole("link", { name: "Sam Spouse" }),
    ).toBeVisible();
    await expect(
      triangle.getByRole("link", { name: "Avery Agent" }),
    ).toBeVisible();

    await section("Deals")
      .getByRole("link", { name: "Willow purchase" })
      .click();
    await expect(page.getByText("referring_agent")).toBeVisible();
    await page.getByRole("link", { name: "Avery Agent" }).first().click();
    await expect(page.getByText("nmls: 999001")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Agents with a Grin" }).first(),
    ).toBeVisible();
  });
});
