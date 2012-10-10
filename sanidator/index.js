/**
 * Validator and Sanitizer for Node and Client-Side sharing
 *
 */

// This object is responsible for validating and sanitizing a hash with a set
// of attributes by a given set of rules, and then return error messages
var HashSanidator = function (hash, options) {
    options = options || {};
    this.hash = hash;
    this.clearErrors();
};

HashSanidator.prototype = {

    /**
     * Regras
     */

    // Sets validation rules
    rules:function (rules) {
        for (var param in rules) {
            this.rule(param, rules[param])
        }
        return !this.hasErrors()
    },

    // Adiciona uma única regra de validação
    rule:function (param, rule) {
        var error = this.sanidate(param, rule);
        if (error) {
            this.errors[param] = error;
            return false;
        }
        return true;
    },

    /**
     * Validação
     */

    // Valida e sanitiza um parâmetro com uma regra
    sanidate:function (param, rule) {
        return new Sanidator(this.hash, param).rule(rule).error;
    },

    /**
     * Controle de erros
     */

    // Reseta o estado de erro deste objeto
    clearErrors:function () {
        this.errors = {};
    },

    // Adiciona um erro de validação ao request
    error:function (param, msg) {
        this.errors[param] = msg;
    },

    // Indica se há erro de validação
    hasErrors:function () {
        if (!this.errors) return false;
        for (var e in this.errors) {
            return true;
        }
        return false;
    }

}

// Valida e sanitiza apenas um valor
// @data define outros dados necessários na validação
var Sanidator = function (hash, name) {
    this.value = hash[name];
    this.name = name;
    this.hash = hash;
}

Sanidator.prototype = {

    rule:function (rule) {
        if (typeof rule == 'function') {
            var ret = rule.call(this, this.value, this.hash);
            if (typeof ret !== 'undefined') {
                this.value = ret;
            }
        }
        return this;
    },

    // Define a mensagem de erro
    err:function (msg) {
        this.error = msg || 'Invalid value';
        this.skip();
        return this;
    },

    skip:function (b) {
        this.skipped = b !== false
    },

    // Sobrepõe a última mensagem de erro
    msg:function (msg) {
        if (this.error) this.error = msg;
        return this;
    },

    // Define um novo valor para o elemento sendo sanidado
    val:function (v) {
        this.value = this.hash[this.name] = v;
        return this;
    }

}

// Sets a filter for the sanidator
Sanidator.setFilter = function (name, func) {
    Sanidator.prototype[name] = function () {
        // Once we get an error, nothing else should be evaluated
        if (this.skipped) return this;
        func.apply(this, [this.value, this.hash].concat(Array.prototype.splice.call(arguments, 0)));
        return this;
    }
};

Sanidator.setFilters = function (filters) {
    for (var name in filters) {
        Sanidator.setFilter(name, filters[name]);
    }
}

// Default filters
require('./filters')(Sanidator);

module.exports = {
    HashSanidator:HashSanidator,
    Sanidator:Sanidator
};
