include include.mk

ACLOCAL_AMFLAGS = -I m4 ${ACLOCAL_FLAGS}

SUBDIRS = src po

if CLASSIC_MODE
SUBDIRS += data
endif


include include.mk

EXTRA_MODULES = prefs.js

dist_extension_DATA = extension.js stylesheet.css $(EXTRA_MODULES)
nodist_extension_DATA = metadata.json $(top_srcdir)/lib/convenience.js $(EXTRA_EXTENSION)

EXTRA_DIST = metadata.json.in

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed \
            -e "s|[@]extension_id@|$(extensionname)|" \
	    -e "s|[@]uuid@|$(uuid)|" \
	    -e "s|[@]gschemaname@|$(gschemaname)|" \
	    -e "s|[@]gettext_domain@|$(GETTEXT_PACKAGE)|" \
	    -e "s|[@]shell_current@|$(SHELL_VERSION)|" \
	    -e "s|[@]url@|$(extensionurl)|" \
	    $< > $@

CLEANFILES = metadata.json

zip-file: all
	-rm -fR $(builddir)/_build
	-rm -fR $(builddir)/zip-files
	mkdir $(builddir)/_build; \
	mkdir $(builddir)/zip-files; \
	$(MAKE) install DESTDIR="$(abs_builddir)/_build"; \
	cp -r "$(builddir)/_build$(extensiondir)" "$(builddir)/_build/"; \
	cp -r "$(builddir)/_build$(datadir)/locale" "$(builddir)/_build/$(uuid)"; \
	cp -p "$(srcdir)/LICENSE" -t "$(builddir)/_build/$(uuid)"; \
	if [ -f "$(builddir)/_build$(datadir)/glib-2.0/schemas/$(gschemabase).$(extensionname).gschema.xml" ]; then \
		mkdir "$(builddir)/_build/$(uuid)/schemas"; \
		cp -p "$(builddir)/_build$(datadir)/glib-2.0/schemas/$(gschemabase).$(extensionname).gschema.xml" "$(builddir)/_build/$(uuid)/schemas"; \
		glib-compile-schemas "$(builddir)/_build/$(uuid)/schemas"; \
	fi; \
	(cd "$(builddir)/_build/$(uuid)"; \
		zip -qr "$(abs_builddir)/zip-files/$(uuid).zip" .; \
	);

localprefix = $(HOME)/.local/share/gnome-shell/extensions

local-install: zip-file
	for i in $(ENABLED_EXTENSIONS); do \
	    uuid="$${i}$(extensionbase)"; \
	    zip_file="$(abs_builddir)/zip-files/$${uuid}.shell-extension.zip"; \
	    if [ -d "$(localprefix)/$${uuid}" ]; then \
		rm -fR "$(localprefix)/$${uuid}"; \
	    fi; \
	    $(MKDIR_P) $(localprefix)/$${uuid}; \
	    (cd $(localprefix)/$${uuid}; \
		unzip -q $${zip_file}; \
	    ); \
    done

install-zip: zip-file
	mkdir -p $(localextensiondir) && unzip -o $(abs_builddir)/zip-files/$(uuid).zip -d $(localextensiondir);

uninstall-zip: Makefile
	-rm -fR $(localextensiondir)
	
	
	
	
	
