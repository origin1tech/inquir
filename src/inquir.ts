import { EOL } from 'os';
import * as readline from 'readline';
import { format, inspect } from 'util';
import * as promisify from 'es6-promisify';
import { extend, isPlainObject, isWindows, isArray, isFunction, last, isString, isValue, toDefault, isNumber, first, contains, keys, castType, toArray, noop } from 'chek';
import { Colurs, IAnsiStyles, IColurs } from 'colurs';

import { IMap, IBasePrompt, IOptions, IPrompt, IPromptInternal, IPromptTemplate, IResponse, IResponses, AnsiStyles, AnswerCallback, CompletionsHandler, InputHandler, EventState } from './interfaces';

const DEFAULTS: IOptions = {
  name: 'Inquir',                       // name of your application.
  input: process.stdin,                 // the input stream to be used.
  output: process.stdout,               // the output stream to be used.
  delim: null,                          // delimiter to use in terminal.
  delimStyle: ['cyan', 'dim'],          // the delimiter color.
  promptDelim: '[?]',                   // the prompt delimiter.
  promptDelimStyle: ['yellow', 'dim'],  // the prompt delimiter's style.
  colorize: true,                       // when true colors are used.
  completer: null,                      // array or functions to get completions from.
  onInput: null,                        // an input handler on interface read.
  onLog: null,                          // override internal log handler.
  onError: null                         // override internal error handler.
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

export class Inquir {

  private _initialized: boolean;
  private _eventsEnabled: boolean;
  private _colurs: IColurs;
  private _prompts: Map<string, IPromptInternal>;

  private _styles: IMap<AnsiStyles | AnsiStyles[]> = {
    emergency: ['red', 'bold'],
    error: ['red', 'dim'],
    warning: ['yellow', 'dim'],
    warn: ['yellow', 'dim'],
    info: ['green', 'dim'],
    exit: ['cyan', 'dim']
  };

  rl: readline.ReadLine;
  options: IOptions;

  constructor(options?: IOptions) {

    this.options = extend({}, DEFAULTS, options);
    this.options.delim = this.options.delim || this.options.name.toLowerCase() + '> ';
    this._prompts = new Map<string, IPromptInternal>();
    this._colurs = new Colurs({ enabled: this.options.colorize });

  }

  /**
   * Event Handlers
   * : Method to wire up internal event handlers.
   */
  private exceptionHandler(state) {

    process.stdin.resume();
    const log = this.log();

    if (state === EventState.EMERGENCY) {
      log.emerg(`Fubar! ${this.options.name} can\'t recover from that one.`);
      this.rl.close();
    }
    else {
      // toggle listeners to prevent any loops.
      this.toggleExceptions();
      log.exit(`${this.options.name} exit requested.`);
      console.log();
    }

  }

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
  private toggleExceptions(events?: string | string[]) {

    const defaults = ['exit', 'uncaughtException'];
    events = toArray<string>(events || defaults);

    if (!this._eventsEnabled) {
      events.forEach((e: any) => {
        if (e !== 'uncaughtException')
          process.on(e, this.exceptionHandler.bind(this, EventState.EXIT));
        else
          process.on(e, this.exceptionHandler.bind(this, EventState.EMERGENCY));
      });
      this._eventsEnabled = true;
    }
    else {
      events.forEach((e) => {
        process.removeListener(e, this.exceptionHandler);
      });
    }

  }

  /**
   * Completer
   * : Gets a completer based on defined values or method.
   *
   * @param completer the completer values or handler.
   */
  private completionHandler(completer: string[] | CompletionsHandler) {

    function filter(line, comps: string[]) {
      return comps.filter(c => c.startsWith(line));
    }

    function _completerAsync(line, fn) {
      (completer as CompletionsHandler)(line, (err, comps) => {
        if (err)
          throw err;
        fn(null, [filter(line, comps), line]);
      });
    }

    function _completer(line) {
      return [filter(line, isFunction(completer) ? (completer as CompletionsHandler)(line) as string[] : completer as string[]), line];
    }

    // Just return func that returns orig line.
    if (!completer || (isArray(completer) && !completer.length))
      return (l) => [[], l];

    if (isArray(completer) || (isFunction(completer) && completer.length === 1))
      return _completer;

    return _completerAsync;

  }

  /**
   * Colorize
   * : Colorizes a string.
   *
   * @param val the value to colorize.
   * @param styles the styles to be applied.
   */
  private colorize(val: string, styles: AnsiStyles | AnsiStyles[]) {
    return this._colurs.applyAnsi(val, styles) as string;
  }

  /**
   * Mask
   * : Hijacks stdout to mask input such as a password,
   *
   * @param prompt the prompt or question to prepend to muted chars.
   */
  private mask(prompt: string, mask: string | AnswerCallback, fn?: AnswerCallback) {

    if (isFunction(mask)) {
      fn = <AnswerCallback>mask;
      mask = undefined;
    }

    let chars, lastKey, listening;
    const stdin = process.openStdin();
    const output = this.options.output;

    mask = mask || '*';
    chars = '';

    // Toggles event listeners on or off.
    function toggleListeners(enable: boolean = true) {
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
    const keypressHandler = (str, key) => {
      lastKey = key;
    };

    // Handles masking input.
    const inputHandler = (input) => {

      input = input + '';

      let key = (lastKey && lastKey.name) || '';
      if (lastKey.ctrl) key = 'ctrl';
      lastKey = null;

      if (key === 'return' || key === 'ctrl') {
        prompt = null;
        chars = '';
        toggleListeners(false);
      }

      else if (prompt) {

        if (key === 'backspace') {
          chars = chars.slice(0, chars.length - 2);
          this.clearLine(false);
          output.write(prompt + (mask as string).repeat(chars.length));
        }

        else {
          chars += input;
          this.clearLine(false);
          output.write(prompt + (mask as string).repeat(chars.length));
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
    this.rl.question(prompt, (answer: string) => {
      // may need cleanup here in future.
      fn(answer);
    });

    return this;

  }

  /**
   * Get Option
   * : Gets an option.
   *
   * @param key the name of the option to get.
   */
  getOption(key: string) {
    return this.options[key];
  }

  /**
   * Set Option
   * : Sets an option.
   *
   * @param key the name or options object.
   * @param val the value to set for the key.
   */
  setOption(key: string | IOptions, val: any) {
    let obj: IOptions = {};
    if (isPlainObject(key)) {
      obj = <IOptions>key;
    }
    else {
      obj[<string>key] = val;
    }
    extend(this.options, obj);
    return this;
  }

  /**
   * Init
   * : Initializes the readline interface.
   */
  init() {

    if (this._initialized)
      return;

    // Enable keypress events.
    readline.emitKeypressEvents(process.stdin);

    // Get the completer.
    let completer = this.completionHandler(this.options.completer);

    // Enable event listeners.
    this.toggleExceptions();

    // Create the readline interface.
    this.rl =
      readline.createInterface(this.options.input, this.options.output, completer);

    // If is TTY must be in raw mode.
    if (process.stdin.isTTY)
      process.stdin.setRawMode(true);

  }

  /**
   * Log
   * : Logs message.
   */
  log(...args: any[]) {

    const formatter = (args: any[]) => {
      let meta = isPlainObject(last(args)) ? args.pop() : null;
      let msg = args.shift();
      let isErr = (msg instanceof Error);
      const hasFmtArgs = /(%s|%d)/g.test(msg);
      if (hasFmtArgs)
        msg = format(msg, ...args);
      else if (!isErr) {
        args.unshift(msg);
        msg = args.join(' ');
      }
      if (isErr) {
        msg =
          this._colurs.red(msg.name || 'Error') + ': ' +
          msg.message + '\n' +
          msg.stack.split('\n').slice(1).join('\n');
      }
      if (meta) {
        meta = inspect(meta, null, null, this.options.colorize);
        msg += (isErr ? '\n' + meta : ' ' + meta);
      }
      return {
        msg,
        isErr
      };
    };

    const logger = (...args) => {

      if (this.options.onLog) {
        this.options.onLog(...args);
        return this;
      }

      let event = args.shift();
      let label = EventState[event];
      if (label) {
        if (this._styles[label.toLowerCase()])
          label = this.colorize(label, this._styles[label.toLowerCase()]);
      }
      else {
        if (event !== 'wrap')
          args.unshift(event);
      }
      const formatted = formatter(args);
      args = [formatted.msg];
      if (label)
        args.unshift(label + ':');
      (console as any).log(...args);
    };

    if (args.length)
      logger(...args);

    return {
      emergency: logger.bind(this, EventState.EMERGENCY),
      emerg: logger.bind(this, EventState.EMERGENCY),
      error: logger.bind(this, EventState.ERROR),
      warning: logger.bind(this, EventState.WARNING),
      warn: logger.bind(this, EventState.WARNING),
      info: logger.bind(this, EventState.INFO),
      exit: logger.bind(this, EventState.EXIT),
      wrap: logger.bind(this)
    };

  }

  /**
   * Clear Screen
   * : Clears the entire screen.
   */
  clearScreen() {
    let out = '';
    if (!isWindows()) {
      out = '\x1B[2J';
    }
    else {
      const lines = process.stdout['getWindowSize']()[1];
      lines.forEach((l) => {
        out += '\r\n';
      });
    }
    out += '\x1B[0f';
    process.stdout.write(out);
    readline.cursorTo(<any>this.rl, 0, 0);
  }

  /**
   * Clear Line
   * : Clears the line and optionally outputs new line first.
   *
   * @param newline when true a new line is output first.
   */
  clearLine(newline: boolean = true) {
    if (newline)
      this.rl.write(EOL);
    readline.clearLine(this.options.output, 0); // clears the line.
    readline.cursorTo(this.options.output, 0);  // moves cursor x to 0 or begining of line.
  }

  /**
   * Set Delim
   * : Calls readline prompt setting delim.
   *
   * @param delim the delimiter to use/output to console.
   */
  setDelim(delim?: string) {
    delim = delim || this.options.delim;
    this.rl.setPrompt(this.colorize(delim, this.options.delimStyle));
    this.rl.prompt();
  }

  /**
   * Generate
   * : Generates a prompt by type.
   *
   * @param prompt the prompt to generate.
   */
  generate(prompt: IPromptInternal) {

  }

  /**
   * Collection
   * : Creates a new collection.
   *
   * @param namespace the name of the collection.
   * @param prompts an array of prompts.
   */
  prompts(namespace: string, prompts?: IPrompt[]) {

    const coll = this._prompts;

    function toNamespace(key) {
      return `${namespace}:${key}`;
    }

    function fromNamespace(key) {
      if (!~key.indexOf(':'))
        return key;
      return key.split(':')[1];
    }

    let ctr;

    const methods = {

      /**
       * Exists
       * : Checks if the prompt exisits.
       *
       * @param name the name of the prompt.
       */
      exists: (name: string) => {
        return coll.has(toNamespace(name));
      },

      /**
       * Get
       * : Gets a prompt by name.
       *
       * @param the name of the prompt.
       */
      get: (name: string) => {
        return coll.get(toNamespace(name));
      },

      /**
       * Get All
       * : Gets all prompts in the collection.
       */
      getAll: () => {
        return Array.from(coll.keys())
          .filter((k) => {
            return (new RegExp('^' + namespace, 'i')).test(k);
          })
          .map((k) => {
            return coll.get(k);
          });
      },

      /**
       * Get By Id
       * : Gets a prompt by it's id.
       *
       * @param id the id of the prompt.
       */
      getById: (id: number) => {
        const coll = methods.getAll();
        return coll.filter(p => p.id === id)[0] || null;
      },

      /**
       * Add
       * : Adds a prompt to the collection.
       *
       * @param the name of the prompt to add.
       * @param prompt the prompt object.
       */
      add: (name: string | IPrompt, prompt?: IPrompt) => {
        let _prompt: any = prompt;
        if (isPlainObject(name))
          _prompt = name;
        if (!name) {
          this.log().warn('unable to add prompt using name of undefined.');
          return methods;
        }
        let nextId = ctr += 1; // methods.lastId();
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
      remove: (name: string | number) => {
        name = isNumber(name) ? methods.getById(<number>name).name : <string>name;
        if (!isValue(name)) {
          this.log('Cannot remove prompt of undefined.');
        }
        coll.delete(toNamespace(name));
        return methods;
      },

      /**
       * Destroy
       * : Destroys all prompts in the collection.
       */
      destroy: () => {
        methods.getAll().forEach((p) => {
          methods.remove(p.name);
        });
        ctr = undefined;
      },

      /**
       * Last Id
       * : Gets last or highest id in the collection.
       */
      lastId: () => {
        const coll = methods.getAll() || [];
        return toDefault(coll.map(p => p.id).sort().pop(), null);
      },

      /**
       * Prompt
       * : Inits the prompt for this collection.
       *
       * @param fn a callback on completed.
       */
      prompt: (fn?: Function) => {
        return this.prompt(namespace, fn);
      }

    };

    ctr = toDefault(methods.lastId(), -1);

    if (prompts) {
      prompts.forEach((p, i) => {
        methods.add(p.name, p);
      });
    }

    return methods;

  }

  /**
   * Prompt
   * : Prompts the user with a question.
   *
   * @param collection the name of the collection to be prompted.
   * @param fn a callback upon prompts completed.
   */
  prompt(collection: string, fn?: Function): Promise<IPrompt[]> {

    // Ensure readline is initialized.
    if (!this._initialized)
      this.init();

    const coll = this.prompts(collection);
    const responses: IMap<IResponses> = {};

    const formatQuestion = (prompt: IPromptInternal) => {
      // const default
      let msg =
        this.colorize(this.options.promptDelim, this.options.promptDelimStyle) +
        ' ' + prompt.message + ' ? ';

    };

    const errorCursorPos = (q) => {
      return { x: q.length + 1, y: 0 };
    };

    return new Promise<IPrompt[]>((resolve, reject) => {

      const promptHandler = (prompt: IPromptInternal, answer: any) => {

        const resp: IResponse = {
          id: prompt.id,
          name: prompt.name,
          type: prompt.type,
          message: prompt.message,
          answer: answer,
          raw: answer,
          valid: true
        };

        const validate: Promise<any> = toPromise(prompt.validate || (() => true));

        validate
          .then((val) => {

          })
          .catch((err) => {
            this.log().error(err);
            this.setDelim();
          });

      };

      // Start the prompts.
      const prompt = coll.getById(0);
      this.rl.question(prompt.message, promptHandler.bind(this, prompt));

    });

  }

  /**
   * Listen
   * : Inits listener to read user inputs.
   *
   * @param handler to listen to input.
   */
  listen(handler?: InputHandler) {

    handler = handler || this.options.onInput || noop;

    if (!handler)
      throw new Error('Whoops cannot Inquir using input handler of undefined.');

    // Ensure readline is initialized.
    if (!this._initialized)
      this.init();

    let exiting;
    this.setDelim();
    this._initialized = true;

    this.rl.on('line', (input) => {
      input = input.trim();
      const lowered = input.toLowerCase();
      if (lowered === 'clear') {
        this.clearScreen();
        this.setDelim();
      }
      else {
        if (input && input.length && !exiting) {
          handler(input, this);
          this.setDelim();
        } else {
          this.setDelim();
        }
      }
    });

    this.rl.on('SIGINT', () => {
      readline.clearLine(this.options.output, -1);
      readline.clearScreenDown(this.options.output);
      this.rl.question('Are you sure you want to exit? ', (answer) => {
        if (answer.match(/^y(es)?$/i)) {
          console.log();
          this.rl.pause();
        }
        else {
          this.setDelim();
        }
      });
    });

    this.rl.on('close', () => {
      exiting = true;
      this.clearLine();
      process.exit(0);
    });

  }

}

