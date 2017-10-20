/// <reference types="node" />
import * as readline from 'readline';
import { IOptions, IPrompt, IPromptInternal, InputHandler } from './interfaces';
export declare class Inquir {
    private _initialized;
    private _eventsEnabled;
    private _colurs;
    private _prompts;
    private _styles;
    rl: readline.ReadLine;
    options: IOptions;
    constructor(options?: IOptions);
    /**
     * Event Handlers
     * : Method to wire up internal event handlers.
     */
    private exceptionHandler(state);
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
    private toggleExceptions(events?);
    /**
     * Completer
     * : Gets a completer based on defined values or method.
     *
     * @param completer the completer values or handler.
     */
    private completionHandler(completer);
    /**
     * Colorize
     * : Colorizes a string.
     *
     * @param val the value to colorize.
     * @param styles the styles to be applied.
     */
    private colorize(val, styles);
    /**
     * Mask
     * : Hijacks stdout to mask input such as a password,
     *
     * @param prompt the prompt or question to prepend to muted chars.
     */
    private mask(prompt, mask, fn?);
    /**
     * Get Option
     * : Gets an option.
     *
     * @param key the name of the option to get.
     */
    getOption(key: string): any;
    /**
     * Set Option
     * : Sets an option.
     *
     * @param key the name or options object.
     * @param val the value to set for the key.
     */
    setOption(key: string | IOptions, val: any): this;
    /**
     * Init
     * : Initializes the readline interface.
     */
    init(): void;
    /**
     * Log
     * : Logs message.
     */
    log(...args: any[]): {
        emergency: any;
        emerg: any;
        error: any;
        warning: any;
        warn: any;
        info: any;
        exit: any;
        wrap: any;
    };
    /**
     * Clear Screen
     * : Clears the entire screen.
     */
    clearScreen(): void;
    /**
     * Clear Line
     * : Clears the line and optionally outputs new line first.
     *
     * @param newline when true a new line is output first.
     */
    clearLine(newline?: boolean): void;
    /**
     * Set Delim
     * : Calls readline prompt setting delim.
     *
     * @param delim the delimiter to use/output to console.
     */
    setDelim(delim?: string): void;
    /**
     * Generate
     * : Generates a prompt by type.
     *
     * @param prompt the prompt to generate.
     */
    generate(prompt: IPromptInternal): void;
    /**
     * Collection
     * : Creates a new collection.
     *
     * @param namespace the name of the collection.
     * @param prompts an array of prompts.
     */
    prompts(namespace: string, prompts?: IPrompt[]): {
        exists: (name: string) => boolean;
        get: (name: string) => IPromptInternal;
        getAll: () => IPromptInternal[];
        getById: (id: number) => IPromptInternal;
        add: (name: string | IPrompt, prompt?: IPrompt) => any;
        remove: (name: string | number) => any;
        destroy: () => void;
        lastId: () => any;
        prompt: (fn?: Function) => Promise<IPrompt[]>;
    };
    /**
     * Prompt
     * : Prompts the user with a question.
     *
     * @param collection the name of the collection to be prompted.
     * @param fn a callback upon prompts completed.
     */
    prompt(collection: string, fn?: Function): Promise<IPrompt[]>;
    /**
     * Listen
     * : Inits listener to read user inputs.
     *
     * @param handler to listen to input.
     */
    listen(handler?: InputHandler): void;
}
