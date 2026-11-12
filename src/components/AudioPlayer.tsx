import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, FastForward, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, title }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Clean relative path if necessary
  const audioSrc = src.startsWith('http') ? src : `${src}`;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log('Audio play error:', e));
    }
    setIsPlaying(!isPlaying);
  };

  const rewind5 = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
  };

  const forward5 = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [0.8, 1.0, 1.2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextRate = speeds[nextIdx];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 my-4 shadow-sm">
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
          <Volume2 className="w-4 h-4 text-blue-600" />
          <span>{title || 'Înregistrare audio (Audio)'}</span>
        </div>
        <button
          onClick={cycleSpeed}
          type="button"
          className="text-xs font-bold px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-blue-800 shadow-2xs hover:bg-blue-100 transition-colors"
          title="Viteza audio"
        >
          {playbackRate}x
        </button>
      </div>

      {/* Progress slider */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-500 font-mono w-9">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <span className="text-xs text-slate-500 font-mono w-9 text-right">{formatTime(duration)}</span>
      </div>

      {/* Touch-friendly controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={rewind5}
          type="button"
          aria-label="Înapoi 5 secunde"
          className="p-2.5 text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-100 active:scale-95 transition-all shadow-2xs flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="text-[10px] font-bold ml-0.5">-5s</span>
        </button>

        <button
          onClick={togglePlay}
          type="button"
          aria-label={isPlaying ? 'Pauză' : 'Redare'}
          className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 active:scale-95 transition-all shadow-md flex items-center justify-center"
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
        </button>

        <button
          onClick={forward5}
          type="button"
          aria-label="Înainte 5 secunde"
          className="p-2.5 text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-100 active:scale-95 transition-all shadow-2xs flex items-center justify-center"
        >
          <span className="text-[10px] font-bold mr-0.5">+5s</span>
          <FastForward className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

