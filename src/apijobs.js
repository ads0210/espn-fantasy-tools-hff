/**
 * Site API's jobs, for Site Backend's Jobs panel: every job on the Site API page (platform key and name, job key and
 * title) and the name each example sends. Generated from app/site-api/guides.js; test/siteapi.mjs checks it against
 * the guides, so the two cannot drift.
 */
export const JOBS = [
  ["sheets","Google Sheets","standings","Keep the standings in a sheet"],
  ["sheets","Google Sheets","left","List who’s left to play"],
  ["sheets","Google Sheets","log","Log league activity as rows"],
  ["sheets","Google Sheets","email","A daily email of the standings (Apps Script)"],
  ["sheets","Google Sheets","waivers","A waiver-wire shortlist every Tuesday"],
  ["excel","Excel","standings","Keep the standings in a sheet"],
  ["excel","Excel","chart","Chart weekly points"],
  ["excel","Excel","left","List who’s left to play"],
  ["excel","Excel","freeagents","Rank the free agents"],
  ["python","Python","score","Show my live score"],
  ["python","Python","bot","Post new league activity to Discord or Slack"],
  ["python","Python","save","Save the whole league once a day"],
  ["python","Python","chart","Chart weekly points"],
  ["python","Python","lineup","Check my lineup before kickoff"],
  ["python","Python","pandas","Explore the league in pandas"],
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
  ["ha","Home Assistant","sensor","My live score as a sensor"],
  ["ha","Home Assistant","trade","A notification when a trade is offered"],
  ["ha","Home Assistant","lead","A notification when the lead changes"],
  ["chat","Discord or Slack","activity","Post new league activity"],
  ["chat","Discord or Slack","sunday","Post the scores on Sundays"],
  ["chat","Discord or Slack","injuries","Post injury news for every rostered player"],
  ["chat","Discord or Slack","recap","Post the week’s results on Tuesdays"],
  ["chat","Discord or Slack","rivalry","Post a rivalry preview for each matchup"],
  ["calendar","Calendar","gcal","My matchups in Google Calendar"],
  ["calendar","Calendar","ics","A calendar file of the season"],
];

/** Each name an example sends, and the jobs (platform.job) that send it. */
export const JOB_NAMES = {
  "standings-sheet": [
    "sheets.standings"
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
  "excel-standings": [
    "excel.standings"
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
  "home-assistant": [
    "ha.sensor",
    "ha.lead"
  ],
  "home-assistant-trades": [
    "ha.trade"
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
  "gcal-matchups": [
    "calendar.gcal"
  ],
  "season-ics": [
    "calendar.ics"
  ]
};
