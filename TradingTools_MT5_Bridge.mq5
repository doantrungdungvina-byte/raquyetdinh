#property strict
#property version   "1.00"
#property description "Read-only price/history bridge from MT5 to Trading Tools Vercel API"

input string InpSymbol = "XAUUSDm";
input string InpEndpoint = "https://tradetool-delta.vercel.app/api/mt5";
input string InpApiKey = "PASTE_THE_SAME_MT5_API_KEY_FROM_VERCEL_HERE";
input int    InpSendEverySeconds = 5;
input int    InpBarsPerTimeframe = 120;
input int    InpTimeoutMs = 5000;
input bool   InpSendM5 = true;
input bool   InpSendM15 = true;
input bool   InpSendH1 = true;
input bool   InpSendD1 = true;

string JsonNumber(double value, int digits=8)
  {
   if(!MathIsValidNumber(value)) return "null";
   return DoubleToString(value, digits);
  }

string BarsJson(ENUM_TIMEFRAMES timeframe)
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(InpSymbol, timeframe, 0, InpBarsPerTimeframe, rates);
   if(copied <= 0) return "[]";
   string out = "[";
   // Array is series: highest index is oldest, so emit oldest to newest.
   for(int i=copied-1; i>=0; i--)
     {
      if(StringLen(out)>1) out += ",";
      out += "{\"time\":" + IntegerToString((long)rates[i].time)
          + ",\"open\":" + JsonNumber(rates[i].open, 8)
          + ",\"high\":" + JsonNumber(rates[i].high, 8)
          + ",\"low\":" + JsonNumber(rates[i].low, 8)
          + ",\"close\":" + JsonNumber(rates[i].close, 8)
          + ",\"tick_volume\":" + IntegerToString((long)rates[i].tick_volume)
          + ",\"real_volume\":" + IntegerToString((long)rates[i].real_volume) + "}";
     }
   return out + "]";
  }

string BuildPayload()
  {
   MqlTick tick;
   if(!SymbolInfoTick(InpSymbol, tick)) return "";
   int digits = (int)SymbolInfoInteger(InpSymbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(InpSymbol, SYMBOL_POINT);
   double spreadPoints = point > 0 ? (tick.ask-tick.bid)/point : 0;
   string tfs = "{";
   bool first = true;
   if(InpSendM5)  { tfs += "\"M5\":"  + BarsJson(PERIOD_M5);  first=false; }
   if(InpSendM15) { if(!first) tfs += ","; tfs += "\"M15\":" + BarsJson(PERIOD_M15); first=false; }
   if(InpSendH1)  { if(!first) tfs += ","; tfs += "\"H1\":"  + BarsJson(PERIOD_H1);  first=false; }
   if(InpSendD1)  { if(!first) tfs += ","; tfs += "\"D1\":"  + BarsJson(PERIOD_D1); }
   tfs += "}";
   string serverTime = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS);
   return "{\"symbol\":\""+InpSymbol+"\",\"bid\":"+JsonNumber(tick.bid,digits)
      +",\"ask\":"+JsonNumber(tick.ask,digits)
      +",\"digits\":"+IntegerToString(digits)
      +",\"point\":"+JsonNumber(point,10)
      +",\"spread_points\":"+JsonNumber(spreadPoints,1)
      +",\"tick_time\":"+IntegerToString((long)tick.time)
      +",\"server_time\":\""+serverTime+"\",\"timeframes\":"+tfs+"}";
  }

bool SendSnapshot()
  {
   if(InpApiKey=="" || InpApiKey=="PASTE_THE_SAME_MT5_API_KEY_FROM_VERCEL_HERE")
     { Print("Trading Tools bridge: set InpApiKey before use."); return false; }
   string payload = BuildPayload();
   if(payload=="") { Print("Trading Tools bridge: no tick for ", InpSymbol, ". Check Market Watch/symbol name."); return false; }
   char post[];
   int copied = StringToCharArray(payload, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied <= 1) return false;
   ArrayResize(post, copied-1); // remove terminating null byte
   char result[];
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nX-API-Key: "+InpApiKey+"\r\n";
   ResetLastError();
   int status = WebRequest("POST", InpEndpoint, headers, InpTimeoutMs, post, result, responseHeaders);
   if(status == -1)
     {
      Print("Trading Tools bridge: WebRequest failed, error=", GetLastError(),
            ". Add the website origin to Tools > Options > Expert Advisors > Allow WebRequest.");
      return false;
     }
   string responseText = CharArrayToString(result, 0, -1, CP_UTF8);
   if(status < 200 || status >= 300)
     {
      Print("Trading Tools bridge: HTTP ", status, " response=", responseText);
      return false;
     }
   Print("Trading Tools bridge: snapshot sent for ", InpSymbol, ", HTTP ", status);
   return true;
  }

int OnInit()
  {
   if(!SymbolSelect(InpSymbol, true))
     { Print("Cannot select broker symbol ", InpSymbol, ". Check exact symbol in Market Watch."); return INIT_FAILED; }
   EventSetTimer(MathMax(2, InpSendEverySeconds));
   SendSnapshot();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() { SendSnapshot(); }
void OnTick() { /* read-only bridge; sending is timer-based to reduce requests */ }
