type PngCanvas = Pick<HTMLCanvasElement, "toDataURL">;

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Keep the download click in the user's gesture; data URLs work across mobile and desktop browsers. */
export function downloadCanvasPng(canvas: PngCanvas, filename: string): boolean {
  try {
    triggerDownload(canvas.toDataURL("image/png"), filename);
    return true;
  } catch {
    return false;
  }
}
