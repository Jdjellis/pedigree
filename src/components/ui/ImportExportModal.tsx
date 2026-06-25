import { useCallback, useRef, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { saveToFile } from '../../io/jsonIO';
import { exportToPed, importFromPed } from '../../io/pedIO';
import { exportToPng } from '../../io/pngExport';
import { exportToSvg } from '../../io/svgExport';
import { exportToPdf } from '../../io/pdfExport';
import type Konva from 'konva';
import styles from './ImportExportModal.module.css';

interface ImportExportModalProps {
  getStage: () => Konva.Stage | null;
}

export function ImportExportModal({ getStage }: ImportExportModalProps) {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const doc = usePedigreeStore((s) => s.document);
  const setDocument = usePedigreeStore((s) => s.setDocument);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearMessages = useCallback(() => {
    setStatus(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    clearMessages();
    closeModal();
  }, [closeModal, clearMessages]);

  // --- Export handlers ---

  const handleExportJson = useCallback(async () => {
    clearMessages();
    try {
      await saveToFile(doc);
      setStatus('JSON file saved.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Failed to save JSON file.');
    }
  }, [doc, clearMessages]);

  const handleExportPed = useCallback(() => {
    clearMessages();
    try {
      const pedStr = exportToPed(doc);
      const blob = new Blob([pedStr], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.metadata.title || 'pedigree'}.ped`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('PED file exported.');
    } catch {
      setError('Failed to export PED file.');
    }
  }, [doc, clearMessages]);

  const handleExportPng = useCallback(async () => {
    clearMessages();
    const stage = getStage();
    if (!stage) {
      setError('Canvas not available.');
      return;
    }
    try {
      await exportToPng(stage, doc.metadata.title || 'pedigree');
      setStatus('PNG exported.');
    } catch {
      setError('Failed to export PNG.');
    }
  }, [getStage, doc.metadata.title, clearMessages]);

  const handleExportSvg = useCallback(() => {
    clearMessages();
    try {
      exportToSvg(doc, doc.metadata.title || 'pedigree');
      setStatus('SVG exported.');
    } catch {
      setError('Failed to export SVG.');
    }
  }, [doc, clearMessages]);

  const handleExportPdf = useCallback(async () => {
    clearMessages();
    const stage = getStage();
    if (!stage) {
      setError('Canvas not available.');
      return;
    }
    try {
      await exportToPdf(stage, doc.metadata);
      setStatus('PDF exported.');
    } catch {
      setError('Failed to export PDF.');
    }
  }, [getStage, doc.metadata, clearMessages]);

  // --- Import handlers ---

  const handleImportPed = useCallback(() => {
    clearMessages();
    fileInputRef.current?.click();
  }, [clearMessages]);

  const handlePedFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const imported = importFromPed(text, file.name.replace(/\.ped$/i, ''));
          setDocument(imported);
          useUIStore.getState().clearSelection();
          setStatus(`Imported ${Object.keys(imported.individuals).length} individuals from PED.`);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to import PED file.'
          );
        }
      };
      reader.readAsText(file);
      // Reset input so re-selecting the same file triggers change event
      e.target.value = '';
    },
    [setDocument]
  );

  if (activeModal !== 'export' && activeModal !== 'import') return null;

  const isExport = activeModal === 'export';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isExport ? 'Export Pedigree' : 'Import Pedigree'}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
          {isExport ? (
            <>
              <p className={styles.description}>
                Choose an export format for your pedigree.
              </p>
              <div className={styles.optionGrid}>
                <button className={styles.option} onClick={handleExportJson}>
                  <span className={styles.optionIcon}>{ '{ }' }</span>
                  <span className={styles.optionLabel}>JSON</span>
                  <span className={styles.optionDesc}>
                    Native format, full fidelity
                  </span>
                </button>
                <button className={styles.option} onClick={handleExportPed}>
                  <span className={styles.optionIcon}>PED</span>
                  <span className={styles.optionLabel}>PED (.ped)</span>
                  <span className={styles.optionDesc}>
                    Standard genetics format
                  </span>
                </button>
                <button className={styles.option} onClick={handleExportPng}>
                  <span className={styles.optionIcon}>PNG</span>
                  <span className={styles.optionLabel}>PNG Image</span>
                  <span className={styles.optionDesc}>
                    High-res raster image (3x)
                  </span>
                </button>
                <button className={styles.option} onClick={handleExportSvg}>
                  <span className={styles.optionIcon}>SVG</span>
                  <span className={styles.optionLabel}>SVG Image</span>
                  <span className={styles.optionDesc}>
                    Vector format for scaling
                  </span>
                </button>
                <button className={styles.option} onClick={handleExportPdf}>
                  <span className={styles.optionIcon}>PDF</span>
                  <span className={styles.optionLabel}>PDF Document</span>
                  <span className={styles.optionDesc}>
                    Printable A4 landscape
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.description}>
                Import a pedigree from a file. JSON restores the full document;
                PED imports basic structure only.
              </p>
              <div className={styles.optionGrid}>
                <button className={styles.option} onClick={handleImportPed}>
                  <span className={styles.optionIcon}>PED</span>
                  <span className={styles.optionLabel}>PED (.ped)</span>
                  <span className={styles.optionDesc}>
                    Standard genetics format
                  </span>
                </button>
              </div>
              <p className={styles.warning}>
                PED import is lossy: gender identity, conditions, annotations,
                and layout positions are approximated. Use JSON for full fidelity.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ped,.txt"
                style={{ display: 'none' }}
                onChange={handlePedFileSelected}
              />
            </>
          )}

          {status && <p className={styles.status}>{status}</p>}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
