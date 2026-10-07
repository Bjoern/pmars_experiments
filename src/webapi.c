/* SPDX-License-Identifier: GPL-2.0-or-later
 * One match per WebAssembly instance, retaining native pMARS globals.
 */
#include "global.h"
#include "sim.h"
#include "webapi.h"
#include <emscripten.h>
#include <string.h>
#include <assert.h>

#define API EMSCRIPTEN_KEEPALIVE
extern void init(void);
extern void pspace_init(void);
extern char *cellview(mem_struct *, char *, int);
unsigned int web_events[WEB_CAPACITY][4];
int web_count, web_phase, web_budget, web_visual;
unsigned int web_executed;
static double deadline;
static int configured, started, loaded[MAXWARRIOR];
static char inspection[128];
static int completed, web_wins[MAXWARRIOR], web_ties[MAXWARRIOR], web_losses[MAXWARRIOR];
#define TRACE_CAPACITY 512
typedef struct { int owner, address; char text[96]; } web_trace_entry;
static web_trace_entry trace_entries[TRACE_CAPACITY];
static int trace_enabled, trace_count;
void web_record_instruction(int address)
{
  if (trace_enabled) {
    web_trace_entry *entry = &trace_entries[trace_count++];
    entry->owner = W - warrior;
    entry->address = address;
    cellview(memory + address, entry->text, 1);
  }
}
void web_round_complete(void)
{
  int i;
  ++completed;
  for (i = 0; i < warriors; ++i) {
    if (!warrior[i].tasks) ++web_losses[i];
    else if (warriorsLeft == 1) ++web_wins[i];
    else ++web_ties[i];
  }
}
API void web_set_trace(int enabled) { trace_enabled = !!enabled; }
API int web_trace_ptr(void) { return (int)trace_entries; }
API int web_trace_count(void) { return trace_count; }
API int web_trace_stride(void) { return sizeof(web_trace_entry); }
API int web_completed(void) { return completed; }
API int web_outcome(int index, int outcome) {
  if (index < 0 || index >= warriors || outcome < 0 || outcome >= warriors) return 0;
  return warrior[index].score[outcome];
}

void web_event(int kind, int address, int owner, int value)
{
  if (!web_visual) return;
  /* advance reserves 64 slots before executing an instruction; initial
     load is limited to MAXWARRIOR 100-instruction warriors. Never drop events. */
  assert(web_count < WEB_CAPACITY);
  web_events[web_count][0] = kind;
  web_events[web_count][1] = address;
  web_events[web_count][2] = owner;
  web_events[web_count++][3] = value;
}

int web_should_yield(void)
{
  if ((trace_enabled && trace_count >= TRACE_CAPACITY) || web_budget <= 0 || web_count > WEB_CAPACITY - 64) return 1;
  if ((web_executed & 63) == 0 && emscripten_get_now() >= deadline) return 1;
  --web_budget;
  ++web_executed;
  return 0;
}

API int web_configure(int size, int count, int limit, int tasks, int visual, int num)
{
  char s[16], r[16], c[16], p[16], paths[MAXWARRIOR][32];
  int i, result;
  char *args[11 + MAXWARRIOR] = {"pmars", "-b", "-f", "-s", s, "-r", r, "-c", c,
                  "-p", p};
  if (num < 1 || num > MAXWARRIOR || size < num * 100 || configured || size < 800 || size > 65536 || count < 1 || count > 1000 ||
      limit < 1 || limit > 10000000 || tasks < 1 || tasks > 65536) return 2;
  configured = 1;
  web_visual = !!visual;
  snprintf(s, sizeof(s), "%d", size); snprintf(r, sizeof(r), "%d", count);
  snprintf(c, sizeof(c), "%d", limit); snprintf(p, sizeof(p), "%d", tasks);
  for (i = 0; i < num; ++i) {
    snprintf(paths[i], sizeof(paths[i]), "/warrior-%d.red", i);
    args[11 + i] = paths[i];
  }
  result = parse_param(11 + num, args);
  if (result) return result;
  init();
  return 0;
}

API int web_compile(int index)
{
  if (!configured || started || index < 0 || index >= warriors || loaded[index]) return 2;
  assemble(warrior[index].fileName, index);
  if (errorcode == 0) loaded[index] = 1;
  return errorcode;
}

/* Compiled banks transfer only between instances of this exact Wasm build.
   No raw pointers are shared between instances. */
API int web_field(int index, int field)
{
  warrior_struct *w;
  if (index < 0 || index >= warriors) return 0;
  w = warrior + index;
  switch (field) {
  case 0: return (int)w->instBank;
  case 1: return w->instLen;
  case 2: return w->offset;
  case 3: return w->pSpaceIndex;
  case 4: return w->pSpaceIDNumber;
  case 5: return sizeof(mem_struct);
  case 6: return w->tasks;
  case 7: return web_wins[index];
  case 8: return web_ties[index];
  case 9: return web_losses[index];
  case 10: return started && w->tasks ? *w->taskHead : -1;
  case 11: set_reg('W', warriors); return score(index);
  default: return 0;
  }
}
API const char *web_name(int index, int author)
{
  if (index < 0 || index >= warriors) return "";
  return author ? warrior[index].authorName : warrior[index].name;
}
API int web_import(int index, int ptr, int length, int offset, int pinState,
                   int pin, const char *name, const char *author)
{
  warrior_struct *w;
  if (!configured || started || index < 0 || index >= warriors || loaded[index] ||
      length < 1 || length > 100 || !ptr ||
      (pinState != UNSHARED && pinState != PIN_APPEARED)) return 2;
  w = warrior + index;
  w->instBank = (mem_struct *)ptr; w->instLen = length; w->offset = offset;
  w->pSpaceIndex = pinState; w->pSpaceIDNumber = pin;
  w->name = strdup(name); w->authorName = strdup(author);
  if (!w->name || !w->authorName) return MEMERR;
  loaded[index] = 1;
  return 0;
}
API int web_start(void)
{
  int i;
  if (started || !configured) return 2;
  for (i = 0; i < warriors; ++i) if (!loaded[i]) return 2;
  started = 1;
  pspace_init();
  simulator1(); /* loads first round and returns without executing */
  return 0;
}
API int web_advance(int instructions, double milliseconds)
{
  if (!started || instructions < 1 || instructions > 100000 ||
      !(milliseconds > 0 && milliseconds <= 8)) return -1;
  web_count = 0;
  trace_count = 0;
  web_executed = 0;
  web_budget = instructions;
  deadline = emscripten_get_now() + milliseconds;
  if (web_phase != 3) simulator1();
  return web_phase == 3;
}
API int web_event_ptr(void) { return (int)web_events; }
API int web_event_count(void) { return web_count; }
API int web_steps(void) { return web_executed; }
API int web_round(void) { return round_num; }
API const char *web_inspect(int address)
{
  if (!started || address < 0 || address >= coreSize) return "";
  return cellview(memory + address, inspection, 1);
}
