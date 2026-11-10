// ART-T1: Kartenwelten für UNO (farbenchaos), Skip-Bo (stapelrennen) und Phase 10 (zehnetappen).
// Nur Darstellung: Der Host wählt eine Welt für den ganzen Raum; Regeln, Karten und Wertung bleiben gleich.
// Wird vom Server (Prüfung der Auswahl) und vom Browser (Auswahl im Host-Menü) geladen.
// cols: vier Weltfarben [Name, Farbe, Motiv]. Skip-Bo nutzt sie der Reihe nach für 1–4, 5–8, 9–12 und Joker;
// UNO und Phase 10 ordnen sie über den Farbton Rot, Gelb, Grün und Blau zu (roles()), damit „Rot“ rötlich bleibt.
// Die Vorbilder (bekannte Spiele) stehen nur in docs/design/CARD_WORLDS.md, nie in der Oberfläche.
export const CARD_WORLD_GAMES = ['farbenchaos', 'stapelrennen', 'zehnetappen'];
export const WORLDS = [
  {"id":"U-01","game":"farbenchaos","name":"Zaubersaal","world":"Schule der Zauberei","frame":"gilded","font":"Cinzel","sky":["#1a1440","#4a2a6a"],"ter":"castle","par":"stars","tbl":"#5a1a22","back":"owl","cols":[["Mut","#d4252e","wand"],["Weisheit","#2a5bd7","owl"],["Treue","#e8a91a","book"],["List","#1f9a52","potion"]]},
  {"id":"U-02","game":"farbenchaos","name":"Hexerpfad","world":"Monsterjäger","frame":"leather","font":"Cinzel","sky":["#2a2f36","#5a4a3a"],"ter":"mountains","par":"embers","tbl":"#3a2a1c","back":"wolf","cols":[["Silber","#7f95ab","wolf"],["Blut","#c0182e","sword"],["Gift","#3f9b3a","potion"],["Zeichen","#e09a1a","medallion"]]},
  {"id":"U-03","game":"farbenchaos","name":"Neonstadt 2099","world":"Neonmetropole","frame":"neon","font":"Orbitron","sky":["#0c0624","#3a0f4a"],"ter":"city","par":"grid","tbl":"#140b2e","back":"chip","cols":[["Pink","#ff2e88","visor"],["Gift","#39e87a","chip"],["Gelb","#ffe600","bolt"],["Cyan","#12a8ff","skyline"]]},
  {"id":"U-04","game":"farbenchaos","name":"Blockwelt","world":"Würfelwelt","frame":"voxel","font":"Press Start 2P","sky":["#7ec8ff","#bfe6ff"],"ter":"hills","par":"pixels","tbl":"#5a3a20","back":"grassblock","cols":[["Gras","#4fb52e","grassblock"],["Diamant","#2ec4d6","ore"],["Lava","#ff5a1a","flame"],["Gold","#f2c21a","pickaxe"]]},
  {"id":"U-05","game":"farbenchaos","name":"Aschenreich","world":"Dunkle Fantasy","frame":"stone","font":"Cinzel","sky":["#3a2a1a","#8a5a2a"],"ter":"castle","par":"embers","tbl":"#2a221c","back":"goldtree","cols":[["Gnade","#d4a537","goldtree"],["Klinge","#a8281e","sword"],["Ring","#4f6f9a","ring"],["Moos","#4f8f3a","leaf"]]},
  {"id":"U-06","game":"farbenchaos","name":"Hüpfwelt","world":"Jump-and-Run","frame":"cartoon","font":"Lilita One","sky":["#5cc6ff","#bdeaff"],"ter":"hills","par":"none","tbl":"#2f8a3a","back":"mushroom","cols":[["Pilz","#e5262d","mushroom"],["Münze","#f2b80f","coin"],["Stern","#2b7de9","star"],["Blume","#2fae4a","flower"]]},
  {"id":"U-07","game":"farbenchaos","name":"Taschenmonster","world":"Sammelmonster","frame":"holo","font":"Fredoka","sky":["#3a8ad6","#9fd8ff"],"ter":"hills","par":"sparks","tbl":"#26406a","back":"monster","cols":[["Feuer","#ff5a2a","monster"],["Wasser","#2a9dff","monster"],["Pflanze","#3fbf4a","monster"],["Blitz","#ffc81a","bolt"]]},
  {"id":"U-08","game":"farbenchaos","name":"Heldenarena","world":"Teamarena","frame":"steel","font":"Righteous","sky":["#ff9a4a","#ffd8a0"],"ter":"city","par":"sparks","tbl":"#2a3340","back":"emblem","cols":[["Angriff","#ff7a1a","emblem"],["Tank","#2a8ad8","shield"],["Heilung","#ff3d6e","heart"],["Tempo","#3fbf63","bolt"]]},
  {"id":"U-09","game":"farbenchaos","name":"Lichtwald","world":"Märchenwald","frame":"storybook","font":"Cinzel","sky":["#1d4a5a","#6ab89a"],"ter":"mountains","par":"stars","tbl":"#2a4a2a","back":"lantern","cols":[["Wald","#2fae7a","leaf"],["Quelle","#2a8ae0","gem"],["Glut","#ff6a2a","lantern"],["Schrein","#e8b21a","temple"]]},
  {"id":"U-10","game":"farbenchaos","name":"Insel-Showdown","world":"Battle Royale","frame":"crystal","font":"Bangers","sky":["#4aa8ff","#bfe0ff"],"ter":"sea","par":"none","tbl":"#3a5a8a","back":"parachute","cols":[["Absprung","#2a7dff","parachute"],["Beute","#3fbf4a","crate"],["Sturm","#ff3d6e","storm"],["Bauen","#f2b80f","house"]]},
  {"id":"SB-01","game":"stapelrennen","name":"Montagewerk 12","world":"Fabrik","frame":"steel","font":"Black Ops One","sky":["#3a4450","#7a8a96"],"ter":"floor","par":"sparks","tbl":"#2a3038","back":"gear","cols":[["Stufe 1–4","#f2b51e","gear"],["Stufe 5–8","#2a8ad8","crate"],["Stufe 9–12","#ff5a1a","crane"],["Joker","#3fbf63","robot"]]},
  {"id":"SB-02","game":"stapelrennen","name":"Klötzchenstadt","world":"Steckbausteine","frame":"cartoon","font":"Lilita One","sky":["#7ec8ff","#d6f0ff"],"ter":"city","par":"none","tbl":"#d43a2a","back":"brick","cols":[["Stufe 1–4","#2a7de9","brick"],["Stufe 5–8","#2fae4a","house"],["Stufe 9–12","#e5262d","crane"],["Joker","#f2c21a","cone"]]},
  {"id":"SB-03","game":"stapelrennen","name":"Inselkolonie","world":"Handelsinseln","frame":"parchment","font":"Cinzel","sky":["#5ab8e8","#c6ecff"],"ter":"sea","par":"none","tbl":"#1f4a6a","back":"ship","cols":[["Stufe 1–4","#1f6fb0","ship"],["Stufe 5–8","#3f9b3a","windmill"],["Stufe 9–12","#c0402a","house"],["Joker","#d4a537","anchor"]]},
  {"id":"SB-04","game":"stapelrennen","name":"Orbitalstation","world":"Weltraumbau","frame":"crystal","font":"Orbitron","sky":["#0a0a2a","#2a1a5a"],"ter":"none","par":"stars","tbl":"#141a3a","back":"station","cols":[["Stufe 1–4","#2ad0ff","station"],["Stufe 5–8","#ff6a3a","planet"],["Stufe 9–12","#c24dff","rocket"],["Joker","#3fdf8a","alien"]]},
  {"id":"SB-05","game":"stapelrennen","name":"Tiefseebasis","world":"Unterwasserbasis","frame":"neon","font":"Righteous","sky":["#062a3a","#0a5a6a"],"ter":"sea","par":"bubbles","tbl":"#06303a","back":"submarine","cols":[["Stufe 1–4","#00d5c0","submarine"],["Stufe 5–8","#ff7ab8","fish"],["Stufe 9–12","#ffb627","octo"],["Joker","#7a6aff","shell"]]},
  {"id":"SB-06","game":"stapelrennen","name":"Stadtplaner","world":"Städtebau","frame":"blueprint","font":"Righteous","sky":["#1f5fa8","#4a8ad6"],"ter":"city","par":"grid","tbl":"#173f6e","back":"skyline","cols":[["Stufe 1–4","#ffd23f","house"],["Stufe 5–8","#3fdf8a","car"],["Stufe 9–12","#ff6a5a","skyline"],["Joker","#ffffff","crane"]]},
  {"id":"SB-07","game":"stapelrennen","name":"Freizeitpark","world":"Parkbau","frame":"storybook","font":"Lilita One","sky":["#ffb0d0","#ffe8a0"],"ter":"hills","par":"none","tbl":"#2f8a5a","back":"coaster","cols":[["Stufe 1–4","#ff3d6e","balloon"],["Stufe 5–8","#2a9dff","coaster"],["Stufe 9–12","#ffb627","icecream"],["Joker","#9b4dff","flag"]]},
  {"id":"SB-08","game":"stapelrennen","name":"Raketenwerft","world":"Raumfahrt-Basteln","frame":"cartoon","font":"Bangers","sky":["#0e1a3a","#3a5a9a"],"ter":"mountains","par":"stars","tbl":"#2a3a5a","back":"rocket","cols":[["Stufe 1–4","#3fbf63","gear"],["Stufe 5–8","#ff8a1a","rocket"],["Stufe 9–12","#2a9dff","moon"],["Joker","#f2c21a","comet"]]},
  {"id":"SB-09","game":"stapelrennen","name":"Burgenbau","world":"Mittelalter-Aufbau","frame":"stone","font":"Cinzel","sky":["#6a8ab8","#c8d8e8"],"ter":"castle","par":"none","tbl":"#4a3a2a","back":"tower","cols":[["Stufe 1–4","#2a5bd7","tower"],["Stufe 5–8","#c0282e","shield"],["Stufe 9–12","#2f9a4a","castle"],["Joker","#d9b56a","sword"]]},
  {"id":"SB-10","game":"stapelrennen","name":"Zwergenschmiede","world":"Bergbau","frame":"leather","font":"Cinzel","sky":["#1a1410","#4a2a1a"],"ter":"mountains","par":"embers","tbl":"#2a1a10","back":"anvil","cols":[["Stufe 1–4","#ff8a1a","lantern"],["Stufe 5–8","#3ad0e0","gem"],["Stufe 9–12","#d4a537","pickaxe"],["Joker","#c0282e","anvil"]]},
  {"id":"P-01","game":"zehnetappen","name":"Unterweltflucht","world":"Mythen-Kammern","frame":"gilded","font":"Cinzel","sky":["#2a0a10","#7a1a1a"],"ter":"mountains","par":"embers","tbl":"#3a0a10","back":"flame","cols":[["Flamme","#ff4a2a","flame"],["Quelle","#2fc8a0","potion"],["Seele","#4a6dff","gem"],["Krone","#f2c21a","crown"]]},
  {"id":"P-02","game":"zehnetappen","name":"Gipfelsturm","world":"Bergsteigen","frame":"voxel","font":"Press Start 2P","sky":["#2a1a5a","#c86aa0"],"ter":"mountains","par":"stars","tbl":"#2a2048","back":"strawberry","cols":[["Beere","#ff3d55","strawberry"],["Gipfel","#3a8ae0","mountain"],["Stern","#f2c21a","star"],["Lager","#3fbf63","tent"]]},
  {"id":"P-03","game":"zehnetappen","name":"Testkammer X","world":"Labor-Rätsel","frame":"frost","font":"Orbitron","sky":["#dfe6ec","#aab8c4"],"ter":"floor","par":"grid","tbl":"#7a8a96","back":"portal","cols":[["Blau","#2a8ae0","portal"],["Orange","#ff8a1a","portal"],["Würfel","#3fbf63","cube"],["Kern","#e0384a","robot"]]},
  {"id":"P-04","game":"zehnetappen","name":"Kerkertiefe","world":"Dungeon","frame":"stone","font":"Cinzel","sky":["#14080a","#4a1010"],"ter":"castle","par":"embers","tbl":"#1a0c0c","back":"sword","cols":[["Blut","#c0182e","sword"],["Mana","#2a5bd7","potion"],["Gift","#3f9b3a","flame"],["Beute","#e0a020","gem"]]},
  {"id":"P-05","game":"zehnetappen","name":"Maschinenjagd","world":"Wildnis und Maschinen","frame":"leather","font":"Righteous","sky":["#f2a65a","#ffd8a0"],"ter":"mountains","par":"none","tbl":"#4a3a2a","back":"mech","cols":[["Jagd","#ff6a2a","mech"],["Wald","#2fae7a","leaf"],["Sonne","#f2c21a","sun"],["Funke","#2ac8ff","bolt"]]},
  {"id":"P-06","game":"zehnetappen","name":"Kart-Grand-Prix","world":"Funracer","frame":"cartoon","font":"Lilita One","sky":["#5cc6ff","#d6f0ff"],"ter":"hills","par":"none","tbl":"#3a3a44","back":"kart","cols":[["Rot","#e5262d","kart"],["Pokal","#f2b80f","trophy"],["Ziel","#2b7de9","flag"],["Banane","#2fae4a","banana"]]},
  {"id":"P-07","game":"zehnetappen","name":"Wüstentempel","world":"Schatzsuche","frame":"parchment","font":"Cinzel","sky":["#f2b86a","#ffe2a8"],"ter":"mountains","par":"none","tbl":"#8a6a3a","back":"temple","cols":[["Tempel","#c0602a","temple"],["Juwel","#2fae7a","gem"],["Sonne","#f2b80f","sun"],["Turm","#2a6ad0","castle"]]},
  {"id":"P-08","game":"zehnetappen","name":"Sternenexpedition","world":"Weltraum-Saga","frame":"neon","font":"Orbitron","sky":["#06081a","#1a2a5a"],"ter":"none","par":"stars","tbl":"#0a1028","back":"planet","cols":[["Nova","#ff3d6e","planet"],["Nebel","#3fdf8a","ufo"],["Pulsar","#3a6aff","rocket"],["Sonne","#ffb627","visor"]]},
  {"id":"P-09","game":"zehnetappen","name":"Küchenchaos","world":"Koch-Party","frame":"storybook","font":"Fredoka","sky":["#ffd8a0","#fff0d0"],"ter":"floor","par":"none","tbl":"#c8a070","back":"pan","cols":[["Pfanne","#e5322a","pan"],["Törtchen","#f2b80f","cupcake"],["Donut","#3a7bff","donut"],["Kirsche","#2fae4a","cherry"]]},
  {"id":"P-10","game":"zehnetappen","name":"Rhythmus-Tour","world":"Musikspiel","frame":"holo","font":"Righteous","sky":["#1a0a3a","#5a1a6a"],"ter":"city","par":"sparks","tbl":"#1a0a2a","back":"guitar","cols":[["Gitarre","#ff3d6e","guitar"],["Trommel","#2ac8ff","drum"],["Mikro","#ffd23f","mic"],["Note","#3fdf8a","note"]]},
  {"id":"X-01","game":"all","name":"Winterball","world":"Weihnacht in der Zauberschule","frame":"gilded","font":"Cinzel","sky":["#0e1a3a","#3a2a6a"],"ter":"castle","par":"snow","tbl":"#5a1a22","back":"owl","cols":[["Rot","#d4252e","gift"],["Blau","#2a5bd7","owl"],["Gold","#e8a91a","candle"],["Grün","#1f9a52","wand"]]},
  {"id":"X-02","game":"all","name":"Frostjäger","world":"Winter-Fantasy","frame":"steel","font":"Cinzel","sky":["#3a4a5a","#9ab0c4"],"ter":"mountains","par":"snow","tbl":"#2a3440","back":"wolf","cols":[["Tanne","#3f9b3a","tree"],["Blut","#c0182e","sword"],["Laterne","#e09a1a","lantern"],["Wolf","#7f95ab","wolf"]]},
  {"id":"X-03","game":"all","name":"Neon-Schnee","world":"Weihnachten 2099","frame":"neon","font":"Orbitron","sky":["#0c0624","#2a1050"],"ter":"city","par":"snow","tbl":"#140b2e","back":"gift","cols":[["Pink","#ff2e88","gift"],["Cyan","#00d5f0","snowflake"],["Gelb","#ffe600","bell"],["Grün","#3fff8a","skyline"]]},
  {"id":"X-04","game":"all","name":"Schneeblöcke","world":"Winter in der Würfelwelt","frame":"voxel","font":"Press Start 2P","sky":["#9fd0ff","#e8f6ff"],"ter":"hills","par":"snow","tbl":"#5a3a20","back":"snowman","cols":[["Rot","#e0322a","gift"],["Eis","#4ac8e8","ore"],["Tanne","#2f8a3a","tree"],["Gold","#f2c21a","pickaxe"]]},
  {"id":"X-05","game":"all","name":"Polarstation","world":"Eiswüste","frame":"frost","font":"Orbitron","sky":["#bfe6ff","#ffffff"],"ter":"sea","par":"snow","tbl":"#2a5a7a","back":"iceberg","cols":[["Eis","#2a9dff","iceberg"],["Station","#ff6a2a","station"],["Licht","#f2b80f","lantern"],["Polar","#3fbf8a","snowflake"]]},
  {"id":"X-06","game":"all","name":"Weihnachtswerkstatt","world":"Fabrik im Advent","frame":"blueprint","font":"Black Ops One","sky":["#1f5fa8","#4a8ad6"],"ter":"floor","par":"snow","tbl":"#173f6e","back":"gift","cols":[["Paket","#e5262d","gift"],["Zahnrad","#f2c21a","gear"],["Roboter","#3fdf8a","robot"],["Geschenkband","#2a7de9","cane"]]},
  {"id":"X-07","game":"all","name":"Winterdorf","world":"Gemütliches Dorf","frame":"storybook","font":"Lilita One","sky":["#7ab0e0","#e8f4ff"],"ter":"hills","par":"snow","tbl":"#6a3a1c","back":"house","cols":[["Hof","#d43a2a","house"],["Plätzchen","#c07a3a","cookie"],["Tanne","#2f8a3a","tree"],["Schlitten","#2a7de9","sleigh"]]},
  {"id":"X-08","game":"all","name":"Eiskönigreich","world":"Kristallschloss","frame":"crystal","font":"Cinzel","sky":["#1a3a6a","#9fd8ff"],"ter":"mountains","par":"snow","tbl":"#1a3a6a","back":"snowflake","cols":[["Kristall","#2fc89a","snowflake"],["Krone","#e8b21a","crown"],["Schloss","#2a5bd7","castle"],["Juwel","#e0284a","diamond"]]},
  {"id":"X-09","game":"all","name":"Lebkuchen-Kart","world":"Weihnachts-Rennen","frame":"cartoon","font":"Bangers","sky":["#ffb0b0","#fff0e0"],"ter":"hills","par":"snow","tbl":"#8a4a2a","back":"ginger","cols":[["Kart","#e5262d","kart"],["Lebkuchen","#c07a3a","ginger"],["Glasur","#2a8ae0","cane"],["Plätzchen","#2fae4a","cookie"]]},
  {"id":"X-10","game":"all","name":"Wintermonster","world":"Sammelmonster im Schnee","frame":"holo","font":"Fredoka","sky":["#4a8ad6","#d6ecff"],"ter":"hills","par":"snow","tbl":"#26406a","back":"monster","cols":[["Feuer","#ff5a2a","monster"],["Eis","#2fc8a0","snowman"],["Rentier","#c07a3a","reindeer"],["Kugel","#3a6aff","ornament"]]}
];

// Schriften (OFL, selbst gehostet unter /fonts/worlds/)
export const FONTS = {
  Cinzel: 'cinzel', Orbitron: 'orbitron', 'Press Start 2P': 'press-start-2p', Bangers: 'bangers',
  'Lilita One': 'lilita-one', 'Black Ops One': 'black-ops-one', Righteous: 'righteous', Fredoka: 'fredoka',
};

export const worldsFor = (game) => (CARD_WORLD_GAMES.includes(game) ? WORLDS.filter((w) => w.game === game || w.game === 'all') : []);
export const worldOf = (game, id) => (typeof id === 'string' ? worldsFor(game).find((w) => w.id === id) || null : null);

// Farbton 0–360 einer #rrggbb-Farbe
export function hue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const TARGET = { r: 0, y: 50, g: 135, b: 215 };
const PERMS = (list) => (list.length < 2 ? [list] : list.flatMap((x, i) => PERMS([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p])));
// Spielfarbe (r, y, g, b) -> Index der Weltfarbe; kleinste Summe der Farbtonabstände
export function roles(world) {
  const dist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  const hues = world.cols.map((c) => hue(c[1]));
  let best = null, cost = Infinity;
  for (const p of PERMS([0, 1, 2, 3])) {
    const sum = ['r', 'y', 'g', 'b'].reduce((s, k, i) => s + dist(hues[p[i]], TARGET[k]), 0);
    if (sum < cost) { cost = sum; best = p; }
  }
  return { r: best[0], y: best[1], g: best[2], b: best[3] };
}
