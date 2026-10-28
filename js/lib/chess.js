// Movement for the Schrödinger's Chess demo: any piece can be handed any movement type for a turn.
export const TYPES = Object.freeze(['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']);

const SIZE = 8;
const ORTHOGONAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const BACK_RANK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
const FILES = 'abcdefgh';

const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

export function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

export function placePiece(board, { r, c }, piece) {
  return board.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? piece : cell)) : row));
}

export function initialBoard() {
  const piece = (color, r, c) => ({ color, id: `${color}-${FILES[c]}${SIZE - r}`, origin: r === 0 || r === 7 ? BACK_RANK[c] : 'pawn' });
  return emptyBoard().map((row, r) => row.map((_, c) => {
    if (r <= 1) return piece('b', r, c);
    if (r >= 6) return piece('w', r, c);
    return null;
  }));
}

function steps(board, from, color, dirs, slide) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let r = from.r + dr;
    let c = from.c + dc;
    while (inside(r, c)) {
      const target = board[r][c];
      if (target && target.color === color) break;
      moves.push({ r, c });
      if (target || !slide) break;
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function pawnMoves(board, from, color) {
  const dir = color === 'w' ? -1 : 1;
  const startRow = color === 'w' ? 6 : 1;
  const moves = [];
  const one = from.r + dir;
  if (inside(one, from.c) && !board[one][from.c]) {
    moves.push({ r: one, c: from.c });
    const two = from.r + 2 * dir;
    if (from.r === startRow && !board[two][from.c]) moves.push({ r: two, c: from.c });
  }
  for (const dc of [-1, 1]) {
    const target = inside(one, from.c + dc) ? board[one][from.c + dc] : null;
    if (target && target.color !== color) moves.push({ r: one, c: from.c + dc });
  }
  return moves;
}

export function movesFor(type, from, board) {
  const piece = board[from.r][from.c];
  if (!piece) return [];
  const { color } = piece;
  switch (type) {
    case 'rook': return steps(board, from, color, ORTHOGONAL, true);
    case 'bishop': return steps(board, from, color, DIAGONAL, true);
    case 'queen': return steps(board, from, color, [...ORTHOGONAL, ...DIAGONAL], true);
    case 'king': return steps(board, from, color, [...ORTHOGONAL, ...DIAGONAL], false);
    case 'knight': return steps(board, from, color, KNIGHT, false);
    case 'pawn': return pawnMoves(board, from, color);
    default: return [];
  }
}

export function otherColor(color) {
  return color === 'w' ? 'b' : 'w';
}

export function applyMove(board, from, to) {
  const piece = board[from.r][from.c];
  const captured = board[to.r][to.c];
  return { board: placePiece(placePiece(board, to, piece), from, null), captured };
}

export function assignTypes(ids, rng) {
  return Object.freeze(Object.fromEntries(ids.map((id) => [id, TYPES[Math.floor(rng() * TYPES.length)]])));
}
