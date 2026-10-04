# ESPN Fantasy Tools

> [!IMPORTANT]
> **Setting up your own copy?** Start with the **[setup guide](setup-guide.md)**. It walks you from forking this
> repository to finishing the setup wizard, in about twenty minutes. This page describes the site once it is
> running.

A private website for one ESPN fantasy football league. It reads your league from ESPN, keeps it up to date on its
own, and adds tools ESPN does not have: a live draft board, minute-by-minute charts of every matchup, the league's
record book, every way the rest of the season can go, a breakdown of every trade offer, and more.

Everything sits behind one password you share with your league. Nobody without it sees anything at all.

---

## Contents

- [Signing in](#signing-in)
- [The home page](#the-home-page)
- [On every page: help and settings](#on-every-page-help-and-settings)
- [The tools](#the-tools)
  - [Draft Helper](#draft-helper) · [Live Matchups](#live-matchups) · [Hall of Fame](#hall-of-fame) ·
    [Fortune Teller](#fortune-teller) · [Trade Analyzer](#trade-analyzer) · [LLM Data Export](#llm-data-export) ·
    [Site API](#site-api) · [Site Backend](#site-backend)
- [Site Configuration](#site-configuration)
- [The setup wizard](#the-setup-wizard)
- [How it all works](#how-it-all-works)

---

## Signing in

Everyone in the league signs in with the same **League Password**. Whoever administers this site sets it during
setup and can change it at any time.

- **Type it, don't paste it.** The field refuses pasted text on purpose; the eye button shows what you typed, so a
  stray character can't lock you out.
- **You stay signed in** for about eight hours on each device.
- **Several wrong attempts in a row** slow the next ones down for a few minutes.

There is a second password, the **Admin Password**, for whoever administers the site. It opens
[Site Configuration](#site-configuration) and any tool set to admin-only, and it is asked for again every time it is
needed rather than kept.

---

## The home page

The home page is the league at a glance. It follows **your team**: pick it once near the top, and the matchup card,
the injury watch and your row in the standings all follow it. Every tool shares the same choice, so you only make it
once.

| Part | What it shows |
| --- | --- |
| **Matchups strip** | This week's fantasy matchups: live scores and projections, moving while games are on |
| **NFL strip** | The NFL games behind them, with scores and kickoff times |
| **Your matchup** | This week's score, projection and win chance for you and your opponent, with a countdown to the next kickoff |
| **Standings** | The full table, sortable on any column: record, points for and against, streak, ESPN's **Playoff %**, and **Sim %** once [Fortune Teller](#fortune-teller) has run. A **Playoffs** line marks the last playoff place. After the regular season every team reads **Clinched** or **Eliminated** |
| **Tools** | One tile per tool. Which tiles appear, and in what order, is set by whoever administers the site. A tool kept for admins shows a lock |
| **Injury watch** | Injuries on your own roster |
| **League activity** | Every completed add, drop and trade, one line per transaction, and every trade offer with where it stands (on the table, rejected, withdrawn, expired, pending approval or completed). Starts at the last seven days; change the range to look further back |
| **Around the league** | Headlines from across the NFL |

> [!NOTE]
> A waiver claim that hasn't run yet is never shown to anyone, on any page. ESPN keeps them private, and so does
> this site.

**When the site is updated**, a short note on the home page says what changed, once per browser. If an update needs
data the site has never fetched, a banner asks whoever administers the site to pull it from Site Configuration.

---

## On every page: help and settings

Every page has the same two buttons in its top corner.

- **Help (the question mark)** opens a short, numbered guide to that page.
- **Settings (the gear)** holds three choices that apply to you alone, on every page:
  - **Reduce motion** stills the moving background.
  - **Light theme**, for those who must.
  - **Time zone**: every time on the site is shown in the zone you pick, or your device's own.

The **← Back to home** button sits at the foot of every page.

---

## The tools

Each tool can be **visible** to the whole league, **admin-only** (listed on the home page with a lock, and opened
with the Admin Password), or **hidden**. Whoever administers the site chooses, tool by tool.

### Draft Helper

*Live draft board, roster needs and recommended targets.* For the day of the draft.

- **The clock.** Before the draft it counts down; during it, it names who is on the clock and which pick they are on.
- **Your roster and needs**, filled in as you pick, using your league's own lineup slots, bench size and position
  limits (including superflex and leagues without a kicker).
- **Targets.** Every available player in ADP order. Star the ones you want to remember and hide the ones you never
  want to see again; **emphasis** floats one position to the top without hiding the rest.
- **The board.** Every pick of the draft, your own highlighted. Empty cells show the overall pick number, so you can
  count forward to your next turn. Snake and straight drafts both work, and a traded pick is shown in its original
  place with the team that now holds it.

### Live Matchups

*This week's scoreboard, lineups and live win probability.*

- **Every matchup this week**, yours first, with a split bar showing ESPN's own win chance as it moves.
- **Full breakdown** opens both lineups player by player, scoring by position, the week's booms and busts, the NFL
  games your players are in, and your record against that opponent.
- **The shape of the week.** Score and win chance are recorded every minute of every game, so you can see exactly
  where a matchup turned even if you missed it. Quiet stretches are squeezed up so the games fill the chart.
- **Look back** through weeks already played with the arrows beside the week, each with its final scores and charts.

### Hall of Fame

*Champions, all-time standings and every team's record.* The league's record book, built from every season it has
played.

- **Champions**: one plaque per completed season, newest first.
- **League records**: every all-time superlative (highest and lowest scores, biggest blowouts, closest games, longest
  streaks and more) and who holds it. When teams are tied, all of them are listed.
- **All-time standings**: every team that has ever played in the league, sortable on any column, with the regular
  season and the postseason shown separately.
- **Team records**: open any team for its season-by-season history and its head-to-head record against every other
  team, down to each game.

### Fortune Teller

*Every way the rest of the season can go, and where each leaves you.*

Near the end of the regular season, the site counts **every** possible way the remaining games can finish, exactly,
not by sampling. Fortune Teller then shows where each of those ways leaves every team.

- **The dial** shows your playoff chances, and the **finish board** your chance of every place from first to last.
- **The map.** Every remaining game is a switch with three results: either team wins, or they tie. Each result is
  coloured by where it would leave you (green for a playoff place, amber for level on record at the cut, red for
  outside). **Tap a result to set it**, and every figure recounts over only the ways the season can go where that
  happens. Games that stop mattering to you fold away.
- **Jumps**: your best path, ESPN's projected winners, the simplest path to a playoff place, winning out and losing out.
- **Standings and brackets** for whatever path is on screen, with teams level on record grouped so you can order them.
- **What-if**: once games inside the counted weeks have been played, change a result that already happened and see how
  things would have turned out.
- **Share** the exact path you are looking at with a link.

Before the map can be built (the site works out when the league is close enough to the end), the page shows ESPN's
playoff odds, the standings as they are, and both brackets seeded from them. After the regular season it becomes a
final page: your season's result, how your odds moved week by week, the final standings and the postseason brackets.

> [!TIP]
> Fortune Teller starts switched off. Whoever administers the site switches it on once in Site Configuration; from
> then on it builds the map by itself as soon as it can and moves it on each week as results come in.

### Trade Analyzer

*Every offer on the table, broken down for both sides.*

- **On the table**: every trade proposed in the league and not yet answered, already analysed. Open one for the full
  breakdown. Nothing here accepts, declines or changes anything in ESPN.
- **Build a trade** between any two teams, not just yours: tap players on either roster and the verdict follows as you
  go. A standing offer can be opened in the builder and taken apart.
- **Twenty-eight statistics** judge every deal, grouped the way the breakdown shows them; eleven have a slider you can
  move for yourself. Whoever administers the site can set the league's own weighting in Site Configuration.
- **What the statistics read**: ESPN's updated projection for every player, each week he has played this season, last
  season, his bye week and his team's depth chart, the free agents your league has available, and ESPN's own playoff
  odds. The figure beside each player is his projected points over the rest of the season. A statistic whose data is
  not there yet (early in the season, say) is shown greyed and counts for nothing, rather than being guessed.
- **The balance meter** leans toward the side the deal favours. Red at either end means far from even, not good or
  bad, and the verdict also says whether anyone is actually gaining.
- **Suggestions**: when a deal leans far enough, up to three single changes that bring it closer to even.
- **Copy link** hands someone the exact trade on screen.

### LLM Data Export

*For those who wish to outsource their thinking.* One file holding the whole league (rules and scoring, every
roster, the standings, this week, the schedule, the best available players, transactions, trade offers, the NFL
calendar and league history), plus a prompt that tells an AI chat assistant how to read it.

- **Choose your team** and the file marks it; the prompt is written from your side.
- **Full or compact**: compact keeps what a weekly decision needs at well under half the size, for assistants that
  struggle with long files.
- **Copy or download**, then paste the prompt into a new chat and attach the file to the same message. Each copy or
  download is brought up to date first.
- **Never in it**: owner names, passwords, ESPN sign-in details, or pending waiver claims for any team.

### Site API

*Your league's data for spreadsheets, scripts and phones.* A small, read-only way for programs to read the league,
and a page that shows how to use it on the tools people already have.

- **The league's key.** One key for the whole league, shown behind dots until you press **Show**. It opens the API
  and nothing else on the site.
- **Five addresses** answer everything: the scoreboard, the standings, the rosters, league activity, and one for all
  of it. **Try it** shows exactly what a program gets.
- **Guides for eleven platforms and 37 jobs**: Google Sheets, Excel, Python, JavaScript, PowerShell, a Mac or Linux
  shell, iPhone and iPad, Android, Home Assistant, Discord or Slack, and your calendar. Each job has its steps, its
  code with the key and your team filled in, and a picture of it working.
- **How often to ask.** Programs should ask about once a minute. The site slows that figure when it is busy and sends
  it with every answer; a program that asks sooner is told to wait instead of being answered, and every example on
  the page pauses or stops itself when it is.
- **Troubleshooting**: every message a program can get, what it means and what to do.
- **Dataset downloads**: every part of the league's data as a JSON or CSV file, with a preview first. No key needed.

> [!NOTE]
> Site API starts **admin-only**. Whoever administers the site can open it to find the key, make it visible to every
> member, switch the API off, or replace the key (it is also replaced automatically, every 90 days by default, with a
> week's notice in every answer). Changing the League Password replaces it at once.

### Site Backend

*How the site is running: health, data, traffic, and logs.* A read-only window for whoever administers the site.
It starts admin-only.

- **Overview**: one word for how the site is doing, a heartbeat of the site's once-a-minute work, anything that needs
  a look (each with a button to the panel explaining it), and the site's use of its free daily allowance.
- **Activity**: the site's log. Visits and sign-ins name the team chosen on that browser and nothing else about a
  visitor. Each hour's status report folds into one line.
- **A tab for every page** of the site: what that page reads, how fresh it is, who visited, and its part of the log.
- **The Site API tab** shows who is asking the API how often. Addresses are never shown, only a name like `IPv4:3`
  (yours is marked **You**). When one asks far more than it should, **High activity** names the team most likely
  behind it, but only after the Admin Password is given again, and only until you leave the page.

Looking at Site Backend never changes anything. To act on something you see there, use Site Configuration.

---

## Site Configuration

The site's controls, for whoever administers it. The Admin Password is asked for when the page opens and checked
again on every change; nothing stays unlocked after you close the tab. Every panel starts shut: choose its header to
open it.

| Panel | What you can do |
| --- | --- |
| **League connection** | See which league, season and history the site is pointed at |
| **ESPN cookies** | Replace them when league data stops loading (for a private league, ESPN's sign-in expires now and then). The site tests them against ESPN before saving |
| **Passwords** | Change the League Password or the Admin Password. Changing the League Password also replaces the Site API key |
| **Tools** | Set each tool to visible, admin-only or hidden. At least one league tool always stays visible |
| **Home page order** | Move tiles up or down; the home page follows at once. Reset puts the original order back |
| **Site API** | Switch the API on or off, replace the key now (gently, or at once after a leak), choose how often it is replaced, and whether the key may be sent in an address |
| **Trade Analyzer weighting** | What each statistic is worth when Trade Analyzer judges a deal for your league |
| **League data** | Refresh every dataset at once, if a page is showing blanks |
| **League history** | Re-pull past seasons for the record book |
| **Fortune Teller** | Switch it on, check it now, or rebuild the map, with where it stands and how big the build is |

---

## The setup wizard

The first time the site runs, it opens on a short wizard instead: a one-time setup code, the two passwords, your
ESPN league (and, for a private league, two cookie values from a signed-in browser), which tools the league sees,
and a first pull of your league's data and history. The [setup guide](setup-guide.md) covers every step. Once it
finishes, the wizard is replaced by the site itself for good.

---

## How it all works

**Where the data comes from.** Everything comes from your league on ESPN, read with the league's own sign-in when
it is private. The site keeps its own copy of each part and refreshes it on its own schedule: live scores every
fifteen seconds while games are on, the rest from every few minutes to a few times a day, depending on how often it
changes. A page you open is answered from that copy at once, and brought up to date behind it if it was getting old.

**What the site works out for itself.** Some of what you see exists nowhere on ESPN: how every score and win chance
moved through each game, ESPN's own weekly playoff odds (which ESPN cannot show for past weeks, so the site records
them), Fortune Teller's exact odds, the Hall of Fame record book, and Trade Analyzer's breakdowns.

**Your team.** Your choice of team is kept on each browser and shared by every page. It is how the site knows whose
side to show; it is not a sign-in.

**What stays private.** Passwords are stored scrambled and never sent back to anyone's browser; the league's ESPN
sign-in is only ever sent to ESPN. Pending waiver claims are never shown. Owner names never leave the site through
LLM Data Export or Site API. Site Backend records which pages were visited by the team chosen on that browser, and
never anyone's address or device.

**Updates.** When a new version of the site is published, the home page shows what changed, once, on each browser.
Nothing you have set is lost in an update.

**Fortune Teller's map.** Counting every way the season can go is a big job, so the site does it in the background,
a little at a time, without slowing anything else down. It starts once few enough weeks are left for the count to
finish (for a ten-team league, typically after about the ninth week), and each week afterwards it moves the map on
as results come in rather than starting again.

**What it costs to run.** Nothing, for a normal league: the whole site runs within Cloudflare's free allowance, and
the site paces itself (and anything asking through Site API) to stay there. If the Cloudflare account also runs
other websites, they share the same allowance, which is why the setup guide suggests keeping the account to this
site alone.

**When something goes wrong.** If pages start coming up empty, the ESPN cookies have most likely expired: replace
them in Site Configuration. The [setup guide](setup-guide.md#if-something-goes-wrong) lists the other common fixes.
