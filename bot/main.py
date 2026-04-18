from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
import asyncio
import json
from config import BOT_TOKEN, API_URL
from database import init_db, get_leaderboard, create_user, get_user, claim_daily

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start(message: types.Message):
    args = message.text.split()
    referrer_id = None
    
    if len(args) > 1:
        try:
            referrer_id = int(args[1])
            if referrer_id == message.from_user.id:
                referrer_id = None
        except:
            pass
    
    user = get_user(message.from_user.id)
    if not user:
        user = create_user(message.from_user.id, message.from_user.username, referrer_id)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🐱 Играть в Kotost Coin!", web_app=WebAppInfo(url=API_URL))],
        [InlineKeyboardButton(text="🏆 Топ игроков", callback_data="leaderboard")],
        [InlineKeyboardButton(text="👥 Реферальная система", callback_data="referral")]
    ])
    
    await message.answer(
        f"🐾 **Добро пожаловать, {message.from_user.first_name}!**\n\n"
        f"💰 Монет: {user['coins']}\n"
        f"⭐ Звёзд: {user['stars']}\n"
        f"🐱 Текущий скин: {user['current_skin']}\n\n"
        f"👇 Нажми на кнопку, чтобы открыть игру",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )

@dp.callback_query(lambda c: c.data == "leaderboard")
async def show_leaderboard(callback: types.CallbackQuery):
    leaders = get_leaderboard(20)
    
    if not leaders:
        text = "🏆 **Топ игроков**\n\nПока никого нет. Будь первым!"
    else:
        text = "🏆 **Топ игроков по монетам**\n\n"
        for i, player in enumerate(leaders, 1):
            medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(i, "📌")
            text += f"{medal} {player['username']} — {player['coins']} 🪙\n"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")]
    ])
    
    await callback.message.edit_text(text, reply_markup=keyboard)
    await callback.answer()

@dp.callback_query(lambda c: c.data == "referral")
async def show_referral(callback: types.CallbackQuery):
    user = get_user(callback.from_user.id)
    bot_username = (await bot.get_me()).username
    ref_link = f"https://t.me/{bot_username}?start={callback.from_user.id}"
    
    text = f"👥 **Реферальная система**\n\n"
    text += f"Приглашай друзей и получай бонусы!\n\n"
    text += f"🔗 **Твоя ссылка:**\n`{ref_link}`\n\n"
    text += f"⭐ **Бонус:** +50 звёзд за каждого друга\n"
    text += f"💰 Друг получает +100 монет на старте\n\n"
    text += f"👥 Приглашено друзей: {get_referrals_count(callback.from_user.id)}"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Скопировать ссылку", callback_data=f"copy_{ref_link}")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")]
    ])
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")
    await callback.answer()

@dp.callback_query(lambda c: c.data == "back_to_menu")
async def back_to_menu(callback: types.CallbackQuery):
    user = get_user(callback.from_user.id)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🐱 Играть в Kotost Coin!", web_app=WebAppInfo(url=API_URL))],
        [InlineKeyboardButton(text="🏆 Топ игроков", callback_data="leaderboard")],
        [InlineKeyboardButton(text="👥 Реферальная система", callback_data="referral")]
    ])
    
    await callback.message.edit_text(
        f"🐾 **Главное меню**\n\n"
        f"💰 Монет: {user['coins']}\n"
        f"⭐ Звёзд: {user['stars']}\n"
        f"🐱 Текущий скин: {user['current_skin']}",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )
    await callback.answer()

def get_referrals_count(user_id):
    from database import conn
    conn = sqlite3.connect('kotost.db')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM users WHERE referrer_id = ?', (user_id,))
    count = cursor.fetchone()[0]
    conn.close()
    return count

async def main():
    init_db()
    print("🐱 Бот Kotost Coin запущен!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())