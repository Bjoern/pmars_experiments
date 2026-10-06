# -------------------------------
# portable makefile for pMARS
# -------------------------------

# Usage:

.DEFAULT_GOAL := all

#   make default        default build (no display, with cdb debugger)
#   make server         server build (disable cdb debugger)
#   make curses         enable Curses display (UNIX)
#   make graphics       build the selected GRAPHICS (gdi or sdl3)
#   make gdi            native Windows GDI: small, no external libraries
#   make sdl3           SDL3: portable display, static SDL on Windows
#   make sdl            compatibility alias for sdl3
#   make check-sdl      build SDL and run its regression tests
#   make check-sdl-native  also test native Windows windows/input events
#   make xwin           enable X Windows graphics (UNIX)
#   make clean          remove all *.o (recommended when changing
#                       CFLAGS in Makefile or switching build version)

# Config options (add to CFLAGS):

#   -DRWLIMIT           enables read/write limits
#   -DSAFECOLORS        use Okabe-Ito CVD-safe palette

CFLAGS += -O2 -DEXT94 -DPERMUTATE

CC = gcc                # required for Linux
#CC = cc                # if you don't have gcc

MAINFILE = pmars

# Graphics backend for `make graphics` and `make check-graphics`.
# gdi: Windows only; smaller executable, GCC + make only, no SDL/CMake.
# sdl3: Windows/Unix/macOS; SDL3 window/input support. Windows builds SDL3
#       statically with CMake + C/C++ compilers, producing a larger standalone
#       executable. Unix/macOS uses an installed SDL3 pkg-config package.
# Edit this setting or pass GRAPHICS=sdl3 on the make command line.
# Named GRAPHICS to avoid colliding with the X11 DISPLAY environment variable.
# The historical `make default` remains the console/debugger build.
GRAPHICS ?= gdi
ifneq ($(GRAPHICS),gdi)
ifneq ($(GRAPHICS),sdl3)
$(error Unsupported GRAPHICS '$(GRAPHICS)'; choose gdi or sdl3)
endif
endif
GDI_PROGRAM ?= pmars-gdi.exe
GDI_EXTRA_CFLAGS ?= -std=c99 -fstack-protector-strong
GDI_LDFLAGS ?= -static -Wl,--dynamicbase,--nxcompat
GDI_LIBS ?= -lgdi32 -luser32
CORE_SOURCES = pmars.c asm.c eval.c disasm.c cdb.c sim.c pos.c clparse.c global.c token.c str_eng.c


# Windows: make owns the static CMake build; only tool/dependency locations
# need overrides for nonstandard installations. Unix uses pkg-config SDL3.
TARGET_TRIPLE := $(shell $(CC) -dumpmachine)
SDL_WINDOWS := $(or $(findstring mingw,$(TARGET_TRIPLE)),$(findstring windows-gnu,$(TARGET_TRIPLE)))
SDL_SOURCES = $(CORE_SOURCES) SDL_main.c
SDL_EXTRA_CFLAGS ?= -std=c99 -fstack-protector-strong
PKG_CONFIG ?= pkg-config
SDL_CFLAGS ?= $(shell $(PKG_CONFIG) --cflags sdl3)
ifneq (,$(SDL_WINDOWS))
CXX = g++
CMAKE ?= cmake
SDL_BUILD_DIR ?= ../build-sdl3
SDL_DIR ?=
JOBS ?= 8
# CMake locates the bundled SDL source/archive when SDL_DIR is empty.
SDL_CONFIGURE = "$(CMAKE)" -S .. -B "$(SDL_BUILD_DIR)" -G "MinGW Makefiles" -DCMAKE_MAKE_PROGRAM="$(MAKE)" -DCMAKE_C_COMPILER="$(strip $(CC))" -DCMAKE_CXX_COMPILER="$(CXX)" -DCMAKE_BUILD_TYPE=Release -DPMARS_STATIC=ON -DPMARS_BUILD_EVENT_TESTS=ON -DSDL3_SOURCE_DIR="$(if $(SDL_DIR),$(abspath $(SDL_DIR)))" -DCMAKE_C_FLAGS="$(CPPFLAGS) $(CFLAGS) $(SDL_EXTRA_CFLAGS)" -DCMAKE_EXE_LINKER_FLAGS="$(LDFLAGS)"
SDL_PROGRAM ?= pmars-sdl3.exe
PYTHON ?= python
else
SDL_LIBS ?= $(shell $(PKG_CONFIG) --libs sdl3)
SDL_PROGRAM ?= pmars-sdl3
SDL_LDFLAGS ?=
PYTHON ?= python3
endif

.PHONY: graphics check-graphics gdi check-gdi sdl3 check-sdl3 all curses default sdl check-sdl check-sdl-native server xwin clean

graphics: $(GRAPHICS)
check-graphics: check-$(GRAPHICS)
sdl3: sdl
check-sdl3: check-sdl

# Always compile the whole GDI variant: no objects leak between backends.
gdi:
ifneq (,$(SDL_WINDOWS))
	$(CC) $(CPPFLAGS) $(CFLAGS) $(GDI_EXTRA_CFLAGS) -DGDIGRAPHX $(CORE_SOURCES) gdidisp.c $(LDFLAGS) $(GDI_LDFLAGS) $(GDI_LIBS) -o "$(GDI_PROGRAM)"
else
	$(error GDI requires a Windows-targeting compiler; use GRAPHICS=sdl3)
endif

check-gdi: gdi
	$(PYTHON) ../security/test_gdi.py ./$(GDI_PROGRAM)
	$(PYTHON) ../security/test_096.py ./$(GDI_PROGRAM)
	$(PYTHON) -c "from pathlib import Path; Path('../security/build').mkdir(parents=True, exist_ok=True)"
	$(CC) -std=c99 -O2 -Wall -Wextra -Werror ../security/test_gdi_surface.c gdidisp.c $(GDI_LDFLAGS) $(GDI_LIBS) -o ../security/build/test-gdi-surface.exe
	$(PYTHON) -c "import subprocess; subprocess.run(['../security/build/test-gdi-surface.exe'], check=True)"

all:
	@echo "-------------------------------"
	@echo "portable makefile for pMARS"
	@echo "-------------------------------"
	@echo "Usage:"
	@echo "  make default        default build (no display, with cdb debugger)"
	@echo "  make server         server build (disable cdb debugger)"
	@echo "  make curses         enable Curses display (UNIX)"
	@echo "  make graphics       selected GRAPHICS=$(GRAPHICS) (gdi or sdl3)"
	@echo "  make gdi            Windows GDI: small, GCC + make, no SDL"
	@echo "  make sdl3           SDL3: portable; CMake/static SDL on Windows"
	@echo "  make check-graphics test the selected display"
	@echo "  make sdl            alias for sdl3"
	@echo "  make check-sdl      build SDL and run its regression tests"
	@echo "  make check-sdl-native  also test native Windows windows/input events"
	@echo "  make xwin           enable X Windows graphics (UNIX)"
	@echo "  make clean          remove all *.o (recommended when changing"
	@echo "                      CFLAGS in Makefile or switching build version)"

curses: CFLAGS += -DCURSESGRAPHX
curses: LIBS = -lncurses
curses: $(MAINFILE)

default: $(MAINFILE)

ifneq (,$(SDL_WINDOWS))
# SDL and compiler runtimes are linked statically by CMakeLists.txt.
# Isolated build output prevents reuse of another display backend's objects.
sdl:
	$(SDL_CONFIGURE)
	"$(CMAKE)" --build "$(SDL_BUILD_DIR)" --target pmars-sdl3 --parallel $(JOBS)
	"$(CMAKE)" -E copy_if_different "$(SDL_BUILD_DIR)/pmars-sdl3.exe" "$(SDL_PROGRAM)"

check-sdl: sdl
	"$(CMAKE)" --build "$(SDL_BUILD_DIR)" --target pmars-server pmars-sdl3-events --parallel $(JOBS)
	$(PYTHON) ../security/test_sdl3.py "$(SDL_BUILD_DIR)" $(SDL_TEST_FLAGS)

check-sdl-native: SDL_TEST_FLAGS = --native
check-sdl-native: check-sdl
else
# Installed SDL3 development package on Unix/macOS.
sdl:
	$(CC) $(CPPFLAGS) $(CFLAGS) $(SDL_EXTRA_CFLAGS) -DSDLGRAPHX $(SDL_CFLAGS) $(SDL_SOURCES) $(LDFLAGS) $(SDL_LDFLAGS) $(SDL_LIBS) -o $(SDL_PROGRAM)

check-sdl: sdl
	$(PYTHON) ../security/test_sdl.py ./$(SDL_PROGRAM)
	$(PYTHON) ../security/test_096.py ./$(SDL_PROGRAM)
endif

server: CFLAGS += -DSERVER
server: LIBS =
server: $(MAINFILE)

xwin: CFLAGS += -DXWINGRAPHX
xwin: LIBS = -L/usr/X11R6/lib -lX11
xwin: $(MAINFILE)

OBJ = pmars.o asm.o eval.o disasm.o cdb.o sim.o pos.o clparse.o global.o token.o str_eng.o

$(MAINFILE): $(OBJ)
	@echo Linking $@
	@$(CC) $(LDFLAGS) -o $@ $^ $(LIBS)
	@strip $@
	@echo Done

token.o asm.o disasm.o: asm.h

sim.o cdb.o pos.o disasm.o: sim.h

sim.o: curdisp.c uidisp.c sdldisp.c gdicore.c gdidisp.h xwindisp.c

sdldisp.c: pmarsicnsdl.h

xwindisp.c: xwindisp.h pmarsicn.h

$(OBJ): Makefile config.h global.h

%.o: %.c
	@echo Compiling $<
	$(CC) $(CPPFLAGS) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJ) core
