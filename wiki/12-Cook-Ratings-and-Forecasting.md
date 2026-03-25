# Feature: Cook Ratings & Forecasting

## Description

OppoDB integrates Cook Political Report ratings and PVI data, along with forecasting model comparisons, to provide district-level electoral competitiveness analysis.

---

## Cook Political Report Ratings

### What They Are
The Cook Political Report publishes partisan lean ratings for all congressional and gubernatorial races. These ratings are among the most respected in political journalism.

### Rating Scale

| Rating | Meaning | Example |
|--------|---------|---------|
| Solid D | Safe Democratic | D+10 or greater |
| Likely D | Strong Democratic | D+7 to D+9 |
| Lean D | Leans Democratic | D+3 to D+6 |
| Tossup | Pure 50/50 | Even |
| Lean R | Leans Republican | R+3 to R+6 |
| Likely R | Strong Republican | R+7 to R+9 |
| Solid R | Safe Republican | R+10 or greater |

### Rating Order
```typescript
const COOK_RATING_ORDER = [
  "Solid D", "Likely D", "Lean D",
  "Tossup",
  "Lean R", "Likely R", "Solid R"
];
```

### Color Coding
Each rating maps to a specific hue value for visualization:
- Solid D: hsl(210, 80%, 55%) — Strong blue
- Likely D: hsl(210, 70%, 50%) — Medium blue
- Lean D: hsl(210, 60%, 45%) — Light blue
- Tossup: hsl(280, 40%, 55%) — Purple
- Lean R: hsl(0, 60%, 45%) — Light red
- Likely R: hsl(0, 70%, 50%) — Medium red
- Solid R: hsl(0, 80%, 55%) — Strong red

---

## Cook PVI (Partisan Voting Index)

### What It Is
The Partisan Voting Index measures how a district performs compared to the national average. A district with PVI of R+5 means it votes 5 points more Republican than the nation as a whole.

### PVI Values
- D+10+ — Most Democratic
- D+5 to D+9
- D+1 to D+4
- Even (D+0 / R+0)
- R+1 to R+4
- R+5 to R+9
- R+10+ — Most Republican

### PVI Filter Options
In the District Intel section, users can filter by PVI using interactive buttons:
- Each PVI range has a color indicator
- Clicking toggles the filter
- Multiple PVI ranges can be selected

---

## District Map Coloring

### PVI-Based Coloring
The interactive district map colors districts by PVI:
- Dark blue: Strong D (D+10+)
- Medium blue: Leans D (D+5-9)
- Light blue: Lean D (D+1-4)
- Gray/purple: Even
- Light red: Lean R (R+1-4)
- Medium red: Leans R (R+5-9)
- Dark red: Strong R (R+10+)

### Cook Rating Overlay
Users can also overlay Cook ratings on the map for competitive race visualization.

---

## Cook Rating History

### Component: `CookRatingHistory`
Shows how a district's Cook rating has changed over time:
- Historical ratings by election cycle
- Directional arrows showing rating shifts
- Explanations for major changes (redistricting, scandal, etc.)

---

## Cook PVI Chart

### Component: `CookPVIChart`
Visual representation of district PVI:
- Horizontal bar showing PVI relative to center
- Color gradient from blue (D) to red (R)
- Numerical PVI label
- Comparison to state and national averages

---

## Forecast Model Comparison

### Component: `ForecastComparisonPanel`
Compares district-level predictions across forecasting models:

| Model | Description |
|-------|-------------|
| 538 | Nate Silver's model (ABC News) |
| Cook | Cook Political Report predictions |
| Inside Elections | Inside Elections ratings |
| Sabato's Crystal Ball | University of Virginia predictions |
| Race Ranking | Custom OppoDB ranking |

### Display
- Probability bars for each model
- Consensus prediction
- Disagreement indicators (when models diverge)
- Historical accuracy notes

---

## Election History Analysis

### Congressional Elections Section
Historical election results for each district:
- Past 4-8 election cycles
- Incumbent party performance
- Open seat analysis
- Trend lines (shifting toward/away from)

### Presidential Performance
By district:
- 2020, 2016, 2012 presidential results
- Shift from previous elections
- County-level breakdown within district

### MIT Election Lab Integration
Historical MIT data overlaid:
- Long-term partisan trends
- Ticket-splitting patterns
- Registration vs actual voting patterns

---

## Tossup Tracker

### Feature
Districts currently rated as Tossup are tracked separately:
- Highlighted in the District Intel list
- Special notification badge
- Quick comparison between Tossup races

### Impact Scoring
OppoDB may calculate a custom impact score for each Tossup race based on:
- District population (impact on House balance)
- Incumbent status
- Fundraising gaps
- Recent polling trends
