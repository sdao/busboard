import { decode, encode } from '@jsquash/png';

/** Gets a base64-encoded data URL for the given blob. */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = (err) => reject(err);
        fr.readAsDataURL(blob);
    });
}

/**
 * Gets the saturation of an RGB color.
 * The saturation is in the range 0.0 (achromatic) to 1.0 (fully saturated).
 */
function getSaturation(r: number, g: number, b: number) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (max === 0) {
        return 0;
    }
    else {
        return delta / max;
    }
}

/**
 * The color scheme used by NOAA/NWS for their radar map images generally uses less-saturated
 * colors for low dBZ values (e.g., < 50% saturation for < 20 dBZ).
 * We take advantage of this to make those areas more transparent in the processed image.
 * Areas between the two thresholds become semi-transparent.
 * The image is processed in place with the data buffer being overwritten.
 * 
 * @param transparencyThreshold Any areas with a saturation (0.0-1.0) equal or less than this become fully-transparent.
 * @param opacityThreshold Any areas with a saturation (0.0-1.0) equal or greater than this become fully-opaque.
 * */
function saturationToAlpha(data: Uint8ClampedArray, transparencyThreshold = 0.5, opacityThreshold = 1.0) {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let a = data[i + 3];

        if (a !== 0) {
            const sat = getSaturation(r, g, b);
            if (sat <= transparencyThreshold) {
                a = 0;
            }
            else if (sat >= opacityThreshold) {
                a = 255;
            }
            else {
                a = Math.round(((sat - transparencyThreshold) / (opacityThreshold - transparencyThreshold)) * 255);
            }
        }

        data[i + 3] = a;
    }
}

/**
 * Downloads a radar image from the given URL and decodes it.
 * Processes the image to make areas with low dBZ values transparent.
 * Then returns it encoded as a data URL containing a PNG.
 */
export async function processRadarImage(src: string): Promise<string> {
    const response = await fetch(src);
    if (!response.ok) {
        throw new Error(`Error loading ${src} (response status ${response.status} ${response.statusText})`);
    }

    const inBuffer = await response.arrayBuffer();
    const imageData = await decode(inBuffer);

    saturationToAlpha(imageData.data);

    const outBuffer = await encode(imageData);
    const blob = new Blob([outBuffer], { type: "image/png" });
    return await blobToBase64(blob);
}
