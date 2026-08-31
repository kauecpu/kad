# KAD Site Signal Design

## Purpose

Remove the artificial decorative language introduced in PR 70 and replace it with a restrained visual signature that communicates movement and study direction.

## Scope

- Only `site/` is changed.
- Collector, Expo app, routes, product behavior, demonstration content, ranking data, and future areas remain untouched.
- Mascot assets remain recoverable in the repository but are not rendered by the site.

## Visual direction

- White, black, and neutral surfaces remain dominant.
- Purple remains the institutional accent.
- Electric yellow is limited to the KAD signal and small functional emphasis.
- Floating notes, arbitrary stamps, concentric targets, tilted KAD squares, and decorative filler are removed.

## KAD signal

The KAD signal is an inline vector mark built from one asymmetric forward-leaning beam with a small directional cut. It should read as energy and progress without becoming a superhero emblem or a giant illustration.

The component provides color, monochrome, and compact variants. It uses design tokens, inherits its context, and is decorative unless a title is explicitly supplied.

## Surfaces

- Public hero: the signal is a small signature beside an honest list of the four product pillars: questions, simulations, trails, and contests.
- Authentication: no decorative art panel or numbered placeholder. The carousel remains functional and copy-led.
- Internal heroes: no placeholder illustration. Content receives the full width.
- Home: no KAD square or replacement art block.

## Validation

- Structural tests must reject old mascot references and artificial mark classes.
- Structural tests must verify a real inline SVG signal and centralized tokens.
- Desktop, mobile, light, dark, authentication, and two internal routes receive visual inspection.
- Typecheck, tests, and production build must pass.
