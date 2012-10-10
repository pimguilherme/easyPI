// This module ensures there will be a session user available
module.exports = function () {
    return function (req, epi, next) {
        if (req.user) {
            next();
        } else {
            epi.auth('User session required')
                .send();
        }
    }
}