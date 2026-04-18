let Telegram = window.Telegram.WebApp;
Telegram.expand();

// ============ АВТОМАТИЧЕСКОЕ СОЗДАНИЕ БИНА ============
// Этот сервис не требует регистрации и создаёт бин автоматически
const JSONBIN_URL = "https://api.jsonstorage.net/v1/json";

let userId = Telegram.initDataUnsafe.user?.id;
let userName = Telegram.initDataUnsafe.user?.first_name || "Аноним";

let gameData = {
    coins: 0,
    total_clicks: 0,
    click_power: 1,
    upgrades: 0,
    current_skin: 'base',
    stars: 0,
    skins: ['base']
};

// Переменная для хранения ID бина
let binId = null;

// ============ ЛИДЕРБОРД ============
async function getOrCreateBin() {
    // Пытаемся получить сохранённый binId из Telegram Cloud
    return new Promise((resolve) => {
        Telegram.CloudStorage.getItem('leaderboard_bin_id', async (error, value) => {
            if (value && !error) {
                binId = value;
                resolve(binId);
            } else {
                // Создаём новый бин
                try {
                    const response = await fetch(JSONBIN_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify([])
                    });
                    const data = await response.json();
                    binId = data.id;
                    Telegram.CloudStorage.setItem('leaderboard_bin_id', binId);
                    resolve(binId);
                } catch(e) {
                    console.log('Bin creation error:', e);
                    resolve(null);
                }
            }
        });
    });
}

async function updateLeaderboard() {
    if (!binId) await getOrCreateBin();
    if (!binId) return;
    
    try {
        // Получаем текущие данные
        const response = await fetch(`${JSONBIN_URL}/${binId}`);
        let leaders = await response.json();
        
        if (!Array.isArray(leaders)) leaders = [];
        
        const existing = leaders.find(l => l.user_id === userId);
        if (existing) {
            existing.coins = gameData.coins;
            existing.username = userName;
            existing.total_clicks = gameData.total_clicks;
        } else {
            leaders.push({
                user_id: userId,
                username: userName,
                coins: gameData.coins,
                total_clicks: gameData.total_clicks
            });
        }
        
        leaders.sort((a, b) => b.coins - a.coins);
        leaders = leaders.slice(0, 50);
        
        await fetch(`${JSONBIN_URL}/${binId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leaders)
        });
    } catch(e) {
        console.log('Leaderboard update error:', e);
    }
}

async function loadLeaderboard() {
    if (!binId) await getOrCreateBin();
    if (!binId) return '📡 Не удалось загрузить лидерборд';
    
    try {
        const response = await fetch(`${JSONBIN_URL}/${binId}`);
        const leaders = await response.json();
        
        if (!leaders || leaders.length === 0) {
            return '🏆 ТОП ИГРОКОВ 🏆\n\nПока никого нет. Будь первым!';
        }
        
        let text = '🏆 ТОП ИГРОКОВ 🏆\n\n';
        leaders.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📌';
            text += `${medal} ${player.username.substring(0, 15)}: ${player.coins.toLocaleString()} 🪙\n`;
        });
        
        return text;
    } catch(e) {
        return '📡 Ошибка загрузки лидерборда';
    }
}

async function showLeaderboard() {
    Telegram.showPopup({
        title: '🏆 Загрузка...',
        message: 'Получаем данные...',
        buttons: [{ type: 'ok' }]
    });
    
    const leaderboardText = await loadLeaderboard();
    
    Telegram.showPopup({
        title: '🏆 Топ игроков',
        message: leaderboardText,
        buttons: [{ type: 'close' }]
    });
}

// ============ СОХРАНЕНИЕ В TELEGRAM CLOUD ============
async function loadData() {
    return new Promise((resolve) => {
        Telegram.CloudStorage.getItem('kotost_data', (error, value) => {
            if (value && !error) {
                try {
                    const saved = JSON.parse(value);
                    gameData = { ...gameData, ...saved };
                } catch(e) {}
            }
            resolve();
        });
    });
}

async function saveData() {
    return new Promise((resolve) => {
        Telegram.CloudStorage.setItem('kotost_data', JSON.stringify(gameData), (error) => {
            if (error) console.error('Save error:', error);
            resolve();
        });
    });
}

// ============ ИГРОВАЯ ЛОГИКА ============
async function handleClick(event) {
    const rect = document.getElementById('cat').getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    gameData.coins += gameData.click_power;
    gameData.total_clicks += gameData.click_power;
    createFloatingNumber(x, y, gameData.click_power);
    updateUI();
    await saveData();
    await updateLeaderboard();
    
    const cat = document.getElementById('cat');
    cat.style.transform = 'scale(0.95)';
    setTimeout(() => cat.style.transform = 'scale(1)', 100);
}

async function buyUpgrade() {
    const price = 50 * (gameData.upgrades + 1);
    if (gameData.coins >= price) {
        gameData.coins -= price;
        gameData.click_power++;
        gameData.upgrades++;
        updateUI();
        await saveData();
        await updateLeaderboard();
    } else {
        const btn = document.getElementById('upgradeBtn');
        btn.style.animation = 'shake 0.3s ease';
        setTimeout(() => btn.style.animation = '', 300);
    }
}

// ============ ЕЖЕДНЕВНЫЙ БОНУС ============
async function claimDaily() {
    const lastDaily = await new Promise((resolve) => {
        Telegram.CloudStorage.getItem('last_daily', (error, value) => {
            resolve(value);
        });
    });
    
    const now = Date.now();
    const oneDay = 86400000;
    
    if (lastDaily && (now - parseInt(lastDaily)) < oneDay) {
        Telegram.showAlert('⏰ Вы уже получали бонус сегодня!\nВозвращайтесь завтра');
        return;
    }
    
    let streak = await new Promise((resolve) => {
        Telegram.CloudStorage.getItem('daily_streak', (error, value) => {
            resolve(value ? parseInt(value) : 0);
        });
    });
    
    const bonus = Math.min(100 + (streak * 50), 1000);
    gameData.coins += bonus;
    
    await saveData();
    await updateLeaderboard();
    
    Telegram.CloudStorage.setItem('last_daily', now.toString());
    Telegram.CloudStorage.setItem('daily_streak', (streak + 1).toString());
    
    updateUI();
    Telegram.showAlert(`🎁 Дневной бонус!\n+${bonus} монет\nСерия: ${streak + 1} дней`);
}

// ============ СКИНЫ ============
const SKINS = {
    base: { name: 'Обычный кот', image: 'images/cat_base.png', priceCoins: 0, priceStars: 0, req: 0 },
    silver: { name: 'Серебряный кот', image: 'images/cat_silver.png', priceCoins: 2500, priceStars: 100, req: 2500 },
    gold: { name: 'Золотой кот', image: 'images/cat_gold.png', priceCoins: 10000, priceStars: 199, req: 10000 },
    diamond: { name: 'Алмазный кот', image: 'images/cat_diamond.png', priceCoins: 50000, priceStars: 999, req: 50000 },
    ruby: { name: 'Рубиновый кот', image: 'images/cat_ruby.png', priceCoins: 100000, priceStars: 2999, req: 100000 },
    galactic: { name: 'Галактический кот', image: 'images/cat_galactic.png', priceCoins: 1000000, priceStars: null, req: 1000000 }
};

async function changeSkin(skinId) {
    if (!gameData.skins.includes(skinId)) {
        Telegram.showAlert(`❌ У вас нет этого скина!\nКупите его в магазине`);
        return;
    }
    
    gameData.current_skin = skinId;
    await saveData();
    updateUI();
    Telegram.showAlert(`🐱 Скин изменён на ${SKINS[skinId].name}`);
}

async function buySkin(skinId, currency) {
    const skin = SKINS[skinId];
    
    if (gameData.skins.includes(skinId)) {
        Telegram.showAlert('✅ У вас уже есть этот скин!');
        return;
    }
    
    if (skin.req > 0 && gameData.total_clicks < skin.req && skin.priceCoins > 0) {
        Telegram.showAlert(`🔒 Скин откроется после ${skin.req.toLocaleString()} кликов!\nУ вас: ${gameData.total_clicks.toLocaleString()}`);
        return;
    }
    
    let price = currency === 'coins' ? skin.priceCoins : skin.priceStars;
    if (!price) {
        Telegram.showAlert('❌ Этот скин нельзя купить за эту валюту');
        return;
    }
    
    const currentAmount = currency === 'coins' ? gameData.coins : gameData.stars;
    if (currentAmount < price) {
        Telegram.showAlert(`💔 Не хватает ${currency === 'coins' ? 'монет' : 'звёзд'}!\nНужно: ${price}\nУ вас: ${currentAmount}`);
        return;
    }
    
    if (currency === 'coins') {
        gameData.coins -= price;
    } else {
        gameData.stars -= price;
    }
    
    gameData.skins.push(skinId);
    await saveData();
    await updateLeaderboard();
    updateUI();
    updateShopUI();
    Telegram.showAlert(`🎉 Поздравляем!\nВы купили ${skin.name}!`);
}

// ============ UI ОБНОВЛЕНИЯ ============
function updateUI() {
    document.getElementById('coinCount').textContent = gameData.coins.toLocaleString();
    document.getElementById('clickPower').textContent = gameData.click_power;
    document.getElementById('upgradeCount').textContent = gameData.upgrades;
    document.getElementById('upgradePrice').textContent = 50 * (gameData.upgrades + 1);
    document.getElementById('starsCount').textContent = gameData.stars;
    document.getElementById('totalClicks').textContent = gameData.total_clicks.toLocaleString();
    
    const catImg = document.getElementById('cat');
    catImg.src = SKINS[gameData.current_skin]?.image || SKINS.base.image;
}

function updateShopUI() {
    const container = document.getElementById('skinsShop');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (const [id, skin] of Object.entries(SKINS)) {
        if (id === 'base') continue;
        
        const owned = gameData.skins.includes(id);
        const unlockedByProgress = gameData.total_clicks >= skin.req;
        
        const div = document.createElement('div');
        div.className = 'skin-item';
        
        let statusHtml = '';
        if (owned) {
            statusHtml = '<span class="owned-badge">✅ Владелец</span>';
        } else if (!unlockedByProgress && skin.req > 0) {
            statusHtml = `<span class="locked-badge">🔒 ${skin.req.toLocaleString()} кликов</span>`;
        } else {
            statusHtml = `
                <button class="buy-coins" data-skin="${id}">💰 ${skin.priceCoins.toLocaleString()}</button>
                ${skin.priceStars ? `<button class="buy-stars" data-skin="${id}">⭐ ${skin.priceStars}</button>` : ''}
            `;
        }
        
        div.innerHTML = `
            <img src="${skin.image}" width="60" height="60" style="border-radius: 50%;">
            <div style="flex: 1;">
                <strong>${skin.name}</strong><br>
                <div class="skin-actions">
                    ${statusHtml}
                    ${owned ? `<button class="equip-skin" data-skin="${id}">🎽 Надеть</button>` : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    }
    
    document.querySelectorAll('.buy-coins').forEach(btn => {
        btn.addEventListener('click', () => buySkin(btn.dataset.skin, 'coins'));
    });
    document.querySelectorAll('.buy-stars').forEach(btn => {
        btn.addEventListener('click', () => buySkin(btn.dataset.skin, 'stars'));
    });
    document.querySelectorAll('.equip-skin').forEach(btn => {
        btn.addEventListener('click', () => changeSkin(btn.dataset.skin));
    });
}

function openSkinShop() {
    const modal = document.getElementById('skinModal');
    modal.style.display = 'flex';
    updateShopUI();
}

function closeSkinShop() {
    document.getElementById('skinModal').style.display = 'none';
}

function createFloatingNumber(x, y, value) {
    const div = document.createElement('div');
    div.className = 'floating-number';
    div.textContent = `+${value}`;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    document.getElementById('floatingNumbers').appendChild(div);
    setTimeout(() => div.remove(), 600);
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    await getOrCreateBin();
    updateUI();
    
    document.getElementById('cat').addEventListener('click', handleClick);
    document.getElementById('upgradeBtn').addEventListener('click', buyUpgrade);
    document.getElementById('dailyBtn').addEventListener('click', claimDaily);
    document.getElementById('skinsBtn').addEventListener('click', openSkinShop);
    document.getElementById('leaderboardBtn').addEventListener('click', showLeaderboard);
    document.getElementById('closeModal').addEventListener('click', closeSkinShop);
    
    document.getElementById('skinModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('skinModal')) closeSkinShop();
    });
    
    await updateLeaderboard();
});