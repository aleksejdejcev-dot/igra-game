import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { CHESS_FEN, CHESS_LINE, isExpectedChessMove } from '../src/tasks/chess';

describe('шахматная партия',()=>{
 it('содержит легальную последовательность из четырёх ходов',()=>{const game=new Chess(CHESS_FEN);for(const [from,to] of CHESS_LINE)expect(()=>game.move({from,to})).not.toThrow();expect(game.history()).toHaveLength(4);});
 it('не принимает неверную пару координат',()=>{expect(isExpectedChessMove(0,'d8','b6')).toBe(true);expect(isExpectedChessMove(0,'d8','d7')).toBe(false);expect(isExpectedChessMove(4,'a1','a2')).toBe(false);});
});
