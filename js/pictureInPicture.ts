import React from "react";

export function videoFromCanvasIsSupported() {
  const canvas = document.createElement("canvas");
  // @ts-ignore
  return canvas.captureStream != null;
}

interface VideoFromCanvasOptions {
  canvas: HTMLCanvasElement | null;
  playing: boolean;
}
export function useVideoFromCanvas({
  canvas,
  playing,
}: VideoFromCanvasOptions): HTMLVideoElement | null {
  // Create an HTMLVideoElement from the passed canvas
  const video = React.useMemo(() => {
    if (canvas == null) {
      return null;
    }
    const v = document.createElement("video");
    v.muted = true;
    // @ts-ignore
    v.srcObject = canvas.captureStream(60 /* fps */);
    return v;
  }, [canvas]);

  // Ensure the video element's playing status stays in sync with the audio.
  // This is important because Chrome decided which media control buttons
  // (play/pause) to show based upon the video's status.
  React.useEffect(() => {
    if (video == null || video.paused !== playing) {
      return;
    }
    if (playing) {
      video.play();
    } else {
      video.pause();
    }
  }, [video, playing]);

  return video;
}

export function pictureInPictureIsSupported() {
  // @ts-ignore
  return document.exitPictureInPicture != null;
}

interface PictureInPictureOptions {
  video: HTMLVideoElement | null;
  enabled: boolean;
  onChange(cb: (enabled: boolean) => void): void;
}

export function usePictureInPicture({
  video,
  enabled,
  onChange,
}: PictureInPictureOptions) {
  const [actuallyEnabled, setActuallyEnabled] = React.useState(false);
  // Wrap the local setEnabled call so that its always called with the change handler.
  const wrappedSetEnabled = React.useCallback(
    newValue => {
      if (newValue === enabled) {
        return;
      }
      onChange(newValue);
      setActuallyEnabled(newValue);
    },
    [enabled, onChange]
  );

  // Subscribe to pictureInPicture events to keep `actuallyEnabled` in sync.
  React.useEffect(() => {
    if (video == null) {
      return;
    }
    // @ts-ignore
    setActuallyEnabled(document.pictureInPictureElement === video);
    const enterHandler = () => wrappedSetEnabled(true);
    const leaveHandler = () => wrappedSetEnabled(false);
    video.addEventListener("enterpictureinpicture", enterHandler);
    video.addEventListener("leavepictureinpicture", leaveHandler);
    return () => {
      video.removeEventListener("enterpictureinpicture", enterHandler);
      video.removeEventListener("leavepictureinpicture", leaveHandler);
    };
  }, [video, wrappedSetEnabled]);

  //
  React.useEffect(() => {
    if (video == null || enabled === actuallyEnabled) {
      return;
    }

    let mounted = true;

    if (enabled) {
      // Returns a promise which we could theoretically await.
      // @ts-ignore
      video.requestPictureInPicture().catch((e: Error) => {
        // I've seen this happen when rendering the MediaStream of a canvas that
        // has never been painted into a video and trying to open that video in
        // picture in picture.
        console.error("Failed to enter picture in picture mode", e);
        if (mounted) wrappedSetEnabled(false);
      });
    } else {
      // Returns a promise which we could theoretically await.
      // @ts-ignore
      document.exitPictureInPicture().catch((e: Error) => {
        console.error("Failed to exit picture in picture mode", e);
        if (mounted) wrappedSetEnabled(true);
      });
    }

    return () => {
      mounted = false;
    };
  }, [video, enabled, actuallyEnabled, wrappedSetEnabled]);
}
