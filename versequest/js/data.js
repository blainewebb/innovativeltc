/* Verse Quest — every verse and trivia question in the game.

   VERSES are NIV (2011) text, in the order the path teaches them: short and
   familiar first, longer ones later. Scripture punctuation is kept exactly as
   printed, including its dashes and quote marks. The game ignores punctuation
   and capital letters when checking answers, so kids never lose a point over a
   comma.

   NIV quoting rule (Biblica): up to 500 verses without written permission, as
   long as they are not a whole book of the Bible and not 25% or more of the
   work. This list is well under that. The notice in NIV_NOTICE has to show in
   the app, and does on the title screen and the grown-ups screen. */

export const VERSION = '1.0.0';

export const NIV_NOTICE = 'Scripture quotations taken from The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.';

export const VERSES = [
  { id: 'gen-1-1',     ref: 'Genesis 1:1',            text: 'In the beginning God created the heavens and the earth.' },
  { id: '1jn-4-19',    ref: '1 John 4:19',            text: 'We love because he first loved us.' },
  { id: 'ps-56-3',     ref: 'Psalm 56:3',             text: 'When I am afraid, I put my trust in you.' },
  { id: 'ps-23-1',     ref: 'Psalm 23:1',             text: 'The LORD is my shepherd, I lack nothing.' },
  { id: 'lk-6-31',     ref: 'Luke 6:31',              text: 'Do to others as you would have them do to you.' },
  { id: 'heb-13-8',    ref: 'Hebrews 13:8',           text: 'Jesus Christ is the same yesterday and today and forever.' },
  { id: 'ps-119-105',  ref: 'Psalm 119:105',          text: 'Your word is a lamp for my feet, a light on my path.' },
  { id: 'rom-3-23',    ref: 'Romans 3:23',            text: 'for all have sinned and fall short of the glory of God,' },
  { id: 'jn-1-1',      ref: 'John 1:1',               text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
  { id: '1pe-5-7',     ref: '1 Peter 5:7',            text: 'Cast all your anxiety on him because he cares for you.' },
  { id: 'col-3-20',    ref: 'Colossians 3:20',        text: 'Children, obey your parents in everything, for this pleases the Lord.' },
  { id: 'ps-46-1',     ref: 'Psalm 46:1',             text: 'God is our refuge and strength, an ever-present help in trouble.' },
  { id: 'ps-136-1',    ref: 'Psalm 136:1',            text: 'Give thanks to the LORD, for he is good. His love endures forever.' },
  { id: 'jn-3-16',     ref: 'John 3:16',              text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
  { id: 'rom-6-23',    ref: 'Romans 6:23',            text: 'For the wages of sin is death, but the gift of God is eternal life in Christ Jesus our Lord.' },
  { id: 'php-4-13',    ref: 'Philippians 4:13',       text: 'I can do all this through him who gives me strength.' },
  { id: 'prv-17-17',   ref: 'Proverbs 17:17',         text: 'A friend loves at all times, and a brother is born for a time of adversity.' },
  { id: 'prv-15-1',    ref: 'Proverbs 15:1',          text: 'A gentle answer turns away wrath, but a harsh word stirs up anger.' },
  { id: 'eph-4-32',    ref: 'Ephesians 4:32',         text: 'Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you.' },
  { id: 'jn-14-6',     ref: 'John 14:6',              text: 'Jesus answered, “I am the way and the truth and the life. No one comes to the Father except through me.' },
  { id: 'rom-5-8',     ref: 'Romans 5:8',             text: 'But God demonstrates his own love for us in this: While we were still sinners, Christ died for us.' },
  { id: 'exo-20-12',   ref: 'Exodus 20:12',           text: 'Honor your father and your mother, so that you may live long in the land the LORD your God is giving you.' },
  { id: 'ps-139-14',   ref: 'Psalm 139:14',           text: 'I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well.' },
  { id: '1jn-1-9',     ref: '1 John 1:9',             text: 'If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness.' },
  { id: 'mt-5-16',     ref: 'Matthew 5:16',           text: 'In the same way, let your light shine before others, that they may see your good deeds and glorify your Father in heaven.' },
  { id: '1co-10-31',   ref: '1 Corinthians 10:31',    text: 'So whether you eat or drink or whatever you do, do it all for the glory of God.' },
  { id: '2co-5-17',    ref: '2 Corinthians 5:17',     text: 'Therefore, if anyone is in Christ, the new creation has come: The old has gone, the new is here!' },
  { id: 'rom-8-28',    ref: 'Romans 8:28',            text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
  { id: 'prv-3-5-6',   ref: 'Proverbs 3:5-6',         text: 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
  { id: 'eph-2-8-9',   ref: 'Ephesians 2:8-9',        text: 'For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God—not by works, so that no one can boast.' },
  { id: 'rom-10-9',    ref: 'Romans 10:9',            text: 'If you declare with your mouth, “Jesus is Lord,” and believe in your heart that God raised him from the dead, you will be saved.' },
  { id: 'jos-1-9',     ref: 'Joshua 1:9',             text: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.' },
  { id: 'deu-31-6',    ref: 'Deuteronomy 31:6',       text: 'Be strong and courageous. Do not be afraid or terrified because of them, for the LORD your God goes with you; he will never leave you nor forsake you.' },
  { id: 'mic-6-8',     ref: 'Micah 6:8',              text: 'He has shown you, O mortal, what is good. And what does the LORD require of you? To act justly and to love mercy and to walk humbly with your God.' },
  { id: '1th-5-16-18', ref: '1 Thessalonians 5:16-18', text: 'Rejoice always, pray continually, give thanks in all circumstances; for this is God’s will for you in Christ Jesus.' },
  { id: '2ti-3-16',    ref: '2 Timothy 3:16',         text: 'All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness,' },
  { id: 'jer-29-11',   ref: 'Jeremiah 29:11',         text: '“For I know the plans I have for you,” declares the LORD, “plans to prosper you and not to harm you, plans to give you hope and a future.”' },
  { id: 'php-4-6',     ref: 'Philippians 4:6',        text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.' },
  { id: 'isa-41-10',   ref: 'Isaiah 41:10',           text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.' },
  { id: 'gal-5-22-23', ref: 'Galatians 5:22-23',      text: 'But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control. Against such things there is no law.' },
];

/* Trivia for ages about 7 to 10. Every story question carries the passage it
   comes from (`ref`), so a parent can check it or read the story together.
   A few general questions have no single passage and use null. `a` is the right
   answer; `wrong` are the other choices (one for true/false, three otherwise).
   Keep every wrong choice plainly wrong, never "also sort of right". */
export const CATEGORIES = {
  ot:    'Old Testament',
  jesus: 'Jesus',
  nt:    'Church and Letters',
  books: 'Bible Basics',
};

export const TRIVIA = [
  // ---------------------------------------------------------- Old Testament
  { id: 'ot-ark', cat: 'ot', q: 'Who built the ark?', a: 'Noah', wrong: ['Moses', 'Abraham', 'David'], ref: 'Genesis 6:13-14', why: 'God told Noah to build an ark to keep his family and the animals safe from the flood.' },
  { id: 'ot-days', cat: 'ot', q: 'God made the world, then rested. On which day did he rest?', a: 'The seventh day', wrong: ['The first day', 'The third day', 'The tenth day'], ref: 'Genesis 2:2', why: 'God finished his work of creating and rested on the seventh day.' },
  { id: 'ot-rainbow', cat: 'ot', q: 'What did God put in the sky as a sign of his promise to Noah?', a: 'A rainbow', wrong: ['A shooting star', 'A full moon', 'A big cloud'], ref: 'Genesis 9:13', why: 'The rainbow is the sign of God\'s promise never again to flood the whole earth.' },
  { id: 'ot-adam', cat: 'ot', q: 'Who were the first man and woman?', a: 'Adam and Eve', wrong: ['Abraham and Sarah', 'Isaac and Rebekah', 'Mary and Joseph'], ref: 'Genesis 3:20', why: 'God made Adam, then Eve, and put them in the Garden of Eden.' },
  { id: 'ot-isaac', cat: 'ot', q: 'Abraham was 100 years old when his son was born. What was the son\'s name?', a: 'Isaac', wrong: ['Jacob', 'Joseph', 'Esau'], ref: 'Genesis 21:5', why: 'Isaac was born when Abraham was 100, just as God promised.' },
  { id: 'ot-jacob', cat: 'ot', q: 'Who tricked his brother Esau to get their father\'s blessing?', a: 'Jacob', wrong: ['Joseph', 'Isaac', 'Abel'], ref: 'Genesis 27:19', why: 'Jacob pretended to be Esau so their father Isaac would bless him.' },
  { id: 'ot-robe', cat: 'ot', q: 'Who got a fancy robe from his father, which made his brothers jealous?', a: 'Joseph', wrong: ['Benjamin', 'Esau', 'Samuel'], ref: 'Genesis 37:3-4', why: 'Jacob loved Joseph and gave him an ornate robe. His brothers hated him for it.' },
  { id: 'ot-sold', cat: 'ot', q: 'Whose brothers sold him to traders going to Egypt?', a: 'Joseph', wrong: ['Moses', 'David', 'Jonah'], ref: 'Genesis 37:28', why: 'Joseph\'s brothers sold him for twenty shekels of silver. Later God used him to save many people.' },
  { id: 'ot-bush', cat: 'ot', q: 'God spoke to Moses from something that was on fire but did not burn up. What was it?', a: 'A bush', wrong: ['A tree', 'A tent', 'A mountain'], ref: 'Exodus 3:2', why: 'The bush was on fire but did not burn up, and God called to Moses from it.' },
  { id: 'ot-exodus', cat: 'ot', q: 'Who led the Israelites out of Egypt?', a: 'Moses', wrong: ['Joshua', 'Noah', 'Abraham'], ref: 'Exodus 3:10', why: 'God sent Moses to bring his people out of Egypt.' },
  { id: 'ot-sea', cat: 'ot', q: 'Which sea did God split so the Israelites could walk across on dry ground?', a: 'The Red Sea', wrong: ['The Dead Sea', 'The Sea of Galilee', 'The Black Sea'], ref: 'Exodus 15:4', why: 'God parted the Red Sea for Israel. When Pharaoh\'s army followed, the water came back.' },
  { id: 'ot-manna', cat: 'ot', q: 'What food did God send every morning for Israel in the desert?', a: 'Manna', wrong: ['Pancakes', 'Apples', 'Rice'], ref: 'Exodus 16:31', why: 'Manna was white like seed and tasted like wafers made with honey.' },
  { id: 'ot-ten', cat: 'ot', q: 'What did God give Moses on Mount Sinai, written on stone?', a: 'The Ten Commandments', wrong: ['A map to the Promised Land', 'A list of kings', 'The Lord\'s Prayer'], ref: 'Exodus 34:28', why: 'God wrote the Ten Commandments on two stone tablets.' },
  { id: 'ot-jericho', cat: 'ot', q: 'The Israelites marched around a city and its walls fell down. Which city?', a: 'Jericho', wrong: ['Jerusalem', 'Babylon', 'Nineveh'], ref: 'Joshua 6:20', why: 'When the priests blew the trumpets and the people shouted, Jericho\'s wall collapsed.' },
  { id: 'ot-samson', cat: 'ot', q: 'Samson was super strong. What was he never supposed to cut?', a: 'His hair', wrong: ['His fingernails', 'His beard only', 'His robe'], ref: 'Judges 16:17', why: 'Samson was set apart to God from birth, and a razor was never used on his head.' },
  { id: 'ot-ruth', cat: 'ot', q: 'Who said, "Where you go I will go"?', a: 'Ruth', wrong: ['Esther', 'Naomi', 'Mary'], ref: 'Ruth 1:16', why: 'Ruth said this to her mother-in-law Naomi, promising to stay with her.' },
  { id: 'ot-samuel', cat: 'ot', q: 'Which boy heard God calling his name in the night?', a: 'Samuel', wrong: ['David', 'Daniel', 'Joseph'], ref: '1 Samuel 3:10', why: 'Samuel answered, "Speak, for your servant is listening."' },
  { id: 'ot-saul', cat: 'ot', q: 'Who was the first king of Israel?', a: 'Saul', wrong: ['David', 'Solomon', 'Samuel'], ref: '1 Samuel 10:1', why: 'Samuel anointed Saul as the first king. David came after him.' },
  { id: 'ot-sheep', cat: 'ot', q: 'Before he became king, young David took care of what animals?', a: 'Sheep', wrong: ['Camels', 'Horses', 'Pigs'], ref: '1 Samuel 16:11', why: 'David was the youngest son and was out tending the sheep when Samuel came.' },
  { id: 'ot-goliath', cat: 'ot', q: 'What was the name of the giant David fought?', a: 'Goliath', wrong: ['Pharaoh', 'Herod', 'Haman'], ref: '1 Samuel 17:4', why: 'Goliath was a giant Philistine champion who mocked God\'s army.' },
  { id: 'ot-sling', cat: 'ot', q: 'What did David use to beat Goliath?', a: 'A sling and a stone', wrong: ['A sword', 'A bow and arrow', 'A spear'], ref: '1 Samuel 17:50', why: 'David trusted God and won with just a sling and a stone.' },
  { id: 'ot-solomon', cat: 'ot', q: 'Which king asked God for wisdom instead of riches?', a: 'Solomon', wrong: ['Saul', 'Herod', 'Pharaoh'], ref: '1 Kings 3:9-12', why: 'God was pleased and gave Solomon a wise and discerning heart.' },
  { id: 'ot-elijah', cat: 'ot', q: 'Which prophet went up to heaven in a whirlwind?', a: 'Elijah', wrong: ['Jonah', 'Moses', 'Daniel'], ref: '2 Kings 2:11', why: 'A chariot of fire appeared and Elijah went up to heaven in a whirlwind.' },
  { id: 'ot-esther', cat: 'ot', q: 'Which queen bravely went to the king to save her people?', a: 'Esther', wrong: ['Ruth', 'Sarah', 'Miriam'], ref: 'Esther 4:16', why: 'Esther said, "I will go to the king, even though it is against the law."' },
  { id: 'ot-furnace', cat: 'ot', q: 'Which three friends were thrown into a fiery furnace and not burned?', a: 'Shadrach, Meshach and Abednego', wrong: ['Peter, James and John', 'Moses, Aaron and Miriam', 'Abraham, Isaac and Jacob'], ref: 'Daniel 3:26-27', why: 'They would not bow to the king\'s statue, and God kept them safe in the fire.' },
  { id: 'ot-lions', cat: 'ot', q: 'Who was thrown into a den of lions for praying to God?', a: 'Daniel', wrong: ['Joseph', 'Samson', 'Jonah'], ref: 'Daniel 6:22', why: 'God sent his angel and shut the lions\' mouths.' },
  { id: 'ot-jonah', cat: 'ot', q: 'Who was swallowed by a huge fish after running away from God?', a: 'Jonah', wrong: ['Peter', 'Elijah', 'Noah'], ref: 'Jonah 1:17', why: 'Jonah was inside the fish three days and three nights.' },
  { id: 'ot-tf-rain', cat: 'ot', q: 'True or false: During the flood, rain fell for forty days and forty nights.', a: 'True', wrong: ['False'], ref: 'Genesis 7:12', why: 'Rain fell on the earth forty days and forty nights.' },

  // ------------------------------------------------------------------ Jesus
  { id: 'j-gabriel', cat: 'jesus', q: 'Which angel told Mary she would have a baby named Jesus?', a: 'Gabriel', wrong: ['Michael', 'Raphael', 'Lucifer'], ref: 'Luke 1:26-31', why: 'God sent the angel Gabriel to Mary in Nazareth.' },
  { id: 'j-born', cat: 'jesus', q: 'In what town was Jesus born?', a: 'Bethlehem', wrong: ['Nazareth', 'Jerusalem', 'Rome'], ref: 'Matthew 2:1', why: 'Jesus was born in Bethlehem and grew up in Nazareth.' },
  { id: 'j-manger', cat: 'jesus', q: 'Where did Mary lay baby Jesus?', a: 'In a manger', wrong: ['In a palace bed', 'In a boat', 'In a basket on a river'], ref: 'Luke 2:7', why: 'There was no guest room for them, so Mary placed him in a manger.' },
  { id: 'j-magi', cat: 'jesus', q: 'Who followed a star to find young Jesus?', a: 'The Magi (wise men)', wrong: ['Roman soldiers', 'The disciples', 'Fishermen'], ref: 'Matthew 2:1-2', why: 'Magi from the east saw his star and came to worship him.' },
  { id: 'j-baptist', cat: 'jesus', q: 'Who baptized Jesus in the Jordan River?', a: 'John the Baptist', wrong: ['Peter', 'Paul', 'Moses'], ref: 'Matthew 3:13', why: 'Jesus came from Galilee to the Jordan to be baptized by John.' },
  { id: 'j-twelve', cat: 'jesus', q: 'How many apostles did Jesus choose?', a: '12', wrong: ['7', '10', '40'], ref: 'Luke 6:13', why: 'Jesus chose twelve of his disciples and called them apostles.' },
  { id: 'j-fisher', cat: 'jesus', q: 'What was Peter\'s job before he followed Jesus?', a: 'Fisherman', wrong: ['Carpenter', 'Shepherd', 'Tax collector'], ref: 'Matthew 4:18-19', why: 'Jesus told Peter and Andrew, "I will send you out to fish for people."' },
  { id: 'j-wine', cat: 'jesus', q: 'In the Gospel of John, what was the first sign (miracle) Jesus did?', a: 'Turned water into wine', wrong: ['Walked on water', 'Fed 5,000 people', 'Healed a blind man'], ref: 'John 2:11', why: 'At a wedding in Cana, Jesus turned water into wine. John calls it the first of his signs.' },
  { id: 'j-prayer', cat: 'jesus', q: 'When Jesus taught his disciples to pray, how did the prayer start?', a: '"Our Father in heaven"', wrong: ['"The LORD is my shepherd"', '"In the beginning"', '"Give thanks to the LORD"'], ref: 'Matthew 6:9', why: 'This is called the Lord\'s Prayer.' },
  { id: 'j-storm', cat: 'jesus', q: 'Jesus said, "Quiet! Be still!" What was he talking to?', a: 'A storm', wrong: ['A crowd', 'A crying baby', 'A barking dog'], ref: 'Mark 4:39', why: 'The wind died down and it was completely calm.' },
  { id: 'j-5000', cat: 'jesus', q: 'Jesus fed a huge crowd with how many loaves and fish?', a: '5 loaves and 2 fish', wrong: ['2 loaves and 5 fish', '12 loaves and 12 fish', '1 loaf and 1 fish'], ref: 'Matthew 14:17-21', why: 'About five thousand men ate, plus women and children, and there were twelve baskets left over.' },
  { id: 'j-water', cat: 'jesus', q: 'Which disciple got out of the boat and walked on the water toward Jesus?', a: 'Peter', wrong: ['John', 'Judas', 'Thomas'], ref: 'Matthew 14:29', why: 'Peter walked on the water, then got scared and began to sink. Jesus caught him.' },
  { id: 'j-samaritan', cat: 'jesus', q: 'In Jesus\' story, who stopped to help the man hurt by robbers?', a: 'A Samaritan', wrong: ['A priest', 'A Levite', 'A king'], ref: 'Luke 10:33-34', why: 'The priest and the Levite passed by. The Samaritan took pity on him and cared for him.' },
  { id: 'j-prodigal', cat: 'jesus', q: 'In Jesus\' story of the lost son, what did the father do when his son came home?', a: 'Ran to hug him and threw a party', wrong: ['Sent him away', 'Made him sleep outside', 'Pretended not to see him'], ref: 'Luke 15:20-24', why: 'The father ran to his son, hugged him, and said, "Let\'s have a feast and celebrate."' },
  { id: 'j-zacchaeus', cat: 'jesus', q: 'Which short man climbed a tree to see Jesus?', a: 'Zacchaeus', wrong: ['Nicodemus', 'Lazarus', 'Bartimaeus'], ref: 'Luke 19:3-4', why: 'Zacchaeus was a tax collector who climbed a sycamore-fig tree.' },
  { id: 'j-lazarus', cat: 'jesus', q: 'Jesus raised his friend from the dead after four days in the tomb. Who was it?', a: 'Lazarus', wrong: ['Peter', 'Zacchaeus', 'John'], ref: 'John 11:43-44', why: 'Jesus called, "Lazarus, come out!" and he did.' },
  { id: 'j-greatest', cat: 'jesus', q: 'Jesus said the greatest commandment is to love whom with all your heart?', a: 'The Lord your God', wrong: ['Yourself', 'Your teacher', 'The king'], ref: 'Matthew 22:37-38', why: '"Love the Lord your God with all your heart and with all your soul and with all your mind."' },
  { id: 'j-judas', cat: 'jesus', q: 'Which disciple betrayed Jesus?', a: 'Judas Iscariot', wrong: ['Peter', 'John', 'Andrew'], ref: 'Matthew 26:14-16', why: 'Judas agreed to hand Jesus over for thirty pieces of silver.' },
  { id: 'j-denied', cat: 'jesus', q: 'Which disciple said he did not know Jesus three times?', a: 'Peter', wrong: ['Thomas', 'Judas', 'Matthew'], ref: 'Luke 22:61', why: 'Jesus had said Peter would disown him three times before the rooster crowed. Later Jesus forgave him.' },
  { id: 'j-third', cat: 'jesus', q: 'On which day did Jesus rise from the dead?', a: 'The third day', wrong: ['The first day', 'The seventh day', 'The fortieth day'], ref: '1 Corinthians 15:4', why: 'Jesus was buried and was raised on the third day.' },
  { id: 'j-tomb', cat: 'jesus', q: 'When the women went to Jesus\' tomb on Sunday morning, what did they find?', a: 'The stone rolled away and no body inside', wrong: ['Soldiers guarding a closed tomb', 'Jesus asleep inside', 'The tomb filled with flowers'], ref: 'Luke 24:2-3', why: 'The stone was rolled away, and Jesus was not there. He had risen!' },
  { id: 'j-tf-nazareth', cat: 'jesus', q: 'True or false: Jesus grew up in Nazareth.', a: 'True', wrong: ['False'], ref: 'Luke 2:39-40', why: 'After Jesus was born in Bethlehem, his family returned to their town of Nazareth.' },

  // ---------------------------------------------------- Church and Letters
  { id: 'nt-paul', cat: 'nt', q: 'Saul was blinded by a bright light on the road to Damascus. What name is he better known by?', a: 'Paul', wrong: ['Peter', 'Timothy', 'Stephen'], ref: 'Acts 9:3-4; 13:9', why: 'Saul met Jesus on the road and became Paul, who told the world about him.' },
  { id: 'nt-letters', cat: 'nt', q: 'Who wrote letters to churches, like Romans and Ephesians?', a: 'Paul', wrong: ['Moses', 'David', 'Noah'], ref: 'Romans 1:1', why: 'Romans begins, "Paul, a servant of Christ Jesus."' },
  { id: 'nt-spirit', cat: 'nt', q: 'After Jesus went back to heaven, who did God send to help the believers?', a: 'The Holy Spirit', wrong: ['A new king', 'Moses', 'An army'], ref: 'Acts 2:4', why: 'At Pentecost the believers were filled with the Holy Spirit.' },
  { id: 'nt-fruit', cat: 'nt', q: 'Love, joy and peace are part of the fruit of the what?', a: 'The Spirit', wrong: ['The garden', 'The vine', 'The law'], ref: 'Galatians 5:22', why: 'Paul lists love, joy, peace and more as the fruit of the Spirit.' },
  { id: 'nt-armor', cat: 'nt', q: 'Paul talks about a helmet, a shield and a sword. What does he call them?', a: 'The armor of God', wrong: ['The armor of David', 'The tools of Noah', 'The crown of Solomon'], ref: 'Ephesians 6:11', why: '"Put on the full armor of God."' },

  // ---------------------------------------------------------- Bible Basics
  { id: 'b-first', cat: 'books', q: 'What is the first book of the Bible?', a: 'Genesis', wrong: ['Exodus', 'Matthew', 'Psalms'], ref: 'Genesis 1:1', why: 'Genesis means "beginning." It starts with creation.' },
  { id: 'b-last', cat: 'books', q: 'What is the last book of the Bible?', a: 'Revelation', wrong: ['Jude', 'Acts', 'Malachi'], ref: 'Revelation 22:21', why: 'Revelation is the last book of the New Testament.' },
  { id: 'b-parts', cat: 'books', q: 'What are the two main parts of the Bible called?', a: 'Old Testament and New Testament', wrong: ['First Book and Second Book', 'Law and Psalms', 'Gospels and Letters'], ref: null, why: 'The Old Testament was written before Jesus was born. The New Testament tells about Jesus and the early church.' },
  { id: 'b-gospels', cat: 'books', q: 'Which one is NOT one of the four Gospels?', a: 'Acts', wrong: ['Matthew', 'Mark', 'John'], ref: 'Acts 1:1', why: 'The four Gospels are Matthew, Mark, Luke and John. Acts comes right after them.' },
  { id: 'b-66', cat: 'books', q: 'How many books are in most Protestant Bibles?', a: '66', wrong: ['12', '40', '100'], ref: null, why: '39 in the Old Testament and 27 in the New Testament. (Catholic Bibles have a few more.)' },
  { id: 'b-psalms', cat: 'books', q: 'Which book is full of songs and prayers?', a: 'Psalms', wrong: ['Leviticus', 'Acts', 'Numbers'], ref: 'Psalm 150:6', why: 'Psalms is a book of 150 songs and prayers. Many were written by David.' },
  { id: 'b-david', cat: 'books', q: 'Which king wrote many of the Psalms?', a: 'David', wrong: ['Saul', 'Herod', 'Pharaoh'], ref: 'Psalm 23', why: 'Psalm 23, "The LORD is my shepherd," is a psalm of David.' },
  { id: 'b-proverbs', cat: 'books', q: 'Which book is full of wise sayings, many from King Solomon?', a: 'Proverbs', wrong: ['Revelation', 'Genesis', 'Jonah'], ref: 'Proverbs 1:1', why: 'Proverbs begins, "The proverbs of Solomon son of David, king of Israel."' },
  { id: 'b-tf-jonah', cat: 'books', q: 'True or false: The book of Jonah is in the New Testament.', a: 'False', wrong: ['True'], ref: 'Jonah 1:1', why: 'Jonah is in the Old Testament, with the other prophets.' },
  { id: 'b-greek', cat: 'books', q: 'What language was the New Testament first written in?', a: 'Greek', wrong: ['English', 'Spanish', 'Latin'], ref: null, why: 'The New Testament was written in Greek. Most of the Old Testament was written in Hebrew.' },
];

/* Badges. Symbolic on purpose: no prizes, money or screen time are attached,
   because rewards for something a kid already enjoys can make them like it
   less once the rewards stop. */
export const BADGES = [
  { id: 'first-step',  name: 'First Step',      desc: 'Finish your first lesson' },
  { id: 'first-verse', name: 'Hidden in My Heart', desc: 'Memorize your first verse' },
  { id: 'verses-5',    name: 'Five Smooth Stones', desc: 'Memorize 5 verses' },
  { id: 'verses-10',   name: 'Ten Strong',      desc: 'Memorize 10 verses' },
  { id: 'verses-20',   name: 'Lamp to My Feet', desc: 'Memorize 20 verses' },
  { id: 'verses-all',  name: 'Whole Quest',     desc: 'Memorize every verse in the game' },
  { id: 'gold',        name: 'Locked In',       desc: 'Keep a verse until it turns gold' },
  { id: 'streak-3',    name: 'Three in a Row',  desc: 'Reach a 3-day streak' },
  { id: 'streak-7',    name: 'Full Week',       desc: 'Reach a 7-day streak' },
  { id: 'streak-30',   name: 'Faithful',        desc: 'Reach a 30-day streak' },
  { id: 'trivia-25',   name: 'Bible Explorer',  desc: 'Get 25 trivia questions right' },
  { id: 'trivia-100',  name: 'Bible Scholar',   desc: 'Get 100 trivia questions right' },
  { id: 'perfect',     name: 'Perfect Round',   desc: 'Get every question right in a trivia round' },
];

export const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
