import * as Immutable from "immutable";
import * as he from "he";
import urlRegex from "url-regex";
import {
  CellFormatter,
  ClickHandler,
  ClickHandlerAppContext,
  FormatOptions,
} from "./FormatOptions";

/*
 * TODO: move to tad-app
const shell = require('electron').shell; // install this globally so we can access in generated a tag:
window.tadOpenExternal = (url: string) => {
  console.log('tadOpenExternal: ', url);
  shell.openExternal(url);
  return false;
};
*/

(window as any).tadLinkNOP = (url: string) => {
  return false;
};

export interface TextFormatOptionsProps {
  type: string;
  urlsAsHyperlinks: boolean;
}

// MUC hardening: hyperlink rendering is off by default. Cell contents come
// from untrusted data files, so URLs are only rendered as links when the
// user explicitly enables it for a column.
const defaultTextFormatOptionsProps: TextFormatOptionsProps = {
  type: "TextFormatOptions",
  urlsAsHyperlinks: false,
};

const isValidURL = (s: string): boolean =>
  urlRegex({
    exact: true,
  }).test(s);

// MUC hardening: url-regex accepts strings containing HTML markup
// (e.g. "https://x.com/<img/src=x/onerror=...>") and non-web schemes
// (file://, smb://). Only accept well-formed http(s) URLs.
const SAFE_URL_PROTOCOLS = ["http:", "https:"];
// Characters RFC 3986 never allows unencoded in a URL; their presence means
// the cell is markup or junk, not a link.
const DISALLOWED_URL_CHARS = /[\s<>"`\\{}|^]/;

export const isSafeURL = (s: unknown): s is string => {
  if (
    typeof s !== "string" ||
    DISALLOWED_URL_CHARS.test(s) ||
    !isValidURL(s)
  ) {
    return false;
  }
  try {
    return SAFE_URL_PROTOCOLS.includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

function stringify(value: any): string | null {
  if (value === null) {
    return null;
  }
  switch (typeof value) {
    case "string":
      return value;
    case "object":
      const ret = JSON.stringify(value, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      );
      return ret;
    default:
      return String(value);
  }
}

export class TextFormatOptions
  extends Immutable.Record(defaultTextFormatOptionsProps)
  implements TextFormatOptionsProps, FormatOptions
{
  public readonly type!: string;
  public readonly urlsAsHyperlinks!: boolean;

  getFormatter(): CellFormatter {
    const ff = (val?: any): string | undefined | null => {
      if (this.urlsAsHyperlinks && val && isSafeURL(val)) {
        // MUC hardening: HTML-encode the URL before inserting it into markup.
        // Just return false from onclick handler to prevent default link handling
        const escVal = he.encode(val);
        const ret = `<a href="${escVal}" onclick='return false;'>${escVal}</a>`;
        return ret;
      }
      // Try to deal with non-string values for cell values like lists or maps
      const valStr = stringify(val);
      const fmtStr = valStr ? he.encode(valStr) : valStr;
      return fmtStr;
    };

    return ff;
  }

  getClassName(): string | null {
    return null;
  }

  getClickHandler(): ClickHandler {
    const ch = (
      appContext: ClickHandlerAppContext,
      row: number,
      column: number,
      val: any
    ) => {
      if (this.urlsAsHyperlinks && val && isSafeURL(val)) {
        appContext.openURL(val);
      }
    };
    return ch;
  }
}
