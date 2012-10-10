var
    _ = require('underscore')
// Local libs
    , HashSanidator = require('./sanidator').HashSanidator
    , utils = require('./utils')
    ;

var
    error = utils.scopedError('easyPI')
    , log = utils.scopedLog('easyPI')
    , slice = Array.prototype.slice
    ;


var pushUniqueIdsArray = function (doc, paths, arr, i) {
    var v = doc.get(paths[i++])
    if (v instanceof Array) {
        _.each(v, function (attr) {
            pushUniqueIdsArray(attr, paths, arr, i);
        })
        return
    }
    if (!v) return;
    if (paths.length > i) {
        if (v.get) {
            return pushUniqueIdsArray(v, paths, arr, i);
        } else {
            return;
        }
    }
    utils.pushUnique(arr, v)
}

/**
 * Hook into the Response Object
 */

var Response = function (epi, req, res, next) {
    this.epi = epi;
    this.req = req;
    this.res = res;
    this.next = next;

    // Models to be sent
    this._models = {}
    // Model which will be expanded prior to sending the response
    // This is indexed by the ModelName and has a set of unique ids
    this._modelExpansions = {}

    // Generic request parameters
    this.body = req.body;
    this.query = req.query;
    this.params = req.params;

    this.errors = {
        // Body parameters error
        body:new HashSanidator(this.body),
        // Query parameters error
        query:new HashSanidator(this.query),
        // Params
        params:new HashSanidator(this.params),
        // Generic errors
        generic:[]
    };
}

Response.prototype = {

    // Indicates whether operations should automatically send results
    autoSend:true,
    autoNext:false,

    _extra:null,
    _models:null,
    _result:null,
    _status:null,

    raise:function (s) {
        this._status = 500;
        this.err('There has been an unexpected server error.')
        log(s)
        this.send();
    },

    // Indicates an operation has been finished
    _finished:function () {
        if (this.autoSend) return this.send();
        if (this.autoNext) return this.next();
    },

    //
    // Easy shortcuts
    //

    // Authentication required
    auth:function (msg) {
        this._status = 401;
        this.err(msg || 'Authentication required')
        this._finished();
        return this;
    },

    // Action forbidden by user
    forbidden:function (msg) {
        this._status = 403;
        this.err(msg || 'Action forbidden for the current user')
        this._finished();
        return this;
    },

    // Couldn't find the  resource
    lost:function (msg) {
        this._status = 404;
        this.err(msg || 'Resource not found')
        this._finished();
        return this;
    },

    // Bad request
    bad:function (name, msg) {
        this._status = 400;
        if (name) {
            this.err(name, msg)
        }
        this._finished()
        return this;
    },

    // Indicates this wa a 201 CREATE operation
    created:function (model, models) {
        this._status = 201;
        this.result(model);
        this.models(models)
        this._finished()
        return this;
    },

    // Indicates a resource has been updated
    updated:function (model) {
        this._status = 200;
        this.result(model)
        this._finished()
        return this;
    },

    // Indicates a resource has been removed
    deleted:function (doc) {
        if (doc) {
            this._status = 200;
            this.result(doc);
        } else {
            this._status = 204;
        }
        this._finished()
        return this;
    },

    extra:function (extra) {
        this._extra = extra;
        return this;
    },

    // Indicates this was a GET / operation
    fetched:function (result, models, hasMore) {
        this._status = 200;
        this.result(result);
        this.models(models)
        this.extra({hasMore:hasMore})
        this._finished()
        return this;
    },

    // Stops the processing and returns the errors, if any
    validate:function () {
        if (this.hasErrors()) {
            this.bad()
            return false;
        }
        return true;
    },

    // Wraps the function around error detection
    cb:function (cb) {
        var self = this;
        return function (err) {
            if (err) return self.raise(err);
            cb.apply(this, slice.call(arguments, 1))
        }
    },

    //
    // Error control
    //

    // Sets validation rules
    rules:function (target, rules) {
        if (!rules){
            rules = target;
            target = 'body'
        }
        return this.errors[target].rules(rules)
    },

    // Adiciona uma única regra de validação
    rule:function (target, param, rule) {
        if (!rule){
            rule = param
            param = target
            target = 'body'
        }
        return this.errors[target].rule(param, rule);
    },

    // Adds a validation error to the response
    error:function (name, msg) {
        if (msg === undefined) return this.errors.generic.push(name);
        this.errors['body'].error(name, msg);
    },

    // Indicates whether there is any validation error
    hasErrors:function () {
        if (!this.errors) return false;
        if (this.errors.generic.length) return true;
        if (this.errors.body.hasErrors()) return true;
        if (this.errors.query.hasErrors()) return true;
        if (this.errors.params.hasErrors()) return true;
        return false;
    },


    //
    // Model Expansion
    //

    // Helper function to register model expansions which will be
    // fetched prior to sending the response
    expandModel:function (model, expandOptions) {
        // Finding the unique ids
        var self = this;
        _.each(expandOptions, function (expansion, paths) {
            paths = paths.split('.')
            var arr = self._modelExpansions[expansion.name] || (self._modelExpansions[expansion.name] = [])
            if (model instanceof Array) {
                model.forEach(function (model) {
                    pushUniqueIdsArray(model, paths, arr, 0);
                })
            } else {
                pushUniqueIdsArray(model, paths, arr, 0);
            }
        })
    },

    // Indicates whether this response conveys (or will) any model expansion
    hasModelExpansion:function (modelName) {
        return this._modelExpansions[modelName] && this._modelExpansions[modelName].length;
    },

    // Fetches expanded models and add them to the models to be sent
    _fetchExpansions:function (done) {

        // This means we want to use a set of models as the result,
        // but for this we must see if there are any expansions which
        // will pollute it
        this._expandResultIds();

        var self = this
        // Count of hanging expansions
            , expandedCount = 1
        // Callback to find out if we are done
            , cb = this.cb(function (docs) {
                if (docs) self.models(docs)
                if (--expandedCount <= 0) done();
            });

        // Fetching them from the database
        _.each(this._modelExpansions, function (ids, name) {
            if (!ids.length) return;
            expandedCount++;
            self.epi.models[name].find({_id:{$in:ids}}, cb)
        })
        cb();

    },

    //
    // Request parameters inflation (model lookup)
    //
    inflateBody:function (inflate, after) {
        var self = this
            , c = 1
            , next = function () { if (--c <= 0) after(); }
            , inflateParam = function (name, model) {
                if (!self.body[name] || (self.body[name] instanceof model)) return;
                if (!self.rule(name, function () { this.mongoId() })) return;
                c++;
                model.findById(self.body[name], self.cb(function (doc) {
                    if (!doc) return self.error(name, 'resource_not_found');
                    self.body[name] = doc;
                    next();
                }))
            }
        _.each(inflate, function (inflation, path) {
            inflateParam(path, inflation.model)
        })
        next();
    },

    //
    // Lower level API
    //

    //
    // Results
    //

    // Configures the result for this session
    result:function (result) {
        if (this._result) this.raise('The result has already been defined for this response');
        this._result = result;
        return this;
    },

    // Return the ids of the models for the current result
    resultIds:function () {
        var r = this._result;
        if (!r) return [];
        if (r instanceof Array) {
            return Array.prototype.slice.call(r, 1);
        } else if (typeof r == 'string') {
            var ids = []
            _.each(this._models[r], function (model) {
                ids.push(model.id)
            })
            return ids;
        } else if (r.id) {
            return [r.id]
        }
        return [];
    },

    // Expands the result, if it's a string, to the ids of the current
    // models in the corresponding set
    _expandResultIds:function () {
        var result = this._result, models;
        if (typeof result != 'string' || !this.hasModelExpansion(result)) return;

        models = this._models[result];
        // We have pending expansions, so we'll get the id of the fetched
        // models
        result = [result];
        if (models instanceof Array) {
            result = result.concat(this.resultIds())
        } else if (models && models.id) {
            result.push(models.id);
        }
        this._result = result;
    },

    // Removes nested associations from the _result object
    _flattenObject:function (obj) {
        var self = this
        if (!obj || typeof obj != 'object')  return;
        _.each(obj, function (val, name) {
            if (!val || typeof val != 'object') return;
            // mongoose model
            if (val.constructor && val.constructor.modelName && val.id) {
                self.models(val);
                obj[name] = val.id;
            } else {
                self._flattenObject(val);
            }
        })
    },

    //
    // Response
    //

    // Adds models to be packaged in the response
    models:function (models) {
        var self = this, name, modelsArray;
        if (!models) return this;
        // We assume an array of models is homogeneous
        if (models instanceof Array) {
            // Well, nothing to add
            if (!models.length) return this;
            models.forEach(function (model) {
                self.models(model);
            })
        }
        // it's just a single model
        else {
            // Okay, let's index the models by their name
            name = models.constructor.modelName
            if (!name) this.raise('Missing model name');
            modelsArray = this._models[name] || (this._models[name] = [])
            utils.pushUnique(modelsArray, models, models.id)
        }
        return this;
    },

    send:function (extra) {
        // Default error status = 500 Internal, because it's unhandled
        if (!this._status && this.hasErrors()) {
            this._status = 500;
        }

        var self = this
            , done = function () {
                var built = self.build();
                self.res.json(self._status, _.extend(extra || {}, self._extra, built))
            }

        // No errors, let's fetch the expansions and flatten the objects
        if (!this.hasErrors()) {
            if (this._result) {
                this._result = this._result.toJSON ? this._result.toJSON() : this._result;
                this._flattenObject(this._result);
            }
            this._fetchExpansions(done);
        } else {
            done()
        }
    },

    _buildErrors:function () {
        var errors = {};
        if (this.errors.generic.length) {
            errors.generic = this.errors.generic;
        }
        if (this.errors.body.hasErrors()) {
            errors.body = this.errors.body.errors;
        }
        if (this.errors.query.hasErrors()) {
            errors.query = this.errors.query.errors;
        }
        if (this.errors.params.hasErrors()) {
            errors.params = this.errors.params.errors;
        }
        for (var e in errors) {
            return errors;
        }
        return null;
    },

    build:function () {

        if (!this._status) {
            this.raise('Invalid status');
        }

        var errors = this._buildErrors()
        if (errors) {
            return {
                status:this._status,
                errors:errors
            }
        }

        return {
            status:this._status,
            result:this._result,
            models:this._models
        }
    }


}

//
// Sanidator delegation
//

Response.prototype['err'] = Response.prototype['error']


module.exports = Response;