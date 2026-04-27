const masterData = require('../../political_tcg_master.json');
const { v4: uuidv4 } = require('uuid');

const NEWS_CYCLES = [
  {
    name: 'Economy Week',
    theme: 'economy',
    events: [
      { name: 'Market Boom', effect: { type: 'passive', amount: 3, duration: 2 }, description: 'Markets surge! Passive support generation increased.' },
      { name: 'Recession Fears', effect: { type: 'scandal', dotAmount: 2, duration: 3 }, description: 'Economic downturn looms. Damage over time.' },
      { name: 'Tax Reform Debate', effect: { type: 'passive', amount: 1, duration: 1 }, description: 'Tax policy takes center stage.' },
      { name: 'Job Growth Report', effect: { type: 'momentum', stacks: 1, stackAmount: 2, maxStacks: 4, duration: 2 }, description: 'Strong employment numbers! Building momentum.' }
    ]
  },
  {
    name: 'Scandal Week',
    theme: 'scandal',
    events: [
      { name: 'Leaked Documents', effect: { type: 'scandal', dotAmount: 3, duration: 2 }, description: 'Damaging leaks surface!' },
      { name: 'Press Conference', effect: { type: 'rally', speedModifier: 1.0, duration: 2 }, description: 'Media frenzy! Rally speed boost.' },
      { name: 'Character Attack', effect: { type: 'momentum', stacks: 2, stackAmount: 1, maxStacks: 5, duration: 2 }, description: 'Opponent under fire! Stacking momentum.' },
      { name: 'Cover-Up Revealed', effect: { type: 'scandal', dotAmount: 2, duration: 4 }, description: 'Attempted cover-up exposed. Long-lasting damage.' }
    ]
  },
  {
    name: 'Foreign Policy Week',
    theme: 'foreign_policy',
    events: [
      { name: 'Diplomatic Victory', effect: { type: 'shield', absorbAmount: 5, duration: 2 }, description: 'International accord signed. Shield protection.' },
      { name: 'International Crisis', effect: { type: 'passive', amount: 2, duration: 1 }, description: 'Global tensions rise. Brief support boost.' },
      { name: 'Trade Deal', effect: { type: 'momentum', stacks: 1, stackAmount: 2, maxStacks: 3, duration: 3 }, description: 'New trade agreement. Building momentum.' },
      { name: 'Sanctions Imposed', effect: { type: 'scandal', dotAmount: 1, duration: 3 }, description: 'Economic sanctions take their toll.' }
    ]
  }
];

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    getRoom(roomId) {
        return this.rooms[roomId];
    }

    stopGameLoop(roomId) {
        const room = this.rooms[roomId];
        if (!room || !room.gameLoopInterval) return;
        clearInterval(room.gameLoopInterval);
        room.gameLoopInterval = null;
    }

    startGameLoop(roomId, io, aiTurnFn) {
        const room = this.rooms[roomId];
        if (!room) return;

        if (room.gameLoopInterval) {
            this.stopGameLoop(roomId);
        }

        room.gameLoopInterval = setInterval(() => {
            if (!room) return;

            room.playerIds.forEach(playerId => {
                const player = room.players[playerId];
                if (player) {
                    if (player.lobbyists) {
                        player.lobbyists.forEach(lob => {
                            if (lob.type === 'capital') player.politicalCapital += lob.amount || 0;
                            if (lob.type === 'support') player.points += lob.amount || 0;
                            if (lob.type === 'atb') player.atbSpeed += lob.amount || 0;
                        });
                    }
                player.points = this.computeSupportFromDemographics(player);
                }
            });

            if (!room) return;

            if (room.status === 'paused' && room.townHall) {
                if (!room.townHallAiVotedTimestamp) {
                    room.townHallAiVotedTimestamp = Date.now();
                }
            }

            if (room && room.players) {
                if (room.townHallAiVotedTimestamp && Date.now() - room.townHallAiVotedTimestamp >= 2000) {
                    const aiPlayerId = Object.keys(room.players).find(id => room.players[id].isAI);
                    if (aiPlayerId) {
                        this.submitTownHall(roomId, aiPlayerId, 'yes');
                        if (!room.townHall) {
                            io.to(roomId).emit('townhall_ended');
                            io.to(roomId).emit('system_message', { message: 'The Town Hall has concluded. Resume the debate!' });
                        }
                    }
                    room.townHallAiVotedTimestamp = null;
                }
            }

            this.updateATB(roomId);

            // Support threshold detection
            if (room && room.players) {
              Object.values(room.players).forEach(p => {
                if (p.previousSupport == null) p.previousSupport = 0;
                const pts = p.points;
                const prev = p.previousSupport;
                const thresholds = [10, 20, 30, 40];
                thresholds.forEach(th => {
                  if (prev < th && pts >= th && (!p.grantedThresholds || !p.grantedThresholds.includes(th))) {
                    if (!p.grantedThresholds) p.grantedThresholds = [];
                    p.grantedThresholds.push(th);
                    this.grantSwingState(roomId, p.id, th);
                  }
                });
                p.previousSupport = pts;
              });
            }

            if (room.status !== 'active') return;

            const winResult = this.checkWinConditions(roomId);
            if (winResult) {
                io.to(roomId).emit('game_over', winResult);
                this.stopGameLoop(roomId);
                return;
            }

            // 1. Political Capital Tick (every 150 ticks = 15s)
            if (room.capTick === undefined) room.capTick = 0;
            room.capTick++;
            if (room.capTick >= 150) {
                const caps = { 'Primaries': 15, 'Convention': 25, 'General Election': 40 };
                const currentCap = caps[room.campaignPhase] || 15;
                
                Object.values(room.players).forEach(p => {
                    p.politicalCapital += 1;
                    if (p.politicalCapital > currentCap) {
                        const overflow = p.politicalCapital - currentCap;
                        p.scandalPoints += overflow;
                        p.politicalCapital = currentCap;
                    }
                });
                room.capTick = 0;
            }

            // 2. Town Hall Trigger (every 900 ticks = 90s)
            if (room.townHallTick === undefined) room.townHallTick = 0;
            room.townHallTick++;
            if (room.townHallTick >= 900) {
                const townHall = this.triggerTownHall(roomId);
                if (townHall) {
                    io.to(roomId).emit('townhall_started', townHall);
                    io.to(roomId).emit('system_message', { message: "🚨 GLOBAL EVENT: A Town Hall meeting is underway. All actions paused!" });
                }
                room.townHallTick = 0;
            }

            // Swing State Trigger (every ~300 ticks)
            if (room.swingTick === undefined) room.swingTick = 0;
            room.swingTick++;
            if (room.swingTick >= 300) {
                const allStates = Object.entries(masterData.states);
                const claimed = room.swingStates ? Object.keys(room.swingStates) : [];
                const available = allStates.filter(([code, s]) => !claimed.includes(code));
                if (available.length > 0) {
                    const [code, pick] = available[Math.floor(Math.random() * available.length)];
                    room.availableSwingState = { stateCode: code, electoralVotes: pick.electoralVotes };
                    room.eventQueue.push({ type: 'swing-state-available', data: room.availableSwingState });
                }
                room.swingTick = 0;
            }

            if (room.swingStateDefenses) {
                const now = Date.now();
                Object.keys(room.swingStateDefenses).forEach(stateCode => {
                    if (room.swingStateDefenses[stateCode] < now) {
                        delete room.swingStateDefenses[stateCode];
                    }
                });
            }

            // International Crisis Trigger (every ~600 ticks)
            if (room.crisisTick === undefined) room.crisisTick = 0;
            room.crisisTick++;
            if (room.crisisTick >= 600) {
                const crises = require('../data/internationalCrises.json');
                const crisis = crises[Math.floor(Math.random() * crises.length)];
                room.crisis = {
                    details: crisis,
                    responses: {},
                    startTime: Date.now()
                };
                room.status = 'paused';
                io.to(roomId).emit('international-crisis-started', crisis);
                room.crisisTick = 0;
            }

            // 3. Update Stats & Broadcast state
            room.stats = this.getRoomStats(roomId);
            const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            sockets.forEach(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                if (socketInstance) {
                    socketInstance.emit('room_state', this.serializeRoomState(room, socketId));
                }
            });

            // 4. Drain Events
            const events = this.drainEvents(roomId);
            if (events) {
                events.forEach(event => io.to(roomId).emit(event.type, event.data));
            }

            // 5. Phase Advance Check
            const phaseData = this.checkPhaseAdvance(roomId);
            if (phaseData) io.to(roomId).emit('phase-change', phaseData);

            // 6. AI Auto-Respond Logic
            if (!room.townHall) {
                const aiId = room.playerIds.find(id => room.players[id].isAI);
                if (aiId && room.players[aiId].atb >= 100 && !room.players[aiId]._aiTurnPending) {
                    room.players[aiId]._aiTurnPending = true;
                    aiTurnFn(roomId, aiId, io);
                }
            }
        }, 100);
    }

    createRoom(roomId) {
        this.rooms[roomId] = {
            id: roomId,
            status: 'waiting',
            activePlayerIndex: 0,
            players: {},
            playerIds: [],
            campaignPhase: 'Primaries',
            eventQueue: [],
            swingStates: {},
            filibusterTimer: { maxTurns: 30, turnCount: 0 },
            newsCycle: { cycleIndex: 0, eventIndex: 0, turnsInCycle: 0 },
            gameLoopInterval: null,
            lastPlayedCard: null,
            pendingEffects: {},
        };
        return this.rooms[roomId];
    }

    addPlayerToRoom(roomId, playerId, playerInfo, deckData) {
        const room = this.rooms[roomId];
        if (!room) return null;

        // Use provided deckData if available, otherwise fallback to masterData for the state
        let initialCards = [];
        if (deckData && Array.isArray(deckData) && deckData.length > 0) {
            initialCards = deckData;
        } else {
            const cleanedStateCode = playerInfo.stateCode ? playerInfo.stateCode.replace(/[0-9]/g, '') : '';
            const stateConfig = masterData.states[cleanedStateCode] || masterData.states[playerInfo.stateCode] || { cards: [] };
            initialCards = stateConfig.cards;
        }

        const initialDeck = initialCards.map(card => ({
            ...card,
            instanceId: uuidv4(),
            ownerId: playerId
        }));

        room.players[playerId] = {
            id: playerId,
            name: playerInfo.name,
            playHistory: [],
            demographicApprovals: { "urban": 10, "suburban": 10, "rural": 10, "working-class": 10, "educated": 10 },
            state: playerInfo.stateCode,
            points: 0,
            politicalCapital: 10,
            atb: 0,
            atbSpeed: 2.5,
            baseAtbSpeed: 2.5,
            fatigue: 0, // Drafting more than once in a row increases fatigue
            deck: this._shuffle(initialDeck),
            hand: [],
            buffs: [],
            costMod: 'none', // New property
            skipNextTurn: false, // New property
            lastIntention: 'none', // New property
            previousSupport: 0,
            isAI: playerInfo.isAI || false,
            scandalPoints: 0,
            darkMoneyCap: 0
        };

        if (!room.playerIds.includes(playerId)) {
            room.playerIds.push(playerId);
        }

        if (room.playerIds.length === 2) {
            room.status = 'active';
            room.townHall = null;
            room.playerIds.forEach(id => {
                for (let i = 0; i < 5; i++) {
                    this.drawCard(roomId, id);
                }
            });
        }

        return room.players[playerId];
    }

    updateATB(roomId) {
        const room = this.rooms[roomId];
        if (!room) return null;

        const isPaused = room.status === 'paused';

        Object.values(room.players).forEach(player => {
            // Reset ATB speed to base before applying rally effects
            player.atbSpeed = player.baseAtbSpeed || player.atbSpeed;
            // Process DOT, momentum, shield, rally tick effects
            this._processBuffTicks(roomId, player, isPaused);

            // 1. Process Buff Durations & Passive Generation
            player.buffs = player.buffs.filter(buff => {
                const step = 0.1;
                buff.duration -= step;

                // Handle Passive Generation (independently for each buff)
                if (buff.type === 'passive' && !isPaused) {
                    buff.accumulator = (buff.accumulator || 0) + step;
                    if (buff.accumulator >= 2) { // roughly every 2 seconds
                        if (buff.stat === 'Capital') player.politicalCapital += buff.value;
                        if (buff.stat === 'Support') player.points += buff.value;
                        buff.accumulator = 0;
                    }
                }

                return buff.duration > 0;
            });

            if (isPaused) return;

            // 2. Calculate current ATB speed
            let currentSpeed = player.atbSpeed || 2.5;
            player.buffs.forEach(buff => {
                if (buff.type === 'haste') currentSpeed += 1.5;
                if (buff.type === 'slow') currentSpeed -= 1.2;
            });

            // 3. Increment ATB
            if (player.atb < 100 && !player.atbFrozen) {
                if (player.skipNextTurn) {
                    // Skip logic: consume part of the skip
                    player.atb = 0;
                    player.skipNextTurn = false;
                } else {
                    player.atb = Math.min(100, player.atb + Math.max(0.5, currentSpeed));
                }
            }
        });
        return room;
    }

    triggerTownHall(roomId) {
        const room = this.rooms[roomId];
        if (!room || room.status !== 'active') return null;

        const topics = [
            { id: 'tax', name: 'Tax Reform', question: 'Should we increase taxes on billionaires to fund moon bases?' },
            { id: 'climate', name: 'Climate Emergency', question: 'Ban all plastic straws to save the turtles, or just build bigger straws?' },
            { id: 'tech', name: 'AI Sovereignty', question: 'Should AIs be allowed to run for local school boards?' },
            { id: 'ufo', name: 'Interstellar Diplomacy', question: 'Establish a "First Contact" embassy in Vegas, or ignore the glowing saucers?' },
            { id: 'pizza', name: 'National Diet', question: 'Mandatory "Free Pizza Fridays" for all citizens to boost national morale?' }
        ];

        room.status = 'paused';
        room.townHall = {
            topic: topics[Math.floor(Math.random() * topics.length)],
            responses: {}
        };
        return room.townHall;
    }

    submitTownHall(roomId, playerId, choice) {
        const room = this.rooms[roomId];
        if (!room || !room.townHall) return false;

        room.townHall.responses[playerId] = choice;

        // Check if everyone voted
        if (Object.keys(room.townHall.responses).length === room.playerIds.length) {
            // Resolve rewards
            Object.keys(room.townHall.responses).forEach(pid => {
                const player = room.players[pid];
                player.politicalCapital += 10;
                player.points += 5;
            });
            room.status = 'active';
            room.townHall = null;
        }
        return true;
    }

    drawCard(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room) return null;
        const player = room.players[playerId];
        if (!player || player.deck.length === 0) return null;

        const card = player.deck.pop();
        player.hand.push(card);
        return card;
    }

    startDraft(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (!room) return null;
        const player = room.players[playerId];
        if (player.atb < 100) return { success: false, message: "Action Gauge not ready!" };

        // 1. Roll Dice (1-6)
        const roll = Math.floor(Math.random() * 6) + 1;
        player.atb = 0;
        room.filibusterTimer.turnCount++;

        // Policy Fatigue logic: Consecutive drafts are harder
        player.fatigue += 1;
        if (player.fatigue > 1) {
            // If they draft again without playing a card, they get fewer options
            console.log(`${player.name} is experiencing Policy Fatigue!`);
        }

        const choiceCount = roll === 6 ? 4 : (roll >= 3 ? 3 : 2);
        // Reduce choice count if fatigue is high
        const adjustedChoiceCount = Math.max(1, choiceCount - Math.max(0, player.fatigue - 1));

        const options = [];
        for (let i = 0; i < adjustedChoiceCount && player.deck.length > 0; i++) {
            options.push(player.deck[player.deck.length - 1 - i]);
        }

        return {
            success: true,
            roll,
            options,
            pickCount: (roll === 6 && player.fatigue <= 1) ? 2 : 1,
            fatigue: player.fatigue
        };
    }

    playCard(roomId, playerId, cardInstanceId) {
        const room = this.rooms[roomId];
        if (!room) return { success: false, message: "Room not found" };
        const player = room.players[playerId];

        if (player.atb < 100) return { success: false, message: "Wait for Action Gauge!" };

        const cardIdx = player.hand.findIndex(c => String(c.instanceId) === String(cardInstanceId));
        if (cardIdx === -1) return { success: false, message: "Card not in hand" };

        const card = player.hand[cardIdx];

        // Calculate Adjusted Cost
        let finalCost = card.cost;
        if (player.costMod === 'double') finalCost *= 2;
        if (player._costDiscount) finalCost = Math.max(0, finalCost - player._costDiscount);

        if (player.politicalCapital < finalCost) return { success: false, message: "Not enough Political Capital" };

        player.politicalCapital -= finalCost;
        player.hand.splice(cardIdx, 1);
        player.playHistory.push(card);
        player.atb = 0;
        player.fatigue = 0; // Reset fatigue on play!
        player.costMod = 'none'; // Reset cost multiplier
        room.filibusterTimer.turnCount++;

        const isDefense = card.type.includes('Defense') || card.type.includes('Save') || card.type.includes('Counter');
        if (isDefense) {
            if (!room.pendingEffects) room.pendingEffects = {};
            room.pendingEffects[playerId] = { 
                name: card.name, 
                cost: card.cost, 
                effect: card.effect, 
                action: card.action 
            };
        } else {
            const effectApplied = this._applyEffect(roomId, playerId, card.effect, card.action);
            if (!effectApplied) {
                player.points += Math.max(1, card.cost);
            }
        }

        let eventMessage = null;
        if (Math.random() < 0.15) {
            const newsEvent = this._triggerNewsCycleEvent(roomId);
            if (newsEvent && newsEvent.effect) {
                for (const pid of room.playerIds) {
                    this._applyEffect(roomId, pid, newsEvent.effect);
                }
            }
            eventMessage = newsEvent ? newsEvent.description : null;
        }

        if (room.lastPlayedCard && card.tags && room.lastPlayedCard.tags) {
            const matchedTags = card.tags.filter(tag => room.lastPlayedCard.tags.includes(tag));
            if (matchedTags.length > 0) {
                player.points += 5;
                room.comboDiscount = 1;
                room.eventQueue.push({
                    type: 'combo-triggered',
                    data: { playerId, matchedTags, bonusAmount: 5, costReduction: 1 }
                });
            }
        }

        if (room.lastPlayedCard && room.lastPlayedCard.argType && card.argType) {
            const advantages = {
                'Emotional': 'Moral Authority',
                'Moral Authority': 'Data-Driven',
                'Data-Driven': 'Emotional'
            };
            if (advantages[card.argType] === room.lastPlayedCard.argType) {
                room.argChain = room.argChain || [];
                room.argChain.push(card.argType);
                const chainLength = Math.min(room.argChain.length, 3);
                const bonus = chainLength * 2;
                player.points += bonus;
                room.eventQueue.push({
                    type: 'debate-chain',
                    data: { playerId, chainLength, bonus }
                });
            } else {
                room.argChain = [];
            }
        }
        room.lastPlayedCard = card;

        if (card.type === 'Gerrymander') {
            const opponentId = room.playerIds.find(id => id !== playerId);
            const opponent = room.players[opponentId];
            if (opponent && opponent.claimedStates && opponent.claimedStates.length > 0) {
                const flipCount = Math.floor(Math.random() * 2) + 1;
                const flippedStates = [];
                for (let i = 0; i < flipCount; i++) {
                    if (opponent.claimedStates.length === 0) break;
                    const idx = Math.floor(Math.random() * opponent.claimedStates.length);
                    const stateKey = opponent.claimedStates.splice(idx, 1)[0];
                    player.claimedStates = player.claimedStates || [];
                    player.claimedStates.push(stateKey);
                    flippedStates.push(stateKey);
                }
                room.eventQueue.push({
                    type: 'gerrymander-activated',
                    data: { playerId, flippedStates }
                });
            }
        }

        this.checkScandalThreshold(roomId, playerId, io);

        return {
            success: true,
            cardPlayed: card,
            eventOccurred: !!eventMessage,
            eventMessage: eventMessage,
            gameOver: player.points >= 50,
            winner: player.points >= 50 ? player.name : null
        };
    }

    _applyEffect(roomId, playerId, effectText, structuredAction = null) {
        const room = this.rooms[roomId];
        if (!room) return null;

        if (effectText && typeof effectText === 'object' && effectText.type) {
            structuredAction = effectText;
            effectText = '';
        }

        if (!effectText && !structuredAction) return false;

        const player = room.players[playerId];
        const opponentId = room.playerIds.find(id => id !== playerId);
        const opponent = room.players[opponentId];
        let changed = false;

        // 1. Handle Structured Actions First (Higher Reliability)
        if (structuredAction) {
            if (typeof structuredAction === 'object' && structuredAction.type) {
                const effect = structuredAction;
                switch (effect.type) {
                    case 'scandal': {
                        const dotBuff = {
                            type: 'scandal',
                            name: effect.name || 'Scandal',
                            dotAmount: effect.dotAmount || 1,
                            duration: effect.duration || 3,
                            stacks: 1
                        };
                        const existingScandal = player.buffs.find(b => b.type === 'scandal' && b.name === dotBuff.name);
                        if (existingScandal) {
                            existingScandal.stacks += 1;
                            existingScandal.dotAmount += (effect.dotAmount || 1);
                            existingScandal.duration = Math.max(existingScandal.duration, dotBuff.duration);
                        } else {
                            player.buffs.push(dotBuff);
                        }
                        break;
                    }
                    case 'momentum': {
                        const momBuff = {
                            type: 'momentum',
                            stacks: effect.stacks || 1,
                            stackAmount: effect.stackAmount || 1,
                            maxStacks: effect.maxStacks || 3,
                            duration: effect.duration || 2
                        };
                        const existingMom = player.buffs.find(b => b.type === 'momentum');
                        if (existingMom) {
                            existingMom.stacks = Math.min(existingMom.stacks + momBuff.stacks, momBuff.maxStacks);
                            existingMom.stackAmount += momBuff.stackAmount;
                            existingMom.duration = Math.max(existingMom.duration, momBuff.duration);
                        } else {
                            player.buffs.push(momBuff);
                        }
                        break;
                    }
                    case 'passive': {
                        player.buffs.push({
                            type: 'passive',
                            amount: effect.amount || 1,
                            duration: effect.duration || 2
                        });
                        break;
                    }
                    case 'shield': {
                        player.buffs.push({
                            type: 'shield',
                            absorbAmount: effect.absorbAmount || 3,
                            duration: effect.duration || 2
                        });
                        break;
                    }
                    case 'rally': {
                        player.buffs.push({
                            type: 'rally',
                            speedModifier: effect.speedModifier || 1.0,
                            duration: effect.duration || 2
                        });
                        break;
                    }
                }
                changed = true;
            }
        }

        // 2. Enhanced Text Parsing
        const text = effectText || '';

        // --- CAPITAL GAINS ---
        const gainCapMatch = text.match(/(?:Gain|Start with) \+?(\d+) (?:Political )?Capital/i);
        if (gainCapMatch) {
            player.politicalCapital += parseInt(gainCapMatch[1]);
            changed = true;
        }

        // --- SUPPORT GAINS ---
        const gainSupMatch = text.match(/(?:Gain|Double) \+?(\d+) Support/i) || text.match(/Heal (\d+) Support/i);
        if (gainSupMatch) {
            player.points += parseInt(gainSupMatch[1]);
            changed = true;
        }

        // --- CAPITAL DRAIN ---
        const drainCapMatch = text.match(/Drain (\d+) (?:Political )?Capital/i) || text.match(/lose (\d+) Capital/i);
        if (drainCapMatch && opponent) {
            opponent.politicalCapital = Math.max(0, opponent.politicalCapital - parseInt(drainCapMatch[1]));
            changed = true;
        }

        if (text.match(/Drain all opponent's Capital/i) && opponent) {
            opponent.politicalCapital = 0;
            changed = true;
        }

        // --- SUPPORT DRAIN ---
        const loseSupMatch = text.match(/(?:Opponent loses|Drain) (\d+) Support/i);
        if (loseSupMatch && opponent) {
            opponent.points = Math.max(0, opponent.points - parseInt(loseSupMatch[1]));
            changed = true;
        }

        // --- HAND DISRUPTION ---
        const discardMatch = text.match(/Discard (\d+) card/i);
        if (discardMatch && opponent && opponent.hand.length > 0) {
            for (let i = 0; i < parseInt(discardMatch[1]); i++) {
                if (opponent.hand.length > 0) opponent.hand.splice(Math.floor(Math.random() * opponent.hand.length), 1);
            }
            changed = true;
        }

        if (text.match(/Force opponent to discard half their hand/i) && opponent) {
            const count = Math.floor(opponent.hand.length / 2);
            for (let i = 0; i < count; i++) {
                opponent.hand.splice(Math.floor(Math.random() * opponent.hand.length), 1);
            }
            changed = true;
        }

        // --- TURN FLOW & ATB ---
        if (text.match(/Skip (?:their|your next) turn/i) && opponent) {
            opponent.skipNextTurn = true;
            changed = true;
        }

        if (text.match(/Delay opponent|hazardous AQI|stuck on the PCH|must skip their turn/i) && opponent) {
            opponent.atb = Math.max(0, opponent.atb - 50);
            changed = true;
        }

        // --- COST MODIFIERS ---
        if (text.match(/next card costs double/i) && opponent) {
            opponent.costMod = 'double';
            changed = true;
        }

        const discountMatch = text.match(/cards cost (\d+) less/i);
        if (discountMatch) {
            player._costDiscount = (player._costDiscount || 0) + parseInt(discountMatch[1]);
            changed = true;
        }

        // --- PASSIVE BUFFS (FACTIONS) ---
        const passiveMatch = text.match(/Steady stream of \+1 (Capital|Support)/i);
        if (passiveMatch) {
            const stat = passiveMatch[1];
            player.buffs.push({
                id: uuidv4(),
                name: `${stat} Faction`,
                type: 'passive',
                stat: stat,
                value: 1,
                duration: 60,
                msg: `Gaining +1 ${stat} every few seconds.`
            });
            changed = true;
        }

        // --- MISC BUFFS ---
        if (text.match(/Haste/i)) {
            player.buffs.push({ id: uuidv4(), name: 'Speed Campaign', type: 'haste', duration: 20, msg: 'ATB filling faster!' });
            changed = true;
        }

        if (text.match(/Slow opponent|Bureaucracy/i) && opponent) {
            opponent.buffs.push({ id: uuidv4(), name: 'Red Tape', type: 'slow', duration: 20, msg: 'ATB slowed by bureaucracy!' });
            changed = true;
        }

        // --- VOTER SUPPRESSION & DEMOGRAPHICS ---
        const demoMatch = text.match(/demographic approval by (\d+)%/i);
        if ((demoMatch || effect.type === 'Voter Suppression') && opponent) {
            const amount = demoMatch ? parseInt(demoMatch[1]) : 5;
            const demographics = require('../data/demographics.json');
            demographics.forEach(group => {
                if (opponent.demographicApprovals[group.id] !== undefined) {
                    opponent.demographicApprovals[group.id] -= amount;
                }
            });
            room.eventQueue.push({ type: 'demographics-shift', playerId, targetId: opponent.id });
            changed = true;
        }

        const boostMatch = text.match(/Boost (\w+) approval by (\d+)/i);
        if (boostMatch) {
            const [_, groupName, amount] = boostMatch;
            const demographics = require('../data/demographics.json');
            const group = demographics.find(g => g.name.toLowerCase() === groupName.toLowerCase());
            if (group) {
                const oldVal = player.demographicApprovals[group.id] || 10;
                const newVal = oldVal + parseInt(amount);
                player.demographicApprovals[group.id] = newVal;
                if (oldVal < 50 && newVal >= 50) {
                    room.eventQueue.push({ type: 'coalition-threshold', playerId, groupId: group.id });
                    player.support = (player.support || 0) + 3;
                }
                room.eventQueue.push({ type: 'demographics-shift', playerId });
                changed = true;
            }
        }

        return changed;
    }

    fundraise(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (!room) return null;
        const player = room.players[playerId];
        if (!player) return null;

        if (player.atb < 100) return { success: false, message: "Wait for Action Gauge!" };

        const capitalGained = Math.floor(Math.random() * 11) + 5;
        const supportGained = Math.floor(Math.random() * 3) + 1;

        player.politicalCapital += capitalGained;
        player.points += supportGained;
        player.atb = 0;
        player.fatigue = 0; // Reset fatigue on rally too!
        room.filibusterTimer.turnCount++;

        return {
            success: true,
            capitalGained,
            supportGained
        };
    }

    selectDraft(roomId, playerId, cardInstanceIds) {
        const room = this.getRoom(roomId);
        if (!room) return false;
        const player = room.players[playerId];

        cardInstanceIds.forEach(id => {
            const cardIdx = player.deck.findIndex(c => String(c.instanceId) === String(id));
            if (cardIdx !== -1) {
                const card = player.deck.splice(cardIdx, 1)[0];
                player.hand.push(card);
            }
        });
        return true;
    }

    removePlayer(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room) return;

        delete room.players[playerId];
        room.playerIds = room.playerIds.filter(id => id !== playerId);

        if (room.playerIds.length === 0) {
            this.stopGameLoop(roomId);
            delete this.rooms[roomId];
        } else {
            room.status = 'waiting';
            this.stopGameLoop(roomId);
        }
    }

    deleteRoom(roomId) {
        if (this.rooms[roomId]) {
            this.stopGameLoop(roomId);
            delete this.rooms[roomId];
            return true;
        }
        return false;
    }

    _processBuffTicks(roomId, player, isPaused) {
        if (isPaused) return;

        player.buffs.forEach(buff => {
            switch (buff.type) {
                case 'scandal': {
                    const dotDamage = buff.stacks * buff.dotAmount;
                    this._applyDamageWithShield(roomId, player.id, dotDamage);
                    break;
                }
                case 'momentum': {
                    player.points += buff.stacks * buff.stackAmount;
                    break;
                }
                case 'rally': {
                    player.atbSpeed += buff.speedModifier;
                    break;
                }
                case 'shield': {
                    break;
                }
            }
        });
    }

    _applyDamageWithShield(roomId, playerId, damage) {
        const room = this.rooms[roomId];
        if (!room) return damage;
        const player = room.players[playerId];
        if (!player) return damage;

        let remainingDamage = damage;

        const shieldBuffs = player.buffs.filter(b => b.type === 'shield');
        for (const shield of shieldBuffs) {
            if (remainingDamage <= 0) break;
            if (shield.absorbAmount >= remainingDamage) {
                shield.absorbAmount -= remainingDamage;
                remainingDamage = 0;
            } else {
                remainingDamage -= shield.absorbAmount;
                shield.absorbAmount = 0;
            }
        }

        player.buffs = player.buffs.filter(b => !(b.type === 'shield' && b.absorbAmount <= 0));

        player.points = Math.max(0, player.points - remainingDamage);

        if (damage > 0) {
            room.eventQueue.push({
                type: 'damage-applied',
                data: {
                    playerId,
                    totalDamage: damage,
                    absorbed: damage - remainingDamage,
                    remainingDamage,
                    pointsRemaining: player.points
                }
            });
        }

        return remainingDamage;
    }

    getRoomStats(roomId) {
        const room = this.getRoom(roomId);
        if (!room) return null;

        const players = Object.values(room.players);
        if (players.length < 2) return null;

        const p1 = players[0];
        const p2 = players[1];

        // Momentum: Based on recent point gains and active buffs
        const p1Power = p1.points + (p1.buffs.length * 2);
        const p2Power = p2.points + (p2.buffs.length * 2);
        const totalPower = p1Power + p2Power || 1;

        // Win Probability: Weighted towards current score and capital
        const p1Score = (p1.points * 2) + p1.politicalCapital;
        const p2Score = (p2.points * 2) + p2.politicalCapital;
        const totalScore = p1Score + p2Score || 1;

        return {
            momentum: (p1Power / totalPower) * 100,
            winProb: (p1Score / totalScore) * 100,
            players: players.map(p => ({
                id: p.id,
                name: p.name,
                buffCount: p.buffs.length,
                handSize: p.hand.length
            }))
        };
    }

    checkPhaseAdvance(roomId) {
        const room = this.rooms[roomId];
        if (!room) return null;

        const totalSupport = Object.values(room.players).reduce((sum, p) => sum + p.points, 0);
        const phases = [
            { name: 'Primaries', threshold: 0 },
            { name: 'Convention', threshold: 30 },
            { name: 'General Election', threshold: 70 }
        ];

        let newPhase = 'Primaries';
        for (const phase of phases) {
            if (totalSupport >= phase.threshold) {
                newPhase = phase.name;
            }
        }

        if (room.campaignPhase !== newPhase) {
            const oldPhase = room.campaignPhase;
            room.campaignPhase = newPhase;
            room.eventQueue.push({
                type: 'phase-change',
                data: { from: oldPhase, to: newPhase, totalSupport }
            });
            return { from: oldPhase, to: newPhase };
        }
        return null;
    }

    drainEvents(roomId) {
        const room = this.rooms[roomId];
        if (!room || !room.eventQueue) return [];
        const events = [...room.eventQueue];
        room.eventQueue = [];
        return events;
    }

    checkWinConditions(roomId) {
        const room = this.rooms[roomId];
        if (!room || room.status !== 'active') return null;
        const playerIds = room.playerIds;
        if (playerIds.length < 2) return null;

        const p1 = room.players[playerIds[0]];
        const p2 = room.players[playerIds[1]];

        // 50-Support victory (existing)
        if (p1.points >= 50) return { winner: p1.name, condition: 'support', support: p1.points };
        if (p2.points >= 50) return { winner: p2.name, condition: 'support', support: p2.points };

        // Deck-out: player has empty deck and empty hand, cannot act
        const isDeckedOut = (p) => p.deck.length === 0 && p.hand.length === 0;
        if (isDeckedOut(p1)) return { winner: p2.name, condition: 'deck-out', loser: p1.id };
        if (isDeckedOut(p2)) return { winner: p1.name, condition: 'deck-out', loser: p2.id };

        // Coalition victory: ≥50 approval in 3+ demographic groups
        const demographicGroups = ['urban', 'suburban', 'rural', 'working-class', 'educated'];
        const getApprovalCount = (p) => demographicGroups.filter(g => (p.demographicApprovals?.[g] || 0) >= 50).length;
        if (getApprovalCount(p1) >= 3) return { winner: p1.name, condition: 'coalition', groups: getApprovalCount(p1) };
        if (getApprovalCount(p2) >= 3) return { winner: p2.name, condition: 'coalition', groups: getApprovalCount(p2) };

        // Electoral-college majority via swingStates (majority of TOTAL available EVs, not just claimed)
        const sw = room.swingStates || {};
        const p1EV = Object.entries(sw)
            .filter(([state, id]) => id === p1.id)
            .reduce((sum, [state]) => sum + (masterData.states[state]?.electoralVotes || 0), 0);
        const p2EV = Object.entries(sw)
            .filter(([state, id]) => id === p2.id)
            .reduce((sum, [state]) => sum + (masterData.states[state]?.electoralVotes || 0), 0);
        const totalAvailableEV = Object.values(masterData.states)
            .reduce((sum, s) => sum + (s.electoralVotes || 0), 0);
        const majority = Math.floor(totalAvailableEV / 2) + 1;
        if (p1EV >= majority) return { winner: p1.name, condition: 'electoral-college', ev: p1EV };
        if (p2EV >= majority) return { winner: p2.name, condition: 'electoral-college', ev: p2EV };

        // Filibuster timeout
        if (room.filibusterTimer.turnCount >= room.filibusterTimer.maxTurns) {
            const winner = p1.points > p2.points ? p1 : (p2.points > p1.points ? p2 : null);
            if (winner) return { winner: winner.name, condition: 'filibuster-timeout', turnCount: room.filibusterTimer.turnCount };
            return { winner: null, condition: 'filibuster-timeout', tie: true };
        }

        return null;
    }

    claimSwingState(roomId, stateKey, playerId) {
        const room = this.rooms[roomId];
        if (!room) return null;
        if (!room.swingStates) room.swingStates = {};
        room.swingStates[stateKey] = playerId;
        room.eventQueue.push({ type: 'swing-state-claimed', data: { stateId: stateKey, playerId } });
        return room.swingStates;
    }

    applyPendingEffect(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room || !room.pendingEffects) return false;
        const pending = room.pendingEffects[playerId];
        if (!pending) return false;
        this._applyEffect(roomId, playerId, pending.effect, pending.action);
        delete room.pendingEffects[playerId];
        return true;
    }

    grantSwingState(roomId, playerId, supportLevel) {
        const room = this.rooms[roomId];
        if (!room) return null;

        if (!room.swingStates) room.swingStates = {};

        const allKeys = Object.keys(masterData.states);
        const unclaimedKeys = allKeys.filter(key => !Object.keys(room.swingStates).includes(key));
        if (unclaimedKeys.length === 0) return null;
        const unclaimed = unclaimedKeys[Math.floor(Math.random() * unclaimedKeys.length)];


        room.swingStates[unclaimed] = playerId;
        
        const event = {
            type: 'swing-state-claimed',
            data: { playerId, stateId: unclaimed, supportLevel }
        };
        if (room.eventQueue) room.eventQueue.push(event);
        
        return event.data;
    }

    flipSwingState(roomId, playerId, stateKey) {
        const room = this.rooms[roomId];
        if (!room || !stateKey) return null;

        const player = room.players[playerId];
        if (!player || player.politicalCapital < 6) return null;

        const currentOwner = room.swingStates?.[stateKey];
        if (!currentOwner || currentOwner === playerId) return null;

        const defenseExpiry = room.swingStateDefenses?.[stateKey] || 0;
        if (defenseExpiry > Date.now()) return null;

        player.politicalCapital -= 6;
        room.swingStates[stateKey] = playerId;

        const event = {
            type: 'swing-state-flipped',
            data: { playerId, stateId: stateKey }
        };
        if (room.eventQueue) room.eventQueue.push(event);

        return event.data;
    }

    defendSwingState(roomId, playerId, stateKey) {
        const room = this.rooms[roomId];
        if (!room) return null;

        const player = room.players[playerId];
        if (!player || player.politicalCapital < 3) return null;

        if (!room.swingStates || room.swingStates[stateKey] !== playerId) return null;

        if (!room.swingStateDefenses) room.swingStateDefenses = {};
        room.swingStateDefenses[stateKey] = Date.now() + 30000;
        player.politicalCapital -= 3;

        const event = {
            type: 'swing-state-defended',
            data: { playerId, stateKey }
        };
        if (room.eventQueue) room.eventQueue.push(event);

        return event.data;
    }

    _triggerNewsCycleEvent(roomId) {
        const room = this.rooms[roomId];
        if (!room) return null;

        if (!room.newsCycle) {
            room.newsCycle = { cycleIndex: 0, eventIndex: 0, turnsInCycle: 0 };
        }

        const nc = room.newsCycle;

        if (nc.turnsInCycle > 0) {
            nc.eventIndex++;
            if (nc.eventIndex >= NEWS_CYCLES[nc.cycleIndex % NEWS_CYCLES.length].events.length) {
                nc.cycleIndex = (nc.cycleIndex + 1) % NEWS_CYCLES.length;
                nc.eventIndex = 0;
                nc.turnsInCycle = 0;
                room.eventQueue.push({
                    type: 'news-cycle-rotate',
                    data: { newCycle: NEWS_CYCLES[nc.cycleIndex].name, theme: NEWS_CYCLES[nc.cycleIndex].theme }
                });
            }
        }

        nc.turnsInCycle++;
        const currentCycle = NEWS_CYCLES[nc.cycleIndex % NEWS_CYCLES.length];
        const currentEvent = currentCycle.events[nc.eventIndex % currentCycle.events.length];

        room.eventQueue.push({
            type: 'news-cycle-event',
            data: {
                cycleName: currentCycle.name,
                theme: currentCycle.theme,
                event: currentEvent,
                cycleIndex: nc.cycleIndex,
                eventIndex: nc.eventIndex
            }
        });

        return currentEvent;
    }

    serializeRoomState(room, requestingPlayerId) {
        const clone = JSON.parse(JSON.stringify(room, (key, value) => {
            if (key === 'gameLoopInterval') return undefined;
            return value;
        }));
        Object.keys(clone.players).forEach(playerId => {
            const player = clone.players[playerId];
            delete player._aiTurnPending;
            delete player._costDiscount;
            delete player.previousSupport;
            delete player.grantedThresholds;
            if (playerId !== requestingPlayerId) {
                if (player.hand) {
                    player.hand = player.hand.map(card => ({ instanceId: card.instanceId }));
                }
                if (player.deck) {
                    player.deck = player.deck.length;
                }
                if (player.playHistory) {
                    player.playHistory = player.playHistory.length;
                }
                player.darkMoneyCap = 'HIDDEN';
            }
        });
        return clone;
    }

    computeSupportFromDemographics(player) {
        const demographics = require('../data/demographics.json');
        let totalSupport = 0;
        demographics.forEach(group => {
            const weight = group.coalitionWeight || 1;
            const approval = player.demographicApprovals[group.id] || 10;
            totalSupport += approval * weight;
        });
        return totalSupport;
    }

    submitCrisisResponse(roomId, playerId, responseId) {
        const room = this.rooms[roomId];
        if (!room || !room.crisis) return false;

        room.crisis.responses[playerId] = responseId;

        if (Object.keys(room.crisis.responses).length === room.playerIds.length) {
            const crisis = room.crisis.details;
            const responses = room.crisis.responses;
            
            const [p1, p2] = room.playerIds;
            const opt1 = crisis.options.find(o => o.id === responses[p1]);
            const opt2 = crisis.options.find(o => o.id === responses[p2]);
            const label1 = opt1 ? opt1.label : 'default';
            const label2 = opt2 ? opt2.label : 'default';
            const outcomeKey = `${label1}-${label2}`;
            const outcome = crisis.outcomes[outcomeKey] || crisis.outcomes['default'];

            room.playerIds.forEach(pid => {
                const opt = crisis.options.find(o => o.id === responses[pid]);
                const playerEffect = opt ? opt.effect : (outcome.playerEffects ? outcome.playerEffects[pid] : null);
                if (playerEffect) this._applyEffect(roomId, pid, playerEffect);
            });

            if (outcome.globalEffect) {
                room.playerIds.forEach(pid => this._applyEffect(roomId, pid, outcome.globalEffect));
            }

            room.status = 'active';
            room.crisis = null;
            return true;
        }
        return false;
    }

    _shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    bankDarkMoney(roomId, playerId, amount) {
        const room = this.rooms[roomId];
        if (!room) return false;
        const player = room.players[playerId];
        if (!player || player.politicalCapital < amount || amount < 3) return false;

        player.politicalCapital -= amount;
        player.darkMoneyCap += amount;
        return true;
    }

    spendDarkMoney(roomId, playerId, cardInstanceId) {
        const room = this.rooms[roomId];
        if (!room) return false;
        const player = room.players[playerId];
        if (!player) return false;

        const card = room.players[playerId].hand.find(c => c.instanceId === cardInstanceId);
        if (!card) return false;

        const baseCost = card.cost || 0;
        const discountedCost = Math.ceil(baseCost / 2);

        if (player.darkMoneyCap >= discountedCost) {
            player.darkMoneyCap -= discountedCost;
            return true;
        }
        return false;
    }

    checkScandalThreshold(roomId, playerId, io) {
        const room = this.rooms[roomId];
        if (!room) return;
        const player = room.players[playerId];
        if (!player || player.scandalPoints < 10) return;

        const quizzes = require('../data/quizzes.json');
        const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
        
        room.status = 'paused';
        if (io) {
            io.to(roomId).emit('impeachment_started', { playerId, quiz });
        }
    }

    handleImpeachmentAnswer(roomId, playerId, isCorrect) {
        const room = this.rooms[roomId];
        if (!room) return;
        const player = room.players[playerId];
        if (!player) return;

        if (!isCorrect) {
            const penalty = Math.floor(player.points * 0.15);
            player.points -= penalty;
        }
        
        player.scandalPoints = 0;
        room.status = 'active';
    }

    buyLobbyist(roomId, playerId, lobbyType) {
        const room = this.rooms[roomId];
        if (!room) return false;
        const player = room.players[playerId];
        if (!player) return false;

        const lobbyistData = masterData.lobbyists?.[lobbyType];
        if (!lobbyistData || player.politicalCapital < lobbyistData.cost) return false;

        player.politicalCapital -= lobbyistData.cost;
        if (!player.lobbyists) player.lobbyists = [];
        player.lobbyists.push({ type: lobbyType, ...lobbyistData.effect });
        return true;
    }

    getLobbyEffects(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room) return null;
        const player = room.players[playerId];
        return player?.lobbyists || [];
    }

    activateFilibuster(roomId, playerId, io) {
        const room = this.rooms[roomId];
        if (!room) return false;
        if (room.filibuster && room.filibuster.active) return false;
        const player = room.players[playerId];
        if (!player || player.atb < 50) return false;

        player.atb -= 50;
        room.filibuster = {
            active: true,
            startTime: Date.now(),
            duration: 8000,
            attackerId: playerId
        };

        const opponentId = room.playerIds.find(id => id !== playerId);
        if (opponentId) {
            room.players[opponentId].atbFrozen = true;
        }

        if (io) {
            io.to(roomId).emit('filibuster_active', { 
                attackerId: playerId, 
                duration: 8000 
            });
        }

        setTimeout(() => {
            if (room && room.filibuster && room.filibuster.attackerId === playerId) {
                room.filibuster = null;
                if (opponentId) room.players[opponentId].atbFrozen = false;
                if (io) io.to(roomId).emit('filibuster_ended', { roomId });
            }
        }, 8000);

        return true;
    }

    clotureVote(roomId, playerId, io) {
        const room = this.rooms[roomId];
        if (!room || !room.filibuster || !room.filibuster.active) return false;
        const player = room.players[playerId];
        if (!player || player.politicalCapital < 6) return false;

        player.politicalCapital -= 6;
        const attackerId = room.filibuster.attackerId;
        room.filibuster = null;

        const opponentId = room.playerIds.find(id => id !== attackerId);
        if (opponentId) {
            room.players[opponentId].atbFrozen = false;
        }

        if (io) {
            io.to(roomId).emit('filibuster_ended', { roomId, brokenBy: playerId });
        }

        return true;
    }

    shiftNewsCycle(roomId, playerId, themeIndex) {
        const room = this.rooms[roomId];
        if (!room) return false;
        const player = room.players[playerId];
        if (!player || player.politicalCapital < 4) return false;

        player.politicalCapital -= 4;
        if (themeIndex >= 0 && themeIndex < NEWS_CYCLES.length) {
            room.currentNewsCycle = NEWS_CYCLES[themeIndex];
            room.newsCycleTimer = 0;
        }
        return true;
    }

    suppressScandal(roomId, playerId) {
        const room = this.rooms[roomId];
        if (!room) return false;
        const player = room.players[playerId];
        if (!player || player.politicalCapital < 3) return false;

        player.politicalCapital -= 3;
        player.scandalPoints = Math.floor(player.scandalPoints / 2);
        return true;
    }

    vetoCard(roomId, playerId, cardInstanceId, io) {
        const room = this.rooms[roomId];
        if (!room) return false;
        const player = room.players[playerId];
        if (!player || player.politicalCapital < 5) return false;

        const card = room.lastPlayedCard;
        if (!card || card.instanceId !== cardInstanceId || card.cost < 4) return false;

        player.politicalCapital -= 5;
        room.vetoWindow = {
            active: true,
            startTime: Date.now(),
            duration: 6000,
            vetoerId: playerId,
            cardInstanceId: cardInstanceId
        };

        if (io) {
            io.to(roomId).emit('veto_attempted', { roomId, vetoerId: playerId, cardInstanceId });
        }

        setTimeout(() => {
            if (room && room.vetoWindow && room.vetoWindow.cardInstanceId === cardInstanceId) {
                room.vetoWindow.active = false;
                if (io) io.to(roomId).emit('veto_expired', { roomId, cardInstanceId });
            }
        }, 6000);

        return true;
    }

    overrideCard(roomId, playerId, cardInstanceId, io) {
        const room = this.rooms[roomId];
        if (!room || !room.vetoWindow || !room.vetoWindow.active) return false;
        if (room.vetoWindow.cardInstanceId !== cardInstanceId) return false;

        const player = room.players[playerId];
        if (!player || player.politicalCapital < 8) return false;

        player.politicalCapital -= 8;
        room.vetoWindow.active = false;

        if (io) {
            io.to(roomId).emit('override_result', { roomId, overriderId: playerId, cardInstanceId, success: true });
        }

        return true;
    }
}

module.exports = new RoomManager();