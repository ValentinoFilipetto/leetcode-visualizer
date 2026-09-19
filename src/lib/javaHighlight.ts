/**
 * A small, dependency-free Java tokenizer — enough to colour the solution
 * sources without pulling in a full highlighting library.
 */

export type TokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'method'
  | 'annotation'
  | 'punct';

export interface Token {
  type: TokenType;
  text: string;
}

const KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
  'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
  'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
  'volatile', 'while', 'var', 'record', 'true', 'false', 'null',
]);

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

/** Tokenizes whole-file source and returns one token list per line. */
export function highlightJava(code: string): Token[][] {
  const lines = code.split('\n');
  const out: Token[][] = [];
  let inBlockComment = false;

  for (const line of lines) {
    const tokens: Token[] = [];
    let i = 0;
    let plain = '';

    const flush = () => {
      if (plain) {
        tokens.push({ type: 'plain', text: plain });
        plain = '';
      }
    };

    while (i < line.length) {
      const rest = line.slice(i);

      if (inBlockComment) {
        const end = rest.indexOf('*/');
        if (end === -1) {
          flush();
          tokens.push({ type: 'comment', text: rest });
          i = line.length;
        } else {
          flush();
          tokens.push({ type: 'comment', text: rest.slice(0, end + 2) });
          i += end + 2;
          inBlockComment = false;
        }
        continue;
      }

      if (rest.startsWith('//')) {
        flush();
        tokens.push({ type: 'comment', text: rest });
        break;
      }

      if (rest.startsWith('/*')) {
        inBlockComment = true;
        continue;
      }

      const ch = line[i];

      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === '\\') j += 2;
          else if (line[j] === ch) { j++; break; }
          else j++;
        }
        flush();
        tokens.push({ type: 'string', text: line.slice(i, j) });
        i = j;
        continue;
      }

      if (ch === '@' && IDENT_START.test(line[i + 1] ?? '')) {
        let j = i + 1;
        while (j < line.length && IDENT_PART.test(line[j])) j++;
        flush();
        tokens.push({ type: 'annotation', text: line.slice(i, j) });
        i = j;
        continue;
      }

      if (/[0-9]/.test(ch) && !(i > 0 && IDENT_PART.test(line[i - 1]))) {
        let j = i;
        while (j < line.length && /[0-9a-fA-FxX._L]/.test(line[j])) j++;
        flush();
        tokens.push({ type: 'number', text: line.slice(i, j) });
        i = j;
        continue;
      }

      if (IDENT_START.test(ch)) {
        let j = i;
        while (j < line.length && IDENT_PART.test(line[j])) j++;
        const word = line.slice(i, j);
        const nextChar = line.slice(j).trimStart()[0];
        flush();
        if (KEYWORDS.has(word)) tokens.push({ type: 'keyword', text: word });
        else if (nextChar === '(') tokens.push({ type: 'method', text: word });
        else if (/^[A-Z]/.test(word)) tokens.push({ type: 'type', text: word });
        else tokens.push({ type: 'plain', text: word });
        i = j;
        continue;
      }

      if (/[{}()[\];,.<>+\-*/%=!&|^~?:]/.test(ch)) {
        flush();
        tokens.push({ type: 'punct', text: ch });
        i++;
        continue;
      }

      plain += ch;
      i++;
    }

    flush();
    out.push(tokens);
  }

  return out;
}
