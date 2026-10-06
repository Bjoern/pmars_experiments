# Run make here or in src. Configuration defaults live in src/Makefile.
# Examples: make, make sdl3, make GRAPHICS=gdi, make TARGET=server, make help
.DEFAULT_GOAL := all
TARGETS = all graphics gdi sdl sdl3 default server curses xwin help clean check check-graphics check-gdi check-sdl check-sdl3 check-sdl-native
.PHONY: $(TARGETS)
$(TARGETS):
	$(MAKE) -C src $@
