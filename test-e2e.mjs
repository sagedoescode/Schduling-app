// E2E smoke test: admin login -> student booking -> leave browser open for manual cancel
import { chromium } from "playwright";

const URL = "https://bookmyenglishtutor.vercel.app";
const ADMIN_EMAIL = "lucaspinheirofab@gmail.com";
const ADMIN_PASSWORD = "AirbusA320#";
const TEST_STUDENT_NAME = "E2E Test Student";
const TEST_STUDENT_PHONE = "5592999999999";

const log = (msg) => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${msg}`);

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  log("Opening app");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 60000 });

  // --- Admin login ---
  log("Clicking Admin button");
  await page.getByRole("button", { name: /admin/i }).first().click();

  log("Waiting for login modal");
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });

  log("Filling admin credentials");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  log("Waiting for admin dashboard");
  await page.waitForSelector("text=Admin Dashboard", { timeout: 10000 });
  log("✓ Admin login successful");

  // --- Switch to Student view ---
  log("Switching to Student View");
  await page.getByRole("button", { name: /student view/i }).click();

  // --- Student booking flow ---
  log("Filling student details");
  await page.getByPlaceholder(/your name/i).fill(TEST_STUDENT_NAME);
  await page.getByPlaceholder(/whatsapp number/i).fill(TEST_STUDENT_PHONE);
  await page.getByRole("button", { name: /continue to schedule/i }).click();

  log("Waiting for time slots");
  await page.waitForSelector("text=Available Slots", { timeout: 10000 });

  // Pick the last available slot (furthest in the future to minimize collisions)
  log("Picking a time slot");
  const slotButtons = page.locator('div.grid button:not([disabled])').filter({ hasText: /^\d{1,2}:\d{2}$/ });
  const slotCount = await slotButtons.count();
  if (slotCount === 0) {
    // Try next day in the day picker
    log("No slots on selected day - cycling through days to find one");
    const dayButtons = page.locator('button:has(div.text-\\[10px\\])').filter({ hasText: /^\s*\w{3}/ });
    const days = await dayButtons.count();
    let found = false;
    for (let i = 0; i < days && !found; i++) {
      await dayButtons.nth(i).click();
      await page.waitForTimeout(400);
      const n = await slotButtons.count();
      if (n > 0) { found = true; break; }
    }
    if (!found) {
      log("✗ No available slots anywhere this view - aborting. Add some availability as admin first.");
      return;
    }
  }
  const finalSlotCount = await slotButtons.count();
  await slotButtons.nth(finalSlotCount - 1).click();

  // Class type defaults to normal50 - optionally change to trial for test
  log("Selecting Trial class type");
  const trialBtn = page.getByRole("button", { name: /trial \(30 min\)/i });
  if (await trialBtn.isVisible()) await trialBtn.click();

  log("Clicking Book Now");
  // WhatsApp popup opens - we block that before clicking
  await context.addInitScript(() => { window.open = () => null; });
  await page.getByRole("button", { name: /book now/i }).click();

  log("Waiting for Booked! confirmation");
  await page.waitForSelector("text=Booked!", { timeout: 10000 });
  log("✓ Booking created successfully");

  log("--- TEST COMPLETE ---");
  log("Browser left open. You can now:");
  log("  1. Switch back to Admin to see the test class on the schedule");
  log("  2. Cancel it via the three-dot menu or Unlock Weekly if recurring");
  log(`  3. Look for "${TEST_STUDENT_NAME}" to spot the test booking`);
  log("Close the browser when you're done. Ctrl+C here to exit the script.");

  // Keep the process alive so the browser stays open
  await new Promise(() => {});
})().catch(err => {
  console.error("\n[E2E] Test failed:", err.message);
  console.error("Browser left open so you can inspect.");
  console.error("Press Ctrl+C to exit.");
  return new Promise(() => {});
});
