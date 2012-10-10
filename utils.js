var fs = require('fs')
    , path = require('path')
    , _ = require('underscore')
    , util = require('util')
    ;

/**
 * Created with JetBrains PhpStorm.
 * User: pim
 * Date: 9/26/12
 * Time: 9:12 PM
 * To change this template use File | Settings | File Templates.
 */
var utils = module.exports = {

    // Returns a structured object containing all the directory's files
    // exports, indexed by the filename
    dirStructure:function (dirPath, options) {
        options = options || {};
        var files = fs.readdirSync(dirPath)
            , struct = {}
            ;
        files.forEach(function (file) {
            if (options.exclude && options.exclude.indexOf(file) != -1) return;
            struct[path.basename(file, '.js')] = require(dirPath + '/' + file);
        });
        return struct;
    },

    // Common scoped error logging
    scopedError:function (name) {
        return function (m) {
            throw new Error(name + ": " + m + ' ' + util.inspect(Array.prototype.slice.call(arguments, 1)))
        }
    },

    // Commong scoped logging
    scopedLog:function (name) {
        return function (m) {
            console.log.call(console, "[" + name + "] " + m, Array.prototype.slice.call(arguments, 1));
            if (m && m.stack) {
                console.log(m.stack)
            }
        }
    },

    // Pushes a unique value into the array, based in a property of the object
    pushUnique:function (arr, obj, key) {
        key = key || obj;
        if ((arr._uniqueMap || (arr._uniqueMap = {})) && arr._uniqueMap[key]) return;
        arr._uniqueMap[key] = true;
        arr.push(obj);
    },


    // The self-propagating extend function that Backbone classes use.
    extend:function (protoProps, classProps) {
        var child = utils.inherits(this, protoProps, classProps);
        child.extend = this.extend || utils.extend;
        return child;
    },

    _ctor:function () { },

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    inherits:function (parent, protoProps, staticProps) {
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function () { parent.apply(this, arguments); };
        }

        // Inherit class (static) properties from parent.
        _.extend(child, parent);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        utils._ctor.prototype = parent.prototype;
        child.prototype = new utils._ctor();

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Add static properties to the constructor function, if supplied.
        if (staticProps) _.extend(child, staticProps);

        // Correctly set child's `prototype.constructor`.
        child.prototype.constructor = child;

        // Set a convenience property in case the parent's prototype is needed later.
        child.__super__ = parent.prototype;

        return child;
    }
}