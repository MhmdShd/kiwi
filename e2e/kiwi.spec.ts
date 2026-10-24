import { test, expect } from "@playwright/test";

test.describe("Kiwi Chat", () => {
  const baseURL = "https://kiwi.mhmdalishd.com";

  test("login page loads", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await expect(page.locator("text=Kiwi")).toBeVisible();
    await expect(page.locator("text=Sign In")).toBeVisible();
  });

  test("register and login flow", async ({ page }) => {
    const email = `test_${Date.now()}@example.com`;
    const password = "testpass123";

    await page.goto(`${baseURL}/login`);
    await page.click("text=Register");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Sign Up")');

    // Should redirect to chat after register+login
    await page.waitForURL(`${baseURL}/chat`, { timeout: 10000 });
    await expect(page.locator("text=New Chat")).toBeVisible();
  });

  test("create chat and send message", async ({ page }) => {
    const email = `test_${Date.now()}@example.com`;
    const password = "testpass123";

    // Register first
    await page.goto(`${baseURL}/login`);
    await page.click("text=Register");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Sign Up")');
    await page.waitForURL(`${baseURL}/chat`, { timeout: 10000 });

    // Create new chat
    await page.click('button:has-text("New Chat")');

    // Send message
    await page.fill('input[placeholder="Type message..."]', "Say hi in 2 words");
    await page.click('button:has-text("Send")');

    // Wait for assistant response
    await expect(page.locator("text=K").first()).toBeVisible({ timeout: 30000 });
  });

  test("chat history persists", async ({ page }) => {
    const email = `test_${Date.now()}@example.com`;
    const password = "testpass123";

    // Register and create chat
    await page.goto(`${baseURL}/login`);
    await page.click("text=Register");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Sign Up")');
    await page.waitForURL(`${baseURL}/chat`, { timeout: 10000 });

    await page.click('button:has-text("New Chat")');
    await page.fill('input[placeholder="Type message..."]', "Hello Kiwi");
    await page.click('button:has-text("Send")');

    // Wait for response
    await page.waitForTimeout(5000);

    // Reload page
    await page.reload();
    await page.waitForURL(`${baseURL}/chat`, { timeout: 10000 });

    // Chat should appear in sidebar
    await expect(page.locator("text=Hello Kiwi").first()).toBeVisible();
  });
});
