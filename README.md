# palette

Générateur de palettes de couleurs accessibles

Générez automatiquement des palettes complètes à partir de deux couleurs de base, créant des variations harmonieuses en termes de luminosité et de saturation.

## Comment l'utiliser ?

- Choisissez deux couleurs de base via les sélecteurs de couleurs ou en remplissant le champ (mot-clé, hex, rgb, hsl acceptés)
- Donnez à chaque couleur un nom sémantique (par exemple, "framboise", "océan")
- Cliquez sur "Générer les palettes"
- L'outil génère automatiquement : les variations de vos deux couleurs, une couleur tonique complémentaire à la couleur principale, une échelle de gris, et les variables CSS correspondantes, prêtes à l'emploi.

## Pourquoi OKLCH ?

L'espace colorimétrique OKLCH offre de nombreux avantages par rapport aux autres espaces colorimétriques en CSS.

1. **Gamut étendu :** OKLCH peut représenter toutes les couleurs affichables sur les écrans modernes avec une large gamme de couleurs, ce qui n'est pas le cas du sRGB (RGB, HSL) qui est plus limité.
2. **Perception uniforme :** OKLCH est basé sur la façon dont l'œil humain perçoit réellement les couleurs.
3. **Manipulation intuitive :** contrairement au RVB ou à la notation hexadécimale, les paramètres de teinte, de luminosité et de contraste sont intuitifs.
4. **Meilleure préservation de la teinte** lors des transitions ou des dégradés.
5. **Contrôle précis du contraste :** Le composant de luminosité (L) correspond directement à la luminosité perçue, ce qui facilite la création de contrastes accessibles.

Consultez le [support des navigateurs pour OKLCH](https://caniuse.com/mdn-css_types_color_oklch) et lisez l'article (en anglais) [OKLCH in CSS: why we moved from RGB and HSL](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl).
