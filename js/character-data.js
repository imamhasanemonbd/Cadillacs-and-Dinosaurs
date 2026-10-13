/**
 * Cadillacs and Dinosaurs - Character Data & Moves Database
 * Capcom CPS-1 Arcade Reference (1993)
 */

const ARCADE_CHARACTERS = [
    {
        id: "mustapha",
        name: "Mustapha Cairo",
        alias: "The Flying Kick King",
        quote: "Let's roll, baby!",
        avatar: "⚡",
        color: "#fbbf24",
        stats: {
            speed: 5,
            power: 3,
            defense: 3,
            recovery: 4
        },
        description: "An engineer and Jack's best friend. Famously the community's favorite character due to his unmatched aerial dominance, swift reach, and devastating flying kicks.",
        signatureMoves: [
            {
                name: "Flying Kick (Iconic)",
                input: "→ → + Jump + Attack",
                type: "aerial",
                description: "Mustapha's game-breaking crowd clearer. Launches horizontally across the screen with huge damage and invincibility frames."
            },
            {
                name: "Somersault Flash Kick",
                input: "↓ ↑ + Attack",
                type: "anti-air",
                description: "A rising vertical backflip kick that catches aerial enemies and boss wakeups."
            },
            {
                name: "Tornado Spin Kick",
                input: "Attack + Jump (A + B)",
                type: "special",
                description: "Emergency spin kick hitting enemies on all 360 degrees. Consumes a tiny sliver of HP."
            },
            {
                name: "Rapid Fist Combo",
                input: "Attack × 4",
                type: "combo",
                description: "Four rapid strikes finishing with a heavy forward right hook."
            }
        ]
    },
    {
        id: "jack",
        name: "Jack Tenrec",
        alias: "The Mechanic Hero",
        quote: "Nobody messes with my Cadillac!",
        avatar: "🔧",
        color: "#38bdf8",
        stats: {
            speed: 3,
            power: 4,
            defense: 4,
            recovery: 3
        },
        description: "The main protagonist, mechanic, and shaman. Jack possesses perfectly balanced all-around attributes with solid knockout power and sliding kicks.",
        signatureMoves: [
            {
                name: "Slide Kick",
                input: "↓ + Jump",
                type: "ground",
                description: "Slides low beneath gunfire and strikes enemy shins, tripping them instantly."
            },
            {
                name: "Upper Dragon Punch",
                input: "↓ ↑ + Attack",
                type: "anti-air",
                description: "A fierce rising uppercut that launches heavies and dinosaurs into the air."
            },
            {
                name: "Spinning Upper Blow",
                input: "Attack + Jump (A + B)",
                type: "special",
                description: "Two-stage revolving punch that knocks away surrounding goons."
            },
            {
                name: "Dash Roundhouse",
                input: "→ → + Jump + Attack",
                type: "aerial",
                description: "A sprinting leap kick that bowls over groups of poachers."
            }
        ]
    },
    {
        id: "hannah",
        name: "Hannah Dundee",
        alias: "The Agile Diplomat",
        quote: "Don't underestimate me, boys!",
        avatar: "🗡️",
        color: "#f43f5e",
        stats: {
            speed: 5,
            power: 2,
            defense: 3,
            recovery: 5
        },
        description: "A skilled scientist and diplomat. Hannah has the fastest item and weapon attack speed in the game, capable of tearing through enemies with knives and bats.",
        signatureMoves: [
            {
                name: "Triangle Wall Spring",
                input: "Jump toward wall + Jump",
                type: "mobility",
                description: "Springs off the edge of the screen to reposition behind enemy ranks."
            },
            {
                name: "Knife Flurry (Item Passive)",
                input: "Pick up Knife + Attack",
                type: "weapon",
                description: "Stabs twice as fast as other characters and can chain infinite slice attacks."
            },
            {
                name: "Somersault Flip",
                input: "↓ ↑ + Attack",
                type: "anti-air",
                description: "Agile acrobatic flip kick that juggles airborne targets."
            },
            {
                name: "Spiral Cartwheel",
                input: "Attack + Jump (A + B)",
                type: "special",
                description: "High-speed spinning cartwheel escape with complete invincibility."
            }
        ]
    },
    {
        id: "mess",
        name: "Mess O'Bradovich",
        alias: "The Colossus",
        quote: "Time to smash some heads!",
        avatar: "💥",
        color: "#a855f7",
        stats: {
            speed: 2,
            power: 5,
            defense: 5,
            recovery: 2
        },
        description: "A mountain of raw muscle and brute force. Mess is slow on his feet, but his grapple throws, body splashes, and piledrivers inflict astronomical damage.",
        signatureMoves: [
            {
                name: "Piledriver Slam",
                input: "Grab Enemy + Jump + Attack",
                type: "grapple",
                description: "Leaps into the stratosphere and drives the victim head-first into the concrete."
            },
            {
                name: "Flying Body Splash",
                input: "→ → + Jump + Attack",
                type: "aerial",
                description: "Crushes multiple dinosaurs and bosses under 300 lbs of airborne bulk."
            },
            {
                name: "Meat Crusher Spin",
                input: "Attack + Jump (A + B)",
                type: "special",
                description: "Wild flailing double-fist spin that batters anyone in range."
            },
            {
                name: "Seismic Headbutt",
                input: "Grab Enemy + Attack",
                type: "grapple",
                description: "Delivers bone-crushing skull hits before tossing the enemy across screen."
            }
        ]
    }
];

const ARCADE_WEAPONS = [
    { name: "M16 Assault Rifle", icon: "🔫", desc: "16-round burst rifle. Obliterates waves of enemies and stuns dinosaurs." },
    { name: "Shotgun", icon: "💥", desc: "Wide-spread buckshot that knocks down whole groups at medium range." },
    { name: "Colt .45 Pistol", icon: "🎯", desc: "Accurate sidearm with 6 bullets. Rapid tap fires quick stopping shots." },
    { name: "UZI Submachine Gun", icon: "⚡", desc: "High rate of fire spray weapon; rips through poachers." },
    { name: "Hand Grenade", icon: "💣", desc: "Explosive projectile. Throw or drop near sleeping dinos for massive blast radius." },
    { name: "1958 Cadillac Eldorado", icon: "🚘", desc: "Stage 3 Vehicle Stage! Steer the car and run over waves of armed bikers!" }
];

window.ARCADE_CHARACTERS = ARCADE_CHARACTERS;
window.ARCADE_WEAPONS = ARCADE_WEAPONS;
