export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const FFMPEG_AT_A_TIME = 5;

export const VIDEOS_DIRECTORY = 'videos';
export const FRAMES_DIRECTORY = 'frames';

export const MIN_MINUTES = 360;
