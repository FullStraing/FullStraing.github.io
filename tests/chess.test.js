import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, emptyBoard, initialBoard, placePiece, movesFor, assignTypes, otherColor, applyMove } from '../js/lib/chess.js';
import { createRng } from '../js/lib/rng.js';

const key = (squares) => squares.map(({ r, c }) => `${r}${c}`).sort().join(' ');

test('a knight in the corner has two jumps', () => {
  const board = placePiece(emptyBoard(), { r: 0, c: 0 }, { color: 'w', id: 'n' });
  assert.equal(movesFor('knight', { r: 0, c: 0 }, board).length, 2);
});

test('a rook on an empty board reaches fourteen squares', () => {
  const board = placePiece(emptyBoard(), { r: 3, c: 3 }, { color: 'w', id: 'r' });
  assert.equal(movesFor('rook', { r: 3, c: 3 }, board).length, 14);
});

test('sliders stop at own pieces and may capture enemies', () => {
  let board = placePiece(emptyBoard(), { r: 3, c: 3 }, { color: 'w', id: 'q' });
  board = placePiece(board, { r: 3, c: 5 }, { color: 'w', id: 'own' });
  board = placePiece(board, { r: 1, c: 3 }, { color: 'b', id: 'foe' });
  const moves = key(movesFor('rook', { r: 3, c: 3 }, board));
  assert.ok(moves.includes('34'));
  assert.ok(!moves.includes('35'));
  assert.ok(moves.includes('13'));
  assert.ok(!moves.includes('03'));
});

test('a king steps one square in every direction', () => {
  const board = placePiece(emptyBoard(), { r: 4, c: 4 }, { color: 'b', id: 'k' });
  assert.equal(movesFor('king', { r: 4, c: 4 }, board).length, 8);
});

test('a queen combines rook and bishop lines', () => {
  const board = placePiece(emptyBoard(), { r: 3, c: 3 }, { color: 'w', id: 'q' });
  const queen = movesFor('queen', { r: 3, c: 3 }, board).length;
  const rook = movesFor('rook', { r: 3, c: 3 }, board).length;
  const bishop = movesFor('bishop', { r: 3, c: 3 }, board).length;
  assert.equal(queen, rook + bishop);
});

test('a white pawn on its start row may advance one or two squares', () => {
  const board = placePiece(emptyBoard(), { r: 6, c: 4 }, { color: 'w', id: 'p' });
  assert.equal(key(movesFor('pawn', { r: 6, c: 4 }, board)), '44 54');
});

test('pawns are blocked straight ahead but capture diagonally', () => {
  let board = placePiece(emptyBoard(), { r: 6, c: 4 }, { color: 'w', id: 'p' });
  board = placePiece(board, { r: 5, c: 4 }, { color: 'b', id: 'block' });
  board = placePiece(board, { r: 5, c: 5 }, { color: 'b', id: 'prey' });
  assert.equal(key(movesFor('pawn', { r: 6, c: 4 }, board)), '55');
});

test('a black pawn moves down the board', () => {
  const board = placePiece(emptyBoard(), { r: 1, c: 0 }, { color: 'b', id: 'p' });
  assert.equal(key(movesFor('pawn', { r: 1, c: 0 }, board)), '20 30');
});

test('an empty square has no moves', () => {
  assert.deepEqual(movesFor('queen', { r: 3, c: 3 }, emptyBoard()), []);
});

test('placing a piece returns a new board', () => {
  const board = emptyBoard();
  const next = placePiece(board, { r: 0, c: 0 }, { color: 'w', id: 'x' });
  assert.equal(board[0][0], null);
  assert.notEqual(next, board);
});

test('the initial board holds 32 pieces with unique ids', () => {
  const pieces = initialBoard().flat().filter(Boolean);
  assert.equal(pieces.length, 32);
  assert.equal(new Set(pieces.map((p) => p.id)).size, 32);
});

test('assigning movement types is deterministic per seed and uses known types', () => {
  const ids = initialBoard().flat().filter(Boolean).map((p) => p.id);
  const a = assignTypes(ids, createRng(42));
  const b = assignTypes(ids, createRng(42));
  const c = assignTypes(ids, createRng(43));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (const id of ids) assert.ok(TYPES.includes(a[id]));
});

test('turns alternate between white and black', () => {
  assert.equal(otherColor('w'), 'b');
  assert.equal(otherColor('b'), 'w');
});

test('applying a move relocates the piece and reports any capture without mutating', () => {
  let board = placePiece(emptyBoard(), { r: 6, c: 4 }, { color: 'w', id: 'p' });
  board = placePiece(board, { r: 5, c: 5 }, { color: 'b', id: 'prey' });
  const { board: next, captured } = applyMove(board, { r: 6, c: 4 }, { r: 5, c: 5 });
  assert.equal(next[5][5].id, 'p');
  assert.equal(next[6][4], null);
  assert.equal(captured.id, 'prey');
  assert.equal(board[6][4].id, 'p');
});

test('a quiet move captures nothing', () => {
  const board = placePiece(emptyBoard(), { r: 0, c: 0 }, { color: 'w', id: 'r' });
  assert.equal(applyMove(board, { r: 0, c: 0 }, { r: 0, c: 5 }).captured, null);
});
