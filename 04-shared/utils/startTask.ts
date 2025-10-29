export default (task: () => void): void => {
    const now = new Date();
    let target10 = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        10,
        0,
        0
    );
    if (now >= target10) {
        target10 = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours() + 1,
            10,
            0,
            0
        );
    }
    let target40 = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        40,
        0,
        0
    );
    if (now >= target40) {
        target40 = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours() + 1,
            40,
            0,
            0
        );
    }
    const nextTarget = target10 < target40 ? target10 : target40;
    const delay = nextTarget.getTime() - now.getTime();
    setTimeout(() => {
        task();
    }, delay);
}