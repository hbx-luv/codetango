# Character art pool

Tiles draw character portraits from numbered pools in this folder:

```
char-red-team-N.png    (red operatives)
char-blue-team-N.png   (blue operatives)
char-neutral-N.png     (civilians)
char-assasin.png       (single image, note the one-s spelling)
```

`game-board.component.ts` deals each pool out per game with a seeded
shuffle, so no image repeats on a board as long as the pool is at least
as big as the tile count (9 red, 9 blue, 7 civilian). After adding new
images here, bump the matching count in `CHARACTER_POOLS` at the top of
`src/app/components/game-board/game-board.component.ts`.

## Generating new art to match the existing style

Use an image model that accepts reference images (GPT Image, Midjourney
`--sref`, Gemini image gen). Attach the two existing images from the
same pool as style references for every generation.

### Base prompt (all categories)

> Digital comic-book character portrait in a bold ink-and-cel-shade
> style: clean dark outlines, dramatic painterly shading, expressive
> face. Bust/shoulders-up framing, character fills most of the frame,
> looking at or near the viewer. Transparent background, no text, no
> logos, no frame. Square canvas, 900×900.

### Per-category additions

- **Red operative** (`char-red-team-N`): "Entire image rendered in a
  monochrome deep-red/crimson palette — skin, hair, and clothing all in
  shades of red. Confident, stylish spy or secret-agent character."
- **Blue operative** (`char-blue-team-N`): "Entire image rendered in a
  monochrome steel-blue/navy palette. Confident, stylish spy or
  secret-agent character."
- **Civilian** (`char-neutral-N`): "Muted natural khaki/beige/olive
  tones, ordinary everyday person, startled or oblivious expression —
  clearly not a spy."

### Variety checklist (avoid a samey pool)

Vary across the 9 (or 7): gender, age, ethnicity, hair, one signature
prop or costume detail each (sunglasses, hat, trench coat, earpiece,
newspaper, coffee cup…), head angle, and expression. No two characters
in a pool should share a pose or prop.

### QC before committing

- Transparent background (check against a dark page, not just white)
- Consistent scale — head roughly the same size across the pool
- Palette stays monochrome for team images (no stray full-color areas)
- Filename numbering continues from the existing files with no gaps
