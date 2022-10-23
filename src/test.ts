function printMessage(message: string) {
    return async (_callback: () => void) => {
        console.log(message);
        _callback();
    };
}
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function main() {
    const ffmpeg_functions: Array<(_callback: () => void) => void> =
        new Array();
    const AMOUNT = 100;
    for (let i = 0; i < AMOUNT; i++) {
        ffmpeg_functions.push(printMessage(i.toString()));
    }
    const FFMPEG_AT_A_TIME = 5;
    for (let i = 0; i < AMOUNT + FFMPEG_AT_A_TIME; i += FFMPEG_AT_A_TIME) {
        let print_promises: Array<Promise<void>> = new Array();
        console.log(Math.min(i + FFMPEG_AT_A_TIME, AMOUNT))
        for (
            let ffmpeg_index = i;
            ffmpeg_index < Math.min(i + FFMPEG_AT_A_TIME, AMOUNT);
            ffmpeg_index++
        ) {
            print_promises.push(
                new Promise<void>((resolve) => {
                    ffmpeg_functions[ffmpeg_index](() => {
                        resolve();
                    });
                })
            );
        }
        await Promise.allSettled(print_promises);
        await delay(1000)
    }
}
main();
