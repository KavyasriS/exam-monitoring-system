/* eslint-disable */
import * as mp from "@mediapipe/face_mesh";

export default class HeadPoseMonitor {

    faceMesh: any;
    callback: (direction: string) => void;

    constructor(callback: (direction: string) => void) {
        this.callback = callback;

        this.faceMesh = new mp.FaceMesh({
            locateFile: (file: string) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results: any) => {
            this.computeDirection(results);
        });
    }

    async send(image: HTMLVideoElement) {
        await this.faceMesh.send({ image });
    }

    computeDirection(results: any) {
        if (!results.multiFaceLandmarks?.length) return;

        const landmarks = results.multiFaceLandmarks[0];

        // Nose tip and cheeks
        const nose = landmarks[1];
        const left = landmarks[234];
        const right = landmarks[454];

        const dx = right.x - left.x;     // horizontal tilt
        const dy = nose.y - (left.y + right.y) / 2; // vertical tilt

        let direction = "Forward";

        if (dx > 0.12) direction = "Looking Right";
        else if (dx < -0.12) direction = "Looking Left";

        if (dy > 0.05) direction = "Looking Down";
        else if (dy < -0.05) direction = "Looking Up";

        this.callback(direction);
    }
}
