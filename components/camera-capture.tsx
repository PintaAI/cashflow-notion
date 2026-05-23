"use client"

import * as React from "react"
import { useCallback, useRef, useState } from "react"
import Webcam from "react-webcam"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Camera01Icon,
  Cancel01Icon,
  Tick02Icon,
  FlashIcon,
  FlashOffIcon
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

interface CameraCaptureProps {
  onCapture: (imageData: string) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null)
  const [isReady, setIsReady] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [flash, setFlash] = useState(false)

  const videoConstraints = {
    facingMode,
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      onCapture(imageSrc)
    }
  }, [onCapture])

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === "user" ? "environment" : "user")
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Camera View */}
      <div className="relative flex-1 overflow-hidden">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMedia={() => setIsReady(true)}
          className="w-full h-full object-cover"
          mirrored={facingMode === "user"}
        />
        
        {/* Overlay instructions */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-white text-center">
              <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-12 mx-auto mb-2 animate-pulse" />
              <p>Starting camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/90 p-4 flex items-center justify-center gap-4">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white size-12"
          onClick={onClose}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-6" />
        </Button>

        {/* Capture button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full size-16 border-4 border-white",
            isReady ? "bg-white hover:bg-white/90" : "bg-white/50"
          )}
          onClick={capture}
          disabled={!isReady}
        >
          <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-8 text-black" />
        </Button>

        {/* Switch camera button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white size-12"
          onClick={toggleCamera}
        >
          <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-6" />
        </Button>
      </div>
    </div>
  )
}