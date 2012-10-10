var utils = require('../utils')
    , _ = require('underscore')

/**
 * Middleware para autenticação de usuário com Facebook
 */

module.exports = function () {
    return function (req, epi, next) {

        // parsing do facebook
        var fbsrCookie = req.cookies[utils.fb.srCookieName];
        if (fbsrCookie) {
            var fbData = utils.fb.parseSignedRequest(fbsrCookie);
            if (fbData) {
                req.fbData = fbData;
                models.User.fromFacebookId(fbData['user_id'], function (user) {
                    req.user = user;
                    next();
                })
                return;
            }
        }

        next();

    }
}