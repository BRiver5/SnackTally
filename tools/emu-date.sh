#!/bin/bash
# Сдвиг системной даты эмулятора для скриншотов с историей (шаг 5), из папки проекта:
#   bash tools/emu-date.sh -2 "14 August 2026"   # 2 раза "Previous month" в пикере, потом день
#   bash tools/emu-date.sh 0 "05 October 2026"   # день — ДВУМЯ цифрами, как в content-desc пикера
#   bash tools/emu-date.sh restore               # вернуть автоматическое время
# Порядок (обкатан на Second Thought / Spare Key Circle, 26.10.2026):
#   1) на РЕАЛЬНОЙ дате `bash tools/emu.sh open` — с датой в прошлом Expo Go проект
#      не грузит ("Something went wrong");
#   2) этот скрипт: меняет дату в Settings и возвращает уже открытое Expo Go через
#      двойной APP_SWITCH, без перезагрузки — JS читает системные часы вживую;
#   3) в приложении нужен refresh по AppState "active", чтобы "сегодня" пересчиталось;
#   4) правки кода на прошлой дате Metro не применит — вернуть дату, `open`, снова сдвинуть.
export MSYS_NO_PATHCONV=1
ADB=/d/Programering/dev-deps/android-sdk/platform-tools/adb.exe
if [ "$1" = "restore" ]; then
  "$ADB" shell settings put global auto_time 1
  "$ADB" shell date
  exit 0
fi
"$ADB" shell settings put global auto_time 0
"$ADB" shell am start -a android.settings.DATE_SETTINGS >/dev/null 2>&1
sleep 1.5
bash tools/emu.sh tapre "^[A-Z][a-z]+ [0-9]+, 20[0-9][0-9]$" >/dev/null
sleep 1
n=$1; btn="Previous month"; [ "$n" -gt 0 ] && btn="Next month"; n=${n#-}
for i in $(seq 1 "$n"); do bash tools/emu.sh tap "$btn" >/dev/null; sleep 0.6; done
bash tools/emu.sh tap "$2" >/dev/null || { echo "нет дня $2 в пикере (день двумя цифрами?)"; exit 1; }
bash tools/emu.sh tap "OK" >/dev/null
sleep 0.5
"$ADB" shell input keyevent KEYCODE_APP_SWITCH; sleep 1.2; "$ADB" shell input keyevent KEYCODE_APP_SWITCH; sleep 2
"$ADB" shell date
