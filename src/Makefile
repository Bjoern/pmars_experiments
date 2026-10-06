# -------------------------------
# portable makefile for pMARS
# -------------------------------

# Usage:

.DEFAULT_GOAL := all

#   make                build TARGET (graphics by default)
#   make help           list targets and settings
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

CC = gcc                # override with CC=clang, etc.
CXX = g++
#CC = cc                # if you don't have gcc

MAINFILE = pmars

# Default target for plain make. Edit here or pass TARGET=server, etc.
TARGET ?= graphics

# The compiler target also supports a user-supplied cross compiler.
TARGET_TRIPLE := $(shell $(CC) -dumpmachine)
SDL_WINDOWS := $(or $(findstring mingw,$(TARGET_TRIPLE)),$(findstring windows-gnu,$(TARGET_TRIPLE)))

# Graphics backend: edit here or pass GRAPHICS=gdi / GRAPHICS=sdl3.
# GDI: Windows only, small executable; needs GCC + make, no SDL/CMake.
# SDL3: portable display; builds the bundled SDL3 statically via CMake.
#       System libraries/frameworks remain dependencies on Unix/macOS.
# GRAPHICS avoids colliding with the X11 DISPLAY environment variable.
ifneq (,$(SDL_WINDOWS))
GRAPHICS ?= gdi
CMAKE_GENERATOR ?= MinGW Makefiles
EXEEXT = .exe
PYTHON ?= python
else
GRAPHICS ?= sdl3
CMAKE_GENERATOR ?= Unix Makefiles
EXEEXT =
PYTHON ?= python3
endif
ifneq ($(GRAPHICS),gdi)
ifneq ($(GRAPHICS),sdl3)
$(error Unsupported GRAPHICS '$(GRAPHICS)'; choose gdi or sdl3)
endif
endif
ifeq (,$(filter $(TARGET),graphics gdi sdl3 sdl default server curses xwin))
$(error Unsupported TARGET '$(TARGET)'; run make help for targets)
endif

GDI_PROGRAM ?= pmars-gdi.exe
GDI_EXTRA_CFLAGS ?= -std=c99 -fstack-protector-strong
GDI_LDFLAGS ?= -static -Wl,--dynamicbase,--nxcompat
GDI_LIBS ?= -lgdi32 -luser32
CORE_SOURCES = pmars.c asm.c eval.c disasm.c cdb.c sim.c pos.c clparse.c global.c token.c str_eng.c

# SDL3 build settings, used on Windows, Linux and macOS.
# Paths are relative to src, even when make is run in the repository root.
# No SDL installation/pkg-config is needed: CMake extracts the bundled source.
CMAKE ?= cmake
SDL_BUILD_DIR ?= ../build-sdl3
SDL_BUILD_TYPE ?= Release
SDL_DIR ?=
SDL_PROGRAM ?= pmars-sdl3$(EXEEXT)
SDL_EXTRA_CFLAGS ?= -std=c99 -fstack-protector-strong
JOBS ?= 8
# Extra CMake options, e.g. CMAKE_ARGS=-DCMAKE_OSX_ARCHITECTURES=arm64
CMAKE_ARGS ?=
SDL_CONFIGURE = "$(CMAKE)" -S .. -B "$(SDL_BUILD_DIR)" -G "$(CMAKE_GENERATOR)" -DCMAKE_MAKE_PROGRAM="$(MAKE)" -DCMAKE_C_COMPILER="$(strip $(CC))" -DCMAKE_CXX_COMPILER="$(strip $(CXX))" -DCMAKE_BUILD_TYPE="$(SDL_BUILD_TYPE)" -DPMARS_STATIC=ON -DPMARS_BUILD_EVENT_TESTS=ON -DSDL3_SOURCE_DIR="$(if $(SDL_DIR),$(abspath $(SDL_DIR)))" -DCMAKE_C_FLAGS="$(CPPFLAGS) $(CFLAGS) $(SDL_EXTRA_CFLAGS)" -DCMAKE_EXE_LINKER_FLAGS="$(LDFLAGS)" $(CMAKE_ARGS)

.PHONY: help check graphics check-graphics gdi check-gdi sdl3 check-sdl3 all curses default sdl check-sdl check-sdl-native server xwin clean

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

all: $(TARGET)

check: check-graphics

help:
	@echo "-------------------------------"
	@echo "portable makefile for pMARS"
	@echo "-------------------------------"
	@echo "Usage:"
	@echo "  make                build TARGET=$(TARGET), GRAPHICS=$(GRAPHICS)"
	@echo "  make help           show this help"
	@echo "  make TARGET=server  override the default target"
	@echo "  make GRAPHICS=sdl3  override the display backend"
	@echo "  Settings: SDL_BUILD_TYPE=Release, JOBS=8, CC, CXX, CMAKE, CMAKE_ARGS"
	@echo "  make default        default build (no display, with cdb debugger)"
	@echo "  make server         server build (disable cdb debugger)"
	@echo "  make curses         enable Curses display (UNIX)"
	@echo "  make graphics       selected GRAPHICS=$(GRAPHICS) (gdi or sdl3)"
	@echo "  make gdi            Windows GDI: small, GCC + make, no SDL"
	@echo "  make sdl3           SDL3: portable; bundled static SDL via CMake"
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

# Isolated CMake output prevents reuse of another display backend's objects.
# SDL3 is embedded on every platform; MinGW runtimes are static on Windows.
sdl:
	$(SDL_CONFIGURE)
	"$(CMAKE)" --build "$(SDL_BUILD_DIR)" --target pmars-sdl3 --parallel $(JOBS)
	"$(CMAKE)" -E copy_if_different "$(SDL_BUILD_DIR)/pmars-sdl3$(EXEEXT)" "$(SDL_PROGRAM)"

check-sdl: sdl
	"$(CMAKE)" --build "$(SDL_BUILD_DIR)" --target pmars-server pmars-sdl3-events --parallel $(JOBS)
	$(PYTHON) ../security/test_sdl3.py "$(SDL_BUILD_DIR)" $(SDL_TEST_FLAGS)

check-sdl-native: SDL_TEST_FLAGS = --native
check-sdl-native: check-sdl

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
