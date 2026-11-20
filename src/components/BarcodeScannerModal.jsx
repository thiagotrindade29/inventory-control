import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [cameraActive, setCameraActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const html5QrCodeRef = useRef(null)
  const scannerContainerId = 'interactive-barcode-scanner'

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
    ]

    const scanner = new Html5Qrcode(scannerContainerId, {
      formatsToSupport: formats,
      verbose: false,
    })
    html5QrCodeRef.current = scanner

    // Iniciar a câmera traseira (environment) com alta resolução
    const config = {
      fps: 15,
      qrbox: { width: 280, height: 160 },
      aspectRatio: 1.333333,
    }

    scanner
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!isMounted) return

          // Vibração tátil no celular se suportado
          if (navigator.vibrate) {
            navigator.vibrate(80)
          }

          // Parar scanner e enviar código lido
          scanner
            .stop()
            .then(() => {
              setCameraActive(false)
              onScanSuccess(decodedText)
            })
            .catch(() => {
              onScanSuccess(decodedText)
            })
        },
        () => {
          // Callback de erro por frame ignorado silenciosamente
        }
      )
      .then(() => {
        if (isMounted) setCameraActive(true)
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage(
            'Não foi possível acessar a câmera do celular. Permita o acesso à câmera nas configurações do navegador ou use HTTPS.'
          )
        }
      })

    return () => {
      isMounted = false
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [isOpen, onScanSuccess])

  function handleClose() {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().finally(() => {
        onClose()
      })
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card scanner-modal">
        <div className="modal-header">
          <div>
            <h3>📷 Leitor de Código de Barras</h3>
            <p className="text-muted text-sm">
              Aponte a câmera do celular para o código de barras na prateleira
            </p>
          </div>
          <button type="button" className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body text-center">
          {errorMessage ? (
            <div className="scanner-error-box">
              <span className="error-icon">⚠️</span>
              <p>{errorMessage}</p>
              <button
                type="button"
                className="btn btn-secondary mt-3"
                onClick={handleClose}
              >
                Digitar Código Manualmente
              </button>
            </div>
          ) : (
            <div className="scanner-viewport-wrapper">
              <div id={scannerContainerId} className="scanner-video-box" />
              <div className="scanner-aim-guide">
                <div className="aim-laser" />
              </div>
              <small className="scanner-hint">
                Mantenha o código de barras reto dentro da área destacada
              </small>
            </div>
          )}
        </div>

        <div className="modal-footer justify-between">
          <span className="text-sm text-muted">
            {cameraActive ? '🟢 Câmera Ativa' : 'Iniciando câmera...'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

