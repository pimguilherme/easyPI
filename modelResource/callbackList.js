// Nested list of callbacks, supporting priority
var CallbackList = function () {
    this.first = null;
}

CallbackList.prototype = {

    // Adds a new callback to the list
    // By default, new callbacks with same priority are appended after the last
    add:function (cb, priority, before) {
        var current = this.first, prev;
        while (current) {
            prev = current;
            if (current.priority <= priority) break;
            current = current.next;
        }

        // Let's scan to the last position with this priority
        if (!before) {
            while (current && current.priority == priority) {
                current = current.next;
            }
        } else {
            current = prev;
        }

        // First of the list!
        if (!prev) {
            this.first = {
                cb:cb,
                priority:priority,
                next:current
            }
            return;
        }

        // 'current' is always the place where the new callback will be
        prev.next = {
            cb:cb,
            priority:priority,
            next:current
        }

    },

    // Returns a function which should be called several times, until
    // the callbacks are exhausted
    // Takes N callbacks or callback lists as parameters
    createRunner:function () {
        var cbs = Array.prototype.slice.call(arguments, 0)
        cbs.unshift(this);
        cbs = cbs.map(function (arg) {
            if (arg instanceof CallbackList) {
                return function (context, args, ctrl) {
                    var current = arg.first
                        , after = ctrl.next;
                    ctrl.next = function () {
                        if (!current) return after();
                        var cb = current.cb;
                        current = current.next;
                        cb.apply(context, args.concat(ctrl.next), after);
                    }
                    ctrl.next()
                }
            } else if (arg) {
                return function (context, args, ctrl) {
                    arg.apply(context, args.concat(ctrl.next));
                }
            }
        });
        var len = cbs.length

        return function (context, args, ctrl) {
            var i = 0
                , after = ctrl.next;
            ctrl.next = function () {
                if (i >= len) return after();
                cbs[i++](context, args, ctrl)
            }
            ctrl.next();
        };
    },

// Traverses the callback list and returns it as an array
    toArray:function () {
        var cbs = [];
        var current = this.first;
        while (current) {
            cbs.push(current.cb);
            current = current.next;
        }
        return cbs
    }
}


module.exports = CallbackList;