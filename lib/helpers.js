'use strict';

exports.epoch = function () {
    var seconds = parseInt(Math.round(new Date().getTime() / 1000));
    return seconds;
};