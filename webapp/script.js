let Telegram = window.Telegram.WebApp;
Telegram.expand(); // Растянуть на весь экран

// Данные игры
let coins = 0;
let clickPower = 1;
let upgrades = 0;

// DOM элементы
const coinCountEl = document.getElementById('coinCount');
const clickPowerEl = document.getElementById('clickPower');
const upgradeCountEl = document.getElementById('upgradeCount');
const upgradePriceEl = document.getElementById('upgradePrice');
const catImg = document.getElementById('cat');
const floatingNumbersDiv = document.getElementById('floatingNumbers');

// Цена улучшения
function getUpgradePrice() {
    return 50 * (upgrades + 1);
}

// Обновить интерфейс
function updateUI() {
    coinCountEl.textContent = coins;
    clickPowerEl.textContent = clickPower;
    upgradeCountEl.textContent = upgrades;
    upgradePriceEl.textContent = getUpgradePrice();
}

// Создать всплывающую цифру
function createFloatingNumber(x, y, value) {
    const div = document.createElement('div');
    div.className = 'floating-number';
    div.textContent = `+${value}`;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    floatingNumbersDiv.appendChild(div);
    
    setTimeout(() => div.remove(), 600);
}

// Клик по коту
function handleClick(event) {
    const rect = catImg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    coins += clickPower;
    createFloatingNumber(x, y, clickPower);
    updateUI();
    saveData();
    
    // Анимация кота
    catImg.style.transform = 'scale(0.95)';
    setTimeout(() => {
        catImg.style.transform = 'scale(1)';
    }, 100);
}

// Купить улучшение
function buyUpgrade() {
    const price = getUpgradePrice();
    if (coins >= price) {
        coins -= price;
        clickPower++;
        upgrades++;
        updateUI();
        saveData();
        
        // Визуальный фидбек
        const btn = document.getElementById('upgradeBtn');
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 100);
    } else {
        // Встряска кнопки при недостатке монет
        const btn = document.getElementById('upgradeBtn');
        btn.style.animation = 'shake 0.3s ease';
        setTimeout(() => {
            btn.style.animation = '';
        }, 300);
    }
}

// Сохранить данные через Telegram Cloud Storage
function saveData() {
    Telegram.CloudStorage.setItem('gameData', JSON.stringify({
        coins: coins,
        clickPower: clickPower,
        upgrades: upgrades
    }));
}

// Загрузить данные
function loadData() {
    Telegram.CloudStorage.getItem('gameData', (error, value) => {
        if (value) {
            try {
                const data = JSON.parse(value);
                coins = data.coins || 0;
                clickPower = data.clickPower || 1;
                upgrades = data.upgrades || 0;
                updateUI();
            } catch(e) {}
        }
    });
}

// Добавляем анимацию встряски
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Обработчики событий
catImg.addEventListener('click', handleClick);
document.getElementById('upgradeBtn').addEventListener('click', buyUpgrade);

// Загрузка данных
loadData();

// Закрыть приложение при свайпе вниз (опционально)
Telegram.MainButton.hide();