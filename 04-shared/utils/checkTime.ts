
export default (): boolean => {
    var now = new Date();
    var hour = now.getHours();
    var day = now.getDay();
    return hour >= 8 && hour <= 17 && day >= 1 && day <= 5;
}