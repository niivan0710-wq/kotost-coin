from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
import asyncio
from config import BOT_TOKEN

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# АДРЕС ВАШЕГО ХОСТИНГА (замените потом)
# Бесплатно: GitHub Pages, Vercel, Netlify
WEBAPP_URL = "https://your-username.github.io/kotost-coin/"  # 👈 СЮДА ВАШУ ССЫЛКУ

@dp.message(Command("start"))
async def start(message: types.Message):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🐱 Играть в Kotost Coin!",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])
    
    await message.answer(
        "🐾 **Kotost Coin** — нажимай на кота, копи монетки и улучшай лапу!\n\n"
        "👇 Нажми на кнопку, чтобы открыть игру",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())