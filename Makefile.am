include include.mk

ACLOCAL_AMFLAGS = -I m4 ${ACLOCAL_FLAGS}

SUBDIRS = src po

EXTRA_DIST = LICENSE README.md

zip-file: all
	-rm -fR $(builddir)/_build
	-rm -fR $(builddir)/$(uuid).zip
	$(MKDIR_P) $(builddir)/_build; \
	$(MAKE) install DESTDIR="$(abs_builddir)/_build"; \
	cp -r "$(builddir)/_build$(extensiondir)" "$(builddir)/_build/"; \
	cp -r "$(builddir)/_build$(datadir)/locale" "$(builddir)/_build/$(uuid)"; \
	cp -p "$(srcdir)/LICENSE" -t "$(builddir)/_build/$(uuid)"; \
	cp -p "$(srcdir)/README.md" -t "$(builddir)/_build/$(uuid)"; \
	$(MKDIR_P) "$(builddir)/_build/$(uuid)/schemas"; \
	cp -p "$(builddir)/_build$(datadir)/glib-2.0/schemas/$(gschema_name).gschema.xml" "$(builddir)/_build/$(uuid)/schemas"; \
	glib-compile-schemas "$(builddir)/_build/$(uuid)/schemas"; \
	(cd "$(builddir)/_build/$(uuid)"; zip -qr "$(abs_builddir)/$(uuid).zip" .; );

install-zip: zip-file
	mkdir -p $(localextensiondir) && unzip -o $(abs_builddir)/$(uuid).zip -d $(localextensiondir);

uninstall-zip: Makefile
	-rm -fR $(localextensiondir)

clean-local:
	-rm -rf _build $(uuid).zip
