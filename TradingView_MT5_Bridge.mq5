//+------------------------------------------------------------------+
//|                                     TradingView_MT5_Bridge.mq5   |
//|                        Copyright 2026, Ultra-Fast Bridge Team    |
//|                        High-Throughput Zero-Latency Engine       |
//+------------------------------------------------------------------+
#property copyright   "TradingView MT5 Ultra-Fast Bridge"
#property link        "http://127.0.0.1:9000"
#property version     "2.00"
#property description "Ultra-low latency MQL5 Expert Advisor bridge for TradingView Advanced Charts"

#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\OrderInfo.mqh>
#include <Trade\AccountInfo.mqh>

//+------------------------------------------------------------------+
//| Win32 API Imports for Optional Named Pipe Support                |
//+------------------------------------------------------------------+
#import "kernel32.dll"
long CreateFileW(string lpFileName, uint dwDesiredAccess, uint dwShareMode, long lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, long hTemplateFile);
int  ReadFile(long hFile, uchar &lpBuffer[], uint nNumberOfBytesToRead, uint &lpNumberOfBytesRead, long lpOverlapped);
int  WriteFile(long hFile, const uchar &lpBuffer[], uint nNumberOfBytesToWrite, uint &lpNumberOfBytesWritten, long lpOverlapped);
int  CloseHandle(long hObject);
int  PeekNamedPipe(long hNamedPipe, uchar &lpBuffer[], uint nBufferSize, uint &lpBytesRead, uint &lpTotalBytesAvail, uint &lpBytesLeftThisMessage);
#import

// Win32 Constants
#define GENERIC_READ           0x80000000
#define GENERIC_WRITE          0x40000000
#define OPEN_EXISTING          3
#define INVALID_HANDLE_VALUE   -1

//+------------------------------------------------------------------+
//| Enumerations & Inputs                                            |
//+------------------------------------------------------------------+
enum ENUM_COMM_MODE
{
   COMM_TCP_SOCKET  = 0, // High-Speed TCP Socket (Default 127.0.0.1:9001)
   COMM_NAMED_PIPE  = 1, // Windows Named Pipe (\\.\pipe\MT5_TV_Bridge)
   COMM_AUTO        = 2  // Auto: Try Named Pipe first, fallback to TCP
};

input group "--- Connectivity Settings ---"
input ENUM_COMM_MODE InpCommMode       = COMM_AUTO;                        // Transport Mode (Auto / TCP / Pipe)
input string         InpHost           = "127.0.0.1";                      // Bridge TCP Host
input int            InpTcpPort        = 9001;                             // Bridge TCP Port
input string         InpPipeName       = "\\\\.\\pipe\\MT5_TV_Bridge";     // Named Pipe Path
input int            InpTimerMs        = 1;                                // Execution Timer (1ms)

input group "--- Trading & Execution Settings ---"
input ulong          InpMagic          = 234000;                           // EA Magic Number
input ulong          InpDefaultDev     = 20;                               // Default Slippage Deviation
input bool           InpAutoSubscribe  = true;                             // Auto-stream Market Watch Ticks

//+------------------------------------------------------------------+
//| Global State Variables                                           |
//+------------------------------------------------------------------+
int      g_tcp_socket   = INVALID_HANDLE;
long     g_pipe_handle  = INVALID_HANDLE_VALUE;
bool     g_is_connected = false;
ulong    g_last_reconn  = 0;
string   g_recv_buffer  = "";

// Subscribed symbols for tick streaming
string   g_sub_symbols[];
long     g_last_tick_msc[];

// Standard trade helpers
CTrade         m_trade;
CSymbolInfo    m_sym;
CPositionInfo  m_pos;
COrderInfo     m_ord;
CAccountInfo   m_acc;

// Forward declarations
void SendHandshake();
void ExecuteCommand(const string json);
void HandleOrderMarket(const long id, const string json);
void HandleOrderPending(const long id, const string json);
void HandleOrderModify(const long id, const string json);
void HandleOrderClose(const long id, const string json);
void HandleOrderCloseAll(const long id, const string json);
void HandleGetPositions(const long id, const string json);
void HandleGetOrders(const long id, const string json);
void HandleGetAccount(const long id, const string json);
void HandleGetSymbols(const long id, const string json);
void HandleGetSymbolInfo(const long id, const string json);
void HandleGetRates(const long id, const string json);
void HandleGetTicks(const long id, const string json);
void HandleSubscribeSymbols(const long id, const string json);

//+------------------------------------------------------------------+
//| String & JSON Helper Functions                                   |
//+------------------------------------------------------------------+
string JsonEscape(const string text)
{
   string res = text;
   StringReplace(res, "\\", "\\\\");
   StringReplace(res, "\"", "\\\"");
   StringReplace(res, "\r", "");
   StringReplace(res, "\n", "\\n");
   StringReplace(res, "\t", "\\t");
   return res;
}

string GetJsonValue(const string json, const string key)
{
   string search = "\"" + key + "\"";
   int pos = StringFind(json, search);
   if(pos < 0) return "";
   
   int colon = StringFind(json, ":", pos + StringLen(search));
   if(colon < 0) return "";
   
   int len = StringLen(json);
   int start = colon + 1;
   while(start < len && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t'))
      start++;
      
   if(start >= len) return "";
   
   ushort ch = StringGetCharacter(json, start);
   if(ch == '\"')
   {
      start++;
      int end = StringFind(json, "\"", start);
      if(end < 0) return "";
      return StringSubstr(json, start, end - start);
   }
   else
   {
      int end = start;
      while(end < len)
      {
         ushort c = StringGetCharacter(json, end);
         if(c == ',' || c == '}' || c == ']' || c == '\r' || c == '\n' || c == ' ')
            break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }
}

string GetJsonString(const string json, const string key, const string def_val="")
{
   string v = GetJsonValue(json, key);
   return (v != "") ? v : def_val;
}

double GetJsonDouble(const string json, const string key, const double def_val=0.0)
{
   string v = GetJsonValue(json, key);
   return (v != "") ? StringToDouble(v) : def_val;
}

long GetJsonLong(const string json, const string key, const long def_val=0)
{
   string v = GetJsonValue(json, key);
   return (v != "") ? StringToInteger(v) : def_val;
}

bool GetJsonBool(const string json, const string key, const bool def_val=false)
{
   string v = GetJsonValue(json, key);
   if(v == "true" || v == "1") return true;
   if(v == "false" || v == "0") return false;
   return def_val;
}

//+------------------------------------------------------------------+
//| Retcode Translation Table                                        |
//+------------------------------------------------------------------+
string GetRetcodeName(const uint code)
{
   switch(code)
   {
      case 10004: return "TRADE_RETCODE_REQUOTE";
      case 10006: return "TRADE_RETCODE_REJECT";
      case 10007: return "TRADE_RETCODE_CANCEL";
      case 10008: return "TRADE_RETCODE_PLACED";
      case 10009: return "TRADE_RETCODE_DONE";
      case 10010: return "TRADE_RETCODE_DONE_PARTIAL";
      case 10011: return "TRADE_RETCODE_ERROR";
      case 10012: return "TRADE_RETCODE_TIMEOUT";
      case 10013: return "TRADE_RETCODE_INVALID";
      case 10014: return "TRADE_RETCODE_INVALID_VOLUME";
      case 10015: return "TRADE_RETCODE_INVALID_PRICE";
      case 10016: return "TRADE_RETCODE_INVALID_STOPS";
      case 10017: return "TRADE_RETCODE_TRADE_DISABLED";
      case 10018: return "TRADE_RETCODE_MARKET_CLOSED";
      case 10019: return "TRADE_RETCODE_NO_MONEY";
      case 10020: return "TRADE_RETCODE_PRICE_CHANGED";
      case 10021: return "TRADE_RETCODE_PRICE_OFF";
      case 10022: return "TRADE_RETCODE_INVALID_EXPIRATION";
      case 10023: return "TRADE_RETCODE_ORDER_CHANGED";
      case 10024: return "TRADE_RETCODE_TOO_MANY_REQUESTS";
      case 10025: return "TRADE_RETCODE_NO_CHANGES";
      case 10026: return "TRADE_RETCODE_SERVER_DISABLES_AT";
      case 10027: return "TRADE_RETCODE_CLIENT_DISABLES_AT";
      case 10028: return "TRADE_RETCODE_LOCKED";
      case 10029: return "TRADE_RETCODE_FROZEN";
      case 10030: return "TRADE_RETCODE_INVALID_FILL";
      case 10031: return "TRADE_RETCODE_CONNECTION";
      case 10032: return "TRADE_RETCODE_ONLY_REAL";
      case 10033: return "TRADE_RETCODE_LIMIT_ORDERS";
      case 10034: return "TRADE_RETCODE_LIMIT_VOLUME";
      case 10035: return "TRADE_RETCODE_POSITION_CLOSED";
      case 10036: return "TRADE_RETCODE_INVALID_CLOSE_VOLUME";
      case 10038: return "TRADE_RETCODE_CLOSE_ORDER_EXIST";
      case 10039: return "TRADE_RETCODE_LIMIT_POSITIONS";
      default:    return "TRADE_RETCODE_UNKNOWN";
   }
}

string GetRetcodeDescription(const uint code)
{
   switch(code)
   {
      case 10004: return "Requote";
      case 10006: return "Request rejected";
      case 10007: return "Request canceled by trader";
      case 10008: return "Order placed";
      case 10009: return "Request completed successfully";
      case 10010: return "Only part of the request was completed";
      case 10011: return "Request processing error";
      case 10012: return "Request canceled by timeout";
      case 10013: return "Invalid request";
      case 10014: return "Invalid volume in the request";
      case 10015: return "Invalid price in the request";
      case 10016: return "Invalid stops in the request";
      case 10017: return "Trade is disabled";
      case 10018: return "Market is closed";
      case 10019: return "There is not enough money to complete the request";
      case 10020: return "Prices changed";
      case 10021: return "There are no quotes to process the request";
      case 10022: return "Invalid order expiration date in the request";
      case 10023: return "Order state changed";
      case 10024: return "Too frequent requests";
      case 10025: return "No changes in request";
      case 10026: return "Autotrading disabled by server";
      case 10027: return "Autotrading disabled by client terminal";
      case 10028: return "Request locked for processing";
      case 10029: return "Order or position frozen";
      case 10030: return "Specified type of order execution is not supported";
      case 10031: return "No connection with the trade server";
      case 10032: return "Operation is allowed only for live accounts";
      case 10033: return "The number of pending orders has reached the limit";
      case 10034: return "The volume of orders and positions has reached the limit";
      case 10035: return "Position is already closed";
      case 10036: return "Invalid close volume";
      case 10038: return "Close order already exists";
      case 10039: return "Position limit reached";
      default:    return "Execution result code: " + IntegerToString(code);
   }
}

// Determine supported filling mode for symbol
ENUM_ORDER_TYPE_FILLING GetSymbolFilling(const string symbol, const int requested_mode = -1)
{
   if(requested_mode == 0) return ORDER_FILLING_FOK;
   if(requested_mode == 1) return ORDER_FILLING_IOC;
   if(requested_mode == 2) return ORDER_FILLING_RETURN;
   
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_IOC) != 0)
      return ORDER_FILLING_IOC;
   if((filling & SYMBOL_FILLING_FOK) != 0)
      return ORDER_FILLING_FOK;
   return ORDER_FILLING_RETURN;
}

//+------------------------------------------------------------------+
//| Transport Layer: Connect, Disconnect, Send, Receive              |
//+------------------------------------------------------------------+
void TransportDisconnect()
{
   if(g_tcp_socket != INVALID_HANDLE)
   {
      SocketClose(g_tcp_socket);
      g_tcp_socket = INVALID_HANDLE;
   }
   if(g_pipe_handle != INVALID_HANDLE_VALUE && g_pipe_handle != 0)
   {
      CloseHandle(g_pipe_handle);
      g_pipe_handle = INVALID_HANDLE_VALUE;
   }
   g_is_connected = false;
}

bool TransportSend(const string text)
{
   if(!g_is_connected) return false;
   
   uchar data[];
   int len = StringToCharArray(text, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len <= 0) return false;
   int to_send = len - 1; // Exclude trailing null
   
   // Pipe send path
   if(g_pipe_handle != INVALID_HANDLE_VALUE && g_pipe_handle != 0)
   {
      uint total_written = 0;
      while(total_written < (uint)to_send)
      {
         uint written = 0;
         uchar slice[];
         uint chunk = (uint)MathMin(8192, to_send - total_written);
         ArrayCopy(slice, data, 0, (int)total_written, (int)chunk);
         int ok = WriteFile(g_pipe_handle, slice, chunk, written, 0);
         if(ok == 0 || written == 0)
         {
            TransportDisconnect();
            return false;
         }
         total_written += written;
      }
      return true;
   }
   
   // TCP send path
   if(g_tcp_socket != INVALID_HANDLE)
   {
      int offset = 0;
      while(offset < to_send)
      {
         int chunk = MathMin(8192, to_send - offset);
         uchar slice[];
         ArrayCopy(slice, data, 0, offset, chunk);
         int sent = SocketSend(g_tcp_socket, slice, chunk);
         if(sent <= 0)
         {
            TransportDisconnect();
            return false;
         }
         offset += sent;
      }
      return true;
   }
   
   return false;
}

void SendHandshake()
{
   string hello = StringFormat("{\"stream\":\"handshake\",\"login\":%I64d,\"server\":\"%s\",\"account_currency\":\"%s\",\"company\":\"%s\",\"time\":%I64d}\n",
                               AccountInfoInteger(ACCOUNT_LOGIN),
                               JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
                               JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)),
                               JsonEscape(AccountInfoString(ACCOUNT_COMPANY)),
                               TimeCurrent());
   TransportSend(hello);
}

bool TransportConnect()
{
   // Try Named Pipe if enabled
   if(InpCommMode == COMM_NAMED_PIPE || InpCommMode == COMM_AUTO)
   {
      g_pipe_handle = CreateFileW(InpPipeName, GENERIC_READ | GENERIC_WRITE, 0, 0, OPEN_EXISTING, 0, 0);
      if(g_pipe_handle != INVALID_HANDLE_VALUE && g_pipe_handle != 0)
      {
         g_is_connected = true;
         PrintFormat("[Bridge] Connected to Ultra-Fast Bridge via Named Pipe: %s", InpPipeName);
         SendHandshake();
         return true;
      }
   }
   
   // Try TCP Socket
   if(InpCommMode == COMM_TCP_SOCKET || InpCommMode == COMM_AUTO)
   {
      if(g_tcp_socket != INVALID_HANDLE)
      {
         SocketClose(g_tcp_socket);
         g_tcp_socket = INVALID_HANDLE;
      }
      
      g_tcp_socket = SocketCreate();
      if(g_tcp_socket == INVALID_HANDLE)
      {
         return false;
      }
      
      // Set non-blocking microsecond timeouts
      SocketTimeouts(g_tcp_socket, 10, 10);
      
      if(SocketConnect(g_tcp_socket, InpHost, InpTcpPort, 500))
      {
         g_is_connected = true;
         PrintFormat("[Bridge] Connected to Ultra-Fast Bridge via TCP: %s:%d", InpHost, InpTcpPort);
         SendHandshake();
         return true;
      }
      else
      {
         SocketClose(g_tcp_socket);
         g_tcp_socket = INVALID_HANDLE;
      }
   }
   
   g_is_connected = false;
   return false;
}

void TransportReceive()
{
   if(!g_is_connected) return;
   
   uchar buf[8192];
   
   // Pipe read
   if(g_pipe_handle != INVALID_HANDLE_VALUE && g_pipe_handle != 0)
   {
      uint avail = 0, left = 0, read_bytes = 0;
      int peek = PeekNamedPipe(g_pipe_handle, buf, 0, read_bytes, avail, left);
      if(peek == 0)
      {
         TransportDisconnect();
         return;
      }
      if(avail > 0)
      {
         uint to_read = MathMin(sizeof(buf), avail);
         uint actually_read = 0;
         if(ReadFile(g_pipe_handle, buf, to_read, actually_read, 0) != 0 && actually_read > 0)
         {
            string piece = CharArrayToString(buf, 0, actually_read, CP_UTF8);
            g_recv_buffer += piece;
         }
      }
   }
   
   // TCP read
   if(g_tcp_socket != INVALID_HANDLE)
   {
      if(!SocketIsConnected(g_tcp_socket))
      {
         TransportDisconnect();
         return;
      }
      uint avail = SocketIsReadable(g_tcp_socket);
      while(avail > 0)
      {
         uint to_read = MathMin(sizeof(buf), avail);
         int read_bytes = SocketRead(g_tcp_socket, buf, to_read, 5);
         if(read_bytes <= 0)
         {
            if(!SocketIsConnected(g_tcp_socket))
               TransportDisconnect();
            break;
         }
         string piece = CharArrayToString(buf, 0, read_bytes, CP_UTF8);
         g_recv_buffer += piece;
         avail = SocketIsReadable(g_tcp_socket);
      }
   }
   
   // Process complete newline-delimited commands
   int newline_pos = StringFind(g_recv_buffer, "\n");
   while(newline_pos >= 0)
   {
      string cmd_line = StringSubstr(g_recv_buffer, 0, newline_pos);
      g_recv_buffer = StringSubstr(g_recv_buffer, newline_pos + 1);
      
      StringTrimLeft(cmd_line);
      StringTrimRight(cmd_line);
      if(StringLen(cmd_line) > 0)
      {
         ExecuteCommand(cmd_line);
      }
      newline_pos = StringFind(g_recv_buffer, "\n");
   }
}

//+------------------------------------------------------------------+
//| Market Watch Subscriptions & Ticks                               |
//+------------------------------------------------------------------+
void AddSubscribedSymbol(const string symbol)
{
   if(symbol == "") return;
   for(int i = 0; i < ArraySize(g_sub_symbols); i++)
   {
      if(g_sub_symbols[i] == symbol) return;
   }
   int sz = ArraySize(g_sub_symbols);
   ArrayResize(g_sub_symbols, sz + 1);
   ArrayResize(g_last_tick_msc, sz + 1);
   g_sub_symbols[sz] = symbol;
   g_last_tick_msc[sz] = 0;
   SymbolSelect(symbol, true);
}

void SyncMarketWatchSymbols()
{
   int total = SymbolsTotal(true);
   for(int i = 0; i < total; i++)
   {
      string sym = SymbolName(i, true);
      AddSubscribedSymbol(sym);
   }
}

void StreamPendingTicks()
{
   if(!g_is_connected) return;
   
   MqlTick tick;
   int sz = ArraySize(g_sub_symbols);
   for(int i = 0; i < sz; i++)
   {
      string sym = g_sub_symbols[i];
      if(SymbolInfoTick(sym, tick))
      {
         if(tick.time_msc > g_last_tick_msc[i])
         {
            g_last_tick_msc[i] = tick.time_msc;
            int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
            string msg = StringFormat("{\"stream\":\"tick\",\"symbol\":\"%s\",\"time_msc\":%I64d,\"bid\":%s,\"ask\":%s,\"last\":%s,\"volume\":%.4f,\"flags\":%u}\n",
                                      JsonEscape(sym),
                                      tick.time_msc,
                                      DoubleToString(tick.bid, digits),
                                      DoubleToString(tick.ask, digits),
                                      DoubleToString(tick.last, digits),
                                      tick.volume,
                                      tick.flags);
            TransportSend(msg);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Core Command Dispatcher                                          |
//+------------------------------------------------------------------+
void ExecuteCommand(const string json)
{
   long   id  = GetJsonLong(json, "id", 0);
   string cmd = GetJsonString(json, "cmd", "");
   
   if(cmd == "ORDER_MARKET")
   {
      HandleOrderMarket(id, json);
   }
   else if(cmd == "ORDER_PENDING")
   {
      HandleOrderPending(id, json);
   }
   else if(cmd == "ORDER_MODIFY")
   {
      HandleOrderModify(id, json);
   }
   else if(cmd == "ORDER_CLOSE")
   {
      HandleOrderClose(id, json);
   }
   else if(cmd == "ORDER_CLOSE_ALL")
   {
      HandleOrderCloseAll(id, json);
   }
   else if(cmd == "GET_POSITIONS")
   {
      HandleGetPositions(id, json);
   }
   else if(cmd == "GET_ORDERS")
   {
      HandleGetOrders(id, json);
   }
   else if(cmd == "GET_ACCOUNT")
   {
      HandleGetAccount(id, json);
   }
   else if(cmd == "GET_SYMBOLS")
   {
      HandleGetSymbols(id, json);
   }
   else if(cmd == "GET_SYMBOL_INFO")
   {
      HandleGetSymbolInfo(id, json);
   }
   else if(cmd == "GET_RATES")
   {
      HandleGetRates(id, json);
   }
   else if(cmd == "GET_TICKS")
   {
      HandleGetTicks(id, json);
   }
   else if(cmd == "SUBSCRIBE_SYMBOLS")
   {
      HandleSubscribeSymbols(id, json);
   }
   else if(cmd == "PING")
   {
      string resp = StringFormat("{\"id\":%I64d,\"cmd\":\"PONG\",\"time\":%I64d}\n", id, TimeCurrent());
      TransportSend(resp);
   }
   else
   {
      string resp = StringFormat("{\"id\":%I64d,\"success\":false,\"error\":\"Unknown command: %s\"}\n", id, JsonEscape(cmd));
      TransportSend(resp);
   }
}

//+------------------------------------------------------------------+
//| Execution Handlers                                               |
//+------------------------------------------------------------------+
void HandleOrderMarket(const long id, const string json)
{
   string symbol    = GetJsonString(json, "symbol", _Symbol);
   string action    = GetJsonString(json, "action", "BUY");
   double volume    = GetJsonDouble(json, "volume", 0.01);
   double price     = GetJsonDouble(json, "price", 0.0);
   double sl        = GetJsonDouble(json, "sl", 0.0);
   double tp        = GetJsonDouble(json, "tp", 0.0);
   ulong  dev       = (ulong)GetJsonLong(json, "deviation", InpDefaultDev);
   ulong  magic     = (ulong)GetJsonLong(json, "magic", InpMagic);
   string comment   = GetJsonString(json, "comment", "TradingView MT5");
   int    req_fill  = (int)GetJsonLong(json, "type_filling", -1);
   
   SymbolSelect(symbol, true);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   
   ENUM_ORDER_TYPE order_type = ORDER_TYPE_BUY;
   string act_upper = action;
   StringToUpper(act_upper);
   if(act_upper == "SELL" || act_upper == "1")
   {
      order_type = ORDER_TYPE_SELL;
   }
   
   double default_price = (order_type == ORDER_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);
   if(price <= 0.0) price = default_price;
   
   price = NormalizeDouble(price, digits);
   if(sl > 0.0) sl = NormalizeDouble(sl, digits);
   if(tp > 0.0) tp = NormalizeDouble(tp, digits);
   
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);
   
   req.action       = TRADE_ACTION_DEAL;
   req.symbol       = symbol;
   req.volume       = volume;
   req.type         = order_type;
   req.price        = price;
   req.sl           = sl;
   req.tp           = tp;
   req.deviation    = dev;
   req.magic        = magic;
   req.comment      = comment;
   req.type_time    = ORDER_TIME_GTC;
   req.type_filling = GetSymbolFilling(symbol, req_fill);
   
   bool sent = OrderSend(req, res);
   
   // Handle filling mode retry if broker rejected filling mode
   if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
   {
      req.type_filling = (req.type_filling == ORDER_FILLING_FOK) ? ORDER_FILLING_IOC : ORDER_FILLING_FOK;
      sent = OrderSend(req, res);
      if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
      {
         req.type_filling = ORDER_FILLING_RETURN;
         sent = OrderSend(req, res);
      }
   }
   
   // Handle market execution stop rejection (ECN brokers requiring stops after fill)
   if(!sent && res.retcode == TRADE_RETCODE_INVALID_STOPS && (sl > 0.0 || tp > 0.0))
   {
      double saved_sl = req.sl;
      double saved_tp = req.tp;
      req.sl = 0;
      req.tp = 0;
      sent = OrderSend(req, res);
      if(sent && (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED))
      {
         ulong pos_ticket = res.order;
         if(pos_ticket > 0)
         {
            MqlTradeRequest sltp_req;
            MqlTradeResult  sltp_res;
            ZeroMemory(sltp_req);
            ZeroMemory(sltp_res);
            sltp_req.action   = TRADE_ACTION_SLTP;
            sltp_req.position = pos_ticket;
            sltp_req.symbol   = symbol;
            sltp_req.sl       = saved_sl;
            sltp_req.tp       = saved_tp;
            bool sltp_sent = OrderSend(sltp_req, sltp_res);
            if(!sltp_sent)
            {
               PrintFormat("[Bridge] SL/TP attach warning for ticket %I64u, retcode: %u", pos_ticket, sltp_res.retcode);
            }
         }
      }
   }
   
   bool success = (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED || res.retcode == TRADE_RETCODE_DONE_PARTIAL);
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":%s,\"retcode\":%u,\"retcode_name\":\"%s\",\"retcode_description\":\"%s\",\"order\":%I64u,\"ticket\":%I64u,\"deal\":%I64u,\"volume\":%.4f,\"price\":%s,\"bid\":%s,\"ask\":%s,\"comment\":\"%s\",\"symbol\":\"%s\",\"action\":\"%s\"}\n",
                              id,
                              success ? "true" : "false",
                              res.retcode,
                              JsonEscape(GetRetcodeName(res.retcode)),
                              JsonEscape(GetRetcodeDescription(res.retcode)),
                              res.order,
                              res.order,
                              res.deal,
                              res.volume,
                              DoubleToString(res.price, digits),
                              DoubleToString(res.bid, digits),
                              DoubleToString(res.ask, digits),
                              JsonEscape(res.comment),
                              JsonEscape(symbol),
                              JsonEscape(act_upper));
   TransportSend(resp);
}

void HandleOrderPending(const long id, const string json)
{
   string symbol    = GetJsonString(json, "symbol", _Symbol);
   string action    = GetJsonString(json, "action", "BUY_LIMIT");
   double volume    = GetJsonDouble(json, "volume", 0.01);
   double price     = GetJsonDouble(json, "price", 0.0);
   double sl        = GetJsonDouble(json, "sl", 0.0);
   double tp        = GetJsonDouble(json, "tp", 0.0);
   double stoplimit = GetJsonDouble(json, "stoplimit", 0.0);
   ulong  dev       = (ulong)GetJsonLong(json, "deviation", InpDefaultDev);
   ulong  magic     = (ulong)GetJsonLong(json, "magic", InpMagic);
   string comment   = GetJsonString(json, "comment", "TradingView MT5 Pending");
   long   exp       = GetJsonLong(json, "expiration", 0);
   int    req_fill  = (int)GetJsonLong(json, "type_filling", -1);
   
   SymbolSelect(symbol, true);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   
   string act = action;
   StringToUpper(act);
   ENUM_ORDER_TYPE order_type = ORDER_TYPE_BUY_LIMIT;
   if(act == "BUY_LIMIT")              order_type = ORDER_TYPE_BUY_LIMIT;
   else if(act == "SELL_LIMIT")        order_type = ORDER_TYPE_SELL_LIMIT;
   else if(act == "BUY_STOP")          order_type = ORDER_TYPE_BUY_STOP;
   else if(act == "SELL_STOP")         order_type = ORDER_TYPE_SELL_STOP;
   else if(act == "BUY_STOP_LIMIT")    order_type = ORDER_TYPE_BUY_STOP_LIMIT;
   else if(act == "SELL_STOP_LIMIT")   order_type = ORDER_TYPE_SELL_STOP_LIMIT;
   
   price = NormalizeDouble(price, digits);
   if(sl > 0.0) sl = NormalizeDouble(sl, digits);
   if(tp > 0.0) tp = NormalizeDouble(tp, digits);
   if(stoplimit > 0.0) stoplimit = NormalizeDouble(stoplimit, digits);
   
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);
   
   req.action       = TRADE_ACTION_PENDING;
   req.symbol       = symbol;
   req.volume       = volume;
   req.type         = order_type;
   req.price        = price;
   req.sl           = sl;
   req.tp           = tp;
   req.stoplimit    = stoplimit;
   req.deviation    = dev;
   req.magic        = magic;
   req.comment      = comment;
   req.type_filling = GetSymbolFilling(symbol, req_fill);
   if(exp > 0)
   {
      req.type_time   = ORDER_TIME_SPECIFIED;
      req.expiration  = (datetime)exp;
   }
   else
   {
      req.type_time   = ORDER_TIME_GTC;
   }
   
   bool sent = OrderSend(req, res);
   if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
   {
      req.type_filling = (req.type_filling == ORDER_FILLING_FOK) ? ORDER_FILLING_IOC : ORDER_FILLING_FOK;
      sent = OrderSend(req, res);
      if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
      {
         req.type_filling = ORDER_FILLING_RETURN;
         sent = OrderSend(req, res);
      }
   }
   
   bool success = (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED);
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":%s,\"retcode\":%u,\"retcode_name\":\"%s\",\"retcode_description\":\"%s\",\"order\":%I64u,\"ticket\":%I64u,\"price\":%s,\"comment\":\"%s\",\"symbol\":\"%s\"}\n",
                              id,
                              success ? "true" : "false",
                              res.retcode,
                              JsonEscape(GetRetcodeName(res.retcode)),
                              JsonEscape(GetRetcodeDescription(res.retcode)),
                              res.order,
                              res.order,
                              DoubleToString(res.price, digits),
                              JsonEscape(res.comment),
                              JsonEscape(symbol));
   TransportSend(resp);
}

void HandleOrderModify(const long id, const string json)
{
   ulong  ticket    = (ulong)GetJsonLong(json, "ticket", 0);
   double price     = GetJsonDouble(json, "price", 0.0);
   double sl        = GetJsonDouble(json, "sl", 0.0);
   double tp        = GetJsonDouble(json, "tp", 0.0);
   double stoplimit = GetJsonDouble(json, "stoplimit", 0.0);
   long   exp       = GetJsonLong(json, "expiration", 0);
   
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);
   
   // 1. Try Position Modification (SL/TP)
   if(PositionSelectByTicket(ticket))
   {
      string sym = PositionGetString(POSITION_SYMBOL);
      int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      if(sl > 0.0) sl = NormalizeDouble(sl, digits);
      if(tp > 0.0) tp = NormalizeDouble(tp, digits);
      
      req.action   = TRADE_ACTION_SLTP;
      req.position = ticket;
      req.symbol   = sym;
      req.sl       = sl;
      req.tp       = tp;
      
      bool sent = OrderSend(req, res);
      bool success = (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED);
      
      string resp = StringFormat("{\"id\":%I64d,\"success\":%s,\"retcode\":%u,\"retcode_name\":\"%s\",\"retcode_description\":\"%s\",\"ticket\":%I64u,\"order\":%I64u,\"sl\":%s,\"tp\":%s}\n",
                                 id,
                                 success ? "true" : "false",
                                 res.retcode,
                                 JsonEscape(GetRetcodeName(res.retcode)),
                                 JsonEscape(GetRetcodeDescription(res.retcode)),
                                 ticket,
                                 res.order,
                                 DoubleToString(sl, digits),
                                 DoubleToString(tp, digits));
      TransportSend(resp);
      return;
   }
   
   // 2. Try Pending Order Modification
   if(OrderSelect(ticket))
   {
      string sym = OrderGetString(ORDER_SYMBOL);
      int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      if(price <= 0.0) price = OrderGetDouble(ORDER_PRICE_OPEN);
      price = NormalizeDouble(price, digits);
      if(sl > 0.0) sl = NormalizeDouble(sl, digits);
      if(tp > 0.0) tp = NormalizeDouble(tp, digits);
      if(stoplimit > 0.0) stoplimit = NormalizeDouble(stoplimit, digits);
      
      req.action    = TRADE_ACTION_MODIFY;
      req.order     = ticket;
      req.symbol    = sym;
      req.price     = price;
      req.sl        = sl;
      req.tp        = tp;
      req.stoplimit = stoplimit;
      if(exp > 0)
      {
         req.type_time  = ORDER_TIME_SPECIFIED;
         req.expiration = (datetime)exp;
      }
      
      bool sent = OrderSend(req, res);
      bool success = (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED);
      
      string resp = StringFormat("{\"id\":%I64d,\"success\":%s,\"retcode\":%u,\"retcode_name\":\"%s\",\"retcode_description\":\"%s\",\"ticket\":%I64u,\"order\":%I64u,\"price\":%s,\"sl\":%s,\"tp\":%s}\n",
                                 id,
                                 success ? "true" : "false",
                                 res.retcode,
                                 JsonEscape(GetRetcodeName(res.retcode)),
                                 JsonEscape(GetRetcodeDescription(res.retcode)),
                                 ticket,
                                 res.order,
                                 DoubleToString(price, digits),
                                 DoubleToString(sl, digits),
                                 DoubleToString(tp, digits));
      TransportSend(resp);
      return;
   }
   
   string not_found = StringFormat("{\"id\":%I64d,\"success\":false,\"retcode\":10013,\"error\":\"Ticket %I64u not found in active positions or pending orders.\"}\n", id, ticket);
   TransportSend(not_found);
}

void HandleOrderClose(const long id, const string json)
{
   ulong  ticket = (ulong)GetJsonLong(json, "ticket", 0);
   double volume = GetJsonDouble(json, "volume", 0.0);
   ulong  dev    = (ulong)GetJsonLong(json, "deviation", InpDefaultDev);
   
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);
   
   // 1. Try Position Close
   if(PositionSelectByTicket(ticket))
   {
      string sym      = PositionGetString(POSITION_SYMBOL);
      int digits      = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double pos_vol  = PositionGetDouble(POSITION_VOLUME);
      double clos_vol = (volume > 0.0 && volume < pos_vol) ? volume : pos_vol;
      long   pos_type = PositionGetInteger(POSITION_TYPE);
      
      req.action       = TRADE_ACTION_DEAL;
      req.position     = ticket;
      req.symbol       = sym;
      req.volume       = clos_vol;
      req.deviation    = dev;
      req.type         = (pos_type == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
      req.price        = (req.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK);
      req.type_filling = GetSymbolFilling(sym);
      req.comment      = "TradingView MT5 Close";
      
      bool sent = OrderSend(req, res);
      if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
      {
         req.type_filling = (req.type_filling == ORDER_FILLING_FOK) ? ORDER_FILLING_IOC : ORDER_FILLING_FOK;
         sent = OrderSend(req, res);
         if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
         {
            req.type_filling = ORDER_FILLING_RETURN;
            sent = OrderSend(req, res);
         }
      }
      
      bool success = (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_DONE_PARTIAL);
      
      string resp = StringFormat("{\"id\":%I64d,\"success\":%s,\"retcode\":%u,\"retcode_name\":\"%s\",\"retcode_description\":\"%s\",\"ticket\":%I64u,\"deal\":%I64u,\"order\":%I64u,\"volume\":%.4f,\"price\":%s}\n",
                                 id,
                                 success ? "true" : "false",
                                 res.retcode,
                                 JsonEscape(GetRetcodeName(res.retcode)),
                                 JsonEscape(GetRetcodeDescription(res.retcode)),
                                 ticket,
                                 res.deal,
                                 res.order,
                                 res.volume,
                                 DoubleToString(res.price, digits));
      TransportSend(resp);
      return;
   }
   
   // 2. Try Pending Order Cancel
   if(OrderSelect(ticket))
   {
      req.action = TRADE_ACTION_REMOVE;
      req.order  = ticket;
      
      bool sent = OrderSend(req, res);
      bool success = (res.retcode == TRADE_RETCODE_DONE);
      
      string resp = StringFormat("{\"id\":%I64d,\"success\":%s,\"retcode\":%u,\"retcode_name\":\"%s\",\"retcode_description\":\"%s\",\"ticket\":%I64u,\"order\":%I64u}\n",
                                 id,
                                 success ? "true" : "false",
                                 res.retcode,
                                 JsonEscape(GetRetcodeName(res.retcode)),
                                 JsonEscape(GetRetcodeDescription(res.retcode)),
                                 ticket,
                                 res.order);
      TransportSend(resp);
      return;
   }
   
   string err = StringFormat("{\"id\":%I64d,\"success\":false,\"retcode\":10013,\"error\":\"Ticket %I64u not found to close or cancel.\"}\n", id, ticket);
   TransportSend(err);
}

void HandleOrderCloseAll(const long id, const string json)
{
   string filter_sym = GetJsonString(json, "symbol", "");
   int closed_count = 0;
   
   int total_pos = PositionsTotal();
   for(int i = total_pos - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         string sym = PositionGetString(POSITION_SYMBOL);
         if(filter_sym == "" || filter_sym == sym)
         {
            double pos_vol  = PositionGetDouble(POSITION_VOLUME);
            long   pos_type = PositionGetInteger(POSITION_TYPE);
            
            MqlTradeRequest req;
            MqlTradeResult  res;
            ZeroMemory(req);
            ZeroMemory(res);
            
            req.action       = TRADE_ACTION_DEAL;
            req.position     = ticket;
            req.symbol       = sym;
            req.volume       = pos_vol;
            req.type         = (pos_type == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
            req.price        = (req.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK);
            req.type_filling = GetSymbolFilling(sym);
            req.comment      = "TradingView MT5 CloseAll";
            
            bool sent = OrderSend(req, res);
            if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
            {
               req.type_filling = (req.type_filling == ORDER_FILLING_FOK) ? ORDER_FILLING_IOC : ORDER_FILLING_FOK;
               sent = OrderSend(req, res);
               if(!sent && res.retcode == TRADE_RETCODE_INVALID_FILL)
               {
                  req.type_filling = ORDER_FILLING_RETURN;
                  sent = OrderSend(req, res);
               }
            }
            if(sent && (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_DONE_PARTIAL))
            {
               closed_count++;
            }
         }
      }
   }
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"closed_count\":%d,\"filter_symbol\":\"%s\"}\n",
                              id, closed_count, JsonEscape(filter_sym));
   TransportSend(resp);
}

void HandleGetPositions(const long id, const string json)
{
   string filter_sym = GetJsonString(json, "symbol", "");
   int total = PositionsTotal();
   string items = "";
   int count = 0;
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         string sym = PositionGetString(POSITION_SYMBOL);
         if(filter_sym != "" && filter_sym != sym) continue;
         
         int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
         long type = PositionGetInteger(POSITION_TYPE);
         string type_str = (type == POSITION_TYPE_BUY) ? "buy" : "sell";
         
         string item = StringFormat("{\"id\":%I64u,\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"%s\",\"side\":\"%s\",\"volume\":%.4f,\"price_open\":%s,\"price_current\":%s,\"sl\":%s,\"tp\":%s,\"profit\":%.2f,\"swap\":%.2f,\"time\":%I64d,\"time_msc\":%I64d,\"magic\":%I64u,\"comment\":\"%s\"}",
                                    ticket,
                                    ticket,
                                    JsonEscape(sym),
                                    type_str,
                                    type_str,
                                    PositionGetDouble(POSITION_VOLUME),
                                    DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), digits),
                                    DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), digits),
                                    DoubleToString(PositionGetDouble(POSITION_SL), digits),
                                    DoubleToString(PositionGetDouble(POSITION_TP), digits),
                                    PositionGetDouble(POSITION_PROFIT),
                                    PositionGetDouble(POSITION_SWAP),
                                    PositionGetInteger(POSITION_TIME),
                                    PositionGetInteger(POSITION_TIME_MSC),
                                    PositionGetInteger(POSITION_MAGIC),
                                    JsonEscape(PositionGetString(POSITION_COMMENT)));
         if(count > 0) items += ",";
         items += item;
         count++;
      }
   }
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"positions\":[%s]}\n", id, items);
   TransportSend(resp);
}

void HandleGetOrders(const long id, const string json)
{
   string filter_sym = GetJsonString(json, "symbol", "");
   int total = OrdersTotal();
   string items = "";
   int count = 0;
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderSelect(ticket))
      {
         string sym = OrderGetString(ORDER_SYMBOL);
         if(filter_sym != "" && filter_sym != sym) continue;
         
         int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
         long type = OrderGetInteger(ORDER_TYPE);
         string type_str = "buy_limit";
         if(type == ORDER_TYPE_BUY_LIMIT)        type_str = "buy_limit";
         else if(type == ORDER_TYPE_SELL_LIMIT)   type_str = "sell_limit";
         else if(type == ORDER_TYPE_BUY_STOP)     type_str = "buy_stop";
         else if(type == ORDER_TYPE_SELL_STOP)    type_str = "sell_stop";
         else if(type == ORDER_TYPE_BUY_STOP_LIMIT)  type_str = "buy_stop_limit";
         else if(type == ORDER_TYPE_SELL_STOP_LIMIT) type_str = "sell_stop_limit";
         
         string item = StringFormat("{\"id\":%I64u,\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"%s\",\"side\":\"%s\",\"volume_initial\":%.4f,\"volume_current\":%.4f,\"price_open\":%s,\"sl\":%s,\"tp\":%s,\"time_setup\":%I64d,\"state\":%I64d,\"magic\":%I64u,\"comment\":\"%s\"}",
                                    ticket,
                                    ticket,
                                    JsonEscape(sym),
                                    type_str,
                                    (StringFind(type_str, "buy") >= 0 ? "buy" : "sell"),
                                    OrderGetDouble(ORDER_VOLUME_INITIAL),
                                    OrderGetDouble(ORDER_VOLUME_CURRENT),
                                    DoubleToString(OrderGetDouble(ORDER_PRICE_OPEN), digits),
                                    DoubleToString(OrderGetDouble(ORDER_SL), digits),
                                    DoubleToString(OrderGetDouble(ORDER_TP), digits),
                                    OrderGetInteger(ORDER_TIME_SETUP),
                                    OrderGetInteger(ORDER_STATE),
                                    OrderGetInteger(ORDER_MAGIC),
                                    JsonEscape(OrderGetString(ORDER_COMMENT)));
         if(count > 0) items += ",";
         items += item;
         count++;
      }
   }
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"orders\":[%s]}\n", id, items);
   TransportSend(resp);
}

void HandleGetAccount(const long id, const string json)
{
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"account\":{\"login\":%I64d,\"name\":\"%s\",\"trade_mode\":%I64d,\"leverage\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"profit\":%.2f,\"margin\":%.2f,\"margin_free\":%.2f,\"margin_level\":%.2f,\"currency\":\"%s\",\"server\":\"%s\",\"company\":\"%s\"}}\n",
                              id,
                              AccountInfoInteger(ACCOUNT_LOGIN),
                              JsonEscape(AccountInfoString(ACCOUNT_NAME)),
                              AccountInfoInteger(ACCOUNT_TRADE_MODE),
                              AccountInfoInteger(ACCOUNT_LEVERAGE),
                              AccountInfoDouble(ACCOUNT_BALANCE),
                              AccountInfoDouble(ACCOUNT_EQUITY),
                              AccountInfoDouble(ACCOUNT_PROFIT),
                              AccountInfoDouble(ACCOUNT_MARGIN),
                              AccountInfoDouble(ACCOUNT_MARGIN_FREE),
                              AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),
                              JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)),
                              JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
                              JsonEscape(AccountInfoString(ACCOUNT_COMPANY)));
   TransportSend(resp);
}

void HandleGetSymbols(const long id, const string json)
{
   int total = SymbolsTotal(true);
   string items = "";
   for(int i = 0; i < total; i++)
   {
      string sym = SymbolName(i, true);
      string item = StringFormat("{\"name\":\"%s\",\"digits\":%d,\"point\":%.6f,\"spread\":%d,\"contract_size\":%.2f,\"currency_base\":\"%s\",\"currency_profit\":\"%s\"}",
                                 JsonEscape(sym),
                                 (int)SymbolInfoInteger(sym, SYMBOL_DIGITS),
                                 SymbolInfoDouble(sym, SYMBOL_POINT),
                                 (int)SymbolInfoInteger(sym, SYMBOL_SPREAD),
                                 SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE),
                                 JsonEscape(SymbolInfoString(sym, SYMBOL_CURRENCY_BASE)),
                                 JsonEscape(SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT)));
      if(i > 0) items += ",";
      items += item;
   }
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"symbols\":[%s]}\n", id, items);
   TransportSend(resp);
}

void HandleGetSymbolInfo(const long id, const string json)
{
   string sym = GetJsonString(json, "symbol", _Symbol);
   SymbolSelect(sym, true);
   
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double contract_size = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
   double tick_size = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   double tick_value = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double min_lot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double max_lot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double step_lot = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   string base_cur = SymbolInfoString(sym, SYMBOL_CURRENCY_BASE);
   string profit_cur = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);
   string margin_cur = SymbolInfoString(sym, SYMBOL_CURRENCY_MARGIN);
   string desc = SymbolInfoString(sym, SYMBOL_DESCRIPTION);
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"symbol\":\"%s\",\"digits\":%d,\"point\":%.6f,\"contract_size\":%.2f,\"tick_size\":%s,\"tick_value\":%.5f,\"min_lot\":%.4f,\"max_lot\":%.4f,\"step_lot\":%.4f,\"currency_base\":\"%s\",\"currency_profit\":\"%s\",\"currency_margin\":\"%s\",\"description\":\"%s\"}\n",
                              id,
                              JsonEscape(sym),
                              digits,
                              point,
                              contract_size,
                              DoubleToString(tick_size, digits),
                              tick_value,
                              min_lot,
                              max_lot,
                              step_lot,
                              JsonEscape(base_cur),
                              JsonEscape(profit_cur),
                              JsonEscape(margin_cur),
                              JsonEscape(desc));
   TransportSend(resp);
}

void HandleGetRates(const long id, const string json)
{
   string symbol = GetJsonString(json, "symbol", _Symbol);
   string tf_str = GetJsonString(json, "timeframe", "M1");
   long   from_t = GetJsonLong(json, "from", 0);
   long   to_t   = GetJsonLong(json, "to", 0);
   int    count  = (int)GetJsonLong(json, "count", 500);
   if(count > 5000) count = 5000;
   
   ENUM_TIMEFRAMES tf = PERIOD_M1;
   string tf_up = tf_str;
   StringToUpper(tf_up);
   if(tf_up == "1" || tf_up == "M1")             tf = PERIOD_M1;
   else if(tf_up == "2" || tf_up == "M2")        tf = PERIOD_M2;
   else if(tf_up == "3" || tf_up == "M3")        tf = PERIOD_M3;
   else if(tf_up == "4" || tf_up == "M4")        tf = PERIOD_M4;
   else if(tf_up == "5" || tf_up == "M5")        tf = PERIOD_M5;
   else if(tf_up == "6" || tf_up == "M6")        tf = PERIOD_M6;
   else if(tf_up == "10" || tf_up == "M10")      tf = PERIOD_M10;
   else if(tf_up == "12" || tf_up == "M12")      tf = PERIOD_M12;
   else if(tf_up == "15" || tf_up == "M15")      tf = PERIOD_M15;
   else if(tf_up == "20" || tf_up == "M20")      tf = PERIOD_M20;
   else if(tf_up == "30" || tf_up == "M30")      tf = PERIOD_M30;
   else if(tf_up == "60" || tf_up == "H1" || tf_up == "1H")   tf = PERIOD_H1;
   else if(tf_up == "120" || tf_up == "H2" || tf_up == "2H") tf = PERIOD_H2;
   else if(tf_up == "180" || tf_up == "H3" || tf_up == "3H") tf = PERIOD_H3;
   else if(tf_up == "240" || tf_up == "H4" || tf_up == "4H") tf = PERIOD_H4;
   else if(tf_up == "360" || tf_up == "H6" || tf_up == "6H") tf = PERIOD_H6;
   else if(tf_up == "480" || tf_up == "H8" || tf_up == "8H") tf = PERIOD_H8;
   else if(tf_up == "720" || tf_up == "H12" || tf_up == "12H") tf = PERIOD_H12;
   else if(tf_up == "D" || tf_up == "1D" || tf_up == "D1")    tf = PERIOD_D1;
   else if(tf_up == "W" || tf_up == "1W" || tf_up == "W1")    tf = PERIOD_W1;
   else if(tf_up == "M" || tf_up == "1M" || tf_up == "MN" || tf_up == "MN1") tf = PERIOD_MN1;
   
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int copied = 0;
   if(from_t > 0 && to_t > 0)
   {
      copied = CopyRates(symbol, tf, (datetime)from_t, (datetime)to_t, rates);
   }
   else
   {
      copied = CopyRates(symbol, tf, 0, count, rates);
   }
   
   if(copied <= 0)
   {
      string no_data = StringFormat("{\"id\":%I64d,\"success\":true,\"s\":\"no_data\",\"nextTime\":%I64d}\n", id, TimeCurrent());
      TransportSend(no_data);
      return;
   }
   
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   string t_arr = "", o_arr = "", h_arr = "", l_arr = "", c_arr = "", v_arr = "";
   for(int i = 0; i < copied; i++)
   {
      if(i > 0)
      {
         t_arr += ","; o_arr += ","; h_arr += ","; l_arr += ","; c_arr += ","; v_arr += ",";
      }
      t_arr += IntegerToString(rates[i].time);
      o_arr += DoubleToString(rates[i].open, digits);
      h_arr += DoubleToString(rates[i].high, digits);
      l_arr += DoubleToString(rates[i].low, digits);
      c_arr += DoubleToString(rates[i].close, digits);
      v_arr += IntegerToString(rates[i].tick_volume);
   }
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"s\":\"ok\",\"t\":[%s],\"o\":[%s],\"h\":[%s],\"l\":[%s],\"c\":[%s],\"v\":[%s]}\n",
                              id, t_arr, o_arr, h_arr, l_arr, c_arr, v_arr);
   TransportSend(resp);
}

void HandleGetTicks(const long id, const string json)
{
   string symbol   = GetJsonString(json, "symbol", _Symbol);
   long   from_msc = GetJsonLong(json, "from_msc", 0);
   long   to_msc   = GetJsonLong(json, "to_msc", 0);
   int    count    = (int)GetJsonLong(json, "count", 1000);
   if(count > 5000) count = 5000;
   
   MqlTick ticks[];
   int copied = 0;
   if(from_msc > 0 && to_msc > 0)
   {
      copied = CopyTicksRange(symbol, ticks, COPY_TICKS_ALL, from_msc, to_msc);
   }
   else
   {
      copied = CopyTicks(symbol, ticks, COPY_TICKS_ALL, 0, count);
   }
   
   if(copied <= 0)
   {
      string no_ticks = StringFormat("{\"id\":%I64d,\"success\":true,\"ticks\":[]}\n", id);
      TransportSend(no_ticks);
      return;
   }
   
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   string items = "";
   for(int i = 0; i < copied; i++)
   {
      string item = StringFormat("{\"time_msc\":%I64d,\"bid\":%s,\"ask\":%s,\"last\":%s,\"volume\":%.4f,\"flags\":%u}",
                                 ticks[i].time_msc,
                                 DoubleToString(ticks[i].bid, digits),
                                 DoubleToString(ticks[i].ask, digits),
                                 DoubleToString(ticks[i].last, digits),
                                 ticks[i].volume,
                                 ticks[i].flags);
      if(i > 0) items += ",";
      items += item;
   }
   
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"ticks\":[%s]}\n", id, items);
   TransportSend(resp);
}

void HandleSubscribeSymbols(const long id, const string json)
{
   string list = GetJsonString(json, "symbols", "");
   if(list != "")
   {
      string parts[];
      int num = StringSplit(list, ',', parts);
      for(int i = 0; i < num; i++)
      {
         StringTrimLeft(parts[i]);
         StringTrimRight(parts[i]);
         AddSubscribedSymbol(parts[i]);
      }
   }
   string resp = StringFormat("{\"id\":%I64d,\"success\":true,\"subscribed_count\":%d}\n", id, ArraySize(g_sub_symbols));
   TransportSend(resp);
}

//+------------------------------------------------------------------+
//| MQL5 Lifecycle Events                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==========================================================");
   Print("Initializing TradingView MT5 Ultra-Fast Bridge v2.00...");
   Print("==========================================================");
   
   m_trade.SetExpertMagicNumber(InpMagic);
   m_trade.SetDeviationInPoints(InpDefaultDev);
   m_trade.SetTypeFillingBySymbol(_Symbol);
   
   // Subscribe chart symbol and Market Watch symbols
   AddSubscribedSymbol(_Symbol);
   if(InpAutoSubscribe)
   {
      SyncMarketWatchSymbols();
   }
   
   // Connect transport (Named Pipe \\.\pipe\MT5_TV_Bridge or TCP 127.0.0.1:9001)
   TransportConnect();
   
   // Enable ultra-high frequency timer (1ms) for microsecond responsiveness
   EventSetMillisecondTimer(InpTimerMs);
   
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   TransportDisconnect();
   PrintFormat("TradingView MT5 Ultra-Fast Bridge unloaded (reason: %d)", reason);
}

void OnTick()
{
   // Stream ticks immediately when market ticks fire on attached chart
   StreamPendingTicks();
   TransportReceive();
}

void OnTimer()
{
   ulong now = GetTickCount64();
   
   // 1. Maintain connection with auto-reconnect
   if(!g_is_connected && (now - g_last_reconn > 1000))
   {
      g_last_reconn = now;
      TransportConnect();
   }
   
   // 2. Poll incoming commands from bridge with zero delay
   if(g_is_connected)
   {
      TransportReceive();
      StreamPendingTicks();
   }
}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(!g_is_connected) return;
   
   int digits = (int)SymbolInfoInteger(trans.symbol, SYMBOL_DIGITS);
   // Immediately stream trade transaction events to the bridge
   string msg = StringFormat("{\"stream\":\"trade\",\"type\":%d,\"deal\":%I64u,\"order\":%I64u,\"symbol\":\"%s\",\"price\":%s,\"volume\":%.4f,\"position\":%I64u,\"time\":%I64d}\n",
                             trans.type,
                             trans.deal,
                             trans.order,
                             JsonEscape(trans.symbol),
                             DoubleToString(trans.price, digits),
                             trans.volume,
                             trans.position,
                             TimeCurrent());
   TransportSend(msg);
}
//+------------------------------------------------------------------+
