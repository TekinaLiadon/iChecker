export const SOURCE_ALERT_THRESHOLD = 3;
export const SOURCE_ALERT_INTERVAL_MS = 60 * 60 * 1000;

export interface SourceHealthOptions {
    name: string;
    notify: (text: string) => Promise<void> | void;
    threshold?: number;
    alertIntervalMs?: number;
}

export class SourceHealthTracker {
    private readonly options: SourceHealthOptions;
    private failures = 0;
    private downSince: number | null = null;
    private lastAlertAt: number | null = null;

    constructor(options: SourceHealthOptions) {
        this.options = options;
    }

    async failure(): Promise<void> {
        this.failures += 1;
        if (this.downSince === null) this.downSince = Date.now();
        const threshold = this.options.threshold ?? SOURCE_ALERT_THRESHOLD;
        if (this.failures < threshold) return;

        const now = Date.now();
        const alertIntervalMs = this.options.alertIntervalMs ?? SOURCE_ALERT_INTERVAL_MS;
        if (this.lastAlertAt !== null && now - this.lastAlertAt < alertIntervalMs) return;

        this.lastAlertAt = now;
        const minutes = Math.floor((now - this.downSince) / 60000);
        await this.options.notify(`${this.options.name} недоступен уже ${minutes} минут`);
    }

    async success(): Promise<void> {
        if (this.lastAlertAt === null) {
            this.failures = 0;
            this.downSince = null;
            return;
        }
        await this.options.notify(`${this.options.name} снова доступен`);
        this.failures = 0;
        this.downSince = null;
        this.lastAlertAt = null;
    }
}
