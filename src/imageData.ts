export function colorToAlpha(imageData: ImageData, targetColor: { r: number, g: number, b: number }, transparencyThreshold = 0, opacityThreshold = 255) {
  const data = imageData.data;
  const tr = targetColor.r;
  const tg = targetColor.g;
  const tb = targetColor.b;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const originalA = data[i + 3];

    // Calculate the maximum difference from the target color
    const diff = Math.max(Math.abs(r - tr), Math.abs(g - tg), Math.abs(b - tb));

    let newA;
    if (diff <= transparencyThreshold) {
      newA = 0; // Fully transparent
    } else if (diff >= opacityThreshold) {
      newA = originalA; // Original opacity
    } else {
      // Linearly interpolate alpha in the transition zone
      const range = opacityThreshold - transparencyThreshold;
      const factor = (diff - transparencyThreshold) / range;
      newA = originalA * factor;
    }

    // Adjust color channels to remove the contribution of the target color
    if (newA > 0) {
      const originalANorm = originalA / 255;
      const newANorm = newA / 255;

      // Formula to calculate the new color by removing the target color's influence
      // Based on: OriginalColor * OriginalAlpha = TargetColor * (OriginalAlpha - NewAlpha) + NewColor * NewAlpha
      data[i] = (r * originalANorm - tr * (originalANorm - newANorm)) / newANorm;
      data[i + 1] = (g * originalANorm - tg * (originalANorm - newANorm)) / newANorm;
      data[i + 2] = (b * originalANorm - tb * (originalANorm - newANorm)) / newANorm;

      // Clamp color values to ensure they are within the 0-255 range
      data[i] = Math.max(0, Math.min(255, Math.round(data[i])));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1])));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2])));

    } else {
      // If fully transparent, set color to black (it won't be visible anyway)
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }

    // Set the new alpha value
    data[i + 3] = Math.round(newA);
  }

  return imageData; // Return the modified ImageData
}

export function alphaBlendImageData(sourceImageData: ImageData, sourceOpacity: number, destImageData: ImageData) {
  const sourceData = sourceImageData.data;
  const destData = destImageData.data;

  for (let i = 0; i < sourceData.length; i += 4) {
    const sourceR = sourceData[i];
    const sourceG = sourceData[i + 1];
    const sourceB = sourceData[i + 2];
    const sourceA = sourceData[i + 3];

    const destR = destData[i];
    const destG = destData[i + 1];
    const destB = destData[i + 2];
    const destA = destData[i + 3];

    // Normalize alpha values to the range [0, 1]
    const sourceAlphaNorm = (sourceA / 255) * sourceOpacity;
    const destAlphaNorm = destA / 255;

    // Calculate the resulting alpha (in 0-1 range)
    const resultAlphaNorm = sourceAlphaNorm + destAlphaNorm * (1 - sourceAlphaNorm);

    // Calculate the resulting color channels (R, G, B)
    let resultR, resultG, resultB;

    if (resultAlphaNorm === 0) {
      resultR = 0;
      resultG = 0;
      resultB = 0;
    } else {
      // Blending formula: Cs * As + Cd * Ad * (1 - As) / Ao
      resultR = (sourceR * sourceAlphaNorm + destR * destAlphaNorm * (1 - sourceAlphaNorm)) / resultAlphaNorm;
      resultG = (sourceG * sourceAlphaNorm + destG * destAlphaNorm * (1 - sourceAlphaNorm)) / resultAlphaNorm;
      resultB = (sourceB * sourceAlphaNorm + destB * destAlphaNorm * (1 - sourceAlphaNorm)) / resultAlphaNorm;
    }

    // Convert the resulting alpha back to the 0-255 range
    const resultA = resultAlphaNorm * 255;

    // Store the results in the result data array (Uint8ClampedArray handles clamping)
    destData[i] = Math.round(resultR);
    destData[i + 1] = Math.round(resultG);
    destData[i + 2] = Math.round(resultB);
    destData[i + 3] = Math.round(resultA);
  }

  return destImageData;
}
