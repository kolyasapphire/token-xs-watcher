import { CovalentClient } from "@covalenthq/client-sdk";
import { load } from "@std/dotenv";

await load({ export: true });

const COVALENT_TOKEN = Deno.env.get("COVALENT_TOKEN");
const ADDRESS = Deno.env.get("ADDRESS");
const MIN_DIFFERENCE = Deno.env.get("MIN_DIFFERENCE"); // percentage
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const BOT_CHAT = Deno.env.get("BOT_CHAT");

const job = async () => {
  if (
    !COVALENT_TOKEN ||
    !ADDRESS ||
    !MIN_DIFFERENCE ||
    !BOT_TOKEN ||
    !BOT_CHAT
  ) {
    console.error("Bad config");
    return;
  }

  const sendMessage = async (
    text: string,
    options?: { [key: string]: unknown },
  ) => {
    const body = {
      chat_id: BOT_CHAT,
      text,
      ...options,
    };

    const req = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!req.ok) {
      console.error(await req.json());
    }
  };

  const client = new CovalentClient(COVALENT_TOKEN);

  const res =
    await client.BalanceService.getHistoricalPortfolioForWalletAddress(
      "eth-mainnet",
      ADDRESS,
      { quoteCurrency: "USD", days: 1 },
    );

  console.debug("Loaded", res.data.items.length, "tokens");

  for (const token of res.data.items) {
    if (!token.holdings[0].quote_rate) {
      console.debug("Ignoring some random token", token.contract_name);
      continue;
    }

    if (token.holdings[1].close.quote < 60) {
      console.debug("Ignoring low balance token", token.contract_name);
      continue;
    }

    const from = token.holdings[0].open.quote;
    const to = token.holdings[1].close.quote;

    const difference = (to / from - 1) * 100;

    if (difference >= Number.parseInt(MIN_DIFFERENCE)) {
      console.debug(
        token.contract_name,
        `(${token.contract_ticker_symbol})`,
        `${Math.round(difference)}%`,
      );
      await sendMessage(
        `${token.contract_name} (${token.contract_ticker_symbol}) increased ${Math.round(difference)}%`,
      );
    }
  }
};

Deno.cron("job", "0 16 * * *", job);
