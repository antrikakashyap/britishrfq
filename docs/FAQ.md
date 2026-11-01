# FAQ

**Why can a supplier only lower its price?**
That is what makes it a British auction: competition pushes prices down. A new total must be lower than that supplier's own last total.

**What if two suppliers have the same total?**
The earlier bid ranks higher.

**Does a bid at exactly the close time count?**
No. The window is "from X minutes before the close, up to but not including the close". A bid at the exact close is rejected.

**Is the extension added to the old close or to the time of the bid?**
To the old close. With a 6:00 PM close and Y = 5, a bid at 5:55 PM moves the close to 6:05 PM, not to 6:00 PM.

**Can the auction run forever?**
No. The forced close is a hard ceiling, checked in the code and again by the database.

**What is the difference between Closed and Force closed?**
Force closed means the auction ended exactly at the forced close time, because extensions pushed the close all the way there.

**What counts as a "rank change"?**
The order of suppliers changes: someone moves up, or a new supplier joins the ranking. Lowering your price without changing anyone's place is not a rank change.

**Does the first bid count as an L1 change?**
Yes. Before it nobody was L1, after it someone is.

**Why does the countdown use the server's time?**
A laptop clock can be wrong. The server stamps every bid, and the page corrects its countdown with the server time.

**Why did the live site take a long time to open?**
It runs on a free plan that sleeps when nobody uses it. The first visit wakes it up (30 to 60 seconds).

**Why did the data reset?**
The free plan has no permanent disk. Demo auctions are created again every time the service starts.

**Where are the decisions explained?**
In [`docs/adr/`](adr/README.md), one short page per decision.
