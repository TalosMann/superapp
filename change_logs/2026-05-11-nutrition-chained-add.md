# Nutrition — chained add (Tab to keep adding)

Small UX fix: previously, clicking "Add to Lunch" added the item and closed the modal, forcing a click on "+ Add" again for each subsequent item. Now there are two save paths:

| Action | Behavior |
|---|---|
| Press **Tab** from the Protein field | Adds the item, clears the form, keeps the modal open, focuses back on Name |
| Click **"Add & close"** button | Adds the item and closes the modal (same as before) |

Same pattern in Library mode: Tab from the Grams field after selecting a food chains the next add.

A green "Added X" pill flashes at the top of the modal for 2 seconds after each chain-save so you can see confirmation without losing your typing flow.

A small `Tab` keyboard hint sits above the button to advertise the chaining behavior — you'd otherwise have to discover it by accident.

## File to overwrite

```
src/sections/Nutrition.jsx  ← REPLACES existing
```

No new dependencies. Vite hot-reloads.

## Try it

1. Open Nutrition → tap Add on Lunch
2. Type "Item 1", Tab to Grams, "100", Tab to Calories, "200", Tab to Protein, "20", **Tab** (not click)
3. Green "Added Item 1" pill appears at the top, form clears, cursor jumps back to Name
4. Type "Item 2", Tab through fields, Tab from Protein again — pill updates to "Added Item 2"
5. Repeat for as many items as needed
6. When done, click "Add & close" on the last one — or just close the modal (X) since the last item was already added by the Tab

## Why Tab and not Enter

Enter on a number field can submit form-level events you didn't ask for, and pressing Enter after typing a number is muscle memory for "I'm done with this number" — not "I'm done with this whole item." Tab is the natural "advance to the next thing" gesture, and from the last field it conveniently means "advance past the form, save this row, start a new row."

If you find yourself wanting Enter to also chain, that's a one-line addition — let me know.

## Why both buttons still exist

For mouse-only users, or for the case where the last item you add is the only one (you don't want to be left staring at an empty form expecting another). "Add & close" is the explicit "I'm done" affordance.

## Edge cases handled

- **Tab from earlier fields** still walks through to the next field normally — only Tab *from Protein* triggers the chain-save
- **Tab while Name is empty** does nothing — won't save an empty item
- **`saveToLib` toggle stays on** between chained adds — useful when you're entering several similar items from the same source
- **Shift+Tab** still walks backwards normally (the chain only triggers on plain Tab)
