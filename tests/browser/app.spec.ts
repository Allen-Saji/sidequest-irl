import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { testWallet } from "./wallet";

test("phone layouts, search, navigation, install guidance, and offline fallback", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Meet Maya/ })).toBeVisible();
  for (const width of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("textbox", { name: "Find a person or topic" })
    .fill("music");
  await expect(page.getByRole("button", { name: /Meet Maya/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Meet Leo/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  mkdirSync(".local/screenshots", { recursive: true });
  await page.screenshot({
    path: ".local/screenshots/people-mobile.png",
    fullPage: false,
  });
  await page.getByRole("tab", { name: "Quests", exact: true }).click();
  await page.getByRole("button", { name: /Find the hole in my pitch/ }).click();
  await expect(
    page.getByRole("heading", { name: "Find the hole in my pitch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "I can help. Claim this quest" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/screenshots/quest-mobile.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Every good hello starts/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Install Sidequest", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const manifest = await (
    await context.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /THE NEXT HELLO CAN WAIT/ }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/screenshots/offline-mobile.png",
    fullPage: true,
  });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

async function join(page: Page, actor: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: "Choose a wallet" }).click();
  await page.getByRole("button", { name: `Sidequest Test ${actor}` }).click();
  await page
    .getByLabel("Your name", { exact: true })
    .fill(actor === "maya" ? "Maya" : "Leo");
  await page
    .getByLabel("What are you building?", { exact: true })
    .fill(
      actor === "maya"
        ? "Building a tiny music app"
        : "Learning Move, one object at a time",
    );
  await page
    .getByLabel(/Ask me about/)
    .fill(
      actor === "maya"
        ? "Music apps and getting an idea across"
        : "Frontend and TypeScript",
    );
  await page
    .getByLabel(/I could use help with/)
    .fill(
      actor === "maya"
        ? "Help me sharpen my pitch."
        : "Explain shared objects to me.",
    );
  await page.getByLabel(/Show my profile/).check();
  await page.getByLabel(/Open to chat for/).check();
  await page
    .getByRole("button", { name: /Join the adventure|Save my profile/ })
    .click();
  await expect(page.getByText("Your field notes are saved.")).toBeVisible();
}

test("two independent phone sessions complete a real testnet ticket", async ({
  browser,
}) => {
  const maya = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const leo = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await testWallet(maya, "maya");
  await testWallet(leo, "leo");
  const creator = await maya.newPage();
  const helper = await leo.newPage();
  await join(creator, "maya");
  await join(helper, "leo");
  // Create through the actual UI rather than claiming a pre-seeded object.
  await creator
    .getByRole("button", { name: "Put a quest out there", exact: true })
    .click();
  const title = `Find my pitch gap ${Date.now().toString().slice(-5)}`;
  await creator.getByLabel("Quest title", { exact: true }).fill(title);
  await creator
    .getByLabel("Public meeting point", { exact: true })
    .fill("Near the coffee counter");
  await creator.getByRole("button", { name: "Put my quest out there" }).click();
  await expect(creator.getByRole("heading", { name: title })).toBeVisible();
  const questUrl = creator.url();
  await helper.goto(questUrl);
  await helper
    .getByRole("button", { name: "I can help. Claim this quest" })
    .click();
  await expect(helper.getByText("YOUR MATCHING CODE")).toBeVisible();
  await helper.setViewportSize({ width: 320, height: 740 });
  expect(
    await helper.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await helper.setViewportSize({ width: 390, height: 844 });
  await creator.reload();
  await expect(creator.getByText("YOUR MATCHING CODE")).toBeVisible();
  expect(await helper.locator(".matching-code").textContent()).toEqual(
    await creator.locator(".matching-code").textContent(),
  );
  mkdirSync(".local/screenshots", { recursive: true });
  await helper.screenshot({
    path: ".local/screenshots/claimed-mobile.png",
    fullPage: true,
  });
  await helper.getByRole("button", { name: "We met. Confirm my half" }).click();
  await expect(
    helper.getByText(/YOUR HALF CONFIRMED - Waiting for Maya/),
  ).toBeVisible();
  await helper.screenshot({
    path: ".local/screenshots/waiting-mobile.png",
    fullPage: true,
  });
  await creator.reload();
  await creator
    .getByRole("button", { name: "We met. Confirm my half" })
    .click();
  await expect(
    creator.getByRole("heading", { name: "A GOOD ENCOUNTER." }),
  ).toBeVisible();
  await expect(creator.getByText("REAL SUI TESTNET RECEIPT")).toBeVisible();
  await helper.reload();
  await expect(
    helper.getByRole("heading", { name: "A GOOD ENCOUNTER." }),
  ).toBeVisible();
  await creator.screenshot({
    path: ".local/screenshots/completed-mobile.png",
    fullPage: true,
  });
  await creator.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(
    creator.getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible();
  await maya.close();
  await leo.close();
});

test("rejected wallet sign-in stays recoverable without a session or success", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await testWallet(context, "leo", true);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: "Choose a wallet" }).click();
  await page.getByRole("button", { name: "Sidequest Test leo" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Leo");
  await page
    .getByLabel("What are you building?", { exact: true })
    .fill("Learning Move");
  await page
    .getByRole("button", { name: /Join the adventure|Save my profile/ })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Wallet approval canceled",
  );
  await expect(
    page.getByRole("button", { name: /Join the adventure|Save my profile/ }),
  ).toBeEnabled();
  const response = await context.request.get(
    "http://localhost:3100/api/profile",
  );
  expect((await response.json()).address).toBeNull();
  await expect(page.getByText("Your field notes are saved.")).toHaveCount(0);
  await context.close();
});
