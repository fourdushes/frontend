import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ChatMessage } from '../types/api';

export const voiceActivityConfig = {
  silenceDurationMs: 1500,
  minimumSpeechDurationMs: 450,
  minimumClipDurationMs: 650,
  maximumClipDurationMs: 60000,
  preRollMs: 700,
  postRollMs: 250,
  noiseCalibrationMs: 1500,
  speechStartHoldMs: 250,
  minimumStartThreshold: 0.035,
  minimumStopThreshold: 0.028,
  startMultiplier: 4,
  stopMultiplier: 2.8,
  releasePeakRatio: 0.4,
  smoothingFactor: 0.82,
  processorBufferSize: 2048,
  maximumRetries: 2,
  retryBaseDelayMs: 900,
} as const;

export type AutoVoiceCaptureState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'CALIBRATING'
  | 'LISTENING'
  | 'SPEECH_DETECTED'
  | 'RECORDING'
  | 'SILENCE'
  | 'ERROR'
  | 'COMPLETED';

export type AudioQueueStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';

export type AudioQueueItem = {
  localId: string;
  sequence: number;
  blob: Blob;
  createdAt: number;
  durationMs: number;
  speechDurationMs: number;
  peakRms: number;
  status: AudioQueueStatus;
  retryCount: number;
  error?: string;
};

type DetectionThresholds = {
  noiseFloor: number;
  startThreshold: number;
  stopThreshold: number;
};

type CaptureController = {
  stop: (flushLastClip: boolean, treatmentCompleted: boolean) => void;
};

type Options = {
  available: boolean;
  treatmentCompleted: boolean;
  upload: (item: AudioQueueItem) => Promise<ChatMessage>;
  onUploaded: (message: ChatMessage) => void;
};

export function useAutoVoiceRecorder({ available, treatmentCompleted, upload, onUploaded }: Options) {
  const [captureState, setCaptureState] = useState<AutoVoiceCaptureState>('IDLE');
  const [queue, setQueue] = useState<AudioQueueItem[]>([]);
  const [meter, setMeter] = useState(0);
  const [thresholds, setThresholds] = useState<DetectionThresholds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<CaptureController | null>(null);
  const startingRef = useRef(false);
  const queueRef = useRef<AudioQueueItem[]>([]);
  const sequenceRef = useRef(0);
  const drainingRef = useRef(false);
  const acceptingUploadsRef = useRef(true);
  const mountedRef = useRef(true);
  const uploadRef = useRef(upload);
  const onUploadedRef = useRef(onUploaded);
  uploadRef.current = upload;
  onUploadedRef.current = onUploaded;

  const supported = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && Boolean(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  const replaceQueue = useCallback((next: AudioQueueItem[]) => {
    queueRef.current = next;
    if (mountedRef.current) setQueue(next);
  }, []);

  const updateQueueItem = useCallback((localId: string, update: Partial<AudioQueueItem>) => {
    replaceQueue(queueRef.current.map((item) => item.localId === localId ? { ...item, ...update } : item));
  }, [replaceQueue]);

  const drainQueue = useCallback(async () => {
    if (drainingRef.current || !acceptingUploadsRef.current) return;
    drainingRef.current = true;
    try {
      while (acceptingUploadsRef.current) {
        const item = queueRef.current.find((candidate) => candidate.status === 'queued');
        if (!item) break;
        updateQueueItem(item.localId, { status: 'uploading', error: undefined });
        try {
          updateQueueItem(item.localId, { status: 'processing' });
          const message = await uploadRef.current(item);
          if (!acceptingUploadsRef.current) {
            updateQueueItem(item.localId, { status: 'failed', error: '진료 종료로 전송 결과 반영을 중단했습니다.' });
            break;
          }
          updateQueueItem(item.localId, { status: 'completed' });
          onUploadedRef.current(message);
        } catch (caught) {
          const retryable = isRetryableUploadError(caught);
          const latest = queueRef.current.find((candidate) => candidate.localId === item.localId) ?? item;
          if (retryable && latest.retryCount < voiceActivityConfig.maximumRetries && acceptingUploadsRef.current) {
            const retryCount = latest.retryCount + 1;
            updateQueueItem(item.localId, { status: 'queued', retryCount, error: `전송 재시도 ${retryCount}/${voiceActivityConfig.maximumRetries}` });
            await delay(voiceActivityConfig.retryBaseDelayMs * 2 ** (retryCount - 1));
            continue;
          }
          const message = uploadErrorMessage(caught);
          updateQueueItem(item.localId, { status: 'failed', error: message });
          if (mountedRef.current) setError(`음성 조각 #${item.sequence} 전송 실패: ${message}`);
          break;
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }, [updateQueueItem]);

  const enqueue = useCallback((item: AudioQueueItem) => {
    replaceQueue([...queueRef.current, item]);
    void drainQueue();
  }, [drainQueue, replaceQueue]);

  const stop = useCallback((flushLastClip = true) => {
    controllerRef.current?.stop(flushLastClip, false);
  }, []);

  const start = useCallback(async () => {
    if (!available || treatmentCompleted || controllerRef.current || startingRef.current) return;
    if (!supported) {
      setCaptureState('ERROR');
      setError('이 브라우저는 자동 발화 녹음에 필요한 오디오 기능을 지원하지 않습니다.');
      return;
    }

    setCaptureState('REQUESTING_PERMISSION');
    setError(null);
    acceptingUploadsRef.current = true;
    startingRef.current = true;
    let pendingStream: MediaStream | null = null;
    let pendingAudioContext: AudioContext | null = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      pendingStream = stream;
      const AudioContextConstructor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('AudioContext를 사용할 수 없습니다.');
      const audioContext = new AudioContextConstructor();
      pendingAudioContext = audioContext;
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(voiceActivityConfig.processorBufferSize, 1, 1);
      const silentOutput = audioContext.createGain();
      silentOutput.gain.value = 0;
      source.connect(processor);
      processor.connect(silentOutput);
      silentOutput.connect(audioContext.destination);

      let active = true;
      let calibrationStartedAt = performance.now();
      let calibrationSamples: number[] = [];
      let noiseFloor: number = voiceActivityConfig.minimumStopThreshold / voiceActivityConfig.stopMultiplier;
      let startThreshold: number = voiceActivityConfig.minimumStartThreshold;
      let stopThreshold: number = voiceActivityConfig.minimumStopThreshold;
      let smoothedRms = 0;
      let lastMeterUpdateAt = 0;
      let candidateStartedAt: number | null = null;
      let speaking = false;
      let silenceStartedAt: number | null = null;
      let preRollFrames: Float32Array[] = [];
      let preRollSamples = 0;
      let clipFrames: Float32Array[] = [];
      let clipSamples = 0;
      let voicedSamples = 0;
      let lastVoiceSample = 0;
      let peakRms = 0;
      let sampleRate = audioContext.sampleRate;

      const resetClip = () => {
        candidateStartedAt = null;
        speaking = false;
        silenceStartedAt = null;
        clipFrames = [];
        clipSamples = 0;
        voicedSamples = 0;
        lastVoiceSample = 0;
        peakRms = 0;
      };

      const pushPreRoll = (frame: Float32Array) => {
        preRollFrames.push(frame);
        preRollSamples += frame.length;
        const maximumSamples = Math.ceil(sampleRate * voiceActivityConfig.preRollMs / 1000);
        while (preRollFrames.length > 1 && preRollSamples > maximumSamples) {
          const removed = preRollFrames.shift();
          if (removed) preRollSamples -= removed.length;
        }
      };

      const finishClip = () => {
        if (!speaking || !clipFrames.length) {
          resetClip();
          return;
        }
        const postRollSamples = Math.ceil(sampleRate * voiceActivityConfig.postRollMs / 1000);
        const keptSamples = Math.min(clipSamples, Math.max(lastVoiceSample + postRollSamples, 0));
        const durationMs = keptSamples / sampleRate * 1000;
        const speechDurationMs = voicedSamples / sampleRate * 1000;
        const meaningful = durationMs >= voiceActivityConfig.minimumClipDurationMs
          && speechDurationMs >= voiceActivityConfig.minimumSpeechDurationMs
          && peakRms >= startThreshold;
        if (meaningful) {
          const blob = encodeWav(clipFrames, keptSamples, sampleRate);
          if (blob.size > 44 && acceptingUploadsRef.current) {
            const sequence = ++sequenceRef.current;
            enqueue({
              localId: createLocalId(sequence),
              sequence,
              blob,
              createdAt: Date.now(),
              durationMs,
              speechDurationMs,
              peakRms,
              status: 'queued',
              retryCount: 0,
            });
          }
        }
        resetClip();
        if (active && mountedRef.current) setCaptureState('LISTENING');
      };

      const stopController = (flushLastClip: boolean, completed: boolean) => {
        if (!active) return;
        active = false;
        if (flushLastClip) finishClip();
        processor.onaudioprocess = null;
        source.disconnect();
        processor.disconnect();
        silentOutput.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        audioContext.onstatechange = null;
        void audioContext.close();
        controllerRef.current = null;
        if (completed) {
          acceptingUploadsRef.current = false;
          replaceQueue(queueRef.current.map((item) => ['queued', 'uploading', 'processing'].includes(item.status)
            ? { ...item, status: 'failed', error: '진료 종료로 남은 전송을 중단했습니다.' }
            : item));
        }
        if (mountedRef.current) {
          setMeter(0);
          setCaptureState(completed ? 'COMPLETED' : 'IDLE');
        }
      };
      controllerRef.current = { stop: stopController };
      pendingStream = null;
      pendingAudioContext = null;

      audioContext.onstatechange = () => {
        if (!active || audioContext.state !== 'suspended') return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void audioContext.resume().catch(() => {
          if (!active) return;
          stopController(true, false);
          if (mountedRef.current) {
            setCaptureState('ERROR');
            setError('브라우저가 오디오 처리를 중단했습니다. 진료 시작하기를 다시 눌러 주세요.');
          }
        });
      };

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!active) return;
          stopController(false, false);
          if (mountedRef.current) {
            setCaptureState('ERROR');
            setError('마이크 입력 장치 연결이 종료되었습니다. 장치를 확인한 뒤 다시 시작해 주세요.');
          }
        };
      });

      setCaptureState('CALIBRATING');
      processor.onaudioprocess = (event) => {
        if (!active) return;
        const now = performance.now();
        const frame = new Float32Array(event.inputBuffer.getChannelData(0));
        sampleRate = event.inputBuffer.sampleRate;
        const rms = calculateRms(frame);
        smoothedRms = voiceActivityConfig.smoothingFactor * smoothedRms + (1 - voiceActivityConfig.smoothingFactor) * rms;
        if (now - lastMeterUpdateAt >= 120) {
          lastMeterUpdateAt = now;
          if (mountedRef.current) setMeter(smoothedRms);
        }

        if (now - calibrationStartedAt < voiceActivityConfig.noiseCalibrationMs) {
          calibrationSamples.push(rms);
          return;
        }
        if (calibrationSamples.length) {
          noiseFloor = median(calibrationSamples);
          stopThreshold = Math.max(voiceActivityConfig.minimumStopThreshold, noiseFloor * voiceActivityConfig.stopMultiplier);
          startThreshold = Math.max(voiceActivityConfig.minimumStartThreshold, noiseFloor * voiceActivityConfig.startMultiplier, stopThreshold * 1.25);
          calibrationSamples = [];
          calibrationStartedAt = 0;
          if (mountedRef.current) {
            setThresholds({ noiseFloor, startThreshold, stopThreshold });
            setCaptureState('LISTENING');
          }
        }

        if (!speaking) {
          pushPreRoll(frame);
          if (smoothedRms >= startThreshold) {
            candidateStartedAt ??= now;
            if (now - candidateStartedAt >= voiceActivityConfig.speechStartHoldMs) {
              speaking = true;
              clipFrames = [...preRollFrames];
              clipSamples = preRollSamples;
              voicedSamples = Math.min(clipSamples, Math.ceil(sampleRate * (now - candidateStartedAt) / 1000));
              lastVoiceSample = clipSamples;
              peakRms = smoothedRms;
              preRollFrames = [];
              preRollSamples = 0;
              if (mountedRef.current) setCaptureState('SPEECH_DETECTED');
            }
          } else {
            candidateStartedAt = null;
          }
          return;
        }

        clipFrames.push(frame);
        clipSamples += frame.length;
        peakRms = Math.max(peakRms, smoothedRms);
        const releaseThreshold = Math.max(
          stopThreshold,
          Math.min(startThreshold, peakRms * voiceActivityConfig.releasePeakRatio),
        );
        if (smoothedRms >= releaseThreshold) {
          voicedSamples += frame.length;
          lastVoiceSample = clipSamples;
          silenceStartedAt = null;
          if (mountedRef.current) setCaptureState('RECORDING');
        } else {
          silenceStartedAt ??= now;
          if (mountedRef.current) setCaptureState('SILENCE');
        }

        const clipDurationMs = clipSamples / sampleRate * 1000;
        if (clipDurationMs >= voiceActivityConfig.maximumClipDurationMs) {
          const continuingSpeech = smoothedRms >= stopThreshold;
          finishClip();
          if (continuingSpeech) {
            candidateStartedAt = now - voiceActivityConfig.speechStartHoldMs;
            pushPreRoll(frame);
          }
          return;
        }
        if (silenceStartedAt && now - silenceStartedAt >= voiceActivityConfig.silenceDurationMs) finishClip();
      };
    } catch (caught) {
      controllerRef.current?.stop(false, false);
      controllerRef.current = null;
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (pendingAudioContext && pendingAudioContext.state !== 'closed') void pendingAudioContext.close();
      setCaptureState('ERROR');
      setError(microphoneErrorMessage(caught));
    } finally {
      startingRef.current = false;
    }
  }, [available, enqueue, replaceQueue, supported, treatmentCompleted]);

  const retryFailed = useCallback(() => {
    if (treatmentCompleted) return;
    acceptingUploadsRef.current = true;
    const firstFailed = queueRef.current.find((item) => item.status === 'failed');
    if (!firstFailed) return;
    updateQueueItem(firstFailed.localId, { status: 'queued', error: undefined });
    setError(null);
    void drainQueue();
  }, [drainQueue, treatmentCompleted, updateQueueItem]);

  useEffect(() => {
    if (!treatmentCompleted) return;
    controllerRef.current?.stop(false, true);
  }, [treatmentCompleted]);

  useEffect(() => {
    if (!available && controllerRef.current) controllerRef.current.stop(false, false);
  }, [available]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden' || !controllerRef.current) return;
      controllerRef.current.stop(true, false);
      if (mountedRef.current) {
        setCaptureState('ERROR');
        setError('탭이 비활성화되어 자동 녹음을 안전하게 중지했습니다. 다시 시작해 주세요.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    acceptingUploadsRef.current = false;
    controllerRef.current?.stop(false, false);
  }, []);

  return {
    supported,
    captureState,
    queue,
    meter,
    thresholds,
    error,
    active: Boolean(controllerRef.current),
    start,
    stop,
    retryFailed,
  };
}

function calculateRms(frame: Float32Array) {
  let sum = 0;
  for (let index = 0; index < frame.length; index += 1) sum += frame[index] * frame[index];
  return Math.sqrt(sum / frame.length);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function encodeWav(frames: Float32Array[], sampleCount: number, sampleRate: number) {
  const source = new Float32Array(sampleCount);
  let sourceIndex = 0;
  for (const frame of frames) {
    const remaining = sampleCount - sourceIndex;
    if (remaining <= 0) break;
    source.set(frame.subarray(0, remaining), sourceIndex);
    sourceIndex += Math.min(frame.length, remaining);
  }

  const outputSampleRate = Math.min(16000, sampleRate);
  const sampleRateRatio = sampleRate / outputSampleRate;
  const outputSampleCount = Math.max(1, Math.floor(sampleCount / sampleRateRatio));
  const buffer = new ArrayBuffer(44 + outputSampleCount * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + outputSampleCount * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputSampleRate, true);
  view.setUint32(28, outputSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, outputSampleCount * 2, true);

  for (let outputIndex = 0; outputIndex < outputSampleCount; outputIndex += 1) {
    const rangeStart = Math.floor(outputIndex * sampleRateRatio);
    const rangeEnd = Math.min(sampleCount, Math.max(rangeStart + 1, Math.floor((outputIndex + 1) * sampleRateRatio)));
    let sum = 0;
    for (let index = rangeStart; index < rangeEnd; index += 1) sum += source[index];
    const sample = Math.max(-1, Math.min(1, sum / (rangeEnd - rangeStart)));
    view.setInt16(44 + outputIndex * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function createLocalId(sequence: number) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `voice-${Date.now()}-${sequence}-${Math.random().toString(16).slice(2)}`;
}

function isRetryableUploadError(error: unknown) {
  if (!axios.isAxiosError(error)) return true;
  if (!error.response) return true;
  return error.response.status >= 500 || error.response.status === 408 || error.response.status === 429;
}

function uploadErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message || error.message || '녹음 파일을 전송하지 못했습니다.';
  }
  return error instanceof Error ? error.message : '녹음 파일을 전송하지 못했습니다.';
}

function microphoneErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Permission') || message.includes('NotAllowed')) return '마이크 권한이 거부되었습니다. 브라우저 설정에서 HearO의 마이크 사용을 허용해 주세요.';
  if (message.includes('NotFound') || message.includes('device')) return '사용할 수 있는 마이크 입력 장치를 찾지 못했습니다.';
  return message || '자동 녹음을 시작하지 못했습니다.';
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
