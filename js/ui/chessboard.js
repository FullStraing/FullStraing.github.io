import { el } from './dom.js';
import { initialBoard, movesFor, assignTypes, otherColor, applyMove } from '../lib/chess.js';
import { createRng } from '../lib/rng.js';

// Solid glyphs for both sides; CSS paints the white army in paper colour with an ink outline.
const GLYPHS = { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' };
const TEXT_STYLE = '︎';
const FILES = 'abcdefgh';
const START_SEED = 7;
const square = ({ r, c }) => `${FILES[c]}${8 - r}`;
const colorName = (color) => (color === 'w' ? 'white' : 'black');
const capitalise = (text) => text[0].toUpperCase() + text.slice(1);
const samePos = (a, b) => a.r === b.r && a.c === b.c;

const pieceIds = (board) => board.flat().filter(Boolean).map((p) => p.id);

function freshState(seed) {
  const board = initialBoard();
  return { board, seed, turn: 1, toMove: 'w', selected: null, types: assignTypes(pieceIds(board), createRng(seed)) };
}

export function mountChessboard(root) {
  let state = freshState(START_SEED);
  const status = el('p', { class: 'board__status', 'aria-live': 'polite' });
  const turnLabel = el('span', { class: 'mono board__turn' });

  // The 64 buttons are built once and updated in place, so keyboard focus survives every move.
  const buttons = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (__, c) =>
    el('button', { type: 'button', onclick: () => onSquare({ r, c }) })));
  const board = el('div', { class: 'board', role: 'group', 'aria-label': 'Chessboard, white at the bottom' },
    buttons.map((row) => el('div', { class: 'board__row' }, row)));

  const describe = (piece, type) => `${colorName(piece.color)} ${piece.origin}, moving as a ${type} this turn`;

  function select(pos) {
    const piece = state.board[pos.r][pos.c];
    if (piece.color !== state.toMove) {
      state = { ...state, selected: null };
      status.textContent = `It is ${colorName(state.toMove)}'s move.`;
      return;
    }
    const type = state.types[piece.id];
    const targets = movesFor(type, pos, state.board);
    state = { ...state, selected: { pos, targets } };
    const count = targets.length;
    status.textContent = `The ${describe(piece, type)}: ${count === 0 ? 'no legal squares' : `${count} square${count === 1 ? '' : 's'}`}.`;
  }

  function moveTo(pos) {
    const from = state.selected.pos;
    const piece = state.board[from.r][from.c];
    const { board: next, captured } = applyMove(state.board, from, pos);
    const seed = state.seed + 1;
    state = { board: next, seed, turn: state.turn + 1, toMove: otherColor(state.toMove), selected: null, types: assignTypes(pieceIds(next), createRng(seed)) };
    status.textContent = `${capitalise(colorName(piece.color))} ${piece.origin} to ${square(pos)}${captured ? `, capturing a ${captured.origin}` : ''}. New turn, new rules: ${colorName(state.toMove)} to move.`;
  }

  function onSquare(pos) {
    const isTarget = state.selected?.targets.some((t) => samePos(t, pos));
    if (isTarget) moveTo(pos);
    else if (state.board[pos.r][pos.c]) select(pos);
    else {
      state = { ...state, selected: null };
      status.textContent = 'Pick a piece to see where it may go this turn.';
    }
    render();
  }

  function paintSquare(button, r, c) {
    const pos = { r, c };
    const piece = state.board[r][c];
    const type = piece ? state.types[piece.id] : null;
    const isSelected = Boolean(state.selected && samePos(state.selected.pos, pos));
    const isTarget = Boolean(state.selected?.targets.some((t) => samePos(t, pos)));
    button.className = ['sq', (r + c) % 2 ? 'sq--dark' : 'sq--light', isSelected && 'is-selected', isTarget && 'is-target', piece && `piece--${piece.color}`]
      .filter(Boolean).join(' ');
    const reach = isTarget ? (piece ? ', can be captured' : ', reachable') : '';
    button.setAttribute('aria-label', `${square(pos)}: ${piece ? describe(piece, type) : 'empty'}${reach}`);
    button.setAttribute('aria-pressed', String(isSelected));
    button.replaceChildren(...(piece ? [
      el('span', { class: 'sq__glyph', 'aria-hidden': 'true', text: GLYPHS[type] + TEXT_STYLE }),
      el('span', { class: 'sq__origin', 'aria-hidden': 'true', text: piece.origin === 'knight' ? 'N' : piece.origin[0].toUpperCase() }),
    ] : []));
  }

  function render() {
    buttons.forEach((row, r) => row.forEach((button, c) => paintSquare(button, r, c)));
    turnLabel.textContent = `Turn ${String(state.turn).padStart(2, '0')} · ${colorName(state.toMove)} to move`;
  }

  const reroll = el('button', { type: 'button', class: 'btn', text: 'Reroll the rules', onclick: () => {
    const seed = state.seed + 1;
    state = { ...state, seed, selected: null, types: assignTypes(pieceIds(state.board), createRng(seed)) };
    status.textContent = 'Every piece has a new way of moving.';
    render();
  } });
  const reset = el('button', { type: 'button', class: 'btn btn--quiet', text: 'Reset', onclick: () => {
    state = freshState(START_SEED);
    status.textContent = 'Board reset. White to move.';
    render();
  } });

  const note = el('p', { class: 'mono board__note', text: 'Glyph = how it moves this turn · corner letter = what it started as' });
  root.prepend(el('div', { class: 'chess' }, [
    el('div', { class: 'board__bar' }, [turnLabel, el('span', { class: 'board__buttons' }, [reroll, reset])]),
    board, status, note,
  ]));
  status.textContent = 'White to move. Pick a piece to see where it may go this turn.';
  render();
}
