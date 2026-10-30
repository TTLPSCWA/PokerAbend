// English equivalents of built-in prompts. IDs, numerical answers and sources remain
// in the original catalogues. Custom prompts never pass through this catalogue.
const rows = (text) => Object.fromEntries(text.trim().split('\n').map((line) => {
  const [id, en, unitEn] = line.split('|');
  return [id, { en, ...(unitEn ? { unitEn } : {}) }];
}));
export const PARTY_ENGLISH = {
  schlagfertig: rows(`
a001|The worst name for a pet: ___
a002|The worst name for a restaurant: ___
a003|A bad name for a cruise ship: ___
a004|The worst name for a superhero: ___
a005|A fitting name for a band of cats: ___
a006|An unsuitable name for a bakery: ___
a007|A name for a coffee-scented perfume: ___
a008|A title for my fridge's autobiography: ___
a009|The title of a film nobody wants to see: ___
a010|The title of a love song about a toaster: ___
a011|The title of a song about a clothes horse: ___
a012|A name for a school of wizards who only know bad tricks: ___
a013|A name for a gym for sloths: ___
a014|A fitting name for a grumpy parrot: ___
a015|A name for spinach-flavoured ice cream: ___
a016|The worst name for a baby hippo: ___
a017|The worst name for a horse: ___
a018|The worst name for a fish: ___
a019|The worst excuse for being late: ___
a020|The worst excuse for not doing your homework: ___
a021|The worst excuse for cancelling a meeting: ___
a022|An excuse for why the cake has already disappeared: ___
a023|The worst excuse for not having done the washing-up: ___
a024|What to tell your boss when you have overslept: ___
a025|An excuse for why you unfortunately cannot dance: ___
a026|The last thing you should say in a job interview: ___
a027|An inappropriate answer to “Where do you see yourself in five years?”: ___
a028|A strength you should leave off your CV: ___
a029|The worst line at a company party: ___
a030|A sentence nobody wants to hear in the office: ___
a031|The worst opening for a presentation: ___
a032|An honest name for the break room: ___
a033|An unusual superpower: ___
a034|The most useless superpower: ___
a035|The most unnecessary invention of all time: ___
a036|An invention that improves cats' lives: ___
a037|An invention that makes Mondays more bearable: ___
a038|A gadget nobody needs but everybody wants: ___
a039|A household appliance that does not exist yet: ___
a040|An app guaranteed to get no downloads: ___
a041|A name for an app that tells you what to wear each morning: ___
a042|A feature every car should have: ___
a043|A rule every office should have: ___
a044|A holiday we still need: ___
a045|A new Olympic event: ___
a046|A new school subject everyone would love: ___
a047|A new sport for lazy people: ___
a048|The worst advertising slogan for toothpaste: ___
a049|An advertising slogan for a hotel nobody wants to book: ___
a050|An advertising slogan for pickle juice: ___
a051|An advertising slogan for an umbrella with a hole: ___
a052|The slogan of an airline where everything goes wrong: ___
a053|A slogan for an alarm clock that never rings: ___
a054|A slogan for the world's slowest delivery service: ___
a055|A slogan for socks that never match: ___
a056|A slogan for a T-shirt you only wear at home: ___
a057|A saying on an office coffee mug: ___
a058|What your dog really thinks when looking at you: ___
a059|What your cat really does at night: ___
a060|What the fridge thinks at three in the morning: ___
a061|What the satnav would love to say: ___
a062|What the alarm clock really wants to say in the morning: ___
a063|The first word of a parrot that repeats everything: ___
a064|What a pigeon thinks all day: ___
a065|What a sheep thinks while being counted: ___
a066|What the Moon says to the Sun in the evening: ___
a067|A sentence you should never say in a lift: ___
a068|The worst opening line when meeting someone: ___
a069|The sentence parents say most often in the supermarket: ___
a070|A sentence you would rather not hear in a restaurant: ___
a071|A sentence you would rather not hear at the hairdresser's: ___
a072|A sentence you would rather not hear on a plane: ___
a073|The worst sentence at a birthday party: ___
a074|A sentence said on every family holiday: ___
a075|A note on the fridge in a shared flat: ___
a076|The worst birthday present: ___
a077|The worst thing to bring to a party: ___
a078|A gift for someone who already has everything: ___
a079|The last thing you put in the shopping trolley: ___
a080|The first thing you forget when moving house: ___
a081|The first thing I would miss on a desert island: ___
a082|The last thing you would take to a desert island: ___
a083|A pointless object everyone has at home: ___
a084|Something found in every drawer: ___
a085|Something found in every coat pocket: ___
a086|The strangest souvenir from a holiday: ___
a087|The most inappropriate thing in your luggage: ___
a088|The strangest ice cream flavour: ___
a089|The worst pizza topping: ___
a090|A dish that only tastes good in the dark: ___
a091|The first dish I would serve an alien: ___
a092|The worst combination of food and drink: ___
a093|A name for a dish made from leftovers: ___
a094|The secret ingredient in Grandma's soup: ___
a095|The dessert that makes everything better: ___
a096|A sandwich nobody would order: ___
a097|A new animal made from two familiar ones – what is it called? ___
a098|What the hamster in its wheel is really planning: ___
a099|The ideal job for a giraffe: ___
a100|The ideal job for a penguin: ___
a101|A sloth's hobbies: ___
a102|A good piece of advice from Grandma that really is not: ___
a103|A piece of wisdom you could embroider on a doormat: ___
a104|Bad advice for your first day at work: ___
a105|Bad advice before an exam: ___
a106|The most unnecessary money-saving tip: ___
a107|A tip for getting out of bed more easily in the morning: ___
a108|A motto for the weekend: ___
a109|A motto for Monday: ___
a110|A motto for lazy people: ___
a111|A headline you would like to read in tomorrow's paper: ___
a112|An invented headline from the animal kingdom: ___
a113|An odd headline from a small town: ___
a114|Today's big news in Duckburg: ___
a115|A review of a one-star hotel: ___
a116|A restaurant review consisting of one sentence: ___
a117|A product review of an umbrella in a storm: ___
a118|Directions you should not follow: ___
a119|A train announcement nobody wants to hear: ___
a120|An announcement in the supermarket: ___
a121|An announcement from the pilot just before take-off: ___
a122|A sign that should exist: ___
a123|A sign in front of a meadow: ___
a124|A warning sign on the fridge: ___
a125|Instructions for a human being: ___
a126|The instruction manual for Monday: ___
a127|A warning on a packet of biscuits: ___
a128|The small print in a contract with Father Christmas: ___
a129|The house rules in the seven dwarfs' house: ___
a130|A rule in the early birds' club: ___
a131|A rule in the late risers' club: ___
a132|A rule in a shared flat for superheroes: ___
a133|The first rule in the snails' club: ___
a134|The mistake a wizard should never make: ___
a135|A spell that only half works: ___
a136|A spell for finding lost socks: ___
a137|A recipe for a good mood: ___
a138|A recipe for a bad mood: ___
a139|An ingredient no magic potion should be without: ___
a140|The first sentence of my novel about a hamster: ___
a141|The worst beginning for a fairy tale: ___
a142|A fairy-tale ending nobody expects: ___
a143|What the princess really says to the frog: ___
a144|A scene from a garden gnome's daily life: ___
a145|A cloud's daily routine: ___
a146|Father Christmas's summer diary: ___
a147|An item on a supervillain's to-do list: ___
a148|A hobby you would rather keep secret: ___
a149|A talent you only have in your sleep: ___
a150|A talent nobody needs: ___
a151|A talent that impresses someone you have just met: ___
a152|The name of a dance you can only do sitting down: ___
a153|The name of a new dance craze: ___
a154|A name for a mountain that is really a hill: ___
a155|A name for a cloud that is always unlucky: ___
a156|A name for a place you never want to be: ___
a157|The name of an island inhabited only by cats: ___
a158|A name for a river that flows backwards: ___
a159|A name for a country made entirely of one sofa: ___
a160|A name for a planet full of custard: ___
a161|A name for the alien moving in with us: ___
a162|The first thing an alien would say about us: ___
a163|What an alien does not understand about our everyday life: ___
a164|A question an alien asks in the supermarket: ___
a165|The first thing a time traveller has to explain: ___
a166|A souvenir from the future: ___
a167|An invention that is completely normal in the year 3000: ___
a168|A job that exists in the year 3000: ___
a169|A fashion trend that hopefully never returns: ___
a170|An item of clothing nobody needs: ___
a171|The worst name for a clothes shop: ___
a172|A Swedish-sounding name for a piece of furniture: ___
a173|A name for a shelf that keeps falling over: ___
a174|A name for the robot vacuum cleaner: ___
a175|A name for the printer that never works: ___
a176|A name for the Wi-Fi in a shared flat: ___
a177|A name for the office coffee machine: ___
a178|A name for the car that will not start: ___
a179|A name for a bicycle with flat tyres: ___
a180|The worst name for a dental practice – no toothache involved: ___
a181|A title for a documentary about paper clips: ___
a182|A name for a café where everything takes too long: ___
`),
  schaetzmeister: rows(`
s001|How many bones does an adult human have?|bones
s002|How many teeth are in a complete adult set, including wisdom teeth?|teeth
s003|How many teeth are in a complete set of milk teeth?|teeth
s004|How many chromosomes does a human body cell have?|chromosomes
s005|How many ribs does a human have in total?|ribs
s006|How many bones are in one human foot?|bones
s007|How many bones are in one human hand, including the wrist?|bones
s008|How many weeks does a pregnancy last when counted from the first day of the last period?|weeks
s009|How many neck vertebrae does a giraffe have?|vertebrae
s010|How many hearts does an octopus have?|hearts
s011|How many eyes does a honeybee have, counting compound and simple eyes?|eyes
s012|How many months is the gestation period of an African elephant?|months
s013|How many arms and tentacles does a squid have altogether?|arms
s014|How many keys does a standard piano have?|keys
s015|How many squares are on a chessboard?|squares
s016|How many chess pieces are on the board at the start, counting both colours?|pieces
s017|How many cards are in a Skat deck?|cards
s018|How many cards are in a standard UNO deck?|cards
s019|How many spaces are on a Monopoly board?|spaces
s020|How many properties, including streets, stations and utilities, are there in Monopoly?|properties
s021|How many numbers are on a European roulette wheel, including zero?|numbers
s022|How many tiles are in a double-six domino set, with values from zero to six?|tiles
s023|How many cells are in a classic Sudoku grid?|cells
s024|How many scoring categories are on a Kniffel sheet, excluding totals?|categories
s025|How many possible combinations are there in a six-out-of-49 lottery?|combinations
s026|How many different five-card hands can be dealt from a 52-card deck?|hands
s027|How many pips are on all six sides of a die altogether?|pips
s028|How long is a marathon?|km
s029|How wide is a football goal, measured between the posts?|m
s030|How high is a football goal, measured to the underside of the crossbar?|m
s031|How high is a basketball hoop?|m
s032|How high is the men's volleyball net?|m
s033|What is the diameter of a table tennis ball?|mm
s034|How far is the oche from the board in steel-tip darts?|m
s035|How high above the floor is the bullseye on a dartboard?|m
s036|What is the highest possible score with three darts?|points
s037|How many minutes is regulation time in a rugby union match?|minutes
s038|How many players are on the field for one rugby union team?|players
s039|How high is a tennis net at its centre?|cm
s040|How many seconds are in a day?|seconds
s041|How many seconds are in a 365-day year?|seconds
s042|How many minutes are in a week?|minutes
s043|How many days are a million seconds?|days
s044|How many years are a billion seconds, assuming 365 days per year?|years
s045|How many days are in a full 400-year cycle of the Gregorian calendar?|days
s046|How many metres are in a nautical mile?|m
s047|How many centimetres are in an inch?|cm
s048|At what temperature in Fahrenheit does water freeze?|°F
s049|At what temperature in Fahrenheit does water boil?|°F
s050|What is absolute zero in degrees Celsius?|°C
s051|What is the speed of sound in air at 20 °C?|m/s
s052|What is the standard acceleration due to gravity on Earth, rounded to two decimal places?|m/s²
s053|What is the speed of light in a vacuum, rounded to whole kilometres per second?|km/s
s054|How many pixels are in a Full HD image, 1920 × 1080?|pixels
s055|How long is an A4 sheet of paper?|mm
s056|How many A4 sheets have the same combined area as one A0 sheet?|sheets
s057|How long is a Euro pallet?|mm
s058|How many litres does a Euro-standard beer keg hold?|litres
s059|How tall is the original Mona Lisa, without its frame?|cm
s060|What is the average distance from the Earth to the Moon?|km
s061|What is the average distance from the Earth to the Sun, one astronomical unit, rounded to whole kilometres?|km
s062|What is the Earth's circumference at the equator?|km
s063|What is the Earth's diameter at the equator?|km
s064|What is the Sun's diameter?|km
s065|What is the temperature of the Sun's surface in Celsius, rounded to the nearest hundred?|°C
s066|How many seconds does light take to travel from the Sun to the Earth?|seconds
s067|How many seconds does light take to travel from the Moon to the Earth?|seconds
s068|How many moons does Mars have?|moons
s069|What percentage of air is oxygen, rounded to a whole number?|%
s070|What percentage of air is nitrogen, rounded to a whole number?|%
s071|What percentage of the Earth's surface is covered by water, rounded to a whole number?|%
s072|Roughly how many Earths would fit inside the Sun by volume?|Earths
s073|What is the average number of days from one new moon to the next?|days
s074|How many named elements are in the periodic table?|elements
s075|What is the atomic number of gold?|atomic number
s076|What is the atomic number of silver?|atomic number
s077|What is the atomic number of iron?|atomic number
s078|What is the atomic number of uranium?|atomic number
s079|What is the atomic number of copper?|atomic number
s080|How high is the Zugspitze?|m
s081|How high is the Brocken in the Harz mountains?|m
s082|How high is the Feldberg in the Black Forest?|m
s083|How high is the Grossglockner?|m
s084|How high is the Matterhorn?|m
s085|How high are the towers of Cologne Cathedral, rounded to whole metres?|m
s086|How high is the Berlin TV Tower, including its antenna?|m
s087|How high is the Statue of Liberty from its base to the torch, excluding its pedestal?|m
s088|How many steps lead all the way to the top of the Eiffel Tower?|steps
s089|How long is the Nürburgring Nordschleife?|km
s090|How many federal states does Germany have?|states
s091|How many countries share a border with Germany?|countries
s092|In what year was the Berlin Wall built?|year
s093|In what year did the Berlin Wall fall?|year
s094|In what year was Germany reunified?|year
s095|In what year was the Basic Law proclaimed, founding the Federal Republic of Germany?|year
s096|In what year did the first humans land on the Moon, on Apollo 11?|year
s097|In what year did Yuri Gagarin become the first human in space?|year
s098|In what year did the Titanic sink?|year
s099|In what year were the first modern Olympic Games held?|year
s100|In what year did Columbus reach the Americas on his first voyage?|year
s101|In what year was the Bastille stormed?|year
s102|In what year did the First World War begin?|year
s103|In what year did the Second World War begin?|year
s104|In what year did the Second World War end in Europe?|year
s105|In what year did Germany's first railway open between Nuremberg and Fürth?|year
s106|In what year were euro notes and coins introduced in Germany?|year
s107|In what year did the Wright brothers make their first powered flight?|year
s108|In what year did the Chernobyl nuclear disaster occur?|year
s109|In what year did Martin Luther traditionally publish his 95 Theses?|year
s110|In what year was the Peace of Westphalia signed?|year
s111|In what year was Charlemagne crowned emperor?|year
s112|In what year AD did the Battle of the Teutoburg Forest take place?|year AD
s113|In what year AD was Pompeii buried by Mount Vesuvius?|year AD
s114|In what year was the first football World Cup held?|year
s115|In what year did the first season of Germany's football Bundesliga begin?|year
s116|In what year was the Deutschmark introduced?|year
s117|In what year was Wikipedia founded?|year
s118|In what year was Google founded?|year
s119|In what year was the first iPhone unveiled?|year
s120|In what year was the first Tagesschau news programme broadcast on television?|year
s121|In what year was the first Tatort episode broadcast?|year
s122|In what year was Wolfgang Amadeus Mozart born?|year
s123|In what year was Johann Wolfgang von Goethe born?|year
s124|In what year was Albert Einstein born?|year
s125|In what year was Goethe's Faust, Part One published?|year
s126|In what year was Harry Potter and the Philosopher's Stone published in the UK?|year
s127|How many symphonies did Ludwig van Beethoven compose?|symphonies
s128|How many tales are in the Brothers Grimm's final 1857 edition of Children's and Household Tales?|tales
s129|How many letters are in the German alphabet when Ä, Ö, Ü and ß are included?|letters
`),
  werhatdasgesagt: rows(`
f001|What was your first mobile phone?
f002|What would you buy first with one million euros?
f003|Which animal would you like to be for a day?
f004|What was your favourite food as a child?
f005|Which series did you last binge-watch?
f006|What does your perfect breakfast look like?
f007|Which song do you secretly sing along to?
f008|What was your favourite film as a child?
f009|What was your first bicycle or car?
f010|What did you want to be when you grew up?
f011|Which superpower would you like to have?
f012|Where would you travel tomorrow if anything were possible?
f013|What is your favourite season?
f014|Which pizza do you like ordering most?
f015|What is your favourite way to spend a free Sunday?
f016|Which board game do you like most?
f017|Which school subject did you like least?
f018|Which school subject did you like most?
f019|What did you collect as a child?
f020|What is your favourite smell?
f021|What is your favourite word?
f022|Which instrument would you like to be able to play?
f023|Which film could you always watch on the sofa?
f024|Which ice cream flavour do you almost always choose?
f025|What do you eat when you do not feel like cooking?
f026|Which famous person would you like to have dinner with?
f027|Which toy did you love as a child?
f028|What was your favourite place as a child?
f029|What is your favourite holiday?
f030|Beach or mountains – and why?
f031|What would you take to a desert island?
f032|Which talent would you like to have?
f033|Which language would you like to speak fluently?
f034|What is your favourite evening drink?
f035|What annoys you most in traffic?
f036|What is your favourite film-night snack?
f037|Which video game have you played the longest?
f038|What hairstyle did you used to have?
f039|What is your favourite place in your town?
f040|Which app do you use most often?
f041|Which song can you not get out of your head?
f042|What costume would you wear to a party?
f043|Which dish do you cook best?
f044|What would you like to learn?
f045|What is your favourite fairy tale?
f046|What is your favourite pizza topping?
f047|Which animal do you really dislike?
f048|What did you most recently do for the first time?
f049|What is your favourite book?
f050|Which time period would you like to travel to?
f051|What is your favourite sound?
f052|What nickname did you have as a child?
f053|What is your favourite way to travel?
f054|What has been your best holiday so far?
f055|What is your favourite piece of furniture?
f056|What do you always bring to a party?
f057|What is your favourite party game?
f058|Which sweet from your childhood do you miss?
f059|What do you always buy too much of at the supermarket?
f060|What is your favourite summer drink?
f061|Which gadget could you no longer live without?
f062|What is your favourite joke?
f063|Which excuse do you use most often?
f064|What would you wish for if it cost nothing?
f065|Which fairy-tale character would you be?
f066|Which film do you almost know by heart?
f067|What was your favourite cuddly toy called?
f068|What is your favourite cake?
f069|Which city would you like to visit?
f070|What was the first concert you attended?
f071|Which word do you say too often?
f072|Who is your favourite superhero?
f073|Which sport would you like to be good at?
f074|What is your favourite weather?
f075|What do you do on a rainy day?
f076|What is your favourite day of the week?
f077|Which quality do you value in friends?
f078|What do you do when you are bored?
f079|Which game did you most enjoy as a child?
f080|Which plant would you like to have in your garden?
f081|What is your favourite zoo animal?
f082|What is your favourite vegetable?
f083|What is your favourite fruit?
f084|How do you take your coffee or tea?
f085|What is your favourite sound in nature?
f086|Where do you most enjoy watching films?
f087|What is your dream vehicle – a car, bicycle or something else entirely?
f088|What do you shout when something goes wrong?
f089|What was your favourite school-canteen meal?
f090|What music do you listen to while tidying up?
f091|What do you most enjoy getting up for in the morning?
f092|Which country surprised you most?
f093|Which meal could you eat every day?
f094|Where do you most enjoy reading?
f095|Which hobby would you like to try?
f096|What does your perfect Saturday evening look like?
f097|Which word describes you best?
f098|What is your favourite card game?
f099|Which cartoon series did you love as a child?
f100|What is the strangest thing you have ever eaten?
f101|What was the last gift you were delighted to receive?
f102|What is your favourite month?
f103|What is your favourite item of clothing?
f104|What is your favourite spot in the house?
f105|What is your lucky number?
f106|Which animal would you like as a pet?
f107|What was your favourite song as a teenager?
f108|What is your favourite breakfast drink?
f109|Which forest animal would you be?
f110|What would you try first at a theme park?
f111|Which dessert do you always order?
f112|What was your favourite activity in PE?
`),
};

export const bilingual = (game, catalogue) => catalogue.map((q) => ({ ...q, ...PARTY_ENGLISH[game]?.[q.id] }));
