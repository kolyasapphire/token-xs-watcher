# Token Xs Watcher

Monitoring script which fetches Ethereum token balances for a particular address and notifies you in Telegram when a token price has significantly gone up so you can react in time.

Uses [Covalent API](https://www.covalenthq.com) to fetch balances.

You can specify the threshold via `MIN_DIFFERENCE` env variable.
