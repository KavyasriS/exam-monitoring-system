// react/features/base/logging/alertLogger.ts

let alertLogs: string[] = [];

/** Add an alert to memory */
export function logAlert(text: string) {
    const timestamp = new Date().toLocaleString();
    alertLogs.push(`[${timestamp}] ${text}`);
}

/** Download as .txt */
export function downloadAlertLogs() {
    const content = alertLogs.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `alert-logs-${Date.now()}.txt`;
    a.click();

    URL.revokeObjectURL(url);
}

/** Clear logs */
export function clearAlertLogs() {
    alertLogs = [];
}
