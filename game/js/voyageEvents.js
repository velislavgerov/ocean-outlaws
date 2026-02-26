// voyageEvents.js — narrative event templates for roguelite voyage nodes

export var VOYAGE_EVENTS = [
  // --- Frontier Isles (columns 0-2) ---
  {
    id: "frontier_parley",
    title: "White Flag on the Horizon",
    body: "A weathered pirate brig raises a white flag. Their captain offers a sealed chart tube in exchange for safe passage.",
    regions: ["frontier_isles"],
    nodeTypes: ["event"],
    rarityWeight: 4,
    sceneRole: "pirate_parley",
    openCue: "event_open",
    choices: [
      {
        id: "hear_them",
        text: "Hear their offer",
        outcomes: {
          gold: 45,
          factionRep: { pirates: 8, navy: -3 },
          setFlags: ["frontier_parley_heard"],
          journal: "You accepted pirate intelligence and gained a rough chart of patrol routes.",
          resultCue: "event_positive"
        }
      },
      {
        id: "seize_charts",
        text: "Seize the chart and board them",
        outcomes: {
          gold: 80,
          factionRep: { pirates: -12, navy: 6 },
          journal: "You took the chart by force. The crew calls it effective, not honorable.",
          combatOverride: {
            encounterType: "pirate_counterattack",
            factions: ["pirate", "pirate"],
            waves: 3,
            enemyBaseAdd: 1,
            weather: "rough",
            sceneRole: "raider_counterattack",
            nodeLabel: "Pirate Counterattack"
          },
          resultCue: "event_negative"
        }
      }
    ]
  },
  {
    id: "cove_refugees",
    title: "Refugees of the Cove",
    body: "Fishing families drift in damaged skiffs, fleeing raids. They beg for escort to the nearest fortified harbor.",
    regions: ["frontier_isles"],
    nodeTypes: ["event"],
    rarityWeight: 3,
    sceneRole: "civilian_rescue",
    openCue: "event_open",
    choices: [
      {
        id: "escort",
        text: "Escort them to safety",
        outcomes: {
          factionRep: { navy: 10, merchant: 6, pirates: -5 },
          hpDelta: -8,
          setFlags: ["rescued_frontier_refugees"],
          journal: "You escorted refugees through contested waters. Morale rose despite hull damage.",
          resultCue: "event_positive"
        }
      },
      {
        id: "supplies_only",
        text: "Give supplies and move on",
        outcomes: {
          gold: -20,
          factionRep: { merchant: 5 },
          journal: "You shared cargo rations but could not spare time for a full escort.",
          resultCue: "event_confirm"
        }
      }
    ]
  },
  {
    id: "smuggler_cache",
    title: "Smuggler Cache",
    body: "Hidden crates float near a reef marker. Some bear naval seals, others pirate brands burned out with a knife.",
    regions: ["frontier_isles"],
    nodeTypes: ["event"],
    rarityWeight: 2,
    sceneRole: "smuggler_cache",
    openCue: "event_open",
    choices: [
      {
        id: "claim_and_log",
        text: "Claim cache and report it",
        requirements: { factionMin: { navy: -40 } },
        outcomes: {
          gold: 60,
          factionRep: { navy: 9, pirates: -7 },
          setFlags: ["smuggler_cache_reported"],
          journal: "You secured the smuggler cache for the navy quartermaster.",
          resultCue: "reputation_up"
        }
      },
      {
        id: "sell_quietly",
        text: "Sell discreetly in back channels",
        outcomes: {
          gold: 95,
          factionRep: { merchant: 6, navy: -6 },
          setFlags: ["smuggler_cache_sold"],
          journal: "You sold smuggled stock through off-book brokers.",
          resultCue: "event_negative"
        }
      }
    ]
  },
  {
    id: "widow_whisper",
    title: "A Name in the Fog",
    body: "A damaged courier warns that a merchant queen called 'The Widow' is buying captains and cannon by the fleet.",
    regions: ["frontier_isles"],
    nodeTypes: ["event"],
    rarityWeight: 1,
    sceneRole: "widow_foreshadow",
    openCue: "event_open",
    choices: [
      {
        id: "pay_for_intel",
        text: "Pay for full intelligence",
        outcomes: {
          gold: -30,
          factionRep: { merchant: -4, navy: 4 },
          setFlags: ["widow_foreshadowed"],
          journal: "You obtained intelligence dossiers naming The Widow's quartermasters.",
          resultCue: "journal_update"
        }
      },
      {
        id: "dismiss_story",
        text: "Dismiss it as dockside fear",
        outcomes: {
          factionRep: { merchant: 2 },
          journal: "You ignored early warnings about The Widow's expansion.",
          resultCue: "event_confirm"
        }
      }
    ]
  },

  // --- Storm Belt (columns 3-4) ---
  {
    id: "convoy_contract",
    title: "Convoy in Distress",
    body: "Signal flares puncture the rain. A merchant convoy under attack broadcasts an open contract for immediate protection.",
    regions: ["storm_belt"],
    nodeTypes: ["event"],
    rarityWeight: 4,
    sceneRole: "convoy_contract",
    openCue: "event_open",
    choices: [
      {
        id: "defend_convoy",
        text: "Accept the protection contract",
        outcomes: {
          gold: 75,
          factionRep: { merchant: 12, pirates: -8 },
          journal: "You accepted a storm-belt convoy contract and earned merchant trust.",
          combatOverride: {
            encounterType: "convoy_defense",
            factions: ["pirate", "pirate", "navy"],
            waves: 3,
            weather: "storm",
            sceneRole: "storm_convoy_defense",
            nodeLabel: "Convoy Defense"
          },
          resultCue: "event_positive"
        }
      },
      {
        id: "raid_convoy",
        text: "Turn on the convoy and raid it",
        outcomes: {
          gold: 120,
          factionRep: { merchant: -20, pirates: 9 },
          setFlags: ["storm_convoy_raided"],
          journal: "You raided a convoy in heavy weather and made an enemy of the guild.",
          combatOverride: {
            encounterType: "convoy_raid",
            factions: ["merchant", "navy"],
            waves: 2,
            enemyBaseAdd: 1,
            weather: "storm",
            sceneRole: "storm_convoy_raid",
            nodeLabel: "Convoy Raid"
          },
          resultCue: "event_negative"
        }
      }
    ]
  },
  {
    id: "lightning_battery",
    title: "Lightning Rig",
    body: "A wrecked test barge drifts nearby with arc coils still charged. Engineers claim the rig can boost cannon output once.",
    regions: ["storm_belt"],
    nodeTypes: ["event"],
    rarityWeight: 2,
    sceneRole: "storm_tech",
    openCue: "event_open",
    choices: [
      {
        id: "salvage_rig",
        text: "Salvage the rig",
        outcomes: {
          hpDelta: -6,
          factionRep: { merchant: 6 },
          setFlags: ["storm_lightning_rig"],
          journal: "You salvaged unstable lightning coils from a storm test barge.",
          resultCue: "event_confirm"
        }
      },
      {
        id: "scuttle_it",
        text: "Scuttle it before anyone can use it",
        outcomes: {
          factionRep: { navy: 7, merchant: -6 },
          journal: "You destroyed a dangerous weapons prototype in open waters.",
          resultCue: "reputation_up"
        }
      }
    ]
  },
  {
    id: "widow_emissary",
    title: "The Widow's Emissary",
    body: "A lacquered courier cutter approaches without guns run out. Its envoy offers safe lanes for a price and your silence.",
    regions: ["storm_belt"],
    nodeTypes: ["event"],
    rarityWeight: 2,
    sceneRole: "widow_envoy",
    openCue: "event_open",
    choices: [
      {
        id: "take_deal",
        text: "Take the deal",
        outcomes: {
          gold: 55,
          factionRep: { merchant: -8, pirates: 4 },
          setFlags: ["widow_deal_taken"],
          journal: "You accepted The Widow's temporary safe-lane arrangement.",
          resultCue: "event_negative"
        }
      },
      {
        id: "refuse_publicly",
        text: "Refuse and broadcast the offer",
        outcomes: {
          factionRep: { navy: 10, merchant: 4 },
          setFlags: ["widow_deal_exposed"],
          journal: "You exposed The Widow's coercive offers to nearby captains.",
          resultCue: "event_positive"
        }
      }
    ]
  },
  {
    id: "storm_shrine",
    title: "Shrine of the Tempest",
    body: "Between thunderheads, a stone shrine breaks the surface at low tide. Sailors leave offerings for safe passage.",
    regions: ["storm_belt"],
    nodeTypes: ["event"],
    rarityWeight: 1,
    sceneRole: "storm_shrine",
    openCue: "event_open",
    choices: [
      {
        id: "leave_offering",
        text: "Leave an offering",
        outcomes: {
          gold: -25,
          hpDelta: 10,
          setFlags: ["storm_shrine_offering"],
          journal: "You left tribute at the storm shrine and the crew swore the sea calmed around the hull.",
          resultCue: "event_positive"
        }
      },
      {
        id: "loot_shrine",
        text: "Loot the offerings",
        outcomes: {
          gold: 70,
          hpDelta: -10,
          factionRep: { pirates: 4, navy: -5, merchant: -4 },
          journal: "You looted the shrine and sailed into a punishing squall soon after.",
          resultCue: "event_negative"
        }
      }
    ]
  },

  // --- Forgotten Depths (columns 5-6) ---
  {
    id: "ghost_convoy",
    title: "Lanterns Without Crews",
    body: "A line of lantern-lit hulls glides across black water, perfectly silent. No voices answer your hails.",
    regions: ["forgotten_depths"],
    nodeTypes: ["event"],
    rarityWeight: 3,
    sceneRole: "ghost_convoy",
    openCue: "event_open",
    choices: [
      {
        id: "shadow_them",
        text: "Shadow the convoy",
        outcomes: {
          gold: 90,
          hpDelta: -12,
          setFlags: ["ghost_convoy_shadowed"],
          journal: "You trailed spectral hulls and recovered cursed bullion from their wake.",
          combatOverride: {
            encounterType: "ghost_intercept",
            factions: ["pirate", "navy", "pirate"],
            waves: 3,
            weather: "storm",
            sceneRole: "ghost_intercept",
            nodeLabel: "Ghost Intercept"
          },
          resultCue: "boss_omen"
        }
      },
      {
        id: "avoid_them",
        text: "Alter course and avoid them",
        outcomes: {
          hpDelta: 6,
          factionRep: { navy: 3 },
          journal: "You refused pursuit and kept the crew focused on survival.",
          resultCue: "event_confirm"
        }
      }
    ]
  },
  {
    id: "abyssal_idol",
    title: "Abyssal Idol",
    body: "Diver bells surface with a carved idol chained inside. Its eyes glow faintly when lightning strikes.",
    regions: ["forgotten_depths"],
    nodeTypes: ["event"],
    rarityWeight: 2,
    sceneRole: "abyssal_idol",
    openCue: "event_open",
    choices: [
      {
        id: "seal_idol",
        text: "Seal it in lead and keep watch",
        outcomes: {
          factionRep: { navy: 6, merchant: 3 },
          setFlags: ["idol_sealed"],
          journal: "You sealed a deepwater idol and logged strict handling protocols.",
          resultCue: "journal_update"
        }
      },
      {
        id: "use_idol",
        text: "Use it to intimidate rivals",
        outcomes: {
          gold: 65,
          factionRep: { pirates: 10, merchant: -6 },
          setFlags: ["idol_exploited"],
          journal: "You weaponized an abyssal relic. Even allies grew uneasy.",
          resultCue: "event_negative"
        }
      }
    ]
  },
  {
    id: "crane_signal",
    title: "Signal of Admiral Crane",
    body: "A broken semaphore tower flashes an obsolete naval code. The repeating call signs all resolve to Admiral Crane's lost fleet.",
    regions: ["forgotten_depths"],
    nodeTypes: ["event"],
    rarityWeight: 1,
    sceneRole: "crane_signal",
    openCue: "event_open",
    choices: [
      {
        id: "decode",
        text: "Decode and archive the signal",
        requirements: { factionMin: { navy: -20 } },
        outcomes: {
          factionRep: { navy: 9 },
          setFlags: ["crane_signal_decoded"],
          journal: "You decoded Crane's repeating signal and traced likely ambush coordinates.",
          resultCue: "reputation_up"
        }
      },
      {
        id: "jam",
        text: "Jam the broadcast and move",
        outcomes: {
          factionRep: { navy: -5, pirates: 4 },
          setFlags: ["crane_signal_jammed"],
          journal: "You jammed the signal, choosing tactical silence over certainty.",
          resultCue: "event_confirm"
        }
      }
    ]
  },
  {
    id: "depths_mutiny",
    title: "Whispers Below Deck",
    body: "Crew arguments break out after midnight. Some sailors claim the sea itself is bargaining with them.",
    regions: ["forgotten_depths"],
    nodeTypes: ["event"],
    rarityWeight: 2,
    sceneRole: "depths_mutiny",
    openCue: "event_open",
    choices: [
      {
        id: "address_crew",
        text: "Address the crew at dawn",
        outcomes: {
          hpDelta: 8,
          factionRep: { merchant: 4 },
          setFlags: ["depths_mutiny_resolved"],
          journal: "You steadied the crew with open command and clear watches.",
          resultCue: "event_positive"
        }
      },
      {
        id: "purge_ringleaders",
        text: "Purge suspected ringleaders",
        outcomes: {
          gold: 40,
          hpDelta: -14,
          factionRep: { pirates: 6, navy: -7, merchant: -7 },
          setFlags: ["depths_mutiny_purged"],
          journal: "You crushed dissent brutally. Discipline held, trust did not.",
          combatOverride: {
            encounterType: "deserter_hunt",
            factions: ["pirate", "navy"],
            waves: 2,
            weather: "storm",
            sceneRole: "mutiny_fallout",
            nodeLabel: "Mutiny Fallout"
          },
          resultCue: "event_negative"
        }
      }
    ]
  }
];

