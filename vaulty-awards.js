/* ============================================================
   REFUGIO 111 — VAULTY Awards: categorías y nominados de cada año
   Los votos de cada jugador se guardan en Firestore (vaultyAwards/{año}); aquí solo va la papeleta.
   Para un año nuevo, añade otra entrada con sus categorías. Cada nominado:
     { t: título, s: estudio (o el juego, en actuación), juego: juego del que sale la imagen (si no es t) }
   Las categorías con tipo 'media' (cine y series) buscan su imagen en TMDB en vez de en IGDB.
   ============================================================ */
window.VAULTY_AWARDS = {
  2026: [
    {
      "id": "goty",
      "icono": "🏆",
      "nombre": "Juego del año (GOTY)",
      "nominados": [
        {
          "t": "007 First Light",
          "s": "IO Interactive"
        },
        {
          "t": "Control Resonant",
          "s": "Remedy/Annapurna"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Phantom Blade Zero",
          "s": "S-GAME"
        },
        {
          "t": "Resident Evil Requiem",
          "s": "Capcom"
        },
        {
          "t": "The Legend of Zelda: Ocarina of Time",
          "s": "Nintendo"
        }
      ]
    },
    {
      "id": "direccion",
      "icono": "🎬",
      "nombre": "Mejor dirección",
      "nominados": [
        {
          "t": "Control Resonant",
          "s": "Remedy/Annapurna"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Phantom Blade Zero",
          "s": "S-GAME"
        },
        {
          "t": "Pragmata",
          "s": "Capcom"
        },
        {
          "t": "Resident Evil Requiem",
          "s": "Capcom"
        }
      ]
    },
    {
      "id": "narrativa",
      "icono": "📖",
      "nombre": "Mejor narrativa",
      "nominados": [
        {
          "t": "007 First Light",
          "s": "IO Interactive"
        },
        {
          "t": "Control Resonant",
          "s": "Remedy/Annapurna"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Resident Evil Requiem",
          "s": "Capcom"
        },
        {
          "t": "The Blood of Dawnwalker",
          "s": "Rebel Wolves/Bandai Namco"
        }
      ]
    },
    {
      "id": "arte",
      "icono": "🎨",
      "nombre": "Mejor dirección de arte",
      "nominados": [
        {
          "t": "Control Resonant",
          "s": "Remedy/Annapurna"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Mouse: P.I. For Hire",
          "s": "Fumi/PlaySide"
        },
        {
          "t": "Phantom Blade Zero",
          "s": "S-GAME"
        },
        {
          "t": "The Legend of Zelda: Ocarina of Time",
          "s": "Nintendo"
        }
      ]
    },
    {
      "id": "banda-sonora",
      "icono": "🎼",
      "nombre": "Mejor banda sonora",
      "nominados": [
        {
          "t": "Ace Combat 8: Wings of Theve",
          "s": "Bandai Namco Aces/Bandai Namco"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Mixtape",
          "s": "Beethoven & Dinosaur/Annapurna"
        },
        {
          "t": "Phantom Blade Zero",
          "s": "S-GAME"
        },
        {
          "t": "The Legend of Zelda: Ocarina of Time",
          "s": "Nintendo"
        }
      ]
    },
    {
      "id": "audio",
      "icono": "🔊",
      "nombre": "Mejor diseño de audio",
      "nominados": [
        {
          "t": "Ace Combat 8: Wings of Theve",
          "s": "Bandai Namco Aces/Bandai Namco"
        },
        {
          "t": "Control Resonant",
          "s": "Remedy/Annapurna"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Resident Evil Requiem",
          "s": "Capcom"
        },
        {
          "t": "Star Wars: Galactic Racer",
          "s": "Fuse Games/Secret Mode"
        }
      ]
    },
    {
      "id": "actuacion",
      "icono": "🎭",
      "nombre": "Mejor actuación",
      "nominados": [
        {
          "t": "Angela Sant’Albano",
          "s": "Resident Evil Requiem",
          "juego": "Resident Evil Requiem"
        },
        {
          "t": "Liam McIntyre",
          "s": "Marvel’s Wolverine",
          "juego": "Marvel’s Wolverine"
        },
        {
          "t": "Manni L. Perez",
          "s": "Grand Theft Auto VI",
          "juego": "Grand Theft Auto VI"
        },
        {
          "t": "Patrick Gibson",
          "s": "007 First Light",
          "juego": "007 First Light"
        },
        {
          "t": "Rahul Kohli",
          "s": "Saros",
          "juego": "Saros"
        }
      ]
    },
    {
      "id": "impacto",
      "icono": "💛",
      "nombre": "Games for Impact",
      "nominados": [
        {
          "t": "Big Walk",
          "s": "House House/Panic"
        },
        {
          "t": "Cairn",
          "s": "The Game Bakers"
        },
        {
          "t": "Forever Ago",
          "s": "Third Shift/Annapurna"
        },
        {
          "t": "Life is Strange: Reunion",
          "s": "Deck Nine/Square Enix"
        },
        {
          "t": "lily’s world XD",
          "s": "SonderingEmily/Kwalee"
        },
        {
          "t": "Mixtape",
          "s": "Beethoven & Dinosaur/Annapurna"
        }
      ]
    },
    {
      "id": "accesibilidad",
      "icono": "♿",
      "nombre": "Innovación en accesibilidad",
      "nominados": [
        {
          "t": "Assassin’s Creed Black Flag Resynced",
          "s": "Ubisoft Singapore/Ubisoft"
        },
        {
          "t": "Forza Horizon 6",
          "s": "Playground Games/Xbox Game Studios"
        },
        {
          "t": "Gears of War: E-Day",
          "s": "The Coalition/Xbox Game Studios"
        },
        {
          "t": "Marvel’s Wolverine",
          "s": "Insomniac/Sony Interactive"
        },
        {
          "t": "Rhythm Heaven Groove",
          "s": "Nintendo"
        }
      ]
    },
    {
      "id": "soporte",
      "icono": "🔄",
      "nombre": "Mejor soporte continuado",
      "nominados": [
        {
          "t": "Arc Raiders",
          "s": "Embark Studios"
        },
        {
          "t": "Final Fantasy XIV",
          "s": "Square Enix"
        },
        {
          "t": "Fortnite",
          "s": "Epic Games"
        },
        {
          "t": "No Man’s Sky",
          "s": "Hello Games"
        },
        {
          "t": "The Witcher 3: Wild Hunt",
          "s": "CD Projekt Red"
        }
      ]
    },
    {
      "id": "comunidad",
      "icono": "🤝",
      "nombre": "Mejor apoyo a la comunidad",
      "nominados": [
        {
          "t": "Crimson Desert",
          "s": "Pearl Abyss"
        },
        {
          "t": "Helldivers 2",
          "s": "Arrowhead Game Studio/Sony Interactive"
        },
        {
          "t": "No Man’s Sky",
          "s": "Hello Games"
        },
        {
          "t": "The Witcher 3: Wild Hunt",
          "s": "CD Projekt Red"
        },
        {
          "t": "Warframe",
          "s": "Digital Extremes"
        }
      ]
    },
    {
      "id": "indie",
      "icono": "🌱",
      "nombre": "Mejor juego independiente",
      "nominados": [
        {
          "t": "Big Walk",
          "s": "House House/Panic"
        },
        {
          "t": "Cairn",
          "s": "The Game Bakers"
        },
        {
          "t": "Denshattack!",
          "s": "Undercoders/Fireshine Games"
        },
        {
          "t": "Mewgenics",
          "s": "Edmund McMillen and Tyler Glaiel"
        },
        {
          "t": "Mina the Hollower",
          "s": "Yacht Club Games"
        }
      ]
    },
    {
      "id": "debut-indie",
      "icono": "✨",
      "nombre": "Mejor debut indie",
      "nominados": [
        {
          "t": "Dressmaker",
          "s": "Cozy Lives/Free Lives"
        },
        {
          "t": "Esoteric Ebb",
          "s": "Christoffer Bodegård/Raw Fury"
        },
        {
          "t": "Orbitals",
          "s": "Shapefarm/Kepler"
        },
        {
          "t": "Replaced",
          "s": "Sad Cat Studios/Thunderful"
        },
        {
          "t": "Silver Pines",
          "s": "Wych Elm/Team17"
        }
      ]
    },
    {
      "id": "movil",
      "icono": "📱",
      "nombre": "Mejor juego para móviles",
      "nominados": [
        {
          "t": "Arknights: Endfield",
          "s": "Hypergryph/GRYPHLINE"
        },
        {
          "t": "Monster Hunter Outlanders",
          "s": "TiMi Studio Group/Level Infinite"
        },
        {
          "t": "Neverness to Everness",
          "s": "Hotta Studio/Perfect World Games"
        },
        {
          "t": "Pokémon Champions",
          "s": "The Pokémon Works/The Pokémon Company"
        },
        {
          "t": "Where Winds Meet",
          "s": "Everstone Studio/NetEase Games"
        }
      ]
    },
    {
      "id": "vr",
      "icono": "🥽",
      "nombre": "Mejor juego de AR/VR",
      "nominados": [
        {
          "t": "Forefront",
          "s": "Triangle Factory"
        },
        {
          "t": "Into the Radius 2",
          "s": "CM Immersive"
        },
        {
          "t": "Little Nightmares VR: Altered Echoes",
          "s": "ICONIK/Bandai Namco"
        },
        {
          "t": "Teenage Mutant Ninja Turtles: Empire City",
          "s": "Cortopia Studios/Beyond Frames"
        },
        {
          "t": "Thief VR: Legacy of Shadow",
          "s": "Maze Theory/Vertigo Games"
        }
      ]
    },
    {
      "id": "accion",
      "icono": "💥",
      "nombre": "Mejor juego de acción",
      "nominados": [
        {
          "t": "Ace Combat 8: Wings of Theve",
          "s": "Bandai Namco Aces/Bandai Namco"
        },
        {
          "t": "Gears of War: E-Day",
          "s": "The Coalition/Xbox Game Studios"
        },
        {
          "t": "Onimusha: Way of the Sword",
          "s": "Capcom"
        },
        {
          "t": "Phantom Blade Zero",
          "s": "S-GAME"
        },
        {
          "t": "Saros",
          "s": "Housemarque/Sony Interactive"
        }
      ]
    },
    {
      "id": "accion-aventura",
      "icono": "🗺️",
      "nombre": "Mejor juego de acción/aventura",
      "nominados": [
        {
          "t": "007 First Light",
          "s": "IO Interactive"
        },
        {
          "t": "Control Resonant",
          "s": "Remedy/Annapurna"
        },
        {
          "t": "Grand Theft Auto VI",
          "s": "Rockstar Games"
        },
        {
          "t": "Pragmata",
          "s": "Capcom"
        },
        {
          "t": "Resident Evil Requiem",
          "s": "Capcom"
        },
        {
          "t": "The Legend of Zelda: Ocarina of Time",
          "s": "Nintendo"
        }
      ]
    },
    {
      "id": "rpg",
      "icono": "⚔️",
      "nombre": "Mejor juego de rol (RPG)",
      "nominados": [
        {
          "t": "Final Fantasy Resonance",
          "s": "Lancarse/Square Enix"
        },
        {
          "t": "Fire Emblem Fortune’s Weave",
          "s": "Intelligent Systems/Nintendo"
        },
        {
          "t": "Monster Hunter Stories 3: Twisted Reflection",
          "s": "Capcom"
        },
        {
          "t": "The Blood of Dawnwalker",
          "s": "Rebel Wolves/Bandai Namco"
        },
        {
          "t": "Trails in the Sky 2nd Chapter",
          "s": "Nihon Falcom/GungHo"
        }
      ]
    },
    {
      "id": "lucha",
      "icono": "🥊",
      "nombre": "Mejor juego de lucha",
      "nominados": [
        {
          "t": "2XKO",
          "s": "Riot Games"
        },
        {
          "t": "Avatar Legends: The Fighting Game",
          "s": "Gameplay Group/Paramount Games"
        },
        {
          "t": "Invincible VS",
          "s": "Quarter Up/Skybound Games"
        },
        {
          "t": "Marvel Tōkon: Fighting Souls",
          "s": "ARC System Works/Sony Interactive"
        },
        {
          "t": "My Hero Academia: All’s Justice",
          "s": "Byking/Bandai Namco"
        }
      ]
    },
    {
      "id": "familiar",
      "icono": "👨‍👩‍👧",
      "nombre": "Mejor juego familiar",
      "nominados": [
        {
          "t": "Big Walk",
          "s": "House House/Panic"
        },
        {
          "t": "Lego Batman: Legacy of the Dark Knight",
          "s": "TT Games/Warner Bros. Games"
        },
        {
          "t": "Nintendo Switch Sports Resort",
          "s": "Nintendo"
        },
        {
          "t": "Pokémon Pokopia",
          "s": "Game Freak/Omega Force/Nintendo"
        },
        {
          "t": "Yoshi and the Mysterious Book",
          "s": "Good-Feel/Nintendo"
        }
      ]
    },
    {
      "id": "estrategia",
      "icono": "♟️",
      "nombre": "Mejor juego de simulación/estrategia",
      "nominados": [
        {
          "t": "Mewgenics",
          "s": "Edmund McMillen and Tyler Glaiel"
        },
        {
          "t": "Planet Zoo 2",
          "s": "Frontier Developments"
        },
        {
          "t": "Pokémon Pokopia",
          "s": "Game Freak/Omega Force/Nintendo"
        },
        {
          "t": "Slay the Spire 2",
          "s": "Mega Crit"
        },
        {
          "t": "Star Wars Zero Company",
          "s": "Bit Reactor/Electronic Arts"
        }
      ]
    },
    {
      "id": "deportes",
      "icono": "🏎️",
      "nombre": "Mejor juego de deportes y carreras",
      "nominados": [
        {
          "t": "EA Sports FC 27",
          "s": "EA Vancouver/EA Romania/EA Sports"
        },
        {
          "t": "Forza Horizon 6",
          "s": "Playground Games/Xbox Game Studios"
        },
        {
          "t": "Nintendo Switch Sports Resort",
          "s": "Nintendo"
        },
        {
          "t": "Screamer",
          "s": "Milestone"
        },
        {
          "t": "Star Wars: Galactic Racer",
          "s": "Fuse Games/Secret Mode"
        }
      ]
    },
    {
      "id": "multijugador",
      "icono": "👥",
      "nombre": "Mejor juego multijugador",
      "nominados": [
        {
          "t": "Big Walk",
          "s": "House House/Panic"
        },
        {
          "t": "Call of Duty: Modern Warfare 4",
          "s": "Infinity Ward/Activision"
        },
        {
          "t": "Gears of War: E-Day",
          "s": "The Coalition/Xbox Game Studios"
        },
        {
          "t": "Marathon",
          "s": "Bungie/Sony Interactive"
        },
        {
          "t": "Meccha Chameleon",
          "s": "Lemorion_1224"
        },
        {
          "t": "Orbitals",
          "s": "Shapefarm/Kepler"
        }
      ]
    },
    {
      "id": "adaptacion",
      "icono": "🎞️",
      "nombre": "Mejor adaptación de un juego",
      "nominados": [
        {
          "t": "Cyberpunk: Edgerunners 2",
          "s": "Studio Trigger/CD Projekt Red/Netflix"
        },
        {
          "t": "Fallout Temporada 2",
          "s": "Kilter Films/Bethesda/Amazon MGM Studios"
        },
        {
          "t": "Mortal Kombat II",
          "s": "New Line Cinema/Atomic Monster/Warner Bros. Pictures"
        },
        {
          "t": "Super Mario Galaxy: La Película",
          "s": "Illumination/Nintendo/Universal Pictures"
        },
        {
          "t": "Resident Evil",
          "s": "Constantin/PlayStation Productions/Columbia Pictures"
        }
      ],
      "tipo": "media"
    },
    {
      "id": "anticipado",
      "icono": "⏳",
      "nombre": "Juego más esperado",
      "nominados": [
        {
          "t": "Fable",
          "s": "Playground Games/Xbox Game Studios"
        },
        {
          "t": "Final Fantasy VII Revelation",
          "s": "Square Enix"
        },
        {
          "t": "God of War Laufey",
          "s": "Sony Santa Monica/Sony Interactive"
        },
        {
          "t": "Resident Evil Veronica",
          "s": "Capcom"
        },
        {
          "t": "The Witcher 4",
          "s": "CD Projekt Red"
        }
      ]
    }
  ]
};
