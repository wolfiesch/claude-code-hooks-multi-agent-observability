# UX Feedback - December 5, 2025 2:00 PM

**Source:** Direct user feedback from Wolfgang during live usage session
**Context:** Testing dashboard with multiple concurrent agents on 14" MacBook Pro
**Date:** December 5, 2025 @ 2:00 PM

---

## Issue 1: No Visual Indication for Active Agent Timeline

**Severity:** 7/10 (Medium-High)
**Category:** Discoverability / Feedback

**Description:**
When clicking on an agent swim lane to view its timeline, there's no visual indication which agent's timeline is currently active/selected. User has to manually match session IDs to figure out which agent they're viewing.

**Current Behavior:**
- Click agent swim lane → timeline updates
- No visual feedback on which lane is "selected"
- User must cross-reference session IDs to confirm

**Expected Behavior:**
- Clicked agent swim lane should have clear visual indicator (highlight, border, background color change)
- Should be obvious at a glance which agent is active

**User Quote:**
> "There's no visual indication if an agent's timeline view is active or not, so I just have to kind of click them and guess. I guess I could match the IDs, the session IDs, but that's way too much work."

---

## Issue 2: Vertical Overflow - Notification Stream Pushed Below Fold

**Severity:** 8/10 (High)
**Category:** Layout / Responsive Design

**Description:**
With multiple concurrent agents running, the agent swim lanes push the notification stream (EventTimeline) below the visible viewport on smaller screens (14" MacBook). Eventually, on any monitor size, enough agents will cause this problem.

**Current Behavior:**
- Each new agent adds a swim lane to the top section
- Notification stream is pushed progressively lower
- On 14" MacBook, becomes inaccessible with ~5+ concurrent agents
- Scrolling is disabled on the top portion (only notification stream scrolls)

**Expected Behavior:**
- Top section (swim lanes) should have max height with vertical scroll
- Notification stream should always be visible
- OR: Use collapsible/accordion pattern for agent swim lanes
- OR: Use tabbed interface to switch between agents

**User Quote:**
> "If I have a lot of concurrent agents going, it eventually pushes the notification screen below the bottom of the page on my 14-inch MacBook. And eventually if you add enough agents, it'll do this for any size monitor."

---

## Issue 3: Scrolling Disabled on Top Section

**Severity:** 8/10 (High)
**Category:** Scrolling / Accessibility

**Description:**
The top section containing agent swim lanes is not scrollable. Only the notification stream at the bottom has scroll enabled. Once the page fills with swim lanes, there's no way to see the notification stream without closing agents.

**Current Behavior:**
- Top section (App.vue main content area): no scroll
- Bottom section (EventTimeline): has scroll
- If swim lanes fill entire viewport, notification stream becomes completely inaccessible

**Expected Behavior:**
- Top section should have `overflow-y: auto` with max-height
- User can scroll through many swim lanes while keeping notification stream visible

**User Quote:**
> "The only scrollable section is the notification screen. So once the entire page is filled with the top portion, there's no way to get back to see the notification stream without closing out of some of the agents."

---

## Issue 4: Grouped Notifications Lost Visual Information

**Severity:** 6/10 (Medium)
**Category:** Data Visualization / Information Density

**Description:**
The current grouped/binned approach for the live activity pulse chart (to avoid clustering and overlap) removed valuable visual information. User wants an at-a-glance view that shows more granular activity.

**Current Behavior:**
- Events are grouped/binned to prevent overlapping bars
- Bars show up with size indicating volume
- Less granular view of individual events

**Expected Behavior:**
- More granular, at-a-glance visualization
- User can quickly see what's happening without losing detail
- Possibly: mini event stream, sparkline, or heat map approach
- Possibly: Configurable grouping level (1s, 5s, 10s bins)

**User Quote:**
> "Right now, you can tell that something is happening by these bars that show up and the size of them. But I think I would rather have an at-a-glance view."

---

## Notes

- All issues observed during real-world usage with multiple concurrent Claude Code agents
- Platform: 14" MacBook Pro (likely 1512x982 or similar viewport)
- Issues #2 and #3 are related and likely require same fix (scrollable container for swim lanes)
- Issue #1 is independent, quick CSS fix
- Issue #4 is more subjective, may need design iteration

---

**Next Steps:**
1. Prioritize by ease of implementation vs impact
2. Address critical layout/scrolling issues first (#2, #3)
3. Add visual feedback for selection (#1)
4. Explore alternative visualizations for grouped events (#4)
