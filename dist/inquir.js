"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var os_1 = require("os");
var readline = require("readline");
var util_1 = require("util");
var promisify = require("es6-promisify");
var chek_1 = require("chek");
var colurs_1 = require("colurs");
var interfaces_1 = require("./interfaces");
var DEFAULTS = {
    name: 'Inquir',
    input: process.stdin,
    output: process.stdout,
    delim: null,
    delimStyle: ['cyan', 'dim'],
    promptDelim: '[?]',
    promptDelimStyle: ['yellow', 'dim'],
    colorize: true,
    completer: null,
    onInput: null,
    onLog: null,
    onError: null // override internal error handler.
};
/**
 * To Promise
 * : Converts standard function to callback then
 * promisifies. ONLY supports one arg when converting to callback.
 *
 * @param fn the regular function to convert.
 */
function toPromise(fn) {
    if (fn.then)
        return fn;
    if (fn.length < 2)
        fn = function (val, done) {
            done(null, fn(val));
        };
    return promisify(fn);
}
var Inquir = (function () {
    function Inquir(options) {
        this._styles = {
            emergency: ['red', 'bold'],
            error: ['red', 'dim'],
            warning: ['yellow', 'dim'],
            warn: ['yellow', 'dim'],
            info: ['green', 'dim'],
            exit: ['cyan', 'dim']
        };
        this.options = chek_1.extend({}, DEFAULTS, options);
        this.options.delim = this.options.delim || this.options.name.toLowerCase() + '> ';
        this._prompts = new Map();
        this._colurs = new colurs_1.Colurs({ enabled: this.options.colorize });
    }
    /**
     * Event Handlers
     * : Method to wire up internal event handlers.
     */
    Inquir.prototype.exceptionHandler = function (state) {
        process.stdin.resume();
        var log = this.log();
        if (state === interfaces_1.EventState.EMERGENCY) {
            log.emerg("Fubar! " + this.options.name + " can't recover from that one.");
            this.rl.close();
        }
        else {
            // toggle listeners to prevent any loops.
            this.toggleExceptions();
            log.exit(this.options.name + " exit requested.");
            console.log();
        }
    };
    /**
     * Toggle Events
     * : Toggles process listener events.
     *
     * exit - fires when closing/exiting process.
     * SIGINT - command ctrl-c was called.
     * SIGUSR1 - kill process id fired (ex: nodemon restart).
     * SIGUSR2 - same as above.
     * uncaughtException - an error has been throw and the process is crashing.
     *
     * @param events optionally pass specific events to toggle.
     */
    Inquir.prototype.toggleExceptions = function (events) {
        var _this = this;
        var defaults = ['exit', 'uncaughtException'];
        events = chek_1.toArray(events || defaults);
        if (!this._eventsEnabled) {
            events.forEach(function (e) {
                if (e !== 'uncaughtException')
                    process.on(e, _this.exceptionHandler.bind(_this, interfaces_1.EventState.EXIT));
                else
                    process.on(e, _this.exceptionHandler.bind(_this, interfaces_1.EventState.EMERGENCY));
            });
            this._eventsEnabled = true;
        }
        else {
            events.forEach(function (e) {
                process.removeListener(e, _this.exceptionHandler);
            });
        }
    };
    /**
     * Completer
     * : Gets a completer based on defined values or method.
     *
     * @param completer the completer values or handler.
     */
    Inquir.prototype.completionHandler = function (completer) {
        function filter(line, comps) {
            return comps.filter(function (c) { return c.startsWith(line); });
        }
        function _completerAsync(line, fn) {
            completer(line, function (err, comps) {
                if (err)
                    throw err;
                fn(null, [filter(line, comps), line]);
            });
        }
        function _completer(line) {
            return [filter(line, chek_1.isFunction(completer) ? completer(line) : completer), line];
        }
        // Just return func that returns orig line.
        if (!completer || (chek_1.isArray(completer) && !completer.length))
            return function (l) { return [[], l]; };
        if (chek_1.isArray(completer) || (chek_1.isFunction(completer) && completer.length === 1))
            return _completer;
        return _completerAsync;
    };
    /**
     * Colorize
     * : Colorizes a string.
     *
     * @param val the value to colorize.
     * @param styles the styles to be applied.
     */
    Inquir.prototype.colorize = function (val, styles) {
        return this._colurs.applyAnsi(val, styles);
    };
    /**
     * Mask
     * : Hijacks stdout to mask input such as a password,
     *
     * @param prompt the prompt or question to prepend to muted chars.
     */
    Inquir.prototype.mask = function (prompt, mask, fn) {
        var _this = this;
        if (chek_1.isFunction(mask)) {
            fn = mask;
            mask = undefined;
        }
        var chars, lastKey, listening;
        var stdin = process.openStdin();
        var output = this.options.output;
        mask = mask || '*';
        chars = '';
        // Toggles event listeners on or off.
        function toggleListeners(enable) {
            if (enable === void 0) { enable = true; }
            if (!enable) {
                stdin.removeListener('data', inputHandler);
                stdin.removeListener('keypress', keypressHandler);
            }
            else {
                stdin.on('data', inputHandler);
                stdin.on('keypress', keypressHandler);
            }
        }
        // Listens to the key pressed.
        var keypressHandler = function (str, key) {
            lastKey = key;
        };
        // Handles masking input.
        var inputHandler = function (input) {
            input = input + '';
            var key = (lastKey && lastKey.name) || '';
            if (lastKey.ctrl)
                key = 'ctrl';
            lastKey = null;
            if (key === 'return' || key === 'ctrl') {
                prompt = null;
                chars = '';
                toggleListeners(false);
            }
            else if (prompt) {
                if (key === 'backspace') {
                    chars = chars.slice(0, chars.length - 2);
                    _this.clearLine(false);
                    output.write(prompt + mask.repeat(chars.length));
                }
                else {
                    chars += input;
                    _this.clearLine(false);
                    output.write(prompt + mask.repeat(chars.length));
                }
            }
        };
        // If prompt = null ensure listeners are disabled.
        if (!prompt) {
            toggleListeners(false);
            return this;
        }
        toggleListeners();
        // Prompt the question.
        this.rl.question(prompt, function (answer) {
            // may need cleanup here in future.
            fn(answer);
        });
        return this;
    };
    /**
     * Get Option
     * : Gets an option.
     *
     * @param key the name of the option to get.
     */
    Inquir.prototype.getOption = function (key) {
        return this.options[key];
    };
    /**
     * Set Option
     * : Sets an option.
     *
     * @param key the name or options object.
     * @param val the value to set for the key.
     */
    Inquir.prototype.setOption = function (key, val) {
        var obj = {};
        if (chek_1.isPlainObject(key)) {
            obj = key;
        }
        else {
            obj[key] = val;
        }
        chek_1.extend(this.options, obj);
        return this;
    };
    /**
     * Init
     * : Initializes the readline interface.
     */
    Inquir.prototype.init = function () {
        if (this._initialized)
            return;
        // Enable keypress events.
        readline.emitKeypressEvents(process.stdin);
        // Get the completer.
        var completer = this.completionHandler(this.options.completer);
        // Enable event listeners.
        this.toggleExceptions();
        // Create the readline interface.
        this.rl =
            readline.createInterface(this.options.input, this.options.output, completer);
        // If is TTY must be in raw mode.
        if (process.stdin.isTTY)
            process.stdin.setRawMode(true);
    };
    /**
     * Log
     * : Logs message.
     */
    Inquir.prototype.log = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var formatter = function (args) {
            var meta = chek_1.isPlainObject(chek_1.last(args)) ? args.pop() : null;
            var msg = args.shift();
            var isErr = (msg instanceof Error);
            var hasFmtArgs = /(%s|%d)/g.test(msg);
            if (hasFmtArgs)
                msg = util_1.format.apply(void 0, [msg].concat(args));
            else if (!isErr) {
                args.unshift(msg);
                msg = args.join(' ');
            }
            if (isErr) {
                msg =
                    _this._colurs.red(msg.name || 'Error') + ': ' +
                        msg.message + '\n' +
                        msg.stack.split('\n').slice(1).join('\n');
            }
            if (meta) {
                meta = util_1.inspect(meta, null, null, _this.options.colorize);
                msg += (isErr ? '\n' + meta : ' ' + meta);
            }
            return {
                msg: msg,
                isErr: isErr
            };
        };
        var logger = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (_this.options.onLog) {
                (_a = _this.options).onLog.apply(_a, args);
                return _this;
            }
            var event = args.shift();
            var label = interfaces_1.EventState[event];
            if (label) {
                if (_this._styles[label.toLowerCase()])
                    label = _this.colorize(label, _this._styles[label.toLowerCase()]);
            }
            else {
                if (event !== 'wrap')
                    args.unshift(event);
            }
            var formatted = formatter(args);
            args = [formatted.msg];
            if (label)
                args.unshift(label + ':');
            (_b = console).log.apply(_b, args);
            var _a, _b;
        };
        if (args.length)
            logger.apply(void 0, args);
        return {
            emergency: logger.bind(this, interfaces_1.EventState.EMERGENCY),
            emerg: logger.bind(this, interfaces_1.EventState.EMERGENCY),
            error: logger.bind(this, interfaces_1.EventState.ERROR),
            warning: logger.bind(this, interfaces_1.EventState.WARNING),
            warn: logger.bind(this, interfaces_1.EventState.WARNING),
            info: logger.bind(this, interfaces_1.EventState.INFO),
            exit: logger.bind(this, interfaces_1.EventState.EXIT),
            wrap: logger.bind(this)
        };
    };
    /**
     * Clear Screen
     * : Clears the entire screen.
     */
    Inquir.prototype.clearScreen = function () {
        var out = '';
        if (!chek_1.isWindows()) {
            out = '\x1B[2J';
        }
        else {
            var lines = process.stdout['getWindowSize']()[1];
            lines.forEach(function (l) {
                out += '\r\n';
            });
        }
        out += '\x1B[0f';
        process.stdout.write(out);
        readline.cursorTo(this.rl, 0, 0);
    };
    /**
     * Clear Line
     * : Clears the line and optionally outputs new line first.
     *
     * @param newline when true a new line is output first.
     */
    Inquir.prototype.clearLine = function (newline) {
        if (newline === void 0) { newline = true; }
        if (newline)
            this.rl.write(os_1.EOL);
        readline.clearLine(this.options.output, 0); // clears the line.
        readline.cursorTo(this.options.output, 0); // moves cursor x to 0 or begining of line.
    };
    /**
     * Set Delim
     * : Calls readline prompt setting delim.
     *
     * @param delim the delimiter to use/output to console.
     */
    Inquir.prototype.setDelim = function (delim) {
        delim = delim || this.options.delim;
        this.rl.setPrompt(this.colorize(delim, this.options.delimStyle));
        this.rl.prompt();
    };
    /**
     * Generate
     * : Generates a prompt by type.
     *
     * @param prompt the prompt to generate.
     */
    Inquir.prototype.generate = function (prompt) {
    };
    /**
     * Collection
     * : Creates a new collection.
     *
     * @param namespace the name of the collection.
     * @param prompts an array of prompts.
     */
    Inquir.prototype.prompts = function (namespace, prompts) {
        var _this = this;
        var coll = this._prompts;
        function toNamespace(key) {
            return namespace + ":" + key;
        }
        function fromNamespace(key) {
            if (!~key.indexOf(':'))
                return key;
            return key.split(':')[1];
        }
        var ctr;
        var methods = {
            /**
             * Exists
             * : Checks if the prompt exisits.
             *
             * @param name the name of the prompt.
             */
            exists: function (name) {
                return coll.has(toNamespace(name));
            },
            /**
             * Get
             * : Gets a prompt by name.
             *
             * @param the name of the prompt.
             */
            get: function (name) {
                return coll.get(toNamespace(name));
            },
            /**
             * Get All
             * : Gets all prompts in the collection.
             */
            getAll: function () {
                return Array.from(coll.keys())
                    .filter(function (k) {
                    return (new RegExp('^' + namespace, 'i')).test(k);
                })
                    .map(function (k) {
                    return coll.get(k);
                });
            },
            /**
             * Get By Id
             * : Gets a prompt by it's id.
             *
             * @param id the id of the prompt.
             */
            getById: function (id) {
                var coll = methods.getAll();
                return coll.filter(function (p) { return p.id === id; })[0] || null;
            },
            /**
             * Add
             * : Adds a prompt to the collection.
             *
             * @param the name of the prompt to add.
             * @param prompt the prompt object.
             */
            add: function (name, prompt) {
                var _prompt = prompt;
                if (chek_1.isPlainObject(name))
                    _prompt = name;
                if (!name) {
                    _this.log().warn('unable to add prompt using name of undefined.');
                    return methods;
                }
                var nextId = ctr += 1; // methods.lastId();
                // nextId = nextId === null ? 0 : nextId += 1;
                _prompt.id = nextId;
                _prompt.name = name;
                _prompt.type = _prompt.type || 'string';
                coll.set(toNamespace(name), _prompt);
                return methods;
            },
            /**
             * Remove
             * : Remove prompt from the collection.
             *
             * @param name the name of the prompt to be removed.
             */
            remove: function (name) {
                name = chek_1.isNumber(name) ? methods.getById(name).name : name;
                if (!chek_1.isValue(name)) {
                    _this.log('Cannot remove prompt of undefined.');
                }
                coll.delete(toNamespace(name));
                return methods;
            },
            /**
             * Destroy
             * : Destroys all prompts in the collection.
             */
            destroy: function () {
                methods.getAll().forEach(function (p) {
                    methods.remove(p.name);
                });
                ctr = undefined;
            },
            /**
             * Last Id
             * : Gets last or highest id in the collection.
             */
            lastId: function () {
                var coll = methods.getAll() || [];
                return chek_1.toDefault(coll.map(function (p) { return p.id; }).sort().pop(), null);
            },
            /**
             * Prompt
             * : Inits the prompt for this collection.
             *
             * @param fn a callback on completed.
             */
            prompt: function (fn) {
                return _this.prompt(namespace, fn);
            }
        };
        ctr = chek_1.toDefault(methods.lastId(), -1);
        if (prompts) {
            prompts.forEach(function (p, i) {
                methods.add(p.name, p);
            });
        }
        return methods;
    };
    /**
     * Prompt
     * : Prompts the user with a question.
     *
     * @param collection the name of the collection to be prompted.
     * @param fn a callback upon prompts completed.
     */
    Inquir.prototype.prompt = function (collection, fn) {
        var _this = this;
        // Ensure readline is initialized.
        if (!this._initialized)
            this.init();
        var coll = this.prompts(collection);
        var responses = {};
        var formatQuestion = function (prompt) {
            // const default
            var msg = _this.colorize(_this.options.promptDelim, _this.options.promptDelimStyle) +
                ' ' + prompt.message + ' ? ';
        };
        var errorCursorPos = function (q) {
            return { x: q.length + 1, y: 0 };
        };
        return new Promise(function (resolve, reject) {
            var promptHandler = function (prompt, answer) {
                var resp = {
                    id: prompt.id,
                    name: prompt.name,
                    type: prompt.type,
                    message: prompt.message,
                    answer: answer,
                    raw: answer,
                    valid: true
                };
                var validate = toPromise(prompt.validate || (function () { return true; }));
                validate
                    .then(function (val) {
                })
                    .catch(function (err) {
                    _this.log().error(err);
                    _this.setDelim();
                });
            };
            // Start the prompts.
            var prompt = coll.getById(0);
            _this.rl.question(prompt.message, promptHandler.bind(_this, prompt));
        });
    };
    /**
     * Listen
     * : Inits listener to read user inputs.
     *
     * @param handler to listen to input.
     */
    Inquir.prototype.listen = function (handler) {
        var _this = this;
        handler = handler || this.options.onInput || chek_1.noop;
        if (!handler)
            throw new Error('Whoops cannot Inquir using input handler of undefined.');
        // Ensure readline is initialized.
        if (!this._initialized)
            this.init();
        var exiting;
        this.setDelim();
        this._initialized = true;
        this.rl.on('line', function (input) {
            input = input.trim();
            var lowered = input.toLowerCase();
            if (lowered === 'clear') {
                _this.clearScreen();
                _this.setDelim();
            }
            else {
                if (input && input.length && !exiting) {
                    handler(input, _this);
                    _this.setDelim();
                }
                else {
                    _this.setDelim();
                }
            }
        });
        this.rl.on('SIGINT', function () {
            readline.clearLine(_this.options.output, -1);
            readline.clearScreenDown(_this.options.output);
            _this.rl.question('Are you sure you want to exit? ', function (answer) {
                if (answer.match(/^y(es)?$/i)) {
                    console.log();
                    _this.rl.pause();
                }
                else {
                    _this.setDelim();
                }
            });
        });
        this.rl.on('close', function () {
            exiting = true;
            _this.clearLine();
            process.exit(0);
        });
    };
    return Inquir;
}());
exports.Inquir = Inquir;
//# sourceMappingURL=inquir.js.map