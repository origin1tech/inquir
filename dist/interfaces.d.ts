/// <reference types="node" />
import { IAnsiStyles } from 'colurs';
import { Inquir } from './inquir';
export declare type LogHandler = (...args: any[]) => void;
export declare type ErrorHandler = LogHandler;
export declare type AnsiStyles = keyof IAnsiStyles;
export declare type NodeCallback = (err: Error, data?: any) => void;
export declare type InputHandler = (input: string, ctx?: Inquir) => void;
export declare type CompletionsHandler = (line: string, fn?: NodeCallback) => void | string[];
export declare type AnswerCallback = (answer: string) => void;
export declare type PromptResponse = boolean | string | Promise<string | boolean>;
export declare type ValidateHandler = (value: any, responses: any) => PromptResponse;
export declare type CoerceHandler = ValidateHandler;
export declare type WhenHandler = (value: any, responses: any) => PromptResponse;
export declare type RecordMethods<T, L extends string> = Record<L, {
    (...args): T;
}>;
export declare enum EventState {
    EMERGENCY = 0,
    ERROR = 1,
    WARNING = 2,
    INFO = 3,
    EXIT = 4,
}
export interface IMap<T> {
    [key: string]: T;
}
export interface IResponse {
    readonly id: number;
    name: string;
    type: string;
    message: string;
    answer: any;
    raw: any;
    valid: boolean;
}
export interface IResponses {
    [key: string]: IResponse;
}
export interface IBasePrompt {
    default?: any;
    validate?: ValidateHandler;
    coerce?: ValidateHandler;
    when?: ValidateHandler;
}
export interface IPromptTemplate extends IBasePrompt {
    name: string;
    prefix?: string;
    prefixStyle?: string;
    suffix?: string;
    suffixStyle?: string;
}
export interface IPrompt extends IBasePrompt {
    type?: string;
    name?: string;
    message: string;
}
export interface IPromptInternal extends IPrompt {
    readonly id: number;
}
export interface IOptions {
    name?: string;
    input?: NodeJS.ReadStream;
    output?: NodeJS.WriteStream;
    delim?: string;
    delimStyle?: AnsiStyles | AnsiStyles[];
    promptDelim?: string;
    promptDelimStyle?: AnsiStyles | AnsiStyles[];
    errorDelim?: string;
    errorDelimStyle?: AnsiStyles | AnsiStyles[];
    colorize?: boolean;
    completer?: string[] | CompletionsHandler;
    onInput?: InputHandler;
    onLog?: LogHandler;
    onError?: ErrorHandler;
}
