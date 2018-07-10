exports.time = function () {
    const seconds = parseInt(Math.round(new Date().getTime() / 1000));
    return seconds;
};