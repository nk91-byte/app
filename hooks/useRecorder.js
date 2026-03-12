import { useState, useRef, useCallback } from 'react';

export function useRecorder() {
  const [recorderState, setRecorderState] = useState('idle'); // idle | recording | paused
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamsRef = useRef([]);

  const start = useCallback(async (withTabAudio = false) => {
    chunksRef.current = [];
    streamsRef.current = [];

    let finalStream;

    if (withTabAudio) {
      // Capture tab/system audio + mic, mixed together
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Chrome requires video:true to show the picker
        audio: true,
      });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      streamsRef.current = [displayStream, micStream];

      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        audioCtx.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(dest);
      }
      audioCtx.createMediaStreamSource(micStream).connect(dest);

      finalStream = dest.stream;
    } else {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current = [micStream];
      finalStream = micStream;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(finalStream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(1000); // collect a chunk every second
    setRecorderState('recording');
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecorderState('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecorderState('recording');
    }
  }, []);

  // Returns a Promise<Blob> with the recorded audio
  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        streamsRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // prevent any pending onstop handlers
      recorder.stop();
    }
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    chunksRef.current = [];
    setRecorderState('idle');
  }, []);

  return { recorderState, start, pause, resume, stop, cancel };
}
