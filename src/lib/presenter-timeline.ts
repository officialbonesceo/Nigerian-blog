/**
 * 9jaBeacon Presenter Timeline & Automation Engine
 * 
 * Generates deterministic frame sequence timelines for Option A animations.
 * Can be run in:
 * 1. Client Browser (Admin Panel Live Testing Workbench)
 * 2. GitHub Actions Workflows (Automated Headless Video Generation via Puppeteer/ffmpeg)
 */

import type { PresenterPose } from './types';

export interface PresenterTimelineEvent {
  timeMs: number;
  pose: PresenterPose;
  mouth: 'closed' | 'open' | 'smile' | 'alert';
  gesture: string;
  coords: { x: string; y: string };
  action: string;
}

export interface PresenterAnimationTrack {
  presenterId: string;
  totalDurationMs: number;
  fps: number;
  totalFrames: number;
  events: PresenterTimelineEvent[];
}

export function generatePresenterTimeline(
  presenterId: string,
  scriptText: string,
  options: {
    wpm?: number;
    hasBreakingAlert?: boolean;
    speechRate?: number;
  } = {}
): PresenterAnimationTrack {
  const wpm = options.wpm || 140;
  const rate = options.speechRate || 1.0;
  const effectiveWpm = wpm * rate;

  const words = (scriptText || '').trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);
  const totalDurationMs = Math.round((wordCount / effectiveWpm) * 60 * 1000);

  const events: PresenterTimelineEvent[] = [];

  // Initial standby frame
  events.push({
    timeMs: 0,
    pose: 'idle',
    mouth: 'closed',
    gesture: 'desk_rest',
    coords: { x: '50%', y: '50%' },
    action: 'broadcast_standby'
  });

  // Pre-speech transition (200ms)
  events.push({
    timeMs: 200,
    pose: 'speaking',
    mouth: 'open',
    gesture: 'hand_raised',
    coords: { x: '50%', y: '50%' },
    action: 'speech_commence'
  });

  // Rhythmic lip-flap & speaking cadence (~180ms - 220ms per cycle)
  const cycleMs = 190;
  const speechEndMs = Math.max(totalDurationMs - 600, 1000);

  for (let t = 400; t < speechEndMs; t += cycleMs) {
    const isMouthOpen = (Math.floor(t / cycleMs) % 2 === 0);

    // If breaking alert segment is specified in the middle of script
    if (options.hasBreakingAlert && t > speechEndMs * 0.4 && t < speechEndMs * 0.7) {
      events.push({
        timeMs: t,
        pose: 'breaking',
        mouth: isMouthOpen ? 'open' : 'alert',
        gesture: 'earpiece_focus',
        coords: { x: '50%', y: '50%' },
        action: 'breaking_news_bulletin'
      });
    } else {
      events.push({
        timeMs: t,
        pose: 'speaking',
        mouth: isMouthOpen ? 'open' : 'closed',
        gesture: 'articulate_gesture',
        coords: { x: '50%', y: '50%' },
        action: 'active_narration'
      });
    }
  }

  // Wrap-up / Sign-off frame
  events.push({
    timeMs: speechEndMs,
    pose: 'wrap',
    mouth: 'closed',
    gesture: 'wrap_closing',
    coords: { x: '50%', y: '50%' },
    action: 'segment_wrap'
  });

  // Post-wrap idle
  events.push({
    timeMs: totalDurationMs,
    pose: 'idle',
    mouth: 'closed',
    gesture: 'desk_rest',
    coords: { x: '50%', y: '50%' },
    action: 'broadcast_concluded'
  });

  return {
    presenterId,
    totalDurationMs,
    fps: 30,
    totalFrames: Math.round((totalDurationMs / 1000) * 30),
    events
  };
}

/**
 * Returns the active timeline event for a given timestamp in milliseconds
 */
export function getEventAtTime(track: PresenterAnimationTrack, timeMs: number): PresenterTimelineEvent {
  if (!track.events || track.events.length === 0) {
    return {
      timeMs: 0,
      pose: 'idle',
      mouth: 'closed',
      gesture: 'desk_rest',
      coords: { x: '0%', y: '0%' },
      action: 'broadcast_standby'
    };
  }

  let activeEvent = track.events[0];
  for (let i = 0; i < track.events.length; i++) {
    if (track.events[i].timeMs <= timeMs) {
      activeEvent = track.events[i];
    } else {
      break;
    }
  }
  return activeEvent;
}

/**
 * Format milliseconds into MM:SS.mmm
 */
export function formatTimeMs(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
