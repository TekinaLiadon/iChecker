export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1000;

export interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
}

export const isRetryableStatus = (status: number): boolean =>
    status === 429 || (status >= 500 && status < 600);

export const getRetryDelayMs = (attempt: number, baseDelayMs: number = RETRY_BASE_DELAY_MS): number => {
    const backoff = baseDelayMs * 2 ** attempt;
    return backoff / 2 + Math.random() * (backoff / 2);
};

const sleep = (ms: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
});

export default async function fetchRetry(url: string, init?: RequestInit, options?: RetryOptions): Promise<Response> {
    const maxAttempts = Math.max(1, options?.maxAttempts ?? RETRY_MAX_ATTEMPTS);
    const baseDelayMs = options?.baseDelayMs ?? RETRY_BASE_DELAY_MS;
    let lastError: unknown = new Error("Запрос не выполнен");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) await sleep(getRetryDelayMs(attempt - 1, baseDelayMs));
        let response: Response;
        try {
            response = await fetch(url, init);
        } catch (e) {
            lastError = e;
            continue;
        }
        if (response.ok) return response;
        if (!isRetryableStatus(response.status)) throw new Error(`HTTP ${response.status}`);
        lastError = new Error(`HTTP ${response.status}`);
    }
    throw lastError;
}
