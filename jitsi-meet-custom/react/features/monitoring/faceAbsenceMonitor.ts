/* eslint-disable */
export default class FaceAbsenceMonitor {
    private threshold: number;
    private count: number;

    constructor(threshold: number = 3) {
        this.threshold = threshold;
        this.count = 0;
    }

    update(isPresent: boolean): boolean {
        if (isPresent) {
            this.count = 0;
            return false;
        } else {
            this.count++;
            // Returns true every time we are over the threshold
            return this.count >= this.threshold;
        }
    }
}