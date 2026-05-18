
// Difficulty Settings
const DIFFICULTIES = {
  easy:   { pairs: 4,  time: 30  },
  medium: { pairs: 8,  time: 50  },
  hard:   { pairs: 12,  time: 90 },
};

// Game State
let state = {
  difficulty:     'easy',
  allPokemon:     [],       
  cards:          [],       
  firstCard:      null,     
  secondCard:     null,
  isLocked:       false,
  clicks:         0,
  matched:        0,
  totalPairs:     0,
  timeLeft:       0,
  timerInterval:  null,
  gameActive:     false,
  powerupUsed:    false,
};

// jQuery Selectors
const $cardGrid        = $('#cardGrid');
const $statsBar        = $('#statsBar');
const $startPrompt     = $('#startPrompt');
const $loadingSpinner  = $('#loadingSpinner');
const $messageOverlay  = $('#messageOverlay');
const $messageIcon     = $('#messageIcon');
const $messageTitle    = $('#messageTitle');
const $messageSub      = $('#messageSub');
const $timerDisplay    = $('#timerDisplay');
const $clicksDisplay   = $('#clicksDisplay');
const $matchedDisplay  = $('#matchedDisplay');
const $remainingDisplay= $('#remainingDisplay');
const $totalDisplay    = $('#totalDisplay');
const $powerupBtn      = $('#powerupBtn');
const $powerupCount    = $('#powerupCount');

$(document).ready(async () => {
  await fetchAllPokemon();
  bindStaticEvents();
  updateStatsDisplay();
});

// Get all Pokemon from the API
async function fetchAllPokemon() {
  try {
    const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
    const data = await res.json();
    state.allPokemon = data.results; 
    } catch (err) {
    console.error('Failed to load Pokémon list:', err);
    state.allPokemon = [];
  }
}

// Static Events
function bindStaticEvents() {

  $('.diff-btn').on('click', function () {
    $('.diff-btn').removeClass('active');
    $(this).addClass('active');
    state.difficulty = $(this).data('diff');
  });

  $('#startBtn').on('click', startGame);
  $('#resetBtn').on('click', resetGame);

  $('#msgPlayAgainBtn').on('click', () => {
    $messageOverlay.addClass('hidden');
    startGame();
  });

  $('#themeBtn').on('click', toggleTheme);

  $powerupBtn.on('click', triggerPowerup);
}

// Theme
function toggleTheme() {
  const current = $('html').attr('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  $('html').attr('data-theme', next);
  $('#themeBtn').text(next === 'dark' ? 'Dark' : 'Light');
}

// Start Game
async function startGame() {
  console.log('Pokemon loaded:', state.allPokemon.length);
  if (state.allPokemon.length === 0) await fetchAllPokemon();

  clearInterval(state.timerInterval);
  Object.assign(state, {
    firstCard:   null,
    secondCard:  null,
    isLocked:    false,
    clicks:      0,
    matched:     0,
    powerupUsed: false,
    gameActive:  false,
  });

  const { pairs, time } = DIFFICULTIES[state.difficulty];
  state.totalPairs = pairs;
  state.timeLeft   = time;

  $startPrompt.addClass('hidden');
  $messageOverlay.addClass('hidden');
  $cardGrid.addClass('hidden');
  $loadingSpinner.removeClass('hidden');
  $statsBar.removeClass('hidden');
  $('body').removeClass('timer-warning');

  state.powerupUsed = false;
  $powerupCount.text('1');
  $powerupBtn.prop('disabled', false);

  updateStatsDisplay();

  const selected = pickRandomPokemon(pairs);
  const pokemonData = await fetchPokemonImages(selected);

  state.cards = buildDeck(pokemonData);
  state.totalPairs = pairs;

  $loadingSpinner.addClass('hidden');
  renderCards();

  state.gameActive = true;
  startTimer();
  updateStatsDisplay();
}

// Reset Game
function resetGame() {
  clearInterval(state.timerInterval);
  state.gameActive = false;
  $messageOverlay.addClass('hidden');
  $cardGrid.addClass('hidden').empty();
  $startPrompt.removeClass('hidden');
  $('body').removeClass('timer-warning');
  Object.assign(state, {
    firstCard:   null,
    secondCard:  null,
    isLocked:    false,
    clicks:      0,
    matched:     0,
    totalPairs:  0,
    timeLeft:    0,
    powerupUsed: false,
  });
  $timerDisplay.text('--');
  updateStatsDisplay();
  $powerupCount.text('1');
  $powerupBtn.prop('disabled', false);
}

// Pick Random Pokemon 
function pickRandomPokemon(count) {
  const pool    = [...state.allPokemon];
  const chosen  = [];
  while (chosen.length < count && pool.length > 0) {
    const idx  = Math.floor(Math.random() * pool.length);
    const poke = pool.splice(idx, 1)[0];
    const id = parseInt(poke.url.split('/').filter(Boolean).pop());
    if (id >= 1 && id <= 1025) chosen.push({ name: poke.name, id });
  }
  return chosen;
}

// Get Images For Chosen Pokemon
async function fetchPokemonImages(pokemonList) {
  const promises = pokemonList.map(async ({ name, id }) => {
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();
      const img  = data?.sprites?.other?.['official-artwork']?.front_default
                || data?.sprites?.front_default
                || '';
      return { name, id, img };
    } catch {
      return { name, id, img: '' };
    }
  });
  return Promise.all(promises);
}

// Build Shuffled Deck
function buildDeck(pokemonData) {
  const deck = [];
  pokemonData.forEach(p => {
    deck.push({ ...p });
    deck.push({ ...p });
  });

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Render Cards
function renderCards() {
  $cardGrid.empty();

  const cols = state.totalPairs <= 3 ? 3
             : state.totalPairs <= 6 ? 4
             : 4;
  $cardGrid.css('grid-template-columns', `repeat(${cols}, auto)`);
  if (state.difficulty === 'hard') $cardGrid.addClass('grid-hard');
  else $cardGrid.removeClass('grid-hard');

  state.cards.forEach((poke, idx) => {
    const cardId   = `card-${idx}`;
    const frontId  = `front-${idx}`;
    const $card    = $(`
      <div class="card" id="${cardId}" data-name="${poke.name}" data-img="${poke.img}">
        <div class="card-inner">
          <div class="card-face back_face"></div>
          <div class="card-face front_face">
            <img id="${frontId}" src="${poke.img}" alt="${poke.name}" />
            <span class="poke-name">${poke.name}</span>
          </div>
        </div>
      </div>
    `);
    $cardGrid.append($card);
  });

  $cardGrid.removeClass('hidden');

  /* Bind card clicks via delegation */
  $cardGrid.off('click', '.card').on('click', '.card', handleCardClick);
}

// Card Click Handler
function handleCardClick() {
  const $card = $(this);

  if (!state.gameActive)           return;  // game not running
  if (state.isLocked)              return;  // mid-animation
  if ($card.hasClass('flip'))      return;  // already flipped
  if ($card.hasClass('matched'))   return;  // already matched

  state.clicks++;
  updateStatsDisplay();

  $card.addClass('flip');

  if (!state.firstCard) {
    state.firstCard = $card;
  } else {
    state.secondCard = $card;
    state.isLocked   = true;

    const firstName = state.firstCard.data('name');
    const secondName = state.secondCard.data('name');

    if (firstName === secondName) {
      state.firstCard.addClass('matched').off('click');
      state.secondCard.addClass('matched').off('click');
      state.matched++;
      updateStatsDisplay();
      resetPair();

      if (state.matched === state.totalPairs) {
        setTimeout(triggerWin, 400);
      }
    } else {
      setTimeout(() => {
        state.firstCard.removeClass('flip');
        state.secondCard.removeClass('flip');
        resetPair();
      }, 1000);
    }
  }
}

function resetPair() {
  state.firstCard  = null;
  state.secondCard = null;
  state.isLocked   = false;
}

// Timer
function startTimer() {
  $timerDisplay.text(formatTime(state.timeLeft));
  clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    $timerDisplay.text(formatTime(state.timeLeft));

    if (state.timeLeft <= 10) $('body').addClass('timer-warning');

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      triggerGameOver();
    }
  }, 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Win / Lose Trigger
function triggerWin() {
  clearInterval(state.timerInterval);
  state.gameActive = false;
  $('body').removeClass('timer-warning');
  showMessage('🏆', 'You Won!',
    `Matched all ${state.totalPairs} pairs in ${state.clicks} clicks with ${formatTime(state.timeLeft)} left!`
  );
}

function triggerGameOver() {
  state.gameActive = false;
  $('body').removeClass('timer-warning');
  showMessage(':(', 'Game Over',
    `Time ran out! You matched ${state.matched} of ${state.totalPairs} pairs.`
  );
}

function showMessage(icon, title, sub) {
  $messageIcon.text(icon);
  $messageTitle.text(title);
  $messageSub.text(sub);
  $messageOverlay.removeClass('hidden');
}

// Stats Display
function updateStatsDisplay() {
  $clicksDisplay.text(state.clicks);
  $matchedDisplay.text(state.matched);
  $remainingDisplay.text(state.totalPairs - state.matched);
  $totalDisplay.text(state.totalPairs);
}

// Power-Up: Peek — reveals all unmatched cards for 1 second
function triggerPowerup() {
  if (!state.gameActive || state.powerupUsed) return;

  state.powerupUsed = true;
  $powerupBtn.prop('disabled', true);
  $powerupCount.text('0');

  const $unmatched = $('.card:not(.matched):not(.flip)');
  $unmatched.addClass('flip');

  state.isLocked = true;

  setTimeout(() => {
    $unmatched.each(function () {
      const $c = $(this);
      if (!state.firstCard || !$c.is(state.firstCard)) {
        if (!state.secondCard || !$c.is(state.secondCard)) {
          $c.removeClass('flip');
        }
      }
    });
    state.isLocked = false;
  }, 500);
}