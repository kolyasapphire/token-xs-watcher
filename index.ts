import { CovalentClient, Chains } from "@covalenthq/client-sdk";
import { load } from "@std/dotenv";

await load({ export: true });

const COVALENT_TOKEN = Deno.env.get("COVALENT_TOKEN");
const ADDRESS = Deno.env.get("ADDRESS");
const MIN_DIFFERENCE = Deno.env.get("MIN_DIFFERENCE"); // percentage
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const BOT_CHAT = Deno.env.get("BOT_CHAT");

const job = async () => {
  console.time("job");

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

  const networks = [
    Chains.ETH_MAINNET,
    Chains.BASE_MAINNET,
    Chains.AVALANCHE_MAINNET,
  ];

  for (const network of networks) {
    console.debug("Starting", network);
    console.time(network);

    const res =
      await client.BalanceService.getHistoricalPortfolioForWalletAddress(
        network,
        ADDRESS,
        { quoteCurrency: "USD", days: 1 },
      );

    console.debug("Loaded", res.data.items.length, "tokens");

    for (const token of res.data.items) {
      if (!token.holdings[0].quote_rate) {
        console.debug(
          "Ignoring some random token (no quote)",
          token.contract_name,
          token.contract_address,
        );
        continue;
      }

      const from = token.holdings[0].open.quote;
      const to = token.holdings[1].close.quote;

      if (to === 0) {
        console.debug(
          "Ignoring zero balance token",
          token.contract_name,
          token.contract_address,
        );
        continue;
      }

      if (to < 60) {
        console.debug(
          "Ignoring low balance token",
          token.contract_name,
          token.contract_address,
          token.holdings[1].close.quote,
        );
        continue;
      }

      const difference = (to / from - 1) * 100;

      if (difference >= Number.parseInt(MIN_DIFFERENCE)) {
        console.debug(
          token.contract_name,
          `(${token.contract_ticker_symbol})`,
          `${Math.round(difference)}%`,
          token.contract_address,
        );
        await sendMessage(
          `${token.contract_name} (${token.contract_ticker_symbol}) increased ${Math.round(difference)}%`,
        );
      }
    }
    console.timeEnd(network);
  }
  console.timeEnd("job");
};

Deno.cron("job", "0 16 * * *", job);
