# Common post-auth UX audit

Date: September 21, 2026

## Product lens

The core student job is: **open Common, understand what is happening soon, decide whether it fits, and join or save it in seconds.** The review assumes students often use the app one-handed, between classes, with limited attention, and arrive through links shared in group chats.

The current direction has a recognizable visual identity and a warm, inclusive voice. The main problem is that the signed-in experience still behaves like a marketing page. It delays useful event information and makes frequent actions feel more involved than they need to be.

## Evidence from the current build

The local signed-in preview was measured at a 390 x 844 viewport.

- The first event card begins at **927px**, below the initial viewport. The welcome section uses 225px and the promotional card uses another 248px before discovery controls and events.
- **23 of 36** visible interactive elements are smaller than a practical 44 x 44 mobile touch target. Save buttons are 26 x 26, category chips are 31px high, date tabs are 36px high, and header buttons are 36 x 36.
- Event cards remain in a two-column grid at 390px. This forces titles into several lines and reduces metadata and navigation labels to very small type.
- Joining requires finding an event, opening its detail view, and then using the join action. The card itself offers only open and save.
- The hosting form has **10 fields, 9 required**. Its publish button begins around 993px below the top of the mobile viewport.
- “My week” contains both joined and saved events, while “Saved” is also a separate navigation destination.
- Mobile navigation offers “Host” as a creation action but gives no equally direct route to manage existing hosted events.

## Priority 0: fix before a student pilot

### 1. Put actual events in the first viewport

**Issue:** The post-auth welcome and promotional hero occupy most of the initial screen. A returning student already understands the product and needs current information.

**Change:** Replace both sections with a compact contextual header such as “Tonight at Babson” and one short line of context. Show the first event immediately underneath. Keep the campaign art for the public landing page, onboarding, empty states, or an occasional dismissible card after the first events.

**Target:** On common phone sizes, at least one complete event or two useful event summaries should appear without scrolling.

### 2. Replace the two-column phone grid

**Issue:** Two columns preserve more poster art but make event names, time, location, host, and state hard to scan. Students compare plans by time, place, vibe, cost, and availability; the current layout gives too much area to decorative artwork.

**Change:** Use a one-column compact card or horizontal list item on phones. Give each row a small image, title, time, location, cost, availability, save, and a clear action. Keep larger Swiss poster cards for a single featured plan and tablet/desktop layouts.

Suggested mobile row:

```text
[image]  Coffee & a little conversation    [save]
         Today, 3:00 PM · Reynolds
         Free · 4 spots left
         [View]                    [Join]
```

### 3. Make joining fast and persistent

**Issue:** Join is hidden behind event detail and can move below long descriptions or announcements. The card language “Come as you are” does not communicate capacity.

**Change:** Add a Join/Waitlist action to cards. Open event detail as a full-screen mobile route or bottom sheet with a sticky action bar. Show time, place, cost, availability, and host trust before the long description. After joining, show “You’re going” with immediate actions for Add to calendar, Share, and View my plans.

Joining is reversible, so a separate confirmation dialog adds friction without useful protection.

### 4. Consolidate planning and hosting

**Issue:** “My week” includes saved events, “Saved” repeats part of it, and hosted events are difficult to reach on mobile.

**Change:** Replace “My week” and “Saved” with **My plans**. Inside it, use three segments:

- Going
- Saved
- Hosting

Group plans by Today, This week, and Later. Put calendar export in the overflow menu. For hosted items, expose Edit, Message attendees, and Cancel from the event management view.

Recommended bottom navigation:

```text
Discover        My plans        Create
```

Keep notifications and profile in the compact top bar. The Create button opens an action sheet with “Host a hangout” and “Suggest a campus event.”

### 5. Make every primary control thumb-friendly

**Issue:** Several controls are visually neat but physically difficult to hit while walking or using one hand.

**Change:** Use a 44 x 44 minimum interaction area for header icons, save, chips, filters, and footer links. The icon can remain visually smaller inside that area. Raise bottom navigation labels from 8px to at least 11px and card metadata to at least 12px. Body copy should generally remain 14px or larger on phones.

## Priority 1: simplify the main workflows

### Discover and decide

Current path:

```text
Open app -> pass welcome -> pass promo -> choose date -> choose category
-> scan cramped cards -> open detail -> scroll/inspect -> join
```

Proposed path:

```text
Open app -> see Tonight/Today plans -> Join
                                  -> or open detail -> sticky Join
```

Use quick filters that match student intent: Tonight, Tomorrow, This weekend, Free, and Student-hosted. Put all other filters in one bottom sheet. Keep search visible or available from a prominent search action. Show active filters in a removable chip row.

### Event detail and sharing

Give every event a stable URL such as `/events/[id]`. Modal-only state cannot be shared reliably or restored with the browser back button. Add the native Web Share action with Copy link as a fallback; WhatsApp and group chats are likely acquisition paths for individual events.

For externally registered campus events, distinguish the actions:

- **Register on event site** opens the source.
- **Save to My plans** keeps it in Common.

This avoids telling a student they are registered when Common has only saved an external listing.

Recommended detail order:

1. Title, status, share, and save
2. Date/time, location, cost, and availability
3. Primary action
4. Description and “What to expect”
5. Host/source and verification
6. Safety actions

Report and block should remain calm but readable. Tiny footer text makes a trust feature look unavailable.

### Host a hangout

Current form asks for every field in one long surface. Use a short mobile flow with progressive disclosure:

1. **The plan:** name, date/time, and location
2. **The vibe:** short description, category, capacity, and cost
3. **Review:** expectations and cancellation policy, already filled with sensible defaults

Default the end time to one hour after the start. Keep capacity at 8 and cost at free unless changed. Save drafts locally or to the account. Show a preview before Publish. After publishing, offer Share invitation and View host tools.

The initial step should feel finishable in under a minute. Optional detail can improve the listing without blocking a spontaneous plan.

### Notifications

Treat notifications as an inbox of actionable changes rather than a generic modal. Group unread items, identify the related event, and offer the relevant action: View update, Confirm new time, or Open waitlist promotion. Use a numeric badge only for unread items and mark them read when opened.

## Priority 2: make the visual system feel intentional

### Icons

The interface mixes Lucide icons, abstract poster glyphs, decorative stars, arrows, colored dots, and text labels. The result is expressive but does not establish a predictable interaction language.

Use one icon family for controls:

- 20px for inline actions
- 22–24px for primary navigation
- consistent 1.75–2px stroke
- filled or tinted state for selected Save and navigation items
- visible labels for unfamiliar actions

Reserve stars, circles, diagonals, and Swiss poster symbols for artwork. They should not imply category meaning or function because their meaning is not self-evident.

### Type and hierarchy

Keep the strong display type for one heading per view. Reduce slogans inside the signed-in experience. Students should see concrete language first: “Tonight,” “3 spots left,” “5 min walk,” and “Student hosted.” Monospace labels work as accents, but the current 7–10px text sacrifices readability.

### Color and status

Keep Babson green as the brand and primary action color. Use complementary colors to distinguish content and status only when the same meaning stays consistent:

- green: joined/success
- amber: few spots or changed details
- red: cancelled/destructive
- blue or neutral: informational/saved

Do not make every category color carry interface meaning. Category color can stay in artwork and chips.

### Motion and feedback

Use short transitions for bottom sheets, saved state, and join success. Keep them around 150–220ms and respect reduced-motion settings. A successful join should update the card immediately and provide an Undo/Leave path. Avoid gamified streaks or popularity counters; they would work against the product’s goal of reducing cliques.

## Gen Z student review

The visual tone is distinctive and more memorable than a generic campus portal. The strongest parts are the direct copy, the inclusive framing, and the poster-inspired cards. The current signed-in experience, however, asks students to appreciate the brand before helping them make a plan.

For this audience, “Gen Z” should translate into speed, shareability, clear trust signals, and personal control. It should not translate into forced slang, constant animation, or social popularity scores. The experience should answer these questions almost instantly:

- What can I do tonight?
- Is it nearby, free, and comfortable to join alone?
- Are there spots left?
- Who is hosting, and are they verified?
- Can I send this to a friend?
- Where do I find it after I join?

## Recommended implementation order

1. Compress the Discover header and show events above the fold.
2. Replace mobile event cards and raise touch/type sizes.
3. Create My plans with Going, Saved, and Hosting.
4. Add event routes, Share, and a sticky Join/Waitlist action.
5. Replace the long host form with the three-step flow and defaults.
6. Standardize icons, state colors, and feedback.
7. Improve notifications and first-run onboarding after the core loop is fast.

The first four changes will have the greatest effect on whether students understand the app and use it repeatedly during a pilot.
