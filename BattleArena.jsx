const BattleArena = ({ player1, player2 }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
      {/* HUD Header */}
      <div className="w-full flex justify-around mb-12">
        {/* Player 1 Stats */}
        <div className="text-center p-4 bg-blue-900 rounded-lg border-2 border-blue-400">
          <h2 className="text-3xl font-black">{player1.state}</h2>
          <div className="w-64 bg-gray-700 h-6 rounded-full mt-2 overflow-hidden border">
            <div className="bg-green-500 h-full transition-all duration-500" 
                 style={{ width: `${(player1.support / 50) * 100}%` }}></div>
          </div>
          <p className="mt-1 text-sm">Support: {player1.support}/50</p>
          <p className="text-yellow-400 font-bold">Capital: ${player1.capital}</p>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="text-5xl font-black text-red-600 animate-pulse">VS</div>
        </div>

        {/* Player 2 Stats */}
        <div className="text-center p-4 bg-red-900 rounded-lg border-2 border-red-400">
          <h2 className="text-3xl font-black">{player2.state}</h2>
          <div className="w-64 bg-gray-700 h-6 rounded-full mt-2 overflow-hidden border">
            <div className="bg-green-500 h-full transition-all duration-500" 
                 style={{ width: `${(player2.support / 50) * 100}%` }}></div>
          </div>
          <p className="mt-1 text-sm">Support: {player2.support}/50</p>
          <p className="text-yellow-400 font-bold">Capital: ${player2.capital}</p>
        </div>
      </div>

      {/* The Board (Center) */}
      <div className="flex-grow w-full border-y border-white/20 flex items-center justify-center gap-8 py-8">
        {/* Played Cards appear here */}
      </div>

      {/* Active Player Hand */}
      <div className="fixed bottom-4 w-full flex justify-center gap-4 px-12 overflow-x-auto pb-4">
        {player1.hand.map((c, i) => (
          <PoliticalCard key={i} card={c} stateCode={player1.state} />
        ))}
      </div>
    </div>
  );
};