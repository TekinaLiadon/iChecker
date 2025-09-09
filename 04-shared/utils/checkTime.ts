
export default (): boolean => {
    var now = new Date();
    var hour = now.getHours();
    var day = now.getDay();
    return hour >= 12 && hour <= 21 && day >= 1 && day <= 5;
}