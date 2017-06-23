include ../include.mk

dist_extension_DATA = extension.js convenience.js logging.js mconnect.js \
						prefs.js prefs.ui stylesheet.css Sw.js
nodist_extension_DATA = metadata.json

EXTRA_DIST = metadata.json.in
CLEANFILES = metadata.json

gschemas_in = $(gschemaname).gschema.xml.in

gsettings_SCHEMAS = $(gschemas_in:.xml.in=.xml)

@GSETTINGS_RULES@

CLEANFILES += $(gschemas_in:.xml.in=.valid) $(gsettings_SCHEMAS)
EXTRA_DIST += $(gschemas_in)

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed \
	-e "s|[@]extension_id@|$(extension_id)|" \
	-e "s|[@]uuid@|$(uuid)|" \
	-e "s|[@]gschemaname@|$(gschemaname)|" \
	-e "s|[@]gettext_domain@|$(GETTEXT_PACKAGE)|" \
	-e "s|[@]shell_current@|$(SHELL_VERSION)|" \
	-e "s|[@]url@|$(extensionurl)|" \
	$< > $@

