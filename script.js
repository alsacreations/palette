const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// New function to format numbers for OKLCH
function formatNumberForOKLCH(num, chiffresApresVirgule = 2) {
  // If the number is very close to an integer (e.g., 0.000000001 or 24.999999999)
  // Round it first to a higher precision to avoid false negatives from Number.isInteger
  const roundedForIntegerCheck = parseFloat(num.toFixed(10));
  if (Number.isInteger(roundedForIntegerCheck)) {
    return roundedForIntegerCheck.toString();
  }
  // Round to the desired number of decimal places for display
  const fixedNum = parseFloat(num.toFixed(chiffresApresVirgule));
  // If after this rounding, it's an integer, return it as such
  if (Number.isInteger(fixedNum)) {
    return fixedNum.toString();
  }
  // Otherwise, return with the necessary decimals (parseFloat().toString() removes trailing zeros)
  return fixedNum.toString();
}

// Updated luminosity ranges
const LUMINOSITY_RANGES = {
  50: [100, 100], // Special case: always 100%
  100: [100, 100], // Always 100%
  200: [90, 99],
  300: [80, 89],
  400: [70, 79],
  500: [60, 69],
  600: [50, 59],
  700: [40, 49],
  800: [30, 39],
  900: [20, 29],
};

/**
 * Converts a hex/rgb color to OKLCH notation
 * and returns the separate components as well as the raw OKLCH string.
 */
function getOKLCHComponents(color) {
  const temp = document.createElement("div");
  temp.style.color = color;
  document.body.appendChild(temp);

  // Convert to OKLCH
  temp.style.color = `oklch(from ${color} l c h)`;
  const computedColorStr = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // Try to parse with L as a percentage or a simple number
  let matches = computedColorStr.match(/oklch\(([^%\s]+)%?\s+([^\s]+)\s+([^\s\)]+)(?:\s*\/\s*([^\)]+))?\)/);
  if (!matches) {
    // Fallback for oklch(L C H) formats without alpha, where L has no %
    matches = computedColorStr.match(/oklch\(([^s]+)\s+([^\s]+)\s+([^\s\)]+)(?:\s*\/\s*([^\)]+))?\)/);
  }

  if (!matches) {
    console.error("Could not parse OKLCH string:", computedColorStr);
    return { l: 0, c: 0, h: 0, oklchString: "oklch(0 0 0)" };
  }

  const lRaw = parseFloat(matches[1]);
  // If lRaw is > 1, it is likely a percentage, otherwise a ratio
  const l = lRaw > 1 ? lRaw / 100 : lRaw;
  const c = parseFloat(matches[2]);
  const h = parseFloat(matches[3]);

  // Format the oklchString with L as a percentage and rounded values
  const formattedL = parseFloat((l * 100).toFixed(4));
  const formattedC = parseFloat(c.toFixed(4));
  const formattedH = parseFloat(h.toFixed(4));
  const formattedOklchString = `oklch(${formattedL}% ${formattedC} ${formattedH})`;

  return {
    l: l, // Luminosity as a ratio (0-1) for internal calculations
    c: c, // Chroma for internal calculations
    h: h, // Hue for internal calculations
    oklchString: formattedOklchString, // Formatted OKLCH string for display and CSS
  };
}

// Function to find the step corresponding to a given luminosity
function findStepForLuminosity(luminosity) {
  return (
    Object.entries(LUMINOSITY_RANGES).find(([, [min, max]]) => luminosity >= min && luminosity <= max)?.[0] || "900"
  );
}

// New function to generate variants from LCH components
function generateVariantsFromLCH(baseL, baseC, baseH, name, exactBaseColorOKLCHString) {
  const variants = {};
  const baseLuminosityPercent = baseL * 100;
  const baseStep = findStepForLuminosity(baseLuminosityPercent);

  // 1. "50" and "100" steps (very light)
  // For "50", L=100%, C very low (5% of baseC, min 0.005)
  variants["50"] = `oklch(100% ${formatNumberForOKLCH(Math.max(0.005, baseC * 0.05))} ${formatNumberForOKLCH(baseH)})`;
  // For "100", L=98% (slightly less than pure white), C a bit higher (15% of baseC, min 0.01)
  variants["100"] = `oklch(98% ${formatNumberForOKLCH(Math.max(0.01, baseC * 0.15))} ${formatNumberForOKLCH(baseH)})`;

  // 2. Place the user color with its exact values on its step
  variants[baseStep] = exactBaseColorOKLCHString;

  // 3. Generate other luminosity steps ("200" to "900")
  const STEPS = ["200", "300", "400", "500", "600", "700", "800", "900"];
  STEPS.forEach((step) => {
    if (step === baseStep) return; // Already defined

    const [minLum, maxLum] = LUMINOSITY_RANGES[step];
    const targetLPercent = (minLum + maxLum) / 2;
    const targetL = targetLPercent / 100;

    let currentC = baseC;
    // Adjust chrominance for luminosity extremes
    if (targetL >= 0.95) {
      // Very light (e.g., 200)
      currentC = baseC * 0.3;
    } else if (targetL >= 0.85) {
      // Light (e.g., 300)
      currentC = baseC * 0.6;
    } else if (targetL <= 0.25) {
      // Very dark (e.g., 900)
      currentC = baseC * 0.4;
    } else if (targetL <= 0.35) {
      // Dark (e.g., 800)
      currentC = baseC * 0.7;
    }
    // Ensure chrominance remains positive and within reasonable limits
    currentC = Math.max(0, Math.min(0.33, currentC));

    variants[step] = `oklch(${formatNumberForOKLCH(targetLPercent)}% ${formatNumberForOKLCH(
      currentC
    )} ${formatNumberForOKLCH(baseH)})`;
  });

  // 4. Saturation variants (fade, bright) at the exact luminosity and hue of the base color
  const fadeC = Math.max(0, baseC * 0.6);
  variants.fade = `oklch(${formatNumberForOKLCH(baseL * 100)}% ${formatNumberForOKLCH(fadeC)} ${formatNumberForOKLCH(
    baseH
  )})`;

  const brightC = Math.min(0.33, baseC * 1.4);
  variants.bright = `oklch(${formatNumberForOKLCH(baseL * 100)}% ${formatNumberForOKLCH(
    brightC
  )} ${formatNumberForOKLCH(baseH)})`;

  return {
    name,
    color: exactBaseColorOKLCHString, // The exact base color
    variants,
  };
}

// Update generateColorVariants to use the new logic
function generateColorVariants(colorInputValue, name) {
  const { l, c, h, oklchString } = getOKLCHComponents(colorInputValue);
  if (oklchString === "oklch(0 0 0)" && l === 0 && c === 0 && h === 0) {
    // Error handling for getOKLCHComponents
    // Return an empty or default palette to avoid downstream errors
    const emptyVariants = {};
    const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "fade", "bright"];
    STEPS.forEach((step) => (emptyVariants[step] = "oklch(0 0 0)"));
    return { name, color: "oklch(0 0 0)", variants: emptyVariants };
  }
  return generateVariantsFromLCH(l, c, h, name, oklchString);
}

/**
 * Extracts the l, c, h components from an OKLCH color.
 * L is returned as a ratio (0-1).
 */
function parseOKLCH(oklchString) {
  // Handles L with or without '%' and with or without alpha
  let matches = oklchString.match(/oklch\(([^%\s]+)%?\s+([^\s]+)\s+([^\s\)]+)(?:\s*\/\s*([^\)]+))?\)/);
  if (!matches) {
    // Fallback for oklch(L C H) formats without alpha, where L has no %
    matches = oklchString.match(/oklch\(([^s]+)\s+([^\s]+)\s+([^\s\)]+)(?:\s*\/\s*([^\)]+))?\)/);
  }

  if (!matches) {
    // Try to parse an OKLCH string generated by the browser after `oklch(from ...)`
    // which can have many decimals and a slightly different format.
    matches = oklchString.match(/oklch\(([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  }

  if (!matches) {
    console.error("Could not parse OKLCH string for components:", oklchString);
    return [0, 0, 0];
  }

  const lRaw = parseFloat(matches[1]);
  const l = String(matches[1]).includes("%") ? lRaw / 100 : lRaw > 1 && lRaw <= 100 ? lRaw / 100 : lRaw;

  return [
    l, // L as a 0-1 ratio
    parseFloat(matches[2]), // c
    parseFloat(matches[3]), // h
  ];
}

// Update generateGrayScaleRow for a more natural progression
function generateGrayScaleRow() {
  const variants = {
    50: `oklch(97% 0 0)`,
    100: `oklch(92.2% 0 0)`,
    200: `oklch(87% 0 0)`,
    300: `oklch(70.8% 0 0)`,
    400: `oklch(55.6% 0 0)`,
    500: `oklch(43.9% 0 0)`,
    600: `oklch(37.1% 0 0)`,
    700: `oklch(26.9% 0 0)`,
    800: `oklch(20.5% 0 0)`,
    900: `oklch(14.5% 0 0)`,
    white: `oklch(100% 0 0)`,
    black: `oklch(0% 0 0)`,
  };

  return {
    name: "gray",
    color: `oklch(43.9% 0 0)`, // Gray-500 as the base color of the palette
    variants,
  };
}

// New function to generate a red palette
function generateRedPalette() {
  const baseHexColor = "#b91c1c";
  const { l, c, h } = getOKLCHComponents(baseHexColor);
  const baseOklchPercent = `oklch(${formatNumberForOKLCH(l * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
    h
  )})`;

  const chromaFor900 = c > 0.13 ? 0.11 : c;

  const variants = {
    // Base color (using a step like 500 for consistency)
    500: baseOklchPercent,

    // Darker version (e.g., step 700)
    // Adjust L downwards, keep C and H. Ensure L doesn't go below 0.
    700: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.15) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,

    // Lighter version (e.g., step 300)
    // Adjust L upwards, keep C and H. Ensure L doesn't go above 1.
    300: `oklch(${formatNumberForOKLCH(Math.min(1, l + 0.2) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,

    // Very light version (step 100)
    // Set L to a high value (e.g., 97%), reduce C to avoid excessive saturation.
    100: `oklch(97% ${formatNumberForOKLCH(c * 0.5)} ${formatNumberForOKLCH(h)})`,

    // Very dark version (step 900)
    900: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.3) * 100)}% ${formatNumberForOKLCH(
      chromaFor900
    )} ${formatNumberForOKLCH(h)})`,
  };

  return {
    name: "red",
    color: baseOklchPercent, // The base color of the palette
    variants,
  };
}

// New function to generate a green palette
function generateGreenPalette() {
  const baseColorHex = "#187C3E"; // Base color for green
  const { l, c, h } = getOKLCHComponents(baseColorHex);
  const baseOklchPercent = `oklch(${formatNumberForOKLCH(l * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
    h
  )})`;

  const chromaFor900 = c > 0.13 ? 0.11 : c;

  const variants = {
    100: `oklch(97% ${formatNumberForOKLCH(c * 0.5)} ${formatNumberForOKLCH(h)})`,
    300: `oklch(${formatNumberForOKLCH(Math.min(1, l + 0.2) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,
    500: baseOklchPercent,
    700: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.15) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,
    900: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.3) * 100)}% ${formatNumberForOKLCH(
      chromaFor900
    )} ${formatNumberForOKLCH(h)})`,
  };

  return {
    name: "green",
    color: baseOklchPercent,
    variants,
  };
}

// New function to generate an orange palette
function generateOrangePalette() {
  const baseHexColor = "#D66400"; // Base color for orange
  const { l, c, h } = getOKLCHComponents(baseHexColor);
  const baseOklchPercent = `oklch(${formatNumberForOKLCH(l * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
    h
  )})`;

  const chromaFor900 = c > 0.13 ? 0.11 : c;

  const variants = {
    // Base color (using a step like 500 for consistency)
    500: baseOklchPercent,

    // Darker version (e.g., step 700)
    700: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.15) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,

    // Lighter version (e.g., step 300)
    300: `oklch(${formatNumberForOKLCH(Math.min(1, l + 0.2) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,

    // Very light version (step 100)
    100: `oklch(97% ${formatNumberForOKLCH(c * 0.5)} ${formatNumberForOKLCH(h)})`,

    // Very dark version (step 900)
    900: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.3) * 100)}% ${formatNumberForOKLCH(
      chromaFor900
    )} ${formatNumberForOKLCH(h)})`,
  };

  return {
    name: "orange",
    color: baseOklchPercent, // The base color of the palette
    variants,
  };
}

// New function to generate a blue palette
function generateBluePalette() {
  const baseHexColor = "#0263C9"; // Base color for blue
  const { l, c, h } = getOKLCHComponents(baseHexColor);
  const baseOklchPercent = `oklch(${formatNumberForOKLCH(l * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
    h
  )})`;

  const chromaFor900 = c > 0.13 ? 0.11 : c;

  const variants = {
    // Base color (using a step like 500 for consistency)
    500: baseOklchPercent,

    // Darker version (e.g., step 700)
    700: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.15) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,

    // Lighter version (e.g., step 300)
    300: `oklch(${formatNumberForOKLCH(Math.min(1, l + 0.2) * 100)}% ${formatNumberForOKLCH(c)} ${formatNumberForOKLCH(
      h
    )})`,

    // Very light version (step 100)
    100: `oklch(97% ${formatNumberForOKLCH(c * 0.5)} ${formatNumberForOKLCH(h)})`,

    // Very dark version (step 900)
    900: `oklch(${formatNumberForOKLCH(Math.max(0, l - 0.3) * 100)}% ${formatNumberForOKLCH(
      chromaFor900
    )} ${formatNumberForOKLCH(h)})`,
  };

  return {
    name: "blue",
    color: baseOklchPercent, // The base color of the palette
    variants,
  };
}

// Function to generate CSS custom properties
function generateCSSCustomProperties(palettes) {
  const properties = [":root {"];

  palettes.forEach((palette) => {
    // Use the same order as for display
    Object.entries(palette.variants)
      .sort(([a], [b]) => VARIANT_ORDER.indexOf(a) - VARIANT_ORDER.indexOf(b))
      .forEach(([variant, color]) => {
        const prefix = variant === "white" || variant === "black" ? `--color-` : `--color-${palette.name}-`;
        properties.push(`  ${prefix}${variant}: ${color};`);
      });
  });

  properties.push("}");
  return properties.join("\n");
}

// --- Start of new functions for contrast calculation ---

/**
 * Converts a color string (including OKLCH) to an RGB object.
 * @param {string} colorString - The color string (e.g., "oklch(50% 0.1 120)", "#ff0000", "rgb(255,0,0)")
 * @returns {{r: number, g: number, b: number} | null} An object with r, g, b components (0-255) or null if conversion fails.
 */
function colorToRgb(colorString) {
  const temp = document.createElement("div");
  temp.style.color = colorString;
  document.body.appendChild(temp);
  let computedColor = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // First try to parse an rgb() or rgba() string
  let matches = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (matches) {
    return {
      r: parseInt(matches[1], 10),
      g: parseInt(matches[2], 10),
      b: parseInt(matches[3], 10),
    };
  }

  // If not rgb/rgba (e.g., if it's still oklch()), use the canvas method
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    console.warn("Could not get canvas context for color conversion.");
    return null;
  }

  ctx.fillStyle = computedColor; // Use the computed color string (can be oklch)
  ctx.fillRect(0, 0, 1, 1);
  const imageData = ctx.getImageData(0, 0, 1, 1).data;

  if (imageData && imageData.length >= 3) {
    return { r: imageData[0], g: imageData[1], b: imageData[2] };
  }

  console.warn(`Could not convert color to RGB using canvas: ${colorString} -> ${computedColor}`);
  return null; // Conversion failed
}

/**
 * Calculates the relative luminance of an RGB color.
 * @param {{r: number, g: number, b: number}} rgb - An object with r, g, b components (0-255).
 * @returns {number} The relative luminance (0-1).
 */
function getRelativeLuminance(rgb) {
  const srgb = [rgb.r, rgb.g, rgb.b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Calculates the WCAG contrast ratio between two RGB colors.
 * @param {{r: number, g: number, b: number}} rgb1
 * @param {{r: number, g: number, b: number}} rgb2
 * @returns {number} The contrast ratio.
 */
function getContrastRatio(rgb1, rgb2) {
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// --- End of new functions for contrast calculation ---

// --- Helper functions for color conversion ---
/**
 * Converts an OKLCH color string to an HSL string.
 * @param {string} oklchString - The OKLCH color string.
 * @returns {string} The HSL color string.
 */
function oklchToHslString(oklchString) {
  const rgbObject = colorToRgb(oklchString); // Utiliser colorToRgb pour une conversion robuste

  if (!rgbObject) {
    console.warn(`oklchToHslString: Could not convert ${oklchString} to RGB. Defaulting to hsl(0,0%,0%).`);
    return "hsl(0, 0%, 0%)"; // Cas de secours si colorToRgb échoue
  }

  let r = rgbObject.r / 255;
  let g = rgbObject.g / 255;
  let b = rgbObject.b / 255;

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h, s; // h et s seront définis ci-dessous
  const l = (max + min) / 2;

  if (max === min) {
    h = 0; // Achromatique
    s = 0; // Achromatique
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        h = 0; // Ne devrait pas arriver avec des nombres r,g,b valides
        break;
    }
    h /= 6;
  }

  const hDegrees = Math.round(h * 360);
  const sPercent = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  return `hsl(${hDegrees}, ${sPercent}%, ${lPercent}%)`;
}

/**
 * Converts an OKLCH color string to a Hex string.
 * @param {string} oklchString - The OKLCH color string.
 * @returns {string} The Hex color string.
 */
function oklchToHexString(oklchString) {
  const rgb = colorToRgb(oklchString);
  if (!rgb) return "#000000"; // Fallback

  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}
// --- End of helper functions for color conversion ---

// Form handler
document.getElementById("controls").addEventListener("submit", (e) => {
  e.preventDefault();

  // Generate palettes
  const primary = generateColorVariants($("#colorPicker1").value, $("#colorName1").value);
  const secondary = generateColorVariants($("#colorPicker2").value, $("#colorName2").value);
  const grays = generateGrayScaleRow();
  const red = generateRedPalette();
  const green = generateGreenPalette(); // Generate green palette
  const orange = generateOrangePalette(); // Generate orange palette
  const blue = generateBluePalette(); // Generate blue palette

  // Palettes for "Your palette" section
  const userPalettes = [primary, secondary];
  // Palettes for "Global colors" section
  const globalPalettes = [grays, red, green, orange, blue]; // Add blue palette

  const palettesContainer = $(".color-palettes");
  palettesContainer.innerHTML = ""; // Clear previous palettes

  // Create and append "Your palette" section
  const userPalettesSection = document.createElement("section");
  userPalettesSection.className = "palette-section";
  userPalettesSection.innerHTML = `
    <h2 class="palette-section-title">Your palette</h2>
    <div class="palette-grid">
      ${userPalettes.map(generateColorRow).join("")}
    </div>
  `;
  palettesContainer.appendChild(userPalettesSection);

  // Create and append "Global colors" section
  const globalPalettesSection = document.createElement("section");
  globalPalettesSection.className = "palette-section";
  globalPalettesSection.id = "global-colors-section"; // Add an ID for initial display
  globalPalettesSection.innerHTML = `
    <h2 class="palette-section-title">Global colors</h2>
    <div class="palette-grid">
      ${globalPalettes.map(generateColorRow).join("")}
    </div>
  `;
  palettesContainer.appendChild(globalPalettesSection);

  // Generate and display custom properties
  $(".css-output code").textContent = generateCSSCustomProperties([
    primary,
    secondary,
    grays,
    red,
    green,
    orange,
    blue,
  ]); // Add blue palette
});

// Function to display global palettes on page load
function displayInitialGlobalPalettes() {
  const grays = generateGrayScaleRow();
  const red = generateRedPalette();
  const green = generateGreenPalette(); // Generate green palette
  const orange = generateOrangePalette(); // Generate orange palette
  const blue = generateBluePalette(); // Generate blue palette

  const globalPalettes = [grays, red, green, orange, blue]; // Add blue palette

  let globalPalettesContainer = $("#global-colors-section .palette-grid");

  // If the section doesn't exist yet (e.g. first load before any submission)
  if (!globalPalettesContainer) {
    const palettesContainer = $(".color-palettes");
    const globalSection = document.createElement("section");
    globalSection.className = "palette-section";
    globalSection.id = "global-colors-section";
    globalSection.innerHTML = `
      <h2 class="palette-section-title">Global colors</h2>
      <div class="palette-grid">
        ${globalPalettes.map(generateColorRow).join("")}
      </div>
    `;
    palettesContainer.appendChild(globalSection);
  } else {
    // If the section exists (e.g. after a submit), just update its content
    globalPalettesContainer.innerHTML = globalPalettes.map(generateColorRow).join("");
  }
}

// Call the function to display global palettes when the DOM is ready
document.addEventListener("DOMContentLoaded", displayInitialGlobalPalettes);

// Synchronize color pickers and text fields
const colorPicker1 = $("#colorPicker1");
const colorText1 = $("#colorText1");
const colorPicker2 = $("#colorPicker2");
const colorText2 = $("#colorText2");

if (colorPicker1 && colorText1) {
  colorPicker1.addEventListener("input", () => {
    colorText1.value = colorPicker1.value;
  });
  colorText1.addEventListener("input", () => {
    // Validating the color before assigning it to the picker might be a good idea,
    // but modern browsers handle errors quite well.
    // For now, assign directly.
    colorPicker1.value = colorText1.value;
  });
}

if (colorPicker2 && colorText2) {
  colorPicker2.addEventListener("input", () => {
    colorText2.value = colorPicker2.value;
  });
  colorText2.addEventListener("input", () => {
    colorPicker2.value = colorText2.value;
  });
}

// "Learn more?" button handler
const learnMoreButton = $(".button-more");
const moreContent = $("#more-content");

if (learnMoreButton && moreContent) {
  learnMoreButton.addEventListener("click", () => {
    const isExpanded = learnMoreButton.getAttribute("aria-expanded") === "true";
    learnMoreButton.setAttribute("aria-expanded", !isExpanded);
    moreContent.hidden = isExpanded;
    if (!isExpanded) {
      // Optional: focus on the title of the revealed content
      const moreTitle = $("#more-title");
      if (moreTitle) {
        moreTitle.focus();
      }
    }
  });
}

// Helper function to generate a color row
/**
 * Determines if white text is needed based on WCAG contrast.
 * @param {string} backgroundColorValue - Background color in OKLCH or other valid CSS format.
 * @returns {boolean} True if white text is the best choice, false for black text.
 */
function needsWhiteText(backgroundColorValue) {
  const backgroundColorRgb = colorToRgb(backgroundColorValue);
  if (!backgroundColorRgb) {
    // Fallback if background color conversion fails
    console.warn(`needsWhiteText: Could not convert ${backgroundColorValue} to RGB. Defaulting to black text.`);
    return false; // Default to black text
  }

  // Direct use of RGB values for white and black to avoid unnecessary calls to colorToRgb
  const whiteRgb = { r: 255, g: 255, b: 255 };
  const blackRgb = { r: 0, g: 0, b: 0 };

  const contrastWithWhite = getContrastRatio(backgroundColorRgb, whiteRgb);
  const contrastWithBlack = getContrastRatio(backgroundColorRgb, blackRgb);

  const wcagAARatio = 4.5;

  // Case 1: Both options (white text and black text) meet the WCAG AA threshold
  if (contrastWithWhite >= wcagAARatio && contrastWithBlack >= wcagAARatio) {
    // Choose the one with the highest contrast
    return contrastWithWhite >= contrastWithBlack;
  }
  // Case 2: Only white text meets the WCAG AA threshold
  else if (contrastWithWhite >= wcagAARatio) {
    return true;
  }
  // Case 3: Only black text meets the WCAG AA threshold
  else if (contrastWithBlack >= wcagAARatio) {
    return false;
  }
  // Case 4: Neither text meets the WCAG AA threshold
  else {
    // Choose the one with the highest contrast, even if insufficient.
    // This ensures the best possible readability in a suboptimal scenario.
    return contrastWithWhite >= contrastWithBlack;
  }
}

// Definition of the display order for variants
const VARIANT_ORDER = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "fade",
  "bright",
  "white",
  "black",
];

// Update the generateColorRow function to respect the order and display contrast
function generateColorRow(colorInfo) {
  const swatches = Object.entries(colorInfo.variants)
    // Sort variants according to the defined order
    .sort(([a], [b]) => VARIANT_ORDER.indexOf(a) - VARIANT_ORDER.indexOf(b))
    .map(([variant, colorValue]) => {
      const isWhiteTextForSwatch = needsWhiteText(colorValue); // Determines text color for swatch name/value

      let contrastDisplay = "";
      const backgroundColorRgb = colorToRgb(colorValue);

      if (backgroundColorRgb) {
        const whiteRgb = { r: 255, g: 255, b: 255 };
        const blackRgb = { r: 0, g: 0, b: 0 };
        const wcagAARatio = 4.5;

        const ratioWithWhite = getContrastRatio(backgroundColorRgb, whiteRgb);
        const ratioWithBlack = getContrastRatio(backgroundColorRgb, blackRgb);

        const whiteCheck = ratioWithWhite >= wcagAARatio ? " √" : "";
        const blackCheck = ratioWithBlack >= wcagAARatio ? " √" : "";

        // Format: "WC: X.XX √ / BC: Y.YY √" (WC = White Contrast, BC = Black Contrast)
        // Using "T.Blc" for "Texte Blanc" and "T.N" for "Texte Noir" for brevity
        contrastDisplay = `<p>WCAG2 contrasts:</p><ul><li>White: ${ratioWithWhite.toFixed(
          2
        )}${whiteCheck}</li><li>Black: ${ratioWithBlack.toFixed(2)}${blackCheck}</li></ul>`;
      }

      const variantName = variant === "white" || variant === "black" ? variant : `${colorInfo.name}-${variant}`;
      const isUserColor = colorValue === colorInfo.color;

      // Add Hex and HSL notations
      const hexValue = oklchToHexString(colorValue);
      const hslValue = oklchToHslString(colorValue);

      return `
          <div class="color-swatch ${isWhiteTextForSwatch ? "high-contrast" : ""} ${
        isUserColor ? "color-swatch--user" : ""
      }"
               style="background: ${colorValue}; ${
        isUserColor ? `outline-color: oklch(from ${colorValue} calc(l * 0.8) calc(c * 1.2) h)` : ""
      }"
               tabindex="0">
            <div class="color-swatch-info">
              <div class="color-swatch-name">${variantName}</div>
              <div class="color-swatch-value">${colorValue}</div>
              <div class="color-swatch-value color-swatch-value--hex">${hexValue}</div>
              <div class="color-swatch-value color-swatch-value--hsl">${hslValue}</div>
              ${contrastDisplay ? `<div class="color-swatch-contrast">${contrastDisplay}</div>` : ""}
            </div>
          </div>
        `;
    })
    .join("");

  return `
    <section class="color-row">
      <h3 class="color-row-name">${colorInfo.name}</h3>
      <div class="color-row-swatches">
        ${swatches}
      </div>
    </section>
  `;
}
