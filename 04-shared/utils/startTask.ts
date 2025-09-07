export default (task: () => void): void=> {
    var now: Date = new Date();
    var target: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        now.getHours(), 10, 0, 0);
    if (now > target) target = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
            now.getHours() + 1, 10, 0, 0);
    var newTime: number = target - now;

    setTimeout(() => {
        task();
    }, newTime);
}