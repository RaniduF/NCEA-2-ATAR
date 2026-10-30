# ATAR Estimation Confidence Levels

Quick reference guide for displaying confidence/uncertainty in ATAR estimations.

---

## Confidence Bands by ATAR Range

### 🟢 High Confidence (0.00 - 98.99)
**Uncertainty:** ±0.025 ATAR points  
**Percentile:** Below top 1%  
**Cohort size per band:** ~32+ students

**Display:**
```
Estimated ATAR: 95.50
Confidence: High
Likely range: 95.45 - 95.55
```

---

### 🟡 Good Confidence (99.00 - 99.49)
**Uncertainty:** ±0.05 ATAR points  
**Percentile:** Top 1% to top 0.1%  
**Cohort size per band:** ~24-32 students

**Display:**
```
Estimated ATAR: 99.25
Confidence: Good
Likely range: 99.20 - 99.30
```

---

### 🟠 Moderate Confidence (99.50 - 99.95)
**Uncertainty:** ±0.05 to ±0.10 ATAR points  
**Percentile:** Top 0.1% (elite performance)  
**Cohort size per band:** ~16 students

**Display:**
```
Estimated ATAR: 99.90
Confidence: Moderate ⚠️
Likely range: 99.85 - 99.95

Note: Small cohorts at this level mean estimates 
should be viewed as indicative ranges.
```

---

## Why Confidence Varies

### Factors Affecting Estimation Reliability

1. **Cohort Size per Band**
   - Larger cohorts = more stable thresholds
   - Top 0.1% has only ~16 students per 0.05 band
   - Statistical noise increases with smaller samples

2. **Year-to-Year Variability**
   - Standard difficulty recalculated annually
   - Cohort characteristics change
   - CV (Coefficient of Variation):
     - 99.00-99.49: ~0.8%
     - 99.50-99.95: ~1.1%

3. **Discrete Banding System**
   - ATAR uses 0.05 increments, not continuous scale
   - Students cluster at certain performance levels
   - Small changes can cause band transitions

4. **Norm-Referenced Nature**
   - ATAR ranks against entire cohort
   - Same work = different ATAR in different years
   - Cannot predict future cohort strength

---

## Recommended UI Messages

### For ATAR < 99.00
No special warning needed. Standard display is sufficient.

### For ATAR 99.00 - 99.49
```
💡 You're in the top 1% of the cohort!

Note: At this level, small improvements in key standards 
can have noticeable impacts on your estimated ATAR.
```

### For ATAR ≥ 99.50
```
⚠️ High Performance Estimation

You're estimated in the top 0.1% of students. At this elite 
level, ATAR estimates have natural uncertainty of ±0.05-0.10 
points due to:

• Small cohort sizes (~16 students per band)
• Year-to-year variability in cohort strength
• High sensitivity to individual standard grades

Your estimate should be viewed as an indicative range rather 
than an exact prediction. To maximize your chances:

✓ Target Excellence in external standards
✓ Ensure breadth across UE-approved subjects
✓ Aim 1-2 ATAR bands above your minimum requirement
```

---

## Historical Context Display

When showing multi-year estimates for high ATARs:

```
Your ATAR Estimates Across Years

2024: 99.90  (Range: 99.85-99.95)  Top 0.10%
2023: 99.85  (Range: 99.80-99.90)  Top 0.15%
2022: 99.90  (Range: 99.85-99.95)  Top 0.10%

3-Year Average: 99.88 ± 0.03

This range reflects normal year-to-year variations in:
• Standard difficulty weightings
• Overall cohort performance  
• Participation rates

Your actual ATAR will depend on the specific year's 
distribution and cohort characteristics.
```

---

## Technical Explanation (Optional Expandable)

For users who want more detail:

```
ℹ️ How ATAR Estimation Works

Your statistical value: 0.9448

This represents your weighted performance on your best 90 
credits, accounting for:
• Standard difficulty (varies by year and subject)
• Grade achieved (Excellence weighted highest)
• Priority hierarchy (UE achievement > UE unit > non-UE)

Your statistical value is then ranked against all ~32,000 
students in the cohort to determine your ATAR band.

At the 99.90 level:
• You're ranked in the top ~16 students
• This represents the top 0.05% of the participation cohort
• Small variations can change your band by ±0.05 points

Learn more about the NZQA methodology →
```

---

## Color Coding for UI

### Statistical Value Display
```css
/* High confidence */
.confidence-high {
  color: #10b981;  /* green */
  border-color: #10b981;
}

/* Good confidence */
.confidence-good {
  color: #f59e0b;  /* amber */
  border-color: #f59e0b;
}

/* Moderate confidence */
.confidence-moderate {
  color: #ef4444;  /* red */
  border-color: #ef4444;
}
```

### Warning Badges
```jsx
{atar >= 99.50 && (
  <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 
                   rounded text-xs text-amber-300">
    ⚠️ Top 0.1% - View as range
  </span>
)}
```

---

## Summary Table: Quick Reference

| ATAR Range | Confidence | Uncertainty | Cohort/Band | Display Color | Warning |
|------------|------------|-------------|-------------|---------------|---------|
| 0.00-98.99 | High | ±0.025 | 32+ | 🟢 Green | None |
| 99.00-99.49 | Good | ±0.05 | 24-32 | 🟡 Amber | Optional tip |
| 99.50-99.95 | Moderate | ±0.10 | ~16 | 🟠 Orange | ⚠️ Required |

---

## Implementation Checklist

- [ ] Add confidence level calculation based on ATAR range
- [ ] Display uncertainty range (±X.XX)
- [ ] Show warning badge for ATAR ≥ 99.50
- [ ] Implement color coding for confidence levels
- [ ] Add expandable "Why this uncertainty?" section
- [ ] Show 3-year average ± std dev for high ATARs
- [ ] Display percentile ranking (e.g., "Top 0.1%")
- [ ] Add contextual tips for high performers

---

**Last Updated:** 2025-07-20  
**Based on:** `HIGH_ATAR_ESTIMATION_RELIABILITY.md` analysis
