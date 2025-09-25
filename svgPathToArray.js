import { cmdMove, cmdLine, cmdQuad, cmdCurve } from "./pathcmds.js";

/**
 * SVG path の d 文字列をコマンド配列にパース
 * - 対応: M/m, L/l, H/h, V/v, C/c, S/s, Q/q, T/t, Z/z
 * - 非対応: A/a（円弧）→ 例外
 *
 * @param {string} d - SVG path の d 属性文字列
 * @param {object} [opts]
 * @param {number} [opts.scaleX=1]  - X倍率
 * @param {number} [opts.scaleY=1]  - Y倍率（flipY=true の場合は符号反転後に適用）
 * @param {boolean}[opts.flipY=false] - Y反転（フォント座標系向けに一般に true）
 * @param {number} [opts.offsetX=0] - X平行移動
 * @param {number} [opts.offsetY=0] - Y平行移動（ベースライン調整など）
 * @returns {opentype.Path}
 */
export const svgPathToArray = (d, opts = {}) => {
  const {
    scaleX = 1,
    scaleY = 1,
    flipY = false,
    offsetX = 0,
    offsetY = 0,
  } = opts;

  // 変換関数（描画直前だけ適用）
  const TX = (x) => offsetX + scaleX * x;
  const TY = (y) => offsetY + (flipY ? -scaleY * y : scaleY * y);

  const path = [];
  
  // --- parser state ---
  let i = 0;
  const len = d.length;
  let cx = 0, cy = 0;        // current point（未変換）
  let sx = 0, sy = 0;        // subpath start（未変換）
  let prevCmd = null;        // 直前のコマンド文字
  let pcx = null, pcy = null; // 直前の cubic 制御点（S/s の反射用）
  let pqx = null, pqy = null; // 直前の quad 制御点（T/t の反射用）

  // --- utils ---
  const isCmd = (ch) => /[a-zA-Z]/.test(ch);

  const skipSpaces = () => {
    while (i < len) {
      const c = d.charCodeAt(i);
      // , space, \t, \r, \n
      if (c === 44 || c === 32 || c === 9 || c === 13 || c === 10) i++;
      else break;
    }
  };

  const readNumber = () => {
    skipSpaces();
    let start = i;
    let hasExp = false;
    let hasDot = false;

    if (d[i] === '+' || d[i] === '-') i++;
    while (i < len) {
      const ch = d[i];
      if (ch >= '0' && ch <= '9') { i++; }
      else if (ch === '.' && !hasDot) { hasDot = true; i++; }
      else if ((ch === 'e' || ch === 'E') && !hasExp) {
        hasExp = true; i++;
        if (d[i] === '+' || d[i] === '-') i++;
      } else break;
    }
    const str = d.slice(start, i);
    if (!str.length) throw new Error('number expected at ' + i);
    return parseFloat(str);
  };

  const readCommand = () => {
    skipSpaces();
    if (i >= len) return null;
    const ch = d[i];
    if (isCmd(ch)) { i++; return ch; }
    // 省略時は直前コマンドを繰り返す
    return prevCmd;
  };

  const reflect = (x1, y1, x2, y2) => [2 * x2 - x1, 2 * y2 - y1];

  // 描画ヘルパ（描画直前に TX/TY）
  const moveToAbs = (x, y) => {
    path.push(cmdMove(TX(x), TY(y)));
    cx = x; cy = y;
    sx = x; sy = y;
    pcx = pcy = pqx = pqy = null;
  };

  const lineToAbs = (x, y) => {
    path.push(cmdLine(TX(x), TY(y)));
    cx = x; cy = y;
    pcx = pcy = pqx = pqy = null;
  };

  // パースループ
  while (true) {
    const cmd = readCommand();
    if (!cmd) break;

    const isRel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    prevCmd = cmd;

    if (C === 'M') {
      // 1組目は move、以降は暗黙の line
      const x = readNumber(), y = readNumber();
      const X = isRel ? cx + x : x;
      const Y = isRel ? cy + y : y;
      moveToAbs(X, Y);

      skipSpaces();
      while (i < len && !isCmd(d[i])) {
        const x2 = readNumber(), y2 = readNumber();
        const X2 = isRel ? cx + x2 : x2;
        const Y2 = isRel ? cy + y2 : y2;
        lineToAbs(X2, Y2);
        skipSpaces();
      }
      continue;
    }

    if (C === 'L') {
      while (true) {
        const x = readNumber(), y = readNumber();
        const X = isRel ? cx + x : x;
        const Y = isRel ? cy + y : y;
        lineToAbs(X, Y);
        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'H') {
      while (true) {
        const x = readNumber();
        const X = isRel ? cx + x : x;
        lineToAbs(X, cy);
        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'V') {
      while (true) {
        const y = readNumber();
        const Y = isRel ? cy + y : y;
        lineToAbs(cx, Y);
        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'C') {
      while (true) {
        const x1 = readNumber(), y1 = readNumber();
        const x2 = readNumber(), y2 = readNumber();
        const x = readNumber(),  y = readNumber();
        const X1 = isRel ? cx + x1 : x1;
        const Y1 = isRel ? cy + y1 : y1;
        const X2 = isRel ? cx + x2 : x2;
        const Y2 = isRel ? cy + y2 : y2;
        const X  = isRel ? cx + x  : x;
        const Y  = isRel ? cy + y  : y;

        //path.curveTo(TX(X1), TY(Y1), TX(X2), TY(Y2), TX(X), TY(Y));
        path.push(cmdCurve(TX(X), TY(Y), TX(X1), TY(Y1), TX(X2), TY(Y2)));
        pcx = X2; pcy = Y2;
        pqx = pqy = null;
        cx = X; cy = Y;

        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'S') {
      while (true) {
        const x2 = readNumber(), y2 = readNumber();
        const x = readNumber(),  y = readNumber();
        const X2 = isRel ? cx + x2 : x2;
        const Y2 = isRel ? cy + y2 : y2;
        const X  = isRel ? cx + x  : x;
        const Y  = isRel ? cy + y  : y;

        let X1, Y1;
        if (prevCmd && (prevCmd.toUpperCase() === 'C' || prevCmd.toUpperCase() === 'S') && pcx !== null) {
          [X1, Y1] = reflect(pcx, pcy, cx, cy);
        } else {
          X1 = cx; Y1 = cy;
        }

        //path.curveTo(TX(X1), TY(Y1), TX(X2), TY(Y2), TX(X), TY(Y));
        //path.push(cmdCurveS(TX(X), TY(Y), TX(X2), TY(Y2)));
        path.push(cmdCurve(TX(X), TY(Y), TX(X1), TY(Y1), TX(X2), TY(Y2)));
        pcx = X2; pcy = Y2;
        pqx = pqy = null;
        cx = X; cy = Y;

        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'Q') {
      while (true) {
        const qx = readNumber(), qy = readNumber();
        const x = readNumber(),  y = readNumber();
        const QX = isRel ? cx + qx : qx;
        const QY = isRel ? cy + qy : qy;
        const X  = isRel ? cx + x  : x;
        const Y  = isRel ? cy + y  : y;

        //path.quadraticCurveTo(TX(QX), TY(QY), TX(X), TY(Y));
        path.push(cmdQuad(TX(X), TY(Y), TX(QX), TY(QY)));
        pqx = QX; pqy = QY;
        pcx = pcy = null;
        cx = X; cy = Y;

        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'T') {
      while (true) {
        const x = readNumber(), y = readNumber();
        const X = isRel ? cx + x : x;
        const Y = isRel ? cy + y : y;

        let QX, QY;
        if (prevCmd && (prevCmd.toUpperCase() === 'Q' || prevCmd.toUpperCase() === 'T') && pqx !== null) {
          [QX, QY] = reflect(pqx, pqy, cx, cy);
        } else {
          QX = cx; QY = cy;
        }

        //path.quadraticCurveTo(TX(QX), TY(QY), TX(X), TY(Y));
        //path.push(cmdQuadS(TX(X), TY(Y)));
        path.push(cmdQuad(TX(X), TY(Y), TX(QX), TY(QY)));
        pqx = QX; pqy = QY;
        pcx = pcy = null;
        cx = X; cy = Y;

        skipSpaces();
        if (i >= len || isCmd(d[i])) break;
      }
      continue;
    }

    if (C === 'Z') {
      path.close();
      cx = sx; cy = sy;
      pcx = pcy = pqx = pqy = null;
      continue;
    }

    if (C === 'A') {
      throw new Error('Arc command (A/a) is not supported. Pre-normalize arcs to Beziers.');
    }
  }

  return path;
};
