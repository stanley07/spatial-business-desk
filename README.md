# SPATIAL BUSINESS DESK
### Your Business. Beyond the Screen.

**A new dimension of business productivity.**

Imagine walking into your business dashboard instead of looking at it.

See your inventory. Reach for products. Prepare orders. Confirm sales. Watch your business respond around you.

**Spatial Business Desk brings everyday business operations into an interactive 3D workspace — powered by Meta Immersive Web SDK.**

**[ENTER THE LIVE SHOWROOM](https://spatial-business-desk.pages.dev/)**

*Explore the interactive workspace in your browser or Meta Quest Browser.*

**[WATCH COMPETITION VIDEO (YouTube)](https://youtu.be/H54b70JewhE)** · **[EXPLORE THE CODE](https://github.com/stanley07/spatial-business-desk)**

---

## BUILT FOR META VR START 2026

### Reimagining Business Productivity for the Immersive Web

**Built for the Meta VR Start Developer Competition 2026**

Spatial Business Desk explores a future where immersive technology is not just for gaming and entertainment, but also for the entrepreneurs and business owners who power the everyday economy.

Built with Meta Immersive Web SDK, our prototype brings inventory, order preparation, and sales confirmation into one spatial experience.

**Innovation category:** Productivity / New Experience

---

## COMPETITION JUDGE VERIFICATION GUIDE

### How to Experience and Evaluate the Prototype

Spatial Business Desk supports both public browser viewing and local simulated WebXR evaluation. Please review the three interaction modes below to assess the application accurately:

#### 1. Desktop Mode (Public Website — Mouse Fallback)
- **Live URL:** [https://spatial-business-desk.pages.dev/](https://spatial-business-desk.pages.dev/)
- **How to interact:** Click **"Enter Experience"** on the landing page (or append `#experience` to the URL) to access the 3D showroom.
- **Input mechanism:** Standard desktop browsers run in **Desktop Mouse Fallback** mode (`canvasPointerEvents: true`).
- **Functionality:** Click products to stage them into the cart kiosk, click `[+]`/`[-]`/`[×]` buttons on cart rows to edit quantities, click **"Undo Edit"** to revert, click **"Clear Cart"** to reset, and click **"Confirm Sale"** on the terminal to finalize the order.
- **Scope note:** Desktop mode uses mouse pointer raycasting, which provides functional verification of the sales flow but does not demonstrate optical hand tracking.

#### 2. XR Simulator Mode (Local Development — Hands-First WebXR)
- **Environment:** Local development server running the Meta Immersive Web Emulation Runtime (IWER).
- **Reproduction steps:**
  ```bash
  git clone https://github.com/stanley07/spatial-business-desk.git
  cd spatial-business-desk
  npm install
  npm run dev
  ```
- **How to test:**
  1. `npm run dev` launches the CLI-managed dev server and opens a Chromium browser window hosting the IWER Meta Quest 3 device emulator.
  2. Click **"Enter Experience"** on the landing page to reveal the 3D workspace.
  3. In the IWER emulator toolbar, accept the offered WebXR session and set input mode to **Simulated Hands**.
  4. Use the simulated right hand to point the target ray at product pedestals and cart buttons, pinching to interact.
- **Reference recording:** The official competition video ([https://youtu.be/thtxHUW_JVw](https://youtu.be/thtxHUW_JVw)) demonstrates this genuine hands-first simulator execution end-to-end.

#### 3. Physical Meta Quest Headset (XR Session Offer Configured)
- **Configuration:** The application configures `world.xr.offer: "always"` in `iwsdk.config.json` with `handTracking: true`, which initiates the WebXR Session Offer API (`navigator.xr.offerSession`) supported by Meta Quest Browser in Horizon OS.
- **Hardware testing disclosure:** **Physical hardware testing on a Meta Quest headset remains unverified.** All hands-first WebXR validation in this submission was performed using the IWER Meta Quest 3 simulator. Do not assume physical headset performance has been verified in QA.

---

## VALIDATED PROTOTYPE FUNCTIONALITY

### Technical Validation Summary

The application’s transactional logic and spatial interface have been validated through two distinct testing phases:

#### A. End-to-End Retail Reproduction (10/10 Steps Passed)
Recently performed automated simulator reproduction exercising the complete retail lifecycle:
1. **Workspace entry:** Landing page overlay dismissed; 3D workspace active.
2. **Product targeting:** Simulated hand rays acquire Rice and Cooking Oil with visual hover highlights.
3. **Multi-product staging:** Rice ×2 and Cooking Oil ×1 staged into the cart; Order Total staged at **₦58,500** while pedestal stock remains unchanged at 12 and 8 (no premature stock deduction).
4. **Quantity reduction:** Rice row `[-]` button decrements quantity to ×1; Order Total updates to **₦33,500**.
5. **Item removal:** Cooking Oil row `[×]` button removes the product; Order Total updates to **₦25,000**.
6. **Undo action:** `SBD-CART:UNDO` restores Cooking Oil ×1 from the cart history stack; Order Total returns to **₦33,500**.
7. **Clear Cart & pre-confirmation lock:** `SBD-CART:CLEAR` empties the basket; deliberate pinch on `SBD-CONFIRM` is rejected (sale confirmation is disabled on an empty cart).
8. **New order staging:** Cooking Oil `[+]` stages 1 unit; Order Total reads **₦8,500**; Confirm Sale re-enables.
9. **Deliberate sale execution:** Pinching `SBD-CONFIRM` commits the transaction:
   - **Cooking Oil stock:** Decrements from **8 → 7**.
   - **Total revenue:** Increments from **₦0 → ₦8,500**.
   - **Completed sales:** Advances from **0 → 1**.
   - **Cart basket:** Resets to empty (**₦0**).
10. **Post-transaction safeguards:** Counters accurately reflect updated business metrics; post-confirmation Undo is locked (committed transactions cannot be undone); multi-event pinch deduplication prevents accidental duplicate transactions.

#### B. Previously Established Acceptance Checks
- **9/9 Hands-First Acceptance Suite:** Verified ergonomic ray angle, poke collider registration, cart kiosk clearance, multi-product staging, granular editing, reversible history stack, empty-cart guard, deliberate transaction commit, and multi-event debounce.
- **4/4 Desktop Fallback Suite:** Verified 2D canvas mouse raycasting, product selection, row editing, and transaction confirmation.

### Data & Financial Scope
Spatial Business Desk is a prototype retail concept with an in-memory sample ledger. All currency figures (Nigerian Naira ₦), stock counts, and sales metrics represent temporary demonstration data for prototype evaluation. The application does not connect to live banking networks or merchant settlement accounts.

---

## WELCOME TO YOUR SPATIAL WORKSPACE

### What if managing a business felt as natural as reaching for an object?

Traditional business software puts operations behind menus, tables, and separate screens.

Spatial Business Desk explores another approach: arrange business information in space, interact directly with products, and understand the results of your actions as they happen.

**Less navigating. More interacting.**

---

## EXPERIENCE THE POSSIBILITIES

### Your Business, Brought to Life

**01 — See Your Inventory**

Step into a three-dimensional workspace where everyday products become interactive objects.

Explore available items and view their stock information without navigating through pages of tables.

**02 — Select with Your Hands**

Reach toward a product using immersive hand interaction to begin preparing a sale.

Our hands-first workflow has been demonstrated end-to-end using simulated WebXR hands in a development environment.

**03 — Build an Order**

Select products and see the pending order total update.

Inventory remains unchanged until the sale is explicitly confirmed.

**04 — Confirm with Confidence**

Complete a sale through a deliberate confirmation action.

The system updates the relevant stock quantity, recorded sales count, and revenue totals.

**05 — See the Business Respond**

Watch operational information reflect the completed transaction.

The result is a more tangible way to understand how everyday business decisions affect your inventory.

---

## THE MOMENT EVERYTHING CONNECTS

### From Physical Gesture to Business Action

**Reach. Select. Review. Confirm.**

One continuous immersive workflow.

Spatial Business Desk demonstrates how interaction with a virtual product can translate into a meaningful business operation, without losing the deliberate confirmation step.

**This is more than an animated product display. It's a working prototype of spatial business interaction.**

**[TRY THE LIVE EXPERIENCE](https://spatial-business-desk.pages.dev/)**

---

## DESIGNED FOR THE REAL WORLD

### Built Around Everyday Commerce

Picture a shop owner preparing sales, a warehouse manager reviewing inventory, or a growing business owner examining operations in a shared spatial environment.

Spatial Business Desk begins with a focused retail workflow: three everyday product categories, an interactive order, and sales confirmation.

The larger vision is a more intuitive interface for business information — one that could eventually connect inventory, financial records, collaboration, and operational insights.

*Current release: an interactive prototype with in-memory sample business data. No live merchant financial records are processed.*

---

## WHY SPATIAL? WHY NOW?

### Business Software Is Ready for a New Perspective.

Business software has become powerful, but much of its interface remains built around flat screens and complex navigation.

Immersive technology invites us to rethink that relationship.

Instead of only reading inventory, imagine seeing it around you.

Instead of navigating multiple pages to prepare an order, imagine interacting directly with products.

Instead of separating actions from results, imagine experiencing them in one connected workspace.

Spatial Business Desk is an early exploration of that possibility.

**The next business interface might not be another screen. It might be a space.**

---

## THE TECHNOLOGY BEHIND THE EXPERIENCE

### Built for the Immersive Web

- **Meta Immersive Web SDK (IWSDK v1.1.0):** Immersive interaction and spatial application development.
- **WebXR:** Browser-based immersive experiences across headsets and desktop environments.
- **Three.js (r185):** Real-time three-dimensional visualization and custom spatial geometry.
- **EliCS (v3.4.2):** High-performance entity-component system for reactive spatial interactions.
- **TypeScript + Vite:** The modern application and build foundation.
- **IWER:** Simulated WebXR interaction used for development and hands-first testing.
- **Cloudflare Pages:** Public edge web deployment.
- **Open Source on GitHub:** Explore the implementation, learn from the prototype, and follow its development.

**[VIEW SOURCE CODE](https://github.com/stanley07/spatial-business-desk)**

---

## WHERE WE GO NEXT

### From Spatial Desk to Spatial Business Operating System

Today, Spatial Business Desk demonstrates a hands-first retail transaction workflow.

Tomorrow, we envision a broader immersive business workspace with capabilities such as:

- Spatial analytics and business intelligence
- Inventory replenishment and low-stock alerts
- Richer transaction histories
- Connected merchant data and persistent records
- Collaborative business workspaces
- More intuitive training and guided operations

These are future product directions, not features claimed as completed in the current release.

Our ambition is to help make the next generation of business software more visual, approachable, and interactive.

---

## EXPERIENCE THE NEXT DIMENSION

### Don't Just Imagine the Future of Business. Enter It.

Explore the working prototype and see what happens when inventory, interaction, and business decisions meet in one immersive environment.

**[ENTER SPATIAL BUSINESS DESK](https://spatial-business-desk.pages.dev/)**

**[WATCH COMPETITION VIDEO (YouTube)](https://youtu.be/thtxHUW_JVw)**

*Built for Meta VR Start Developer Competition 2026.*

*Powered by Meta Immersive Web SDK.*

---

## FOOTER

**SPATIAL BUSINESS DESK**

*Your Business. Beyond the Screen.*

An immersive productivity concept exploring the future of business operations.

**Live Experience:** [https://spatial-business-desk.pages.dev/](https://spatial-business-desk.pages.dev/)
**Competition Video:** [https://youtu.be/thtxHUW_JVw](https://youtu.be/thtxHUW_JVw)
**Source Code:** [https://github.com/stanley07/spatial-business-desk](https://github.com/stanley07/spatial-business-desk)
**Competition:** Meta VR Start Developer Competition 2026
**Technology:** Meta Immersive Web SDK · WebXR · Three.js · TypeScript

© 2026 Spatial Business Desk. Competition prototype.

*Independent competition submission built using Meta developer technology; not presented as an official Meta product.*
