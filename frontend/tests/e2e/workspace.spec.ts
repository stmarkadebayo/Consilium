import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("user can seed a council and run a query", async ({ page }) => {
  await page.goto("/app");

  await expect(page.getByText("Shape the advisory bench")).toBeVisible();
  await page.getByRole("button", { name: "Generate starter council" }).click();

  await expect(page.getByText("Starter council assembled. You can ask the first question now.")).toBeVisible({
    timeout: 20_000,
  });

  await page.getByPlaceholder("Should I raise a seed round now, or stay profitable for another six months?").fill(
    "Should I raise a seed round now or wait another quarter?",
  );
  await page.getByRole("button", { name: "Run council query" }).click();

  await expect(page.getByText("The council has responded.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Synthesis")).toBeVisible();
  await expect(page.getByText("Most actionable next step")).toBeVisible();
});

test("user can create and deactivate a custom persona", async ({ page }) => {
  await page.goto("/app");

  await page.getByPlaceholder("Naval Ravikant or Custom Operator").fill("The Allocator");
  await page
    .getByPlaceholder("Investor focused on leverage, timing, and long-term upside.")
    .fill("Capital allocator focused on downside-aware decision quality.");
  await page.getByPlaceholder("One belief per line, or comma separated.").fill("Preserve optionality\nAvoid forced bets");
  await page.getByPlaceholder("Clarity, compounding, low-regret decisions").fill("clarity, resilience");
  await page.getByRole("button", { name: "Add to council" }).click();

  await expect(page.getByText("Advisor added. Your council is ready to grow.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("The Allocator")).toBeVisible();

  await page.getByRole("button", { name: "Deactivate" }).last().click();

  await expect(page.getByText("The Allocator")).toBeVisible();
  await expect(page.getByText("inactive")).toBeVisible();
});
