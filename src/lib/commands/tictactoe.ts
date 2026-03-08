export interface TicTacToeMove {
  cell: number; // 0-8
  reset: boolean;
}

const CELL_RE = /^[1-9]$/;

/**
 * Parse a tic-tac-toe command. Returns a move or null.
 * Usage: SBB ttt 5      (place in cell 5, numbered 1-9)
 *        SBB ttt reset   (reset the board)
 */
export function parseTicTacToe(input: string): TicTacToeMove | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed === "reset") {
    return { cell: -1, reset: true };
  }

  if (CELL_RE.test(trimmed)) {
    // Convert 1-9 (user-facing) to 0-8 (internal index)
    return { cell: Number(trimmed) - 1, reset: false };
  }

  return null;
}

export type TicTacToeMark = "" | "X" | "O";

export interface TicTacToeState {
  board: TicTacToeMark[];
  currentTurn: "X" | "O";
  winner: "" | "X" | "O" | "draw";
}

export const EMPTY_TTT_STATE: TicTacToeState = {
  board: ["", "", "", "", "", "", "", "", ""],
  currentTurn: "X",
  winner: "",
};

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: TicTacToeMark[]): "" | "X" | "O" | "draw" {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  if (board.every((cell) => cell !== "")) {
    return "draw";
  }
  return "";
}

/**
 * Apply a move to the current TTT state. Returns the new state,
 * or null if the move is invalid (cell occupied, game over).
 */
export function applyTicTacToeMove(
  state: TicTacToeState,
  move: TicTacToeMove
): TicTacToeState | null {
  if (move.reset) {
    return { ...EMPTY_TTT_STATE, board: [...EMPTY_TTT_STATE.board] };
  }

  // Can't play if game is over
  if (state.winner) return null;

  // Can't play in an occupied cell
  if (state.board[move.cell] !== "") return null;

  const newBoard = [...state.board];
  newBoard[move.cell] = state.currentTurn;

  const winner = checkWinner(newBoard);
  const nextTurn = state.currentTurn === "X" ? "O" : "X";

  return {
    board: newBoard,
    currentTurn: winner ? state.currentTurn : nextTurn,
    winner,
  };
}
