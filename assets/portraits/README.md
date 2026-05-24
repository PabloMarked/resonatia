# assets/portraits/

Drop your class portrait images here.

## Expected filenames

| Filename        | Class     |
|-----------------|-----------|
| wizard.png      | Wizard    |
| cleric.png      | Cleric    |
| barbarian.png   | Barbarian |
| bard.png        | Bard      |

## Specs

- **Format:** PNG (supports transparency) or JPG
- **Size:** 300 × 400 px recommended (3:4 portrait ratio)
- **Max file size:** 200 KB per portrait
- **Style note:** The portrait is displayed in a framed panel
  on the character screen. Head-and-shoulders or bust shots
  work best. The image is cropped from the top-center.

## How to activate

After dropping your file here, open `js/assets.js` and
update the matching `src` field from `null` to the file path:

```js
Wizard: {
  src:   "assets/portraits/wizard.png",   // ← change this line
  emoji: '🧙',
  alt:   'Wizard class portrait'
},
```

Save the file. Reload the browser. Done.
The emoji fallback disappears automatically once the image loads.
