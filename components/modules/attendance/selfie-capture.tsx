'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, RefreshCw, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface SelfieCaptureProps {
  open: boolean
  onClose: () => void
  /** Recebe o blob JPEG capturado. */
  onCapture: (blob: Blob) => void
}

export function SelfieCapture({ open, onClose, onCapture }: SelfieCaptureProps) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [shot,    setShot]    = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  // Liga/desliga a câmera conforme o modal abre
  useEffect(() => {
    if (!open) { stop(); setShot(null); setError(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões.')
      }
    })()
    return () => { cancelled = true; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function takeShot() {
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setShot(canvas.toDataURL('image/jpeg', 0.8))
  }

  function confirm() {
    const canvas = canvasRef.current
    if (!canvas) return
    setWorking(true)
    canvas.toBlob(blob => {
      if (blob) onCapture(blob)
      setWorking(false)
    }, 'image/jpeg', 0.8)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> Selfie do ponto</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="py-8 text-center text-sm text-red-500">{error}</div>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className={`w-full h-full object-cover ${shot ? 'hidden' : ''}`} playsInline muted />
              {shot && <img src={shot} alt="Selfie" className="w-full h-full object-cover" />}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {!shot ? (
              <Button onClick={takeShot} className="w-full">
                <Camera className="h-4 w-4 mr-2" /> Tirar foto
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShot(null)} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" /> Refazer
                </Button>
                <Button onClick={confirm} disabled={working} className="flex-1">
                  {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Confirmar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
