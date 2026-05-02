CSV Row Generation Instructions For Planner Import

Goal
Generate only valid CSV data rows (with header) for planner bulk import.

Output Format
- Output only CSV text.
- Include header exactly once as the first line.
- Do not include markdown, code fences, notes, or explanations.

Required Header (Exact Order)
Week,Date,Day,Activity Type,Race Type,Details,Focus,Planned Duration,Planned Distance

Field Rules
1. Week
- Integer greater than or equal to 1.
- Represents training week number.

2. Date
- Required.
- Format: YYYY-MM-DD.
- Must be a real calendar date.

3. Day
- Required.
- One of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
- Must match the Date value.

4. Activity Type
- Required.
- Non-empty text.
- Examples: Run, Cycle, Swim, Strength, Mobility, Rest, Walk.

5. Race Type
- Optional.
- Allowed values: empty, A, B, C.
- Do not use N/A, NA, None, or other values.

6. Details
- Optional free text.
- May include commas and multiline content.
- If Details contains comma, quote, or newline, wrap field in double quotes.
- Escape internal double quotes by doubling them.

7. Focus
- Optional free text.
- May include commas and multiline content.
- If Focus contains comma, quote, or newline, wrap field in double quotes.
- Escape internal double quotes by doubling them.

8. Planned Duration
- Required numeric value in minutes.
- Integer greater than or equal to 0.
- Use 0 for full rest if needed.

9. Planned Distance
- Required numeric value in kilometers.
- Number greater than or equal to 0.
- Decimal values allowed (example: 7.5).
- Use 0 for non-distance workouts.

Row Validity Rules
- Every row must have: Date, Day, Activity Type, Planned Duration, Planned Distance.
- Day must correspond correctly to Date.
- Keep column order exactly as header.
- Keep column count exactly 9 for every row.
- Do not add extra columns.
- Do not leave trailing separators.

CSV Escaping Rules
- If a field contains comma, newline, or double quote, enclose it in double quotes.
- Inside quoted fields, represent double quote as two double quotes.

Example Valid Row
17,2026-04-20,Monday,Walk,,"20-30 min easy walk at conversational pace",Recovery day,25,2
