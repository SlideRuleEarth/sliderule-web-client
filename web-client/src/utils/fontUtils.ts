/**
 * Returns the pixel width of a single character, based on the root element's font settings.
 *
 * @param character - The character to measure, e.g. "M" or "A".
 * @returns The width of the character in pixels.
 */
export function getCharacterWidth(character: string): number {
    // Get computed styles from the root (documentElement)
    const rootStyle = window.getComputedStyle(document.documentElement);
    const fontSize = rootStyle.fontSize; // e.g. "16px"
    const fontFamily = rootStyle.fontFamily || "sans-serif";
  
    // Create an off-screen canvas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
  
    if (!context) {
      throw new Error("Unable to get canvas rendering context.");
    }
  
    // Match the canvas context's font to the root style
    context.font = `${fontSize} ${fontFamily}`;
  
    // Measure the character's width
    return context.measureText(character).width;
  }
  
  // Example usage:
  const width = getCharacterWidth("M");
  console.log(`Width of 'M' is: ${width}px`);
  