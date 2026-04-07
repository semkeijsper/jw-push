export type Logger = {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};

export function createLogger(name: string): Logger {
    const prefix = `[${name}]`;
    return {
        log: (...args) => console.log(prefix, ...args),
        error: (...args) => console.error(prefix, ...args),
    };
}
