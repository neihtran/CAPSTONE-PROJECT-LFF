"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

/**
 * ClipPlayer — play HLS video với custom controls.
 *
 * MVP: dùng HTML5 `<video>` + `hls.js` (nếu browser không support HLS native).
 *
 * Trim: chỉ play đoạn [startTime, endTime] của videoUrl — dùng currentTime + ended event.
 *
 * Auto-increment view khi mount (qua parent — không làm ở đây để tránh dup).
 *
 * Edge cases:
 *   - videoUrl rỗng / invalid → show placeholder + message.
 *   - HLS load fail → show error với nút retry.
 *   - Stream đã end (LiveKit HLS hết hạn) → giải thích "cần LiveKit Egress".
 */

type ClipPlayerProps = {
  clipId: string;
  videoUrl: string;
  startTime: number;
  endTime: number;
  thumbnail: string | null | undefined;
  title: string;
  autoPlay?: boolean;
};

export function ClipPlayer({
  clipId,
  videoUrl,
  startTime,
  endTime,
  thumbnail,
  title,
  autoPlay = false,
}: ClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(endTime - startTime);
  const [error, setError] = useState<string | null>(null);

  const duration_ = Math.max(1, endTime - startTime);
  const progress = Math.min(100, ((currentTime - startTime) / duration_) * 100);

  // Setup HLS.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Guard: nếu không có videoUrl → không setup gì cả, để placeholder hiện.
    if (!videoUrl || !videoUrl.trim()) {
      setError("Clip này chưa có video. Vui lòng quay lại sau.");
      return;
    }

    let hls: { destroy: () => void } | null = null;

    const setupNativeOrHls = async () => {
      // Native HLS (Safari).
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
        return;
      }

      // Fallback: hls.js.
      try {
        const mod = await import("hls.js");
        const Hls = mod.default;
        if (Hls.isSupported()) {
          const hlsInstance = new Hls();
          hlsInstance.loadSource(videoUrl);
          hlsInstance.attachMedia(video);
          hlsInstance.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean; details?: string }) => {
            if (data?.fatal) {
              // Phân biệt lỗi để user hiểu:
              // - manifestLoadError: HLS stream hết hạn (LiveKit Cloud TTL).
              // - networkError: mạng/CDN chặn.
              if (data.details?.includes("manifest")) {
                setError(
                  "Stream gốc đã hết hạn. LiveKit chỉ giữ HLS trong thời gian ngắn sau khi kết thúc live."
                );
              } else {
                setError("Lỗi tải video. Vui lòng thử lại.");
              }
            }
          });
          hls = hlsInstance;
        } else {
          video.src = videoUrl;
        }
      } catch {
        video.src = videoUrl;
      }
    };

    setupNativeOrHls();

    return () => {
      hls?.destroy();
    };
  }, [videoUrl]);

  // Trim start.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoadedMetadata = () => {
      video.currentTime = startTime;
      if (duration > 0 && Number.isFinite(video.duration)) {
        setDuration(Math.min(video.duration, endTime) - startTime);
      }
    };
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () =>
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, [startTime, endTime, duration]);

  // Trim end + timeupdate.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      // Stop khi tới endTime.
      if (t >= endTime) {
        video.pause();
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setError("Lỗi phát video");

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
    };
  }, [endTime]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((e) => console.warn("[ClipPlayer]", e));
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = startTime + pct * duration_;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="space-y-2">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
        <video
          ref={videoRef}
          poster={thumbnail ?? undefined}
          autoPlay={autoPlay}
          playsInline
          muted={false}
          controls={false}
          preload="metadata"
          className="w-full h-full object-contain"
          onClick={togglePlay}
        />

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 p-6 text-center">
            {thumbnail && (
              <Image
                src={thumbnail}
                alt={title}
                fill
                className="opacity-30 object-cover -z-10"
                unoptimized
              />
            )}
            <div className="text-4xl">🎬</div>
            <p className="text-sm font-medium">{error}</p>
            <p className="text-xs text-white/70 max-w-md">
              Để xem lại clip, cần bật <strong>LiveKit Egress</strong> để ghi
              từng clip thành file MP4/HLS riêng biệt.
            </p>
          </div>
        ) : !videoUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground gap-2">
            {thumbnail && (
              <Image
                src={thumbnail}
                alt={title}
                fill
                className="opacity-40 object-cover -z-10"
                unoptimized
              />
            )}
            <p className="text-sm font-medium">Clip chưa có video</p>
          </div>
        ) : null}

        {/* Play button overlay khi paused. */}
        {!isPlaying && !error && videoUrl && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Phát video"
          >
            <div className="bg-black/50 hover:bg-black/70 transition-colors rounded-full p-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* Custom controls — chỉ hiện khi có video. */}
      {!error && videoUrl && (
        <div className="flex items-center gap-x-3">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 hover:bg-muted rounded transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <div
            className="flex-1 h-1.5 bg-muted rounded cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.max(0, currentTime - startTime).toFixed(0)}s / {duration_}s
          </span>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                .writeText(`${window.location.origin}/clips/${clipId}`)
                .then(() => toast.success("Đã copy link!"))
                .catch(() => toast.error("Không thể copy link"));
            }}
            className="p-2 hover:bg-muted rounded text-xs"
            title="Copy link"
          >
            🔗 Share
          </button>
        </div>
      )}

      <p className="sr-only">{title}</p>
    </div>
  );
}
