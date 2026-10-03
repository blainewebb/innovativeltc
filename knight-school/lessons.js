// Coach lessons. Each one teaches an idea, then asks for one move.
// `theme` links the lesson to book puzzles that use the same trick.
window.LESSONS = [
  {
    id: 'values', title: 'What pieces are worth', theme: null,
    body: [
      'Every piece has a number. A Pawn is worth 1. A Knight is worth 3, and so is a Bishop. A Rook is worth 5. The Queen is worth 9. The King has no number, because if you lose it, the game is over.',
      'Use the numbers to make good trades. Giving a Knight (3) to win a Rook (5) is a great deal. Giving a Queen (9) for a Rook (5) is a bad deal.',
    ],
    ex: { fen: '4k3/8/8/1n3r2/8/8/8/1R2KR2 w - - 0 1', ask: 'Both black pieces are free. Which one should you take?', answers: ['Rxf5'],
      yes: 'Yes! The Rook is worth 5 and the Knight is only worth 3. Always take the bigger one.', no: 'That works, but there is a bigger prize. Count the points!' },
  },
  {
    id: 'check', title: 'Getting out of check', theme: null,
    body: [
      'When your King is attacked, that is check. You must fix it right away. There are three ways: move the King, block the attack, or capture the attacker.',
      'Capturing the attacker is often the best fix, because it wins a piece at the same time.',
    ],
    ex: { fen: '4k3/8/8/8/8/2B5/8/r3K3 w - - 0 1', ask: 'The black Rook is checking your King. Find the best way out.', answers: ['Bxa1'],
      yes: 'Perfect. You got out of check and won a Rook!', no: 'That gets out of check, but you can do better. Can anything capture the Rook?' },
  },
  {
    id: 'cct', title: 'Checks, captures, threats', theme: 'material',
    body: [
      'Before every move, strong players ask three questions. Can I give a check? Can I capture something? Can I make a threat?',
      'Look at every check first, then every capture, then every threat. Most puzzles in your books are solved this way. It also helps you spot what your opponent wants to do to you.',
    ],
    ex: { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', ask: 'Look for checks first. One of them is checkmate!', answers: ['Qxf7#'],
      yes: 'Checkmate! This is called Scholar\'s Mate. The Queen and Bishop work together on f7.', no: 'Not quite. Look at every check, and find the one the King cannot escape.' },
  },
  {
    id: 'fork', title: 'Forks', theme: 'fork',
    body: [
      'A fork is when one piece attacks two enemy pieces at the same time. Your opponent can only save one of them.',
      'Knights are the best forkers, because they jump. A Knight check that also attacks a Rook or Queen is called a family fork.',
    ],
    ex: { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ask: 'Find the Knight fork.', answers: ['Nc7+'],
      yes: 'Fork! The King is in check and must move, and then your Knight takes the Rook.', no: 'Look for a Knight jump that attacks the King and the Rook together.' },
  },
  {
    id: 'pin', title: 'Pins', theme: 'pin',
    body: [
      'A pin is when a piece cannot move, because a bigger piece is standing behind it. If the piece behind is the King, the pinned piece is not allowed to move at all.',
      'Bishops, Rooks and Queens make pins, because they attack in straight lines. Once a piece is pinned, attack it again!',
    ],
    ex: { fen: '4k3/8/2n5/8/3P4/8/8/4KB2 w - - 0 1', ask: 'Pin the black Knight to its King.', answers: ['Bb5'],
      yes: 'Pinned! The Knight cannot move. Next, your pawn will march to d5 and attack it.', no: 'Find the Bishop move that lines up the Knight and the King.' },
  },
  {
    id: 'skewer', title: 'Skewers', theme: 'skewer',
    body: [
      'A skewer is a pin turned around. You attack a big piece in front, and when it moves out of the way, you take the piece behind it.',
      'Skewers work best with a check, because the King has to move.',
    ],
    ex: { fen: 'r7/8/2k5/5B2/8/8/8/4K3 w - - 0 1', ask: 'Check the King so that you win the Rook behind it.', answers: ['Be4+'],
      yes: 'Skewer! The King must step away, and the Bishop takes the Rook on a8.', no: 'Find a Bishop check on the long diagonal from a8 to h1.' },
  },
  {
    id: 'discovered', title: 'Discovered attacks', theme: 'discovered',
    body: [
      'Sometimes one of your pieces is hiding another one. When the front piece moves, the piece behind it attacks. That is a discovered attack.',
      'It is very strong, because the front piece can make its own attack at the same time. Two attacks in one move!',
    ],
    ex: { fen: '4k3/7q/8/8/4B3/8/8/4R1K1 w - - 0 1', ask: 'Move the Bishop to uncover a check from your Rook, and win something big.', answers: ['Bxh7'],
      yes: 'Discovered check! The Rook checks the King, and your Bishop grabs the Queen.', no: 'Any Bishop move gives check from the Rook. Which one also captures something?' },
  },
  {
    id: 'backrank', title: 'Back-rank mate', theme: 'backrank',
    body: [
      'When a King is stuck behind its own pawns on the back row, a Rook or Queen can checkmate it there. The pawns block every escape square.',
      'This is why good players sometimes give their King a little window, by moving one of the pawns in front of it.',
    ],
    ex: { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', ask: 'Checkmate in one move.', answers: ['Ra8#'],
      yes: 'Back-rank mate! The black King is trapped by its own pawns.', no: 'Look at the black King. Its pawns are blocking it in. Which row can your Rook reach?' },
  },
  {
    id: 'promotion', title: 'Making a Queen', theme: 'promotion',
    body: [
      'When a pawn reaches the very last row, it turns into a Queen (or a Rook, Bishop or Knight). That is called promotion.',
      'A pawn close to the end can be worth as much as a Queen. Push it, and guard it on the way!',
    ],
    ex: { fen: '8/4P1k1/8/8/8/8/6K1/8 w - - 0 1', ask: 'Turn your pawn into a Queen.', answers: ['e8=Q', 'e8=Q+'],
      yes: 'A brand new Queen! Now you have a huge advantage.', no: 'Your pawn is one step away from the last row.' },
  },
  {
    id: 'opening', title: 'Starting the game', theme: null,
    body: [
      'Three rules help you start every game well. First, put a pawn in the center (e4 or d4). Second, bring out your Knights and Bishops early. Third, castle to keep your King safe.',
      'Try not to move your Queen out too soon. Enemy pieces will chase it, and you will waste moves running away.',
    ],
    ex: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ask: 'Make a good first move.', answers: ['e4', 'd4', 'Nf3', 'c4', 'Nc3'],
      yes: 'Good start! That move helps you control the center.', no: 'That move is allowed, but it does not help much. Try a center pawn or a Knight.' },
  },
];
