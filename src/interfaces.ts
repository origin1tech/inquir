import { Colurs, IAnsiStyles, IColurs } from 'colurs';
import { Inquir } from './inquir';


export type LogHandler = (...args: any[]) => void;
export type ErrorHandler = LogHandler;
export type AnsiStyles = keyof IAnsiStyles;
export type NodeCallback = (err: Error, data?: any) => void;
export type InputHandler = (input: string, ctx?: Inquir) => void;
export type CompletionsHandler = (line: string, fn?: NodeCallback) => void | string[];
export type AnswerCallback = (answer: string) => void;
export type PromptResponse = boolean | string | Promise<string | boolean>;
export type ValidateHandler = (value: any, responses: any) => PromptResponse;
export type CoerceHandler = ValidateHandler;
export type WhenHandler = (value: any, responses: any) => PromptResponse;

export type RecordMethods<T, L extends string> = Record<L, { (...args): T }>;

export enum EventState {
  EMERGENCY,
  ERROR,
  WARNING,
  INFO,
  EXIT
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