import { Chains, CovalentClient } from '@covalenthq/client-sdk'
import { load } from '@std/dotenv'

await load({ export: true })

const COVALENT_TOKEN = Deno.env.get('COVALENT_TOKEN')
const ADDRESS = Deno.env.get('ADDRESS')
const MIN_DIFFERENCE = Deno.env.get('MIN_DIFFERENCE') // percentage
const BOT_TOKEN = Deno.env.get('BOT_TOKEN')
const BOT_CHAT = Deno.env.get('BOT_CHAT')

const job = async () => {
  console.time('job')

  if (
    !COVALENT_TOKEN ||
    !ADDRESS ||
    !MIN_DIFFERENCE ||
    !BOT_TOKEN ||
    !BOT_CHAT
  ) {
    console.error('Bad config')
    return
  }

  const sendMessage = async (
    text: string,
    options?: { [key: string]: unknown },
  ) => {
    const body = {
      chat_id: BOT_CHAT,
      text,
      ...options,
    }

    const req = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!req.ok) {
      console.error(await req.json())
    }
  }

  const client = new CovalentClient(COVALENT_TOKEN)

  const networks = [
    Chains.ETH_MAINNET,
    Chains.BASE_MAINNET,
    Chains.AVALANCHE_MAINNET,
    Chains.ARBITRUM_MAINNET,
    Chains.ZKSYNC_MAINNET,
    Chains.GNOSIS_MAINNET,
    Chains.MATIC_MAINNET,
    Chains.POLYGON_ZKEVM_MAINNET,
    Chains.OPTIMISM_MAINNET,
    Chains.LINEA_MAINNET,
  ]

  for (const network of networks) {
    console.debug('Starting network', network)
    console.time(network)

    const res = await client.BalanceService.getHistoricalPortfolioForWalletAddress(
      network,
      ADDRESS,
      { quoteCurrency: 'USD', days: 3 },
    )

    console.debug('Loaded', res.data.items.length, 'tokens from API')

    for (const token of res.data.items) {
      if (!token.holdings[0].quote_rate) {
        console.debug(
          'Ignoring some random token (no quote)',
          token.contract_name,
          token.contract_address,
        )
        continue
      }

      // Holdings are ordered by descending date from last day to earlier
      let from = token.holdings[token.holdings.length - 1].close.quote
      const to = token.holdings[0].close.quote

      if (to === 0) {
        console.debug(
          'Ignoring zero balance token',
          token.contract_name,
        )
        continue
      }

      if (to < 60) {
        console.debug(
          'Ignoring low balance token',
          token.contract_name,
          `${to} USD`,
        )
        continue
      }

      // Account for us possibly not having the token yet at that time
      if (from === 0) {
        for (const x of token.holdings.toSpliced(-1).toReversed()) {
          if (x.close.quote !== 0) {
            from = x.close.quote
            break
          }
        }
        if (from === 0) continue
      }

      console.log(
        'Loaded',
        token.contract_name,
        `${to} USD`,
      )

      const difference = (to / from - 1) * 100

      if (difference >= Number.parseInt(MIN_DIFFERENCE)) {
        console.debug(
          'Triggered:',
          token.contract_name,
          `(${token.contract_ticker_symbol})`,
          `${Math.round(difference)}%`,
        )
        await sendMessage(
          `${token.contract_name} (${token.contract_ticker_symbol}) increased ${
            Math.round(difference)
          }%`,
        )
      }
    }
    console.timeEnd(network)
  }
  console.timeEnd('job')
}

Deno.cron('job', '0 */4 * * *', job)
