import { expect, test } from "@playwright/test";

test("signup → onboarding → log food → change portion → persists after reload", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill("sicheres-passwort-1");
  await page.getByRole("button", { name: /konto erstellen/i }).click();

  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Starten" }).click();
  await page.getByRole("radio", { name: /Abnehmen/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Geschätzter Erhaltungsbedarf")).toBeVisible();
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: /Los geht/ }).click();

  await page.waitForURL("**/today");
  await expect(page.getByText("Protein")).toBeVisible();

  await page.goto("/log");
  await page.getByRole("searchbox").fill("haferflocken");
  await page.getByRole("link", { name: /^Haferflocken/ }).first().click();
  await page.getByRole("button", { name: /Hinzufügen/ }).click();
  await page.waitForURL("**/today");

  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }));
  await page.goto(`/diary/${today}`);
  await page.getByRole("link", { name: /Haferflocken/ }).click();
  await page.getByLabel("Menge").fill("3");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForURL("**/today");

  await page.reload();
  await page.goto(`/diary/${today}`);
  await expect(page.getByRole("link", { name: /Haferflocken/ })).toContainText("3 ×");
});
