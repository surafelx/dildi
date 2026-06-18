"use client";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";

/**
 * Sleep sounds, generated locally with the Web Audio API (filtered noise) —
 * no audio files, fully offline. A timer fades the sound out gently.
 */
type Sound = { id: string; label: string; icon: string; type: "brown" | "pink" | "white"; cutoff: number };

const SOUNDS: Sound[] = [
  { id: "wind", label: "Wind in Trees", icon: "🌬️", type: "pink", cutoff: 600 },
  { id: "rain", label: "Gentle Rain", icon: "🌧️", type: "pink", cutoff: 1600 },
  { id: "river", label: "River Flow", icon: "🌊", type: "brown", cutoff: 900 },
  { id: "white", label: "White Noise", icon: "📻", type: "white", cutoff: 8000 },
];

const TIMERS = [15, 30, 45, 60];

export default function SleepPage() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [timer, setTimer] = useState(30);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stop() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const n = nodesRef.current;
    const ctx = ctxRef.current;
    if (n && ctx) {
      n.gain.gain.cancelScheduledValues(ctx.currentTime);
      n.gain.gain.setValueAtTime(n.gain.gain.value, ctx.currentTime);
      n.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      try { n.src.stop(ctx.currentTime + 0.5); } catch {}
    }
    nodesRef.current = null;
    setPlaying(null);
  }

  function play(s: Sound) {
    if (playing === s.id) { stop(); return; }
    if (nodesRef.current) stop();

    const ctx = ctxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    ctx.resume();

    // 2s noise buffer, looped.
    const len = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (s.type === "brown") { d[i] = (last + 0.02 * white) / 1.02; last = d[i]; d[i] *= 3.2; }
      else if (s.type === "pink") { d[i] = (last + 0.05 * white) / 1.05; last = d[i]; d[i] *= 2.4; }
      else d[i] = white * 0.6;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = s.cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.6);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();

    nodesRef.current = { src, gain };
    setPlaying(s.id);

    timeoutRef.current = setTimeout(stop, timer * 60 * 1000);
  }

  useEffect(() => () => stop(), []); // cleanup on unmount

  return (
    <>
      <Header title="Sleep" subtitle="Rest well, live well." />
      <div className="space-y-3 px-1">
        {/* now playing */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Sleep Sounds</h2>
              <p className="text-sm text-muted">{playing ? `Playing · stops in ${timer} min` : "Relaxing nature sounds"}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-xl text-white">
              {playing ? "♪" : "🌙"}
            </span>
          </div>
        </div>

        {/* timer */}
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Sleep timer</span>
            <span className="font-semibold text-[#EAA46E]">{timer} min</span>
          </div>
          <div className="flex gap-2">
            {TIMERS.map((t) => (
              <button key={t} onClick={() => setTimer(t)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${timer === t ? "bg-gradient-to-r from-[#F2A65A] to-[#E27D6E] text-white" : "bg-white/10 text-muted"}`}>
                {t}m
              </button>
            ))}
          </div>
        </div>

        {/* sounds */}
        <div className="card">
          <div className="space-y-2">
            {SOUNDS.map((s) => (
              <button key={s.id} onClick={() => play(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10">
                <span className="text-xl">{s.icon}</span>
                <span className="flex-1 font-medium">{s.label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm">
                  {playing === s.id ? "⏸" : "▶"}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">Sounds are generated on your device — nothing streams.</p>
        </div>
      </div>
    </>
  );
}
