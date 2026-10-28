/**
 * Site API's jobs, for Site Backend's Jobs panel: every job on the Site API page (platform key and name, job key and
 * title) and the name each example sends. Generated from app/site-api/guides.js; test/siteapi.mjs checks it against
 * the guides, so the two cannot drift.
 */
export const JOBS = [
  ["sheets","Google Sheets","standings","Keep the standings in a sheet"],
  ["sheets","Google Sheets","records","Keep the season’s records in a sheet"],
  ["sheets","Google Sheets","insights","Keep this week’s insights in a sheet"],
  ["sheets","Google Sheets","left","List who’s left to play"],
  ["sheets","Google Sheets","log","Log league activity as rows"],
  ["sheets","Google Sheets","email","A daily email of the standings (Apps Script)"],
  ["sheets","Google Sheets","waivers","A waiver-wire shortlist every Tuesday"],
  ["sheets","Google Sheets","bye","A bye-week grid for my roster"],
  ["sheets","Google Sheets","odds","Track the playoff odds week by week"],
  ["sheets","Google Sheets","dashboard","A season dashboard in Looker Studio"],
  ["excel","Excel","standings","Keep the standings in a sheet"],
  ["excel","Excel","records","Keep the season’s records in a sheet"],
  ["excel","Excel","chart","Chart weekly points"],
  ["excel","Excel","left","List who’s left to play"],
  ["excel","Excel","freeagents","Rank the free agents"],
  ["excel","Excel","bye","A bye-week grid for my roster"],
  ["python","Python","score","Show my live score"],
  ["python","Python","bot","Post new league activity to Discord or Slack"],
  ["python","Python","save","Save the whole league once a day"],
  ["python","Python","chart","Chart weekly points"],
  ["python","Python","lineup","Check my lineup before kickoff"],
  ["python","Python","pandas","Explore the league in pandas"],
  ["python","Python","bye","Plan around bye weeks"],
  ["python","Python","odds","Chart the playoff race"],
  ["python","Python","injurymail","An alert when a player’s injury status changes by email"],
  ["python","Python","awardsmail","Weekly awards by email"],
  ["node","JavaScript (Node)","score","Show my live score"],
  ["node","JavaScript (Node)","bot","Post new league activity to Discord or Slack"],
  ["node","JavaScript (Node)","save","Save the whole league once a day"],
  ["powershell","PowerShell (Windows)","save","Save the whole league once a day"],
  ["powershell","PowerShell (Windows)","score","Show my live score"],
  ["shell","curl and a shell (macOS, Linux)","save","Save the whole league once a day"],
  ["shell","curl and a shell (macOS, Linux)","csv","Keep a standings CSV current"],
  ["iphone","iPhone and iPad","score","My live score as a widget or a notification"],
  ["iphone","iPhone and iPad","left","Who’s left to play"],
  ["iphone","iPhone and iPad","lineup","Lineup check on Sunday morning"],
  ["android","Android","tap","My live score with a one-tap shortcut"],
  ["android","Android","tasker","A scheduled check with Tasker"],
  ["android","Android","close","A close-game alert with Tasker"],
  ["ha","Home Assistant","sensor","My live score as a sensor"],
  ["ha","Home Assistant","trade","A notification when a trade is offered"],
  ["ha","Home Assistant","lead","A notification when the lead changes"],
  ["ha","Home Assistant","close","A notification when my game is close late"],
  ["ha","Home Assistant","injury","A notification when a player’s injury status changes"],
  ["chat","Discord or Slack","activity","Post new league activity"],
  ["chat","Discord or Slack","sunday","Post the scores on Sundays"],
  ["chat","Discord or Slack","injuries","Post injury news for every rostered player"],
  ["chat","Discord or Slack","recap","Post the week’s results on Tuesdays"],
  ["chat","Discord or Slack","rivalry","Post a rivalry preview for each matchup"],
  ["chat","Discord or Slack","drop","A notable drop alert"],
  ["chat","Discord or Slack","trade","Post a breakdown of each trade offer"],
  ["chat","Discord or Slack","decided","A post when a team clinches or is eliminated"],
  ["chat","Discord or Slack","awards","Weekly awards"],
  ["calendar","Calendar","gcal","My matchups in Google Calendar"],
  ["calendar","Calendar","ics","A calendar file of the season"],
  ["ntfy","ntfy (phone alerts)","close","A close-game alert"],
  ["ntfy","ntfy (phone alerts)","injury","An alert when a player’s injury status changes"],
  ["ntfy","ntfy (phone alerts)","drop","A notable drop alert"],
  ["ntfy","ntfy (phone alerts)","decided","A post when a team clinches or is eliminated"],
  ["telegram","Telegram","close","A close-game alert"],
  ["telegram","Telegram","injury","An alert when a player’s injury status changes"],
  ["telegram","Telegram","drop","A notable drop alert"],
  ["telegram","Telegram","decided","A post when a team clinches or is eliminated"],
  ["telegram","Telegram","awards","Weekly awards"],
  ["groupme","GroupMe","close","A close-game alert"],
  ["groupme","GroupMe","injury","An alert when a player’s injury status changes"],
  ["groupme","GroupMe","drop","A notable drop alert"],
  ["display","Desk and TV displays","tv","The whole league live on a TV or in OBS"],
  ["display","Desk and TV displays","menubar","My score in the macOS menu bar"],
  ["display","Desk and TV displays","pi","A desk scoreboard on a Raspberry Pi"],
  ["display","Desk and TV displays","esp32","A pocket scoreboard on an ESP32"],
  ["data","Dashboards and SQL","duckdb","Ask the league anything in SQL (DuckDB)"],
  ["data","Dashboards and SQL","grafana","A season dashboard in Grafana"],
];

/** Each name an example sends, and the jobs (platform.job) that send it. */
export const JOB_NAMES = {
  "standings-sheet": [
    "sheets.standings"
  ],
  "records-sheet": [
    "sheets.records"
  ],
  "insights-sheet": [
    "sheets.insights"
  ],
  "left-to-play": [
    "sheets.left"
  ],
  "activity-log": [
    "sheets.log"
  ],
  "standings-email": [
    "sheets.email"
  ],
  "waiver-shortlist": [
    "sheets.waivers"
  ],
  "sheets-byes": [
    "sheets.bye"
  ],
  "sheets-odds": [
    "sheets.odds"
  ],
  "looker-season": [
    "sheets.dashboard"
  ],
  "excel-standings": [
    "excel.standings"
  ],
  "excel-records": [
    "excel.records"
  ],
  "excel-weekly": [
    "excel.chart"
  ],
  "excel-left": [
    "excel.left"
  ],
  "excel-free-agents": [
    "excel.freeagents"
  ],
  "excel-byes": [
    "excel.bye"
  ],
  "live-score": [
    "python.score"
  ],
  "activity-bot": [
    "python.bot",
    "chat.activity"
  ],
  "daily-save": [
    "python.save"
  ],
  "weekly-chart": [
    "python.chart"
  ],
  "lineup-check": [
    "python.lineup"
  ],
  "pandas": [
    "python.pandas"
  ],
  "bye-planner": [
    "python.bye"
  ],
  "odds-chart": [
    "python.odds"
  ],
  "injury-watch-email": [
    "python.injurymail"
  ],
  "weekly-awards-email": [
    "python.awardsmail"
  ],
  "live-score-js": [
    "node.score"
  ],
  "activity-bot-js": [
    "node.bot"
  ],
  "daily-save-js": [
    "node.save"
  ],
  "daily-save-ps": [
    "powershell.save"
  ],
  "live-score-ps": [
    "powershell.score"
  ],
  "daily-save-sh": [
    "shell.save"
  ],
  "standings-csv": [
    "shell.csv"
  ],
  "iphone-score": [
    "iphone.score"
  ],
  "iphone-left": [
    "iphone.left"
  ],
  "iphone-lineup": [
    "iphone.lineup"
  ],
  "android-score": [
    "android.tap"
  ],
  "tasker": [
    "android.tasker"
  ],
  "tasker-close": [
    "android.close"
  ],
  "home-assistant": [
    "ha.sensor",
    "ha.lead"
  ],
  "home-assistant-trades": [
    "ha.trade"
  ],
  "ha-injuries": [
    "ha.injury"
  ],
  "sunday-scores": [
    "chat.sunday"
  ],
  "injury-news": [
    "chat.injuries"
  ],
  "weekly-recap": [
    "chat.recap"
  ],
  "rivalry-preview": [
    "chat.rivalry"
  ],
  "notable-drops-chat": [
    "chat.drop"
  ],
  "trade-breakdown": [
    "chat.trade"
  ],
  "playoff-race-chat": [
    "chat.decided"
  ],
  "weekly-awards-chat": [
    "chat.awards"
  ],
  "gcal-matchups": [
    "calendar.gcal"
  ],
  "season-ics": [
    "calendar.ics"
  ],
  "close-game-ntfy": [
    "ntfy.close"
  ],
  "injury-watch-ntfy": [
    "ntfy.injury"
  ],
  "notable-drops-ntfy": [
    "ntfy.drop"
  ],
  "playoff-race-ntfy": [
    "ntfy.decided"
  ],
  "close-game-telegram": [
    "telegram.close"
  ],
  "injury-watch-telegram": [
    "telegram.injury"
  ],
  "notable-drops-telegram": [
    "telegram.drop"
  ],
  "playoff-race-telegram": [
    "telegram.decided"
  ],
  "weekly-awards-telegram": [
    "telegram.awards"
  ],
  "close-game-groupme": [
    "groupme.close"
  ],
  "injury-watch-groupme": [
    "groupme.injury"
  ],
  "notable-drops-groupme": [
    "groupme.drop"
  ],
  "league-ticker": [
    "display.tv"
  ],
  "menu-bar": [
    "display.menubar"
  ],
  "desk-scoreboard": [
    "display.pi"
  ],
  "esp32-scoreboard": [
    "display.esp32"
  ],
  "league-sql": [
    "data.duckdb"
  ],
  "grafana-season": [
    "data.grafana"
  ]
};
