import React, { useState } from 'react';
import { AudioTrack } from '../types/course';
import { useLanguage } from '../context/LanguageContext';
import { AudioPlayer } from './AudioPlayer';
import { Music, Play, Disc3, Headphones } from 'lucide-react';

interface AudioPlaylistRunnerProps {
  tracks: AudioTrack[];
  title: string;
}

export const AudioPlaylistRunner: React.FC<AudioPlaylistRunnerProps> = ({
  tracks,
  title
}) => {
  const { t } = useLanguage();
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [filterCategory, setFilterCategory] = useState<string>('Toate');

  const categories = ['Toate', ...Array.from(new Set(tracks.map(t => t.category)))];
  const filteredTracks = filterCategory === 'Toate'
    ? tracks
    : tracks.filter(t => t.category === filterCategory);

  const currentTrack = tracks[activeTrackIdx] || tracks[0];

  return (
    <div className="space-y-6">
      {/* Active Audio Player Card */}
      {currentTrack && (
        <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border border-blue-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-600 text-white rounded-md flex items-center gap-1.5 shadow-2xs">
              <Headphones className="w-3.5 h-3.5" />
              {t('audio_now_playing', { current: activeTrackIdx + 1, total: tracks.length })}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white/80 border border-blue-200 text-blue-900 rounded-md">
              {currentTrack.category}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-blue-600 animate-spin-slow shrink-0" />
            <span className="break-words">{currentTrack.title}</span>
          </h3>

          <AudioPlayer
            key={currentTrack.audioUrl}
            src={`media/${currentTrack.audioUrl}`}
            title={currentTrack.title}
          />
        </div>
      )}

      {/* Category Filter Pills */}
      {categories.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Track List */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-slate-600" />
          Lista înregistrărilor disponibile ({filteredTracks.length}):
        </h4>

        <div className="space-y-2">
          {filteredTracks.map((track) => {
            const originalIdx = tracks.findIndex(t => t.id === track.id);
            const isActive = originalIdx === activeTrackIdx;

            return (
              <button
                key={track.id}
                type="button"
                onClick={() => setActiveTrackIdx(originalIdx)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 active:scale-99 ${
                  isActive
                    ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-200 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {isActive ? <Play className="w-3.5 h-3.5 fill-current" /> : originalIdx + 1}
                  </span>

                  <div className="min-w-0">
                    <p className={`text-sm sm:text-base font-semibold truncate ${
                      isActive ? 'text-blue-950 font-bold' : 'text-slate-900'
                    }`}>
                      {track.title}
                    </p>
                    <span className="text-xs font-medium text-slate-500">
                      {track.category}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    isActive
                      ? 'bg-blue-200/80 text-blue-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isActive ? 'Selectat' : 'Ascultă'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

