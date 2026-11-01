# Glossary

| Term | Meaning |
| --- | --- |
| **RFQ** | Request for Quotation. A buyer asks several suppliers for a price. In this app one RFQ is one auction. |
| **British auction** | An open auction where bidders can see each other and can only lower their own price. Late activity extends the clock. |
| **Supplier / carrier** | A company that bids to move the goods. |
| **Quote / bid** | One offer: freight charges + origin charges + destination charges, plus transit time and how long the quote is valid. |
| **Total quote** | The sum of the three charges. Ranking uses this number. |
| **L1, L2, L3** | The ranking by total quote. L1 is the lowest (best) price. |
| **Bid start** | When bidding opens. |
| **Bid close** | When bidding is due to end. It can move later when the auction is extended. |
| **Original bid close** | The bid close as first configured. Kept so the app can show how much time was added. |
| **Forced bid close** | The final deadline. It never moves, and no extension can pass it. |
| **Trigger window (X)** | The last X minutes before the current bid close. Activity inside it can extend the auction. |
| **Extension (Y)** | How many minutes are added each time the trigger fires. |
| **Trigger type** | What counts as activity: any bid, any rank change, or a change of L1. |
| **Extended** | The close moved by the full Y minutes. |
| **Capped** | The close moved, but only up to the forced close (less than Y). |
| **Blocked** | The trigger fired but the close was already at the forced close, so nothing moved. |
| **Scheduled** | Status before bid start. |
| **Active** | Status while bidding is open. |
| **Closed** | Status when the auction ended at a normal close time. |
| **Force closed** | Status when the auction ended exactly at the forced close time. |
| **Activity log** | The permanent list of what happened: bids, extensions and the reason for each. |
