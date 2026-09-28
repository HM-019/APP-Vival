import { useEffect, useRef, useState } from 'react'
import { X, ScanLine, AlertCircle } from 'lucide-react'
import { useT } from '../i18n'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

// TypeScript types for BarcodeDetector Web API
interface BarcodeDet {
  detect(src: HTMLVideoElement | HTMLImageElement): Promise<Array<{ rawValue: string }>>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: object) => BarcodeDet
  }
}

const FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']

export default function CameraScanner({ onScan, onClose }: Props) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const calledRef = useRef(false)
  const detectorRef = useRef<BarcodeDet | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'loading' | 'scanning' | 'no_support' | 'no_camera' | 'error'>('loading')
  const [torch, setTorch] = useState(false)

  const handleResult = (code: string) => {
    if (calledRef.current) return
    calledRef.current = true
    // Vibrate on success
    navigator.vibrate?.(100)
    onScan(code)
  }

  useEffect(() => {
    if (!window.BarcodeDetector) {
      setStatus('no_support')
      return
    }

    detectorRef.current = new window.BarcodeDetector({ formats: FORMATS })

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } })
      .then((stream) => {
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.play()
        setStatus('scanning')

        const scan = async () => {
          if (calledRef.current) return
          if (video.readyState >= 2) {
            try {
              const codes = await detectorRef.current!.detect(video)
              if (codes.length > 0) { handleResult(codes[0].rawValue); return }
            } catch {}
          }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      })
      .catch(() => setStatus('no_camera'))

    return () => {
      calledRef.current = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch
    try {
      await (track as MediaStreamTrack & { applyConstraints(c: object): Promise<void> })
        .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch {}
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.BarcodeDetector) { setStatus('no_support'); return }
    if (!detectorRef.current) {
      detectorRef.current = new window.BarcodeDetector({ formats: FORMATS })
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.src = url
    img.onload = async () => {
      try {
        const codes = await detectorRef.current!.detect(img)
        if (codes.length > 0) handleResult(codes[0].rawValue)
        else setStatus('error')
      } catch {
        setStatus('error')
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col select-none">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-safe pt-4 pb-6 bg-gradient-to-b from-black/80 to-transparent">
        <span className="text-white text-sm font-medium">{t('camera.hint')}</span>
        <button onClick={onClose} className="p-2 rounded-full bg-white/20 text-white active:bg-white/40">
          <X size={18} />
        </button>
      </div>

      {/* States */}
      {status === 'no_support' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertCircle size={44} className="text-warning-400" />
          <p className="text-white font-medium">{t('camera.no_support')}</p>
          <p className="text-white/50 text-sm">Utilisez l&apos;entrée manuelle du code-barre.</p>
          <button onClick={onClose} className="mt-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-medium text-sm">
            {t('camera.close')}
          </button>
        </div>
      )}

      {status === 'no_camera' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertCircle size={44} className="text-danger-400" />
          <p className="text-white font-medium">{t('camera.error')}</p>
          <p className="text-white/50 text-sm">Accès caméra refusé ou non disponible (HTTPS requis sur réseau).</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-medium text-sm"
          >
            <ScanLine size={18} /> {t('camera.photo')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertCircle size={44} className="text-danger-400" />
          <p className="text-white font-medium">{t('camera.not_found')}</p>
          <button
            onClick={() => { setStatus('no_camera') }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-medium text-sm"
          >
            <ScanLine size={18} /> Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Live video */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${status === 'scanning' ? '' : 'hidden'}`}
        playsInline
        muted
      />

      {/* Scan frame overlay */}
      {status === 'scanning' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-72 h-44">
            {/* Dimmed corners */}
            <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            {/* Border */}
            <div className="absolute inset-0 rounded-2xl border-2 border-brand-400" />
            {/* Corner markers */}
            <span className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-brand-400 rounded-tl-xl" />
            <span className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-brand-400 rounded-tr-xl" />
            <span className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-brand-400 rounded-bl-xl" />
            <span className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-brand-400 rounded-br-xl" />
            {/* Animated scan line */}
            <div className="absolute inset-x-3 h-px bg-brand-400/90 top-1/2 shadow-[0_0_6px_2px_rgba(99,102,241,0.6)] animate-pulse" />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {status === 'scanning' && (
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-8 pb-safe pb-8 pt-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
          <button
            onClick={toggleTorch}
            className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl text-white text-xs font-medium transition-colors ${torch ? 'bg-brand-500' : 'bg-white/20 active:bg-white/30'}`}
          >
            <span className="text-xl leading-none">🔦</span>
            {t('camera.torch')}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/20 active:bg-white/30 text-white text-xs font-medium"
          >
            <ScanLine size={20} />
            Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  )
}
