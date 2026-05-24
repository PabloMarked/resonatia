# assets/scenes/

Drop your scene background images here.

## Expected filenames

| Filename            | Scene                          |
|---------------------|--------------------------------|
| title.jpg           | Title / intro screen           |
| city.jpg            | Jurnaheim city gates           |
| tavern.jpg          | Tavern interior (Act 1)        |
| tiefling.jpg        | Tiefling Rogue encounter       |
| waitress.jpg        | Tavern waitress encounter      |
| elfrogue.jpg        | Elf Rogue encounter            |
| streets.jpg         | Jurnaheim night streets        |
| alley.jpg           | Dark alley / being followed    |
| sunken-ward.jpg     | The Sunken Ward                |
| archive.jpg         | Oswald's archive interior      |
| finale.jpg          | Climax / archive on fire       |
| power.jpg           | Ancient power awakens          |
| destruction.jpg     | Seal shattered                 |
| ending-good.jpg     | Good ending                    |
| ending-worst.jpg    | Worst ending                   |

## Specs

- **Format:** JPG (photos) or PNG (illustrated art)
- **Minimum size:** 1280 × 720 px (16:9 ratio)
- **Max file size:** 500 KB per image (for fast browser load)
- **Style note:** Images are scaled to fill the scene area with a
  dark gradient overlay drawn on top — so slightly dark/moody
  images work best; very bright images may wash out under the overlay.

## How to activate

After dropping your file in here, open `js/assets.js` and
update the matching `src` field from `null` to the file path:

```js
tavern: {
  src:   "assets/scenes/tavern.jpg",   // ← change this line
  emoji: '🍺',
  label: 'Jurnaheim Tavern Interior'
},
```

Save the file. Reload the browser. Done.
