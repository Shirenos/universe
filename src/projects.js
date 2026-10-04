// Данные «планет». Никаких личных данных — только публичные проекты.
export const PROJECTS = [
  {
    id: 'habit',
    name: 'Трекер привычек',
    kind: 'Telegram-бот',
    desc:
      'Бот в Telegram, который помогает выработать полезные привычки: добавляешь привычку, отмечаешь её каждый день и следишь за сериями прямо в мессенджере.',
    feats: [
      'Серии (streaks), лучший результат и статистика за последние 7 дней',
      'Ежедневные напоминания в выбранное время, с учётом часового пояса',
      'У каждого пользователя свои привычки — данные изолированы',
      'Тесты, автоматическая проверка кода (CI) и запуск в Docker',
    ],
    stack: ['Python', 'aiogram 3', 'SQLite', 'asyncio', 'Docker', 'GitHub Actions', 'pytest'],
    url: 'https://github.com/Shirenos/habit-tracker-bot',
    orbit: { radius: 8.8, speed: 0.115, phase: 0.6, incl: 0.05, tilt: 0.0 },
    body: { size: 1.25, spin: 0.12, colA: [0.02, 0.22, 0.2], colB: [0.1, 0.72, 0.46], colC: [0.7, 1.0, 0.55], atmo: [0.25, 1.0, 0.7], bands: 5, bandMix: 0.35, seed: 3.1 },
  },
  {
    id: 'schedule',
    name: 'Расписание вуза',
    kind: 'Telegram-бот @Shirenos_Schedule_Bot',
    desc:
      'Бот хранит расписание занятий под рукой: что сегодня, что завтра, вся неделя и ближайшая пара с обратным отсчётом. Умеет подтягивать расписание группы с сайта ТулГУ.',
    feats: [
      'Синхронизация с сайтом ТулГУ по номеру группы',
      'Удобные кнопки: листание дней и недель прямо в сообщении',
      'Напоминания за N минут до каждой пары',
      'Чётные и нечётные недели, фильтры подгрупп',
    ],
    stack: ['Python', 'aiogram 3', 'SQLite', 'httpx', 'asyncio', 'Docker', 'GitHub Actions'],
    url: 'https://github.com/Shirenos/university-schedule-bot',
    extra: { label: 'Открыть бота в Telegram ↗', url: 'https://t.me/Shirenos_Schedule_Bot' },
    orbit: { radius: 13.2, speed: 0.082, phase: 2.9, incl: -0.07, tilt: 0.0 },
    body: { size: 1.55, spin: 0.09, colA: [0.06, 0.05, 0.3], colB: [0.38, 0.28, 0.95], colC: [0.5, 0.85, 1.0], atmo: [0.5, 0.55, 1.0], bands: 9, bandMix: 0.75, seed: 9.7, ring: true },
  },
  {
    id: 'universe',
    name: 'Эта Вселенная',
    kind: 'Сайт на Three.js',
    desc:
      'Сайт, на котором ты сейчас находишься: интерактивный 3D-космос, где проекты — планеты. Шейдеры, постобработка и аккуратная оптимизация, всё это статикой на GitHub Pages.',
    feats: [
      'Шейдерное звёздное поле, туманность и полярное сияние',
      'Bloom, кометы, пояс астероидов и свечение атмосфер',
      'Адаптив под телефон, ограничение pixelRatio, автоснижение качества',
      'prefers-reduced-motion и кнопка отключения анимаций',
    ],
    stack: ['Three.js', 'GLSL', 'Vite', 'JavaScript', 'GitHub Actions', 'GitHub Pages'],
    url: 'https://github.com/Shirenos/universe',
    orbit: { radius: 23.5, speed: 0.052, phase: 4.7, incl: 0.1, tilt: 0.0 },
    body: { size: 1.4, spin: 0.15, colA: [0.32, 0.03, 0.28], colB: [0.95, 0.25, 0.65], colC: [1.0, 0.75, 0.4], atmo: [1.0, 0.4, 0.8], bands: 6, bandMix: 0.5, seed: 17.3, halo: true },
  },
];
