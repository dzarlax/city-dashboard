# Line Data Update Scripts

Скрипты для обновления данных о линиях общественного транспорта Белграда.

## Структура

- `update_line_data.py` - Генерирует `line_mapping.json` и `line_details.json` из файла `lines`

## Как обновить данные

### Способ 1: Через npm (рекомендуется)

```bash
npm run update-lines
```

### Способ 2: Прямой запуск Python

```bash
python scripts/update_line_data.py
```

## Что делают скрипты

1. **Читает файл `lines`** из корня проекта
2. **Генерирует `line_mapping.json`**:
   - Маппинг номера линии → kod_linije (для URL)
   - Поддерживает и кириллицу, и латиницу (например, `7L` и `7Л`)
   - 643 записи

3. **Генерирует `line_details.json`**:
   - Детальная информация о каждой линии
   - Тип транспорта (аутобус, трамвај, etc.)
   - Категория линии (1, 2, 3, Tramvaji, etc.)
   - Полный список улиц маршрута (в среднем 17 улиц на линию)
   - 643 записи

## Получение файла `lines`

Файл `lines` содержит данные с BG Prevoz API. Для обновления:

1. Скачать актуальные данные с BG Prevoz
2. Сохранить как `lines` в корень проекта
3. Запустить `npm run update-lines`

## Формат файла `lines`

```json
{
  "linije": [
    {
      "kod_linije": 30002,
      "prikazan_kod_linije": "2A",
      "tip_linije": "аутобус",
      "kategorija_linije": "1",
      "pocetni_terminus": "...",
      "krajnji_terminus": "...",
      "zona": "ИТС 1",
      "verzije": [
        {
          "spisak_ulica_smer_a": "Улица 1 - Улица 2 - ...",
          "spisak_ulica_smer_b": "Улица 5 - Улица 4 - ..."
        }
      ]
    }
  ]
}
```

## Статистика

После генерации скрипт покажет:

- Общее количество линий в маппинге
- Количество линий с détaльной информацией
- Количество линий со списками улиц
- Среднее количество улиц на линию
- Распределение по категориям

## Использование в коде

```javascript
import lineMapping from '../line_mapping.json';
import lineDetails from '../line_details.json';
import { getLineUrl, getLineTooltip } from '../utils/helpers';

// Получить URL линии
const url = getLineUrl('7L', 'BG');
// → https://www.bgprevoz.rs/linije/red-voznje/smer-a/21001

// Получить tooltip с информацией
const tooltip = getLineTooltip('7L', 'BG');
// → "7L (Минibus)\nУлица 1 → Улица 2 → ..."
```

## Кодировки

Скрипт автоматически создаёт оба варианта кодировки:
- Кириллица (из API): `7Л`, `2А`, `26Л`
- Латиница (для фронтенда): `7L`, `2A`, `26L`

Это гарантирует, что маппинг работает независимо от того, в какой кодировке приходит номер линии от API.
