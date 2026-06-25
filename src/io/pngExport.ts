import type Konva from 'konva';

export async function exportToPng(
  stage: Konva.Stage,
  title: string
): Promise<void> {
  const dataUrl = stage.toDataURL({ pixelRatio: 3, mimeType: 'image/png' });

  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Trigger download via <a download>
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
