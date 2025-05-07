import { Jimp } from "jimp";

/** Color-to-Alpha function (like GIMP) with the Color hardcoded to white. */
function whiteToAlpha(data: Uint8Array, transparencyThreshold = 0, opacityThreshold = 255) {
    const tr = 255;
    const tg = 255;
    const tb = 255;

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
            const newR = (r * originalANorm - tr * (originalANorm - newANorm)) / newANorm;
            const newG = (g * originalANorm - tg * (originalANorm - newANorm)) / newANorm;
            const newB = (b * originalANorm - tb * (originalANorm - newANorm)) / newANorm;

            // Clamp color values to ensure they are within the 0-255 range
            data[i] = Math.max(0, Math.min(255, Math.round(newR)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round(newG)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round(newB)));

        } else {
            // If fully transparent, set color to black (it won't be visible anyway)
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
        }

        // Set the new alpha value
        data[i + 3] = Math.round(newA);
    }
}

/**
 * Downloads a radar image from the given URL and decodes it.
 * Then runs the Color-to-Alpha function to convert opaque light areas to alpha.
 * Then returns it encoded as a data URL containing a PNG.
 */
export async function processRadarImage(src: string): Promise<string> {
    const jimp = await Jimp.read(src);
    whiteToAlpha(jimp.bitmap.data, 50);
    return await jimp.getBase64("image/png");
}
