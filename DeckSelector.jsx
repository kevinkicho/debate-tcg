import React, { useState } from 'react';
import masterData from './political_tcg_master.json';

const DeckSelector = ({ onSelect }) => {
  const [search, setSearch] = useState("");
  const states = Object.values(masterData.states);

  const filteredStates = states.filter(s => 
    s.stateCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Select Your State Deck</h1>
      <input 
        type="text" 
        placeholder="Search state (e.g. NY, CA)..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '300px', marginBottom: '20px' }}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {filteredStates.map(state => (
          <div 
            key={state.stateCode}
            onClick={() => onSelect(state.stateCode)}
            style={{
              border: '2px solid #333',
              borderRadius: '8px',
              padding: '15px',
              cursor: 'pointer',
              backgroundColor: '#f9f9f9',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2 style={{ margin: '0' }}>{state.stateCode}</h2>
            <p style={{ color: '#666' }}>{state.electoralVotes} Electoral Votes</p>
            <div style={{ fontSize: '12px', background: '#eee', padding: '5px', borderRadius: '4px' }}>
                {state.cardCount} Cards Loaded
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeckSelector;