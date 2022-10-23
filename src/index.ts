import { exec } from 'child_process';
export const execPromise = require('util').promisify(exec);
import { createWriteStream, promises as fs } from 'fs';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import {
    delay,
    FFMPEG_AT_A_TIME,
    FRAMES_DIRECTORY,
    MIN_MINUTES,
    VIDEOS_DIRECTORY
} from './constants';

let stats_royale_intro = true;
let stats_royale_app = true;
let skip_first_seconds = true;
let skip_ending_seconds = true;
let stats_royale_outro = true;

async function download_video(video_id: string) {
    const video = ytdl(`https://www.youtube.com/watch?v=${video_id}`, {
        filter: (format) =>
            format.container === 'mp4' &&
            format.hasAudio === false &&
            format.qualityLabel === '720p'
    });

    await new Promise<void>((resolve) => {
        video.pipe(
            createWriteStream(`${VIDEOS_DIRECTORY}/${video_id}.mp4`).on(
                'finish',
                () => {
                    resolve();
                }
            )
        );
    });
}

function extract_frames(video_id: string) {
    return async (_callback: () => void) => {
        console.log(`Downloading video id: ${video_id}`)
        try {
            await fs.access(`${FRAMES_DIRECTORY}/${video_id}`);
        } catch {
            await fs.mkdir(`${FRAMES_DIRECTORY}/${video_id}`);
        }
        // Use FFMPEG to extract frames out of video
        await execPromise(
            `ffmpeg -i ${VIDEOS_DIRECTORY}/${video_id}.mp4 -vf "select=not(mod(n\\,8))" -vsync vfr "${FRAMES_DIRECTORY}/${video_id}/%01d.png"`
        );

        let starting_frame_index = 0;
        let ending_frame_index = 0;
        if (stats_royale_intro) starting_frame_index += 21;
        if (stats_royale_app) starting_frame_index += 48;
        if (skip_first_seconds) starting_frame_index += 48;
        if (skip_ending_seconds) ending_frame_index += 20;
        if (stats_royale_outro) ending_frame_index += 62;

        let frames = await fs.readdir(`${FRAMES_DIRECTORY}/${video_id}`);

        let unlink_promises: Array<Promise<void>> = new Array();
        for (let i = 1; i <= starting_frame_index; i++) {
            unlink_promises.push(
                fs.unlink(`${FRAMES_DIRECTORY}/${video_id}/${i}.png`)
            );
        }
        for (
            let i = frames.length - ending_frame_index;
            i <= frames.length;
            i++
        ) {
            unlink_promises.push(
                fs.unlink(`${FRAMES_DIRECTORY}/${video_id}/${i}.png`)
            );
        }
        await Promise.allSettled(unlink_promises);
        _callback();
    };
}

const download_video_ids: Map<string, boolean> = new Map();
const frame_video_ids: Map<string, boolean> = new Map();

async function retrieve_previous_video_download_created() {
    const video_id_dir = await fs.readdir(VIDEOS_DIRECTORY);
    for (let video_id in video_id_dir) {
        download_video_ids.set(video_id.slice(0, -4), true)
    }
}

async function retrieve_previous_video_frames_created() {
    const video_id_dir = await fs.readdir(FRAMES_DIRECTORY);
    for (let video_id in video_id_dir) {
        frame_video_ids.set(video_id, true)
    }
}

async function download_video_batches() {
    let batch_count = 1;
    let batch: ytpl.Result | ytpl.ContinueResult = await ytpl(
        'https://www.youtube.com/c/StatsRoyale',
        {
            pages: 1
        }
    );
    do {
        console.log(`Starting batch: ${batch_count}`);
        let download_videos_promises: Array<Promise<void>> =
            new Array();
        let ffmpeg_functions: Array<(_callback: () => void) => Promise<void>> =
            new Array();
        for (let video of batch.items) {
            const video_id = video.id;
            if (frame_video_ids.get(video_id) === undefined && video.durationSec! < MIN_MINUTES) {
                if (download_video_ids.get(video_id) === undefined) {
                    download_videos_promises.push(download_video(video_id));
                }
                ffmpeg_functions.push(extract_frames(video_id));
            }
        }
        console.log(`Downloading videos for batch: ${batch_count}`);
        await Promise.allSettled(download_videos_promises);
        console.log(`Completed downloading for batch: ${batch_count}`);
        for (
            let i = 0;
            i < ffmpeg_functions.length + FFMPEG_AT_A_TIME;
            i += FFMPEG_AT_A_TIME
        ) {
            let ffmpeg_promises: Array<Promise<void>> = new Array();
            // Limit the FFMPEG functions so it will run every "FFMPEG_AT_A_TIME"
            for (
                let ffmpeg_index = i;
                ffmpeg_index <
                Math.min(i + FFMPEG_AT_A_TIME, ffmpeg_functions.length);
                ffmpeg_index++
            ) {
                ffmpeg_promises.push(
                    new Promise((resolve) => {
                        ffmpeg_functions[ffmpeg_index](() => resolve());
                    })
                );
            }
            await Promise.allSettled(ffmpeg_promises);
        }
        console.log(`Completed batch: ${batch_count}`);
        batch = await ytpl.continueReq(batch.continuation!);
        batch_count++;
        delay(5000)
    } while (batch.continuation);
}

async function main() {
    await retrieve_previous_video_frames_created();
    await retrieve_previous_video_download_created();
    await download_video_batches();
}
main();
