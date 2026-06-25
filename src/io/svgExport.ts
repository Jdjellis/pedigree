import type Konva from 'konva';

export async function exportToSvg(
  stage: Konva.Stage,
  title: string
): Promise<void> {
  const width = stage.width();
  const height = stage.height();

  // Get a high-res PNG from the stage
  const dataUrl = stage.toDataURL({ pixelRatio: 3, mimeType: 'image/png' });

  // Wrap the PNG in an SVG container
  const svgString = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <image href="${dataUrl}" width="${width}" height="${height}" />`,
    `</svg>`,
  ].join('\n');

  // Create Blob and trigger download
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
