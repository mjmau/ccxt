'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ExchangeNotAvailable, BadResponse, BadRequest, InvalidOrder, InsufficientFunds, AuthenticationError, ArgumentsRequired, InvalidAddress } = require ('./base/errors');
const { TRUNCATE } = require ('./base/functions/number');

//  ---------------------------------------------------------------------------

module.exports = class probit extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'probit',
            'name': 'ProBit',
            'countries': [ 'SC', 'KR' ], // Seychelles, South Korea
            'rateLimit': 250, // ms
            'has': {
                'CORS': true,
                'fetchTime': true,
                'fetchMarkets': true,
                'fetchCurrencies': true,
                'fetchTickers': true,
                'fetchTicker': true,
                'fetchOHLCV': true,
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchBalance': true,
                'createOrder': true,
                'createMarketOrder': true,
                'cancelOrder': true,
                'fetchOrder': true,
                'fetchOpenOrders': true,
                'fetchClosedOrders': true,
                'fetchMyTrades': true,
                'fetchDepositAddress': true,
                'withdraw': true,
            },
            'timeframes': {
                '1m': '1m',
                '3m': '3m',
                '5m': '5m',
                '10m': '10m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '4h': '4h',
                '6h': '6h',
                '12h': '12h',
                '1d': '1D',
                '1w': '1W',
            },
            'version': 'v1',
            'urls': {
                'logo': 'https://static.probit.com/landing/assets/images/probit-logo-global.png',
                'api': {
                    'accounts': 'https://accounts.probit.com',
                    'public': 'https://api.probit.com/api/exchange',
                    'private': 'https://api.probit.com/api/exchange',
                },
                'www': 'https://www.probit.com',
                'doc': [
                    'https://docs-en.probit.com',
                    'https://docs-ko.probit.com',
                ],
                'fees': 'https://support.probit.com/hc/en-us/articles/360020968611-Trading-Fees',
                'referral': 'https://www.probit.com/r/34608773',
            },
            'api': {
                'public': {
                    'get': [
                        'market',
                        'currency',
                        'time',
                        'ticker',
                        'order_book',
                        'trade',
                        'candle',
                    ],
                },
                'private': {
                    'post': [
                        'new_order',
                        'cancel_order',
                        'withdrawal',
                    ],
                    'get': [
                        'balance',
                        'order',
                        'open_order',
                        'order_history',
                        'trade_history',
                        'deposit_address',
                    ],
                },
                'accounts': {
                    'post': [
                        'token',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.2 / 100,
                    'taker': 0.2 / 100,
                },
            },
            'exceptions': {
                'UNAUTHORIZED': AuthenticationError,
                'INVALID_ARGUMENT': BadRequest,
                'TRADING_UNAVAILABLE': ExchangeNotAvailable,
                'NOT_ENOUGH_BALANCE': InsufficientFunds,
                'NOT_ALLOWED_COMBINATION': BadRequest,
                'INVALID_ORDER': InvalidOrder,
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': true,
            },
            'options': {
                'createMarketBuyOrderRequiresPrice': true,
                'timeInForce': {
                    'limit': 'gtc',
                    'market': 'ioc',
                },
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetMarket (params);
        //
        //     {
        //         "data":[
        //             {
        //                 "id":"MONA-USDT",
        //                 "base_currency_id":"MONA",
        //                 "quote_currency_id":"USDT",
        //                 "min_price":"0.001",
        //                 "max_price":"9999999999999999",
        //                 "price_increment":"0.001",
        //                 "min_quantity":"0.0001",
        //                 "max_quantity":"9999999999999999",
        //                 "quantity_precision":4,
        //                 "min_cost":"1",
        //                 "max_cost":"9999999999999999",
        //                 "cost_precision":8,
        //                 "taker_fee_rate":"0.2",
        //                 "maker_fee_rate":"0.2",
        //                 "show_in_ui":true,
        //                 "closed":false
        //             },
        //         ]
        //     }
        //
        const markets = this.safeValue (response, 'data', []);
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const id = this.safeString (market, 'id');
            const baseId = this.safeString (market, 'base_currency_id');
            const quoteId = this.safeString (market, 'quote_currency_id');
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const closed = this.safeValue (market, 'closed', false);
            const active = !closed;
            const priceIncrement = this.safeString (market, 'price_increment');
            const precision = {
                'amount': this.safeInteger (market, 'quantity_precision'),
                'price': this.precisionFromString (priceIncrement),
                'cost': this.safeInteger (market, 'cost_precision'),
            };
            const takerFeeRate = this.safeFloat (market, 'taker_fee_rate');
            const makerFeeRate = this.safeFloat (market, 'maker_fee_rate');
            result.push ({
                'id': id,
                'info': market,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': active,
                'precision': precision,
                'taker': takerFeeRate / 100,
                'maker': makerFeeRate / 100,
                'limits': {
                    'amount': {
                        'min': this.safeFloat (market, 'min_quantity'),
                        'max': this.safeFloat (market, 'max_quantity'),
                    },
                    'price': {
                        'min': this.safeFloat (market, 'min_price'),
                        'max': this.safeFloat (market, 'max_price'),
                    },
                    'cost': {
                        'min': this.safeFloat (market, 'min_cost'),
                        'max': this.safeFloat (market, 'max_cost'),
                    },
                },
            });
        }
        return result;
    }

    async fetchCurrencies (params = {}) {
        const response = await this.publicGetCurrency (params);
        //     {
        //         data: [
        //             {
        //                 id: 'DOGE',
        //                 name: 'Dogecoin',
        //                 display_name: { 'ko-kr': '도지코인', 'en-us': 'Dogecoin' },
        //                 platform: 'DOGE',
        //                 precision: 8,
        //                 display_precision: 8,
        //                 min_confirmation_count: 20,
        //                 min_withdrawal_amount: '4',
        //                 withdrawal_fee: '2',
        //                 deposit_suspended: true,
        //                 withdrawal_suspended: true,
        //                 internal_precision: 8,
        //                 show_in_ui: true,
        //                 suspended_reason: '',
        //                 min_deposit_amount: '0'
        //             },
        //         ]
        //     }
        //
        const currencies = this.safeValue (response, 'data');
        const result = {};
        for (let i = 0; i < currencies.length; i++) {
            const currency = currencies[i];
            const id = this.safeString (currency, 'id');
            const code = this.safeCurrencyCode (id);
            const name = this.safeString (currency, 'name');
            const precision = this.safeInteger (currency, 'precision');
            const suspendedReason = this.safeString (currency, 'suspended_reason');
            let active = true;
            if (suspendedReason.length > 0) {
                active = false;
            }
            result[code] = {
                'id': id,
                'code': code,
                'info': currency,
                'name': name,
                'active': active,
                'fee': this.safeFloat (currency, 'withdrawal_fee'),
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': Math.pow (10, -precision),
                        'max': Math.pow (10, precision),
                    },
                    'price': {
                        'min': Math.pow (10, -precision),
                        'max': Math.pow (10, precision),
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'deposit': {
                        'min': this.safeFloat (currency, 'min_deposit_amount'),
                        'max': undefined,
                    },
                    'withdraw': {
                        'min': this.safeFloat (currency, 'min_withdrawal_amount'),
                        'max': undefined,
                    },
                },
            };
        }
        return result;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privateGetBalance (params);
        //
        //     {
        //         data: [
        //             {
        //                 "currency_id":"XRP",
        //                 "total":"100",
        //                 "available":"0",
        //             }
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data');
        const result = { 'info': data };
        for (let i = 0; i < data.length; i++) {
            const balance = data[i];
            const currencyId = this.safeString (balance, 'currency_id');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['total'] = this.safeFloat (balance, 'total');
            account['free'] = this.safeFloat (balance, 'available');
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'market_id': market['id'],
        };
        const response = await this.publicGetOrderBook (this.extend (request, params));
        //
        //     {
        //         data: [
        //             { side: 'buy', price: '0.000031', quantity: '10' },
        //             { side: 'buy', price: '0.00356007', quantity: '4.92156877' },
        //             { side: 'sell', price: '0.1857', quantity: '0.17' },
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        const dataBySide = this.groupBy (data, 'side');
        return this.parseOrderBook (dataBySide, undefined, 'buy', 'sell', 'price', 'quantity');
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        if (symbols !== undefined) {
            const marketIds = this.marketIds (symbols);
            request['market_ids'] = marketIds.join (',');
        }
        const response = await this.publicGetTicker (this.extend (request, params));
        //
        //     {
        //         "data":[
        //             {
        //                 "last":"0.022902",
        //                 "low":"0.021693",
        //                 "high":"0.024093",
        //                 "change":"-0.000047",
        //                 "base_volume":"15681.986",
        //                 "quote_volume":"360.514403624",
        //                 "market_id":"ETH-BTC",
        //                 "time":"2020-04-12T18:43:38.000Z"
        //             }
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        return this.parseTickers (data, symbols);
    }

    parseTickers (rawTickers, symbols = undefined) {
        const tickers = [];
        for (let i = 0; i < rawTickers.length; i++) {
            tickers.push (this.parseTicker (rawTickers[i]));
        }
        return this.filterByArray (tickers, 'symbol', symbols);
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'market_ids': market['id'],
        };
        const response = await this.publicGetTicker (this.extend (request, params));
        //
        //     {
        //         "data":[
        //             {
        //                 "last":"0.022902",
        //                 "low":"0.021693",
        //                 "high":"0.024093",
        //                 "change":"-0.000047",
        //                 "base_volume":"15681.986",
        //                 "quote_volume":"360.514403624",
        //                 "market_id":"ETH-BTC",
        //                 "time":"2020-04-12T18:43:38.000Z"
        //             }
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        const ticker = this.safeValue (data, 0);
        if (ticker === undefined) {
            throw new BadResponse (this.id + ' fetchTicker() returned an empty response');
        }
        return this.parseTicker (ticker, market);
    }

    parseTicker (ticker, market = undefined) {
        //
        //     {
        //         "last":"0.022902",
        //         "low":"0.021693",
        //         "high":"0.024093",
        //         "change":"-0.000047",
        //         "base_volume":"15681.986",
        //         "quote_volume":"360.514403624",
        //         "market_id":"ETH-BTC",
        //         "time":"2020-04-12T18:43:38.000Z"
        //     }
        //
        const timestamp = this.parse8601 (this.safeString (ticker, 'time'));
        let symbol = undefined;
        const marketId = this.safeString (ticker, 'market_id');
        if (marketId !== undefined) {
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            } else {
                const [ baseId, quoteId ] = marketId.split ('-');
                const base = this.safeCurrencyCode (baseId);
                const quote = this.safeCurrencyCode (quoteId);
                symbol = base + '/' + quote;
            }
        }
        if ((symbol === undefined) && (market !== undefined)) {
            symbol = market['symbol'];
        }
        const close = this.safeFloat (ticker, 'last');
        const change = this.safeFloat (ticker, 'change');
        let percentage = undefined;
        let open = undefined;
        if (change !== undefined) {
            percentage = change / 100;
            if (close !== undefined) {
                open = close - change;
            }
        }
        const baseVolume = this.safeFloat (ticker, 'base_volume');
        const quoteVolume = this.safeFloat (ticker, 'quote_volume');
        let vwap = undefined;
        if ((baseVolume !== undefined) && (quoteVolume !== undefined)) {
            vwap = baseVolume / quoteVolume;
        }
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high'),
            'low': this.safeFloat (ticker, 'low'),
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': vwap,
            'open': open,
            'close': close,
            'last': close,
            'previousClose': undefined, // previous day close
            'change': change,
            'percentage': percentage,
            'average': undefined,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'info': ticker,
        };
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = undefined;
        const request = {
            'limit': 100,
            'start_time': this.iso8601 (0),
            'end_time': this.iso8601 (this.milliseconds ()),
        };
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['market_id'] = market['id'];
        }
        if (since !== undefined) {
            request['start_time'] = this.iso8601 (since);
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.privateGetTradeHistory (this.extend (request, params));
        //
        //     {
        //         data: [
        //             {
        //                 "id":"BTC-USDT:183566",
        //                 "order_id":"17209376",
        //                 "side":"sell",
        //                 "fee_amount":"0.657396569175",
        //                 "fee_currency_id":"USDT",
        //                 "status":"settled",
        //                 "price":"6573.96569175",
        //                 "quantity":"0.1",
        //                 "cost":"657.396569175",
        //                 "time":"2018-08-10T06:06:46.000Z",
        //                 "market_id":"BTC-USDT"
        //             }
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        return this.parseTrades (data, market, since, limit);
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'market_id': market['id'],
            'limit': 100,
            'start_time': '1970-01-01T00:00:00.000Z',
            'end_time': this.iso8601 (this.milliseconds ()),
        };
        if (since !== undefined) {
            request['start_time'] = this.iso8601 (since);
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.publicGetTrade (this.extend (request, params));
        //
        //     {
        //         "data":[
        //             {
        //                 "id":"ETH-BTC:3331886",
        //                 "price":"0.022981",
        //                 "quantity":"12.337",
        //                 "time":"2020-04-12T20:55:42.371Z",
        //                 "side":"sell",
        //                 "tick_direction":"down"
        //             },
        //             {
        //                 "id":"ETH-BTC:3331885",
        //                 "price":"0.022982",
        //                 "quantity":"6.472",
        //                 "time":"2020-04-12T20:55:39.652Z",
        //                 "side":"sell",
        //                 "tick_direction":"down"
        //             }
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        return this.parseTrades (data, market, since, limit);
    }

    parseTrade (trade, market = undefined) {
        //
        // fetchTrades (public)
        //
        //     {
        //         "id":"ETH-BTC:3331886",
        //         "price":"0.022981",
        //         "quantity":"12.337",
        //         "time":"2020-04-12T20:55:42.371Z",
        //         "side":"sell",
        //         "tick_direction":"down"
        //     }
        //
        // fetchMyTrades (private)
        //
        //     {
        //         "id":"BTC-USDT:183566",
        //         "order_id":"17209376",
        //         "side":"sell",
        //         "fee_amount":"0.657396569175",
        //         "fee_currency_id":"USDT",
        //         "status":"settled",
        //         "price":"6573.96569175",
        //         "quantity":"0.1",
        //         "cost":"657.396569175",
        //         "time":"2018-08-10T06:06:46.000Z",
        //         "market_id":"BTC-USDT"
        //     }
        //
        const timestamp = this.parse8601 (this.safeString (trade, 'time'));
        let symbol = undefined;
        const id = this.safeString (trade, 'id');
        if (id !== undefined) {
            const parts = id.split (':');
            let marketId = this.safeString (parts, 0);
            if (marketId === undefined) {
                marketId = this.safeString (trade, 'market_id');
            }
            if (marketId !== undefined) {
                if (marketId in this.markets_by_id) {
                    market = this.markets_by_id[marketId];
                } else {
                    const [ baseId, quoteId ] = marketId.split ('-');
                    const base = this.safeCurrencyCode (baseId);
                    const quote = this.safeCurrencyCode (quoteId);
                    symbol = base + '/' + quote;
                }
            }
        }
        if ((symbol === undefined) && (market !== undefined)) {
            symbol = market['symbol'];
        }
        const side = this.safeString (trade, 'side');
        const price = this.safeFloat (trade, 'price');
        const amount = this.safeFloat (trade, 'quantity');
        let cost = undefined;
        if (price !== undefined) {
            if (amount !== undefined) {
                cost = price * amount;
            }
        }
        const orderId = this.safeString (trade, 'order_id');
        const feeCost = this.safeFloat (trade, 'fee_amount');
        let fee = undefined;
        if (feeCost !== undefined) {
            const feeCurrencyId = this.safeString (trade, 'fee_currency_id');
            const feeCurrencyCode = this.safeCurrencyCode (feeCurrencyId);
            fee = {
                'cost': feeCost,
                'currency': feeCurrencyCode,
            };
        }
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'order': orderId,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
        };
    }

    async fetchTime (params = {}) {
        const response = await this.publicGetTime (params);
        //
        //     { "data":"2020-04-12T18:54:25.390Z" }
        //
        const timestamp = this.parse8601 (this.safeString (response, 'data'));
        return timestamp;
    }

    normalizeCandleTimestamp (timestamp, timeframe) {
        const coeff = parseInt (timeframe.slice (0, -1), 10);
        const unitLetter = timeframe.slice (-1);
        const m = 60 * 1000;
        const h = 60 * m;
        const D = 24 * h;
        const W = 7 * D;
        const units = {
            'm': m,
            'h': h,
            'D': D,
            'W': W,
        };
        const unit = units[unitLetter];
        const mod = coeff * unit;
        const diff = (timestamp % mod);
        timestamp = timestamp - diff;
        if (unit === W) {
            timestamp = timestamp + 3 * D;
        }
        return timestamp;
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const interval = this.timeframes[timeframe];
        limit = (limit === undefined) ? 100 : limit;
        const request = {
            'market_ids': market['id'],
            'interval': interval,
            'sort': 'asc',
            'limit': limit, // max 1000
        };
        const now = this.milliseconds ();
        const duration = this.parseTimeframe (timeframe);
        const difference = limit * duration * 1000;
        if (since === undefined) {
            request['end_time'] = this.iso8601 (now);
            request['start_time'] = this.iso8601 (now - difference);
        } else {
            request['start_time'] = this.iso8601 (since);
            request['end_time'] = this.iso8601 (this.sum (since, difference));
        }
        const response = await this.publicGetCandle (this.extend (request, params));
        //
        //     {
        //         "data":[
        //             {
        //                 "market_id":"ETH-BTC",
        //                 "open":"0.02811",
        //                 "close":"0.02811",
        //                 "low":"0.02811",
        //                 "high":"0.02811",
        //                 "base_volume":"0.0005",
        //                 "quote_volume":"0.000014055",
        //                 "start_time":"2018-11-30T18:19:00.000Z",
        //                 "end_time":"2018-11-30T18:20:00.000Z"
        //             },
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data');
        return this.parseOHLCVs (data, market, timeframe, since, limit);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            this.parse8601 (this.safeString (ohlcv, 'start_time')),
            this.safeFloat (ohlcv, 'open'),
            this.safeFloat (ohlcv, 'high'),
            this.safeFloat (ohlcv, 'low'),
            this.safeFloat (ohlcv, 'close'),
            this.safeFloat (ohlcv, 'base_volume'),
        ];
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        since = this.parse8601 (since);
        const request = {};
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['market_id'] = market['id'];
        }
        const response = await this.privateGetOpenOrder (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        return this.parseOrders (data, market, since, limit);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'start_time': this.iso8601 (0),
            'end_time': this.iso8601 (this.milliseconds ()),
            'limit': 100,
        };
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['market_id'] = market['id'];
        }
        if (since) {
            request['start_time'] = this.iso8601 (since);
        }
        if (limit) {
            request['limit'] = limit;
        }
        const response = await this.privateGetOrderHistory (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        return this.parseOrders (data, market, since, limit);
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrder requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'market_id': market['id'],
        };
        const clientOrderId = this.safeString2 (params, 'clientOrderId', 'client_order_id');
        if (clientOrderId !== undefined) {
            request['client_order_id'] = clientOrderId;
        } else {
            request['order_id'] = id;
        }
        const query = this.omit (params, [ 'clientOrderId', 'client_order_id' ]);
        const response = await this.privateGetOrder (this.extend (request, query));
        const data = this.safeValue (response, 'data', []);
        const order = this.safeValue (data, 0);
        return this.parseOrder (order, market);
    }

    parseOrderStatus (status) {
        const statuses = {
            'open': 'open',
            'cancelled': 'canceled',
            'filled': 'closed',
        };
        return this.safeString (statuses, status, status);
    }

    parseOrder (order, market = undefined) {
        //
        //     {
        //         id: string,
        //         user_id: string,
        //         market_id: string,
        //         type: OrderType,
        //         side: Side,
        //         quantity: string,
        //         limit_price: string,
        //         time_in_force: TimeInForce,
        //         filled_cost: string,
        //         filled_quantity: string,
        //         open_quantity: string,
        //         cancelled_quantity: string,
        //         status: OrderStatus,
        //         time: Date,
        //         client_order_id: string,
        //     }
        //
        const status = this.parseOrderStatus (this.safeString (order, 'status'));
        const id = this.safeString (order, 'id');
        const type = this.safeString (order, 'type');
        const side = this.safeString (order, 'side');
        let symbol = undefined;
        const marketId = this.safeString (order, 'market_id');
        if (marketId !== undefined) {
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            } else {
                const [ baseId, quoteId ] = marketId.split ('-');
                const base = this.safeCurrencyCode (baseId);
                const quote = this.safeCurrencyCode (quoteId);
                symbol = base + '/' + quote;
            }
        }
        if ((symbol === undefined) && (market !== undefined)) {
            symbol = market['symbol'];
        }
        const timestamp = this.parse8601 (this.safeString (order, 'time'));
        let price = this.safeFloat (order, 'limit_price');
        const filled = this.safeFloat (order, 'filled_quantity');
        const remaining = this.safeFloat (order, 'open_quantity');
        let amount = this.safeFloat (order, 'quantity', this.sum (filled, remaining));
        let cost = this.safeFloat (order, 'filled_cost');
        if (type === 'market') {
            amount = this.sum (filled, cost);
            price = undefined;
        }
        let average = undefined;
        if (filled !== undefined) {
            if (cost === undefined) {
                if (price !== undefined) {
                    cost = price * filled;
                }
            }
            if (cost !== undefined) {
                if (filled > 0) {
                    average = cost / filled;
                }
            }
        }
        let clientOrderId = this.safeString (order, 'client_order_id');
        if (clientOrderId === '') {
            clientOrderId = undefined;
        }
        return {
            'id': id,
            'info': order,
            'clientOrderId': clientOrderId,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': type,
            'side': side,
            'status': status,
            'price': price,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'average': average,
            'cost': cost,
            'fee': undefined,
            'trades': undefined,
        };
    }

    costToPrecision (symbol, cost) {
        return this.decimalToPrecision (cost, TRUNCATE, this.markets[symbol]['precision']['cost'], this.precisionMode);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const options = this.safeValue (this.options, 'timeInForce');
        const defaultTimeInForce = this.safeValue (options, type);
        const timeInForce = this.safeString2 (params, 'timeInForce', 'time_in_force', defaultTimeInForce);
        const request = {
            'market_id': market['id'],
            'type': type,
            'side': side,
            'time_in_force': timeInForce,
        };
        const clientOrderId = this.safeString2 (params, 'clientOrderId', 'client_order_id');
        if (clientOrderId !== undefined) {
            request['client_order_id'] = clientOrderId;
        }
        if (type === 'limit') {
            request['limit_price'] = this.priceToPrecision (symbol, price);
            request['quantity'] = this.amountToPrecision (symbol, amount);
        } else if (type === 'market') {
            // for market buy it requires the amount of quote currency to spend
            if (side === 'buy') {
                let cost = this.safeFloat (params, 'cost');
                const createMarketBuyOrderRequiresPrice = this.safeValue (this.options, 'createMarketBuyOrderRequiresPrice', true);
                if (createMarketBuyOrderRequiresPrice) {
                    if (price !== undefined) {
                        if (cost === undefined) {
                            cost = amount * price;
                        }
                    } else if (cost === undefined) {
                        throw new InvalidOrder (this.id + " createOrder() requires the price argument for market buy orders to calculate total order cost (amount to spend), where cost = amount * price. Supply a price argument to createOrder() call if you want the cost to be calculated for you from price and amount, or, alternatively, add .options['createMarketBuyOrderRequiresPrice'] = false and supply the total cost value in the 'amount' argument or in the 'cost' extra parameter (the exchange-specific behaviour)");
                    }
                } else {
                    cost = (cost === undefined) ? amount : cost;
                }
                request['cost'] = this.costToPrecision (symbol, cost);
            } else {
                request['quantity'] = this.amountToPrecision (symbol, amount);
            }
        }
        const query = this.omit (params, [ 'timeInForce', 'time_in_force', 'clientOrderId', 'client_order_id' ]);
        const response = await this.privatePostNewOrder (this.extend (request, query));
        //
        //     {
        //         data: {
        //             id: string,
        //             user_id: string,
        //             market_id: string,
        //             type: OrderType,
        //             side: Side,
        //             quantity: string,
        //             limit_price: string,
        //             time_in_force: TimeInForce,
        //             filled_cost: string,
        //             filled_quantity: string,
        //             open_quantity: string,
        //             cancelled_quantity: string,
        //             status: OrderStatus,
        //             time: Date,
        //             client_order_id: string,
        //         }
        //     }
        //
        const data = this.safeValue (response, 'data');
        return this.parseOrder (data, market);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrder requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'market_id': market['id'],
            'order_id': id,
        };
        const response = await this.privatePostCancelOrder (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        return this.parseOrder (data);
    }

    parseDepositAddress (depositAddress, currency = undefined) {
        const address = this.safeString (depositAddress, 'address');
        const tag = this.safeString (depositAddress, 'destination_tag');
        const currencyId = this.safeString (depositAddress, 'currency_id');
        const code = this.safeCurrencyCode (currencyId);
        this.checkAddress (address);
        return {
            'currency': code,
            'address': address,
            'tag': tag,
            'info': depositAddress,
        };
    }

    async fetchDepositAddress (code, params = {}) {
        await this.loadMarkets ();
        const currency = this.currency (code);
        const request = {
            'currency_id': currency['id'],
        };
        const response = await this.privateGetDepositAddress (this.extend (request, params));
        //
        //     {
        //         "data":[
        //             {
        //                 "currency_id":"ETH",
        //                 "address":"0x12e2caf3c4051ba1146e612f532901a423a9898a",
        //                 "destination_tag":null
        //             }
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        const firstAddress = this.safeValue (data, 0);
        if (firstAddress === undefined) {
            throw new InvalidAddress (this.id + ' fetchDepositAddress returned an empty response');
        }
        return this.parseDepositAddress (firstAddress, currency);
    }

    async fetchDepositAddresses (codes = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        if (codes) {
            const currencyIds = [];
            for (let i = 0; i < codes.length; i++) {
                const currency = this.currency (codes[i]);
                currencyIds.push (currency['id']);
            }
            request['currency_id'] = codes.join (',');
        }
        const response = await this.privateGetDepositAddress (this.extend (request, params));
        const data = this.safeValue (response, 'data', []);
        return this.parseDepositAddresses (data);
    }

    parseDepositAddresses (addresses) {
        const result = {};
        for (let i = 0; i < addresses.length; i++) {
            const address = this.parseDepositAddress (addresses[i]);
            const code = address['currency'];
            result[code] = address;
        }
        return result;
    }

    async withdraw (code, amount, address, tag = undefined, params = {}) {
        this.checkAddress (address);
        await this.loadMarkets ();
        const currency = this.currency (code);
        if (!tag) {
            tag = undefined;
        }
        const request = {
            'currency_id': currency['id'],
            'address': address,
            'destination_tag': tag,
            'amount': this.numberToString (amount),
        };
        const response = await this.privatePostWithdrawal (this.extend (request, params));
        return this.parseTransaction (response['data']);
    }

    parseTransaction (transaction, currency = undefined) {
        const id = this.safeString (transaction, 'id');
        const amount = this.safeFloat (transaction, 'amount');
        const address = this.safeString (transaction, 'address');
        const tag = this.safeString (transaction, 'destination_tag');
        const txid = this.safeString (transaction, 'hash');
        const timestamp = this.parse8601 (this.safeString (transaction, 'time'));
        const type = this.safeString (transaction, 'type');
        const currencyId = this.safeString (transaction, 'currency_id');
        const code = this.safeCurrencyCode (currencyId);
        const status = this.parseTransactionStatus (this.safeString (transaction, 'status'));
        const feeCost = this.safeFloat (transaction, 'fee');
        let fee = undefined;
        if (feeCost !== undefined && feeCost !== 0) {
            fee = {
                'currency': code,
                'cost': feeCost,
            };
        }
        return {
            'id': id,
            'currency': code,
            'amount': amount,
            'address': address,
            'tag': tag,
            'status': status,
            'type': type,
            'txid': txid,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'fee': fee,
            'info': transaction,
        };
    }

    parseTransactionStatus (status) {
        const statuses = {
            'requested': 'pending',
            'pending': 'pending',
            'confirming': 'pending',
            'confirmed': 'pending',
            'applying': 'pending',
            'done': 'ok',
            'cancelled': 'canceled',
            'cancelling': 'canceled',
        };
        return this.safeString (statuses, status, status);
    }

    nonce () {
        return this.milliseconds ();
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/';
        const query = this.omit (params, this.extractParams (path));
        if (api === 'accounts') {
            this.checkRequiredCredentials ();
            url += this.implodeParams (path, params);
            const auth = this.apiKey + ':' + this.secret;
            const auth64 = this.stringToBase64 (this.encode (auth));
            headers = {
                'Authorization': 'Basic ' + this.decode (auth64),
                'Content-Type': 'application/json',
            };
            if (Object.keys (query).length) {
                body = this.json (query);
            }
        } else {
            url += this.version + '/';
            if (api === 'public') {
                url += this.implodeParams (path, params);
                if (Object.keys (query).length) {
                    url += '?' + this.urlencode (query);
                }
            } else if (api === 'private') {
                const now = this.milliseconds ();
                this.checkRequiredCredentials ();
                const expires = this.safeInteger (this.options, 'expires');
                if ((expires === undefined) || (expires < now)) {
                    throw new AuthenticationError (this.id + ' accessToken expired, call signIn() method');
                }
                const accessToken = this.safeString (this.options, 'accessToken');
                headers = {
                    'Authorization': 'Bearer ' + accessToken,
                };
                url += this.implodeParams (path, params);
                if (method === 'GET') {
                    if (Object.keys (query).length) {
                        url += '?' + this.urlencode (query);
                    }
                } else if (Object.keys (query).length) {
                    body = this.json (query);
                    headers['Content-Type'] = 'application/json';
                }
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    async signIn (params = {}) {
        this.checkRequiredCredentials ();
        const request = {
            'grant_type': 'client_credentials', // the only supported value
        };
        const response = await this.accountsPostToken (this.extend (request, params));
        //
        //     {
        //         access_token: '0ttDv/2hTTn3bLi8GP1gKaneiEQ6+0hOBenPrxNQt2s=',
        //         token_type: 'bearer',
        //         expires_in: 900
        //     }
        //
        const expiresIn = this.safeInteger (response, 'expires_in');
        const accessToken = this.safeString (response, 'access_token');
        this.options['accessToken'] = accessToken;
        this.options['expires'] = this.sum (this.milliseconds (), expiresIn * 1000);
        return response;
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return; // fallback to default error handler
        }
        if ('errorCode' in response) {
            const errorCode = this.safeString (response, 'errorCode');
            const message = this.safeString (response, 'message');
            if (errorCode !== undefined) {
                const feedback = this.json (response);
                const exceptions = this.exceptions;
                if (message in exceptions) {
                    throw new exceptions[message] (feedback);
                } else if (errorCode in exceptions) {
                    throw new exceptions[errorCode] (feedback);
                } else {
                    throw new ExchangeError (feedback);
                }
            }
        }
    }
};
