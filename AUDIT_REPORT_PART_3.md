# Habit Tracker — Pass 1 Audit Report (Part 3 of 4)

**Read-only audit. No repository files were modified, no migrations executed, no build commands run. Git status confirmed clean on `master`.**

---

## D. Performance Review audit

### D.1 Schedule awareness (confirmed present)

`src/pages/PerformanceReview.tsx` fetches `epochsByHabit` via `useScheduleHistory()` and surfaces `scheduleLoading`/`scheduleError` (unlike Habit Detail, which ignores them). `review.ts` `habitOpportunities` / `calculatePeriodReview` / `calculateMonthlyWeeklyBreakdown` / `calculateYearlyMonthlyBreakdown` all accept `epochsByHabit` and resolve epochs per date via `resolveEpoch`. Weekly_target = one opportunity per closed Mon–Sun week; off-days/skipped/vacation neutral; transition/partial/current weeks carry; done-on-unscheduled still wins. ✅ Stage 4C/4D wiring is present.

### D.2 Preserved cadences

- Review periods: Weekly = Sun–Sat (`getCompletedWeekRange`), Monthly = calendar month, Yearly = calendar year. ✅ Preserved as required.
- Scheduling engine weekly-target weeks: Mon–Sun (`schedule.ts` `weekStart`/`weekEnd`). ✅ Preserved as required.
- Boundary conflict: a full Sun–Sat Review week contains no complete Mon–Sun week. Example week Sun Nov 1 – Sat Nov 7, 2026: the Mon–Sun week Mon Nov 2 – Sun Nov 8 starts inside but ends after Saturday. `habitOpportunities` skips it (`we < end` false for Sun Nov 8 vs end Sat Nov 7). **Result: weekly-target habits contribute zero opportunities in any full Sun–Sat weekly Review.** Weekly offset-0 (current running week Sun–today) likewise has no complete Mon–Sun week → zero.

### D.3 High-severity Review bugs

**D.3a Current-period future-day counting (monthly/yearly).**
- `habitOpportunities` treats `dayStatus` result `future` as non-neutral (`isNeutral` excludes `future`), so future days inside the current window are recorded as missed.
- `getCompletedMonthRange(today, 0)` returns the full current month (start-of-month → last day), not clamped to today. `getCompletedYearRange(today, 0)` returns the **current** year (comment says "most recently completed calendar year" — doc/code mismatch; tests assert current year). Future months in the current year are recorded as missed.
- `scoreRange` is called with `period.end` as the walk end, so future days step the score as misses too.
- Effect: opening Review mid-month/mid-year shows artificially low completion %, score, and breakdown bars for the current period. Weekly offset-0 is clamped to today (correct); monthly/yearly offset-0 are not.
- Fix (review layer, no `score.ts` change): clamp the effective calculation end to `min(period.end, today)` for `habitOpportunities`/`scoreRange`/breakdowns while keeping display labels as the full period. Previous periods (end < today) are unaffected.

**D.3b Weekly Review zeroes weekly-target habits.**
- Because no complete Mon–Sun week fits in Sun–Sat, weekly-target habits get `eligible=0` and are excluded from overall rate, but they still appear in `habitPerformances` with score 0 and drag `overallScore` (average over all habits, including zero-opportunity ones).
- `weekBased` is only `true` when `dayOpportunities===0 && weekOpportunities>0`; mixed-mode habits (some day opps + some weeks) show unit "days" in `ReviewHabitList` (`{doneDays} of {eligibleDays} weeks|days completed`) even though weeks are counted. Unit label is wrong for mixed modes.

**D.3c Strict `<` on week end drops a closed final week.**
- `habitOpportunities` requires `we < end && we < today`. A Mon–Sun week whose Sunday equals `period.end` is excluded even though it is fully closed (for completed monthly/yearly periods ending on a Sunday). Should be `we <= end` for completed periods while still excluding the current week via `we < today`.
- Same strict-`<` pattern exists in `score.ts` `scheduledScoreSeries` (`we < endDate`) and `overview.ts` `completionSeries` (`we < endDate`). Consistent within the codebase, but the doc comment ("the week containing endDate is never scored") means a week ending exactly on endDate is also never scored — a boundary decision to confirm, not necessarily a bug.

**D.3d Overall score drags on zero-opportunity habits.**
- `overallScore` averages `p.score` over all `habitPerformances`, including habits with `eligible===0` (score 0). A habit created after the period start, or a weekly_target habit in a weekly Review, contributes 0 and drags the average. `prevOverallScore` correctly filters `prevEligibleDays>0`; current overall does not.

**D.3e Previous-period comparison length mismatch.**
- Weekly offset-0 compares same elapsed days (`prevEnd = prevStart + daysInPeriod`). Monthly/yearly offset-0 compare the current (possibly partial) period against the full previous month/year — unfair delta. Should compare equal elapsed time or only completed periods.

**D.3f `getCompletedYearRange` doc/code mismatch.**
- Comment: "most recently completed calendar year". Code/tests: current year. Rename/repurpose or change baseline; requires approval (changes product semantics).

### D.4 Insights / breakdowns

- `generateActionableInsights` uses `eligibleDays >= 3` thresholds and "days" wording unless pure weekly; mixed-mode wording imprecise.
- `ReviewHeroCard` shows `totalCheckIns / totalEligibleOpportunities` ("Completed / opportunities") — mixing day-check-ins and week-achievements when weekly_target habits are present; no unit label.
- `ReviewHabitList` filter pills (All/Improving/Consistent/Declining) and trajectory badges work; "new" trajectory for habits created in period.
- Breakdowns aggregate across habits (total done / total eligible), which mixes units for weekly_target vs daily in the same month/year chart. Acceptable only if clearly labeled as "opportunities".

### D.5 Approval-required decisions (Performance Review)

1. Clamp current monthly/yearly calculation end to `min(period.end, today)` (review-layer fix; safe; needs tests).
2. Decide weekly Review treatment of weekly_target habits: exclude from daily rate + show separate week progress, OR include with a separate week denominator. **Do not silently unify** day/week units.
3. Fix `week <= end` for closed final week in completed periods (boundary decision; confirm intended semantics first).
4. Fix `overallScore` to average only habits with `eligible>0` (or document current behavior).
5. Decide `getCompletedYearRange` baseline (completed year vs current year) — changes labels/tests.
6. Equalize previous-period elapsed time for monthly/yearly (or keep full-period comparison as documented).
