"""Vnstock OHLCV endpoint for Vietnamese equities. VCI primary, KBS fallback."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone
import json
import math
import pandas as pd

ALLOWED = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

def _number(value):
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None

def _sma(series, n):
    x = series.rolling(n).mean().iloc[-1]
    return _number(x)

def _rsi(close, period=14):
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    rs = gain / loss.replace(0, float('nan'))
    value = 100 - (100 / (1 + rs))
    if len(value) and close.diff().dropna().gt(0).all():
        return 100.0
    return _number(value.iloc[-1]) if len(value) else None

def _build_response(symbol, df, source):
    # Normalize provider column names without assuming their exact capitalization.
    lookup = {str(c).strip().lower(): c for c in df.columns}
    date_col = next((lookup[k] for k in ('time','date','tradingdate','trading_date') if k in lookup), None)
    if date_col is None:
        raise ValueError('Nguồn dữ liệu không có cột ngày giao dịch.')
    cols = {}
    for target in ('open','high','low','close','volume'):
        if target not in lookup:
            raise ValueError(f'Nguồn dữ liệu thiếu cột {target}.')
        cols[target] = lookup[target]
    out = pd.DataFrame({
        'date': pd.to_datetime(df[date_col], errors='coerce').dt.strftime('%Y-%m-%d'),
        **{k: pd.to_numeric(df[c], errors='coerce') for k,c in cols.items()}
    }).dropna(subset=['date','close']).sort_values('date').drop_duplicates('date').reset_index(drop=True)
    if len(out) < 2:
        raise ValueError('Nguồn trả về dưới 2 phiên hợp lệ.')
    close=out['close']; high=out['high']; low=out['low']
    delta=close.diff()
    ema12=close.ewm(span=12, adjust=False).mean(); ema26=close.ewm(span=26, adjust=False).mean()
    macd=ema12-ema26; signal=macd.ewm(span=9, adjust=False).mean()
    mid=close.rolling(20).mean(); std=close.rolling(20).std(ddof=0)
    prev=close.shift(1)
    tr=pd.concat([(high-low).abs(),(high-prev).abs(),(low-prev).abs()],axis=1).max(axis=1)
    atr=tr.rolling(14).mean()
    # Vnstock stock OHLCV is quoted in thousand VND; normalize to VND for the frontend/DCA math.
    price_scale = 1000.0
    latest=float(close.iloc[-1]) * price_scale; previous=float(close.iloc[-2]) * price_scale
    levels=[]
    for label, pct, basis in [('DCA 1',0.03,'Thấp hơn giá gần nhất 3%'),('DCA 2',0.06,'Thấp hơn giá gần nhất 6%'),('DCA 3',0.10,'Thấp hơn giá gần nhất 10%')]:
        levels.append({'label':label,'price':round(latest*(1-pct),2),'dropPct':pct*100,'basis':basis})
    try:
        actual_source = getattr(df, 'attrs', {}).get('source') or source
    except Exception:
        actual_source = source
    return {
        'symbol':symbol, 'price':latest, 'previousClose':previous,
        'changePct':((latest-previous)/previous*100) if previous else None,
        'currency':'VND', 'source':str(actual_source).upper(),
        'asOf':str(out['date'].iloc[-1]), 'updatedAt':datetime.now(timezone.utc).isoformat(),
        'history':(out.tail(250).assign(open=lambda d:d['open']*price_scale, high=lambda d:d['high']*price_scale, low=lambda d:d['low']*price_scale, close=lambda d:d['close']*price_scale)).to_dict(orient='records'), 'levels':levels,
        'indicators':{
            'ma20':(_sma(close,20)*price_scale if _sma(close,20) is not None else None),'ma50':(_sma(close,50)*price_scale if _sma(close,50) is not None else None),'ma200':(_sma(close,200)*price_scale if _sma(close,200) is not None else None),
            'rsi14':_rsi(close,14),'macd':(_number(macd.iloc[-1])*price_scale if _number(macd.iloc[-1]) is not None else None),'macdSignal':(_number(signal.iloc[-1])*price_scale if _number(signal.iloc[-1]) is not None else None),
            'bollingerUpper':(_number((mid+2*std).iloc[-1])*price_scale if _number((mid+2*std).iloc[-1]) is not None else None),'bollingerMiddle':(_number(mid.iloc[-1])*price_scale if _number(mid.iloc[-1]) is not None else None),
            'bollingerLower':(_number((mid-2*std).iloc[-1])*price_scale if _number((mid-2*std).iloc[-1]) is not None else None),'atr14':(_number(atr.iloc[-1])*price_scale if _number(atr.iloc[-1]) is not None else None)
        }
    }

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs=parse_qs(urlparse(self.path).query)
        symbol=(qs.get('symbol',[''])[0] or '').strip().upper()
        if not symbol or len(symbol)>12 or any(ch not in ALLOWED for ch in symbol):
            return self._send(400, {'error':'Mã cổ phiếu không hợp lệ. Chỉ dùng chữ cái và chữ số, ví dụ FPT, HPG, VCB.'})
        try:
            # Vnstock v5 is distributed from the official package index.
            from vnstock import Quote
        except Exception as exc:
            return self._send(500, {'error':'Không nạp được Vnstock. Kiểm tra requirements.txt, package index và Vercel Build Logs.', 'details':[str(exc)[:220]]})
        errors=[]
        # Vnstock v5 API: Quote(symbol=..., source=...).history(...)
        for source in ('VCI', 'KBS'):
            try:
                quote = Quote(symbol=symbol, source=source)
                end = datetime.now().strftime('%Y-%m-%d')
                start = (datetime.now().replace(year=datetime.now().year-2)).strftime('%Y-%m-%d')
                df = quote.history(start=start, end=end, interval='1D')
                if df is None or getattr(df,'empty',True):
                    raise ValueError('Nguồn trả về bảng dữ liệu rỗng.')
                payload = _build_response(symbol, df, source)
                payload['fallbackTried'] = source != 'VCI'
                return self._send(200, payload)
            except Exception as exc:
                errors.append(f'{source}: {str(exc)[:220]}')
        return self._send(502, {'error':'Không lấy được dữ liệu từ Vnstock VCI hoặc KBS.','details':errors,'symbol':symbol})

    def _send(self,status,payload):
        body=json.dumps(payload,ensure_ascii=False,allow_nan=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Access-Control-Allow-Origin','*')
        self.end_headers(); self.wfile.write(body)

    def log_message(self, format, *args):
        return
