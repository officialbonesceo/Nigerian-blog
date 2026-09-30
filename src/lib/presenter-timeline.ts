/**
 * 9jaBeacon Presenter Timeline & Automation Engine
 * 
 * Generates deterministic frame sequence timelines for Option A animations.
 * Can be run in:
 * 1. Client Browser (Admin Panel Live Testing Workbench)
 * 2. GitHub Actions Workflows (Automated Headless Video Generation via Puppeteer/ffmpeg)
 */

import type { PresenterPose, PresenterGaze, PresenterArmState, BroadcastStageMode } from './types';

export interface PresenterTimelineEvent {
  timeMs: number;
  pose: PresenterPose;
  mouth: 'closed' | 'open' | 'smile' | 'alert';
  gaze: PresenterGaze;
  armState: PresenterArmState;
  stageMode: BroadcastStageMode;
  gesture: string;
  coords: { x: string; y: string };
  action: string;
  brollTag?: string;
  brollHeadline?: string;
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
  const totalDurationMs = Math.max(Math.round((wordCount / effectiveWpm) * 60 * 1000), 12000);

  const events: PresenterTimelineEvent[] = [];

  // Stage timeline key milestones (deterministic authentic news broadcast pacing)
  const tPrepEnd = Math.min(1400, Math.round(totalDurationMs * 0.08));
  const tSpeechEnd = Math.max(totalDurationMs - 1200, 4000);
  
  // Phase thresholds
  const tAudienceEnd = Math.round(tPrepEnd + (tSpeechEnd - tPrepEnd) * 0.30); // 8% - 35%: Audience headline
  const tScreenEnd = Math.round(tPrepEnd + (tSpeechEnd - tPrepEnd) * 0.55);   // 35% - 55%: Look & gesture at side screen
  const tBrollEnd = Math.round(tPrepEnd + (tSpeechEnd - tPrepEnd) * 0.75);    // 55% - 75%: B-Roll Interstitial Cut
  const tBookEnd = Math.round(tPrepEnd + (tSpeechEnd - tPrepEnd) * 0.90);     // 75% - 90%: Look down at book on desk speaking

  // 1. Initial Standby / Prep: Anchor glancing down at briefing book on desk
  events.push({
    timeMs: 0,
    pose: 'idle',
    mouth: 'closed',
    gaze: 'book',
    armState: 'hold_notes',
    stageMode: 'studio',
    gesture: 'reviewing_table_book',
    coords: { x: '50%', y: '50%' },
    action: 'consult_briefing_book'
  });

  // 2. Look up from book to audience (Preparation finished)
  events.push({
    timeMs: tPrepEnd,
    pose: 'speaking',
    mouth: 'open',
    gaze: 'audience',
    armState: 'desk_rest',
    stageMode: 'studio',
    gesture: 'look_up_audience',
    coords: { x: '50%', y: '50%' },
    action: 'headline_direct_address'
  });

  // 3. Cadenced speech loops with dynamic gaze, gestures, and B-roll cutaway
  const cycleMs = 190;
  for (let t = tPrepEnd + 200; t < tSpeechEnd; t += cycleMs) {
    const isMouthOpen = (Math.floor(t / cycleMs) % 2 === 0);

    if (t < tAudienceEnd) {
      // Direct Audience delivery
      events.push({
        timeMs: t,
        pose: options.hasBreakingAlert ? 'breaking' : 'speaking',
        mouth: isMouthOpen ? 'open' : (options.hasBreakingAlert ? 'alert' : 'closed'),
        gaze: 'audience',
        armState: 'desk_rest',
        stageMode: 'studio',
        gesture: 'direct_reporting',
        coords: { x: '50%', y: '50%' },
        action: 'anchor_addressing_audience'
      });
    } else if (t < tScreenEnd) {
      // Turn to big side projection screen and gesture towards it
      events.push({
        timeMs: t,
        pose: 'speaking',
        mouth: isMouthOpen ? 'open' : 'closed',
        gaze: 'screen',
        armState: 'gesture_screen',
        stageMode: 'studio',
        gesture: 'point_to_big_screen',
        coords: { x: '50%', y: '50%' },
        action: 'referencing_side_screen'
      });
    } else if (t < tBrollEnd) {
      // B-Roll / Interstitial Cutaway: Pause anchor or cut to field footage/image
      events.push({
        timeMs: t,
        pose: 'speaking',
        mouth: isMouthOpen ? 'open' : 'closed', // Voiceover narration over footage
        gaze: 'audience',
        armState: 'desk_rest',
        stageMode: 'b_roll',
        brollTag: 'VERIFIED ARCHIVE // ON-SCENE REPORT',
        brollHeadline: 'FIELD DISPATCH: LIVE MONITORED UPDATE',
        gesture: 'b_roll_footage_active',
        coords: { x: '50%', y: '50%' },
        action: 'b_roll_interstitial_cut'
      });
    } else if (t < tBookEnd) {
      // Back to Studio Desk: Look down at briefing book on table while speaking statistics
      events.push({
        timeMs: t,
        pose: 'speaking',
        mouth: isMouthOpen ? 'open' : 'closed',
        gaze: 'book',
        armState: 'hold_notes',
        stageMode: 'studio',
        gesture: 'reading_table_book_speaking',
        coords: { x: '50%', y: '50%' },
        action: 'consulting_table_book_speaking'
      });
    } else {
      // Look back up to audience for final wrap
      events.push({
        timeMs: t,
        pose: 'speaking',
        mouth: isMouthOpen ? 'open' : 'closed',
        gaze: 'audience',
        armState: 'desk_rest',
        stageMode: 'studio',
        gesture: 'final_audience_address',
        coords: { x: '50%', y: '50%' },
        action: 'final_audience_wrap'
      });
    }
  }

  // 4. Wrap-up / Sign-off frame: warm professional close looking at audience
  events.push({
    timeMs: tSpeechEnd,
    pose: 'wrap',
    mouth: 'smile',
    gaze: 'audience',
    armState: 'desk_rest',
    stageMode: 'studio',
    gesture: 'closing_wrap',
    coords: { x: '50%', y: '50%' },
    action: 'segment_wrap'
  });

  // 5. Concluded idle at desk
  events.push({
    timeMs: totalDurationMs,
    pose: 'idle',
    mouth: 'closed',
    gaze: 'book',
    armState: 'hold_notes',
    stageMode: 'studio',
    gesture: 'reviewing_table_book',
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
      gaze: 'audience',
      armState: 'desk_rest',
      stageMode: 'studio',
      gesture: 'desk_rest',
      coords: { x: '50%', y: '50%' },
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
