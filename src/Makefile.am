include ../include.mk

dist_extension_DATA = extension.js convenience.js logging.js mconnect.js \
						prefs.js prefs.ui stylesheet.css Sw.js
nodist_extension_DATA = metadata.json

EXTRA_DIST = metadata.json.in
CLEANFILES = metadata.json

gsettings_SCHEMAS = $(gschemaname).gschema.xml

@GSETTINGS_RULES@

CLEANFILES += $(gsettings_SCHEMAS:.xml=.valid)
EXTRA_DIST += $(gsettings_SCHEMAS)

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed \
	-e "s|[@]extension_id@|$(extension_id)|" \
	-e "s|[@]uuid@|$(uuid)|" \
	-e "s|[@]gschemaname@|$(gschemaname)|" \
	-e "s|[@]gettext_domain@|$(GETTEXT_PACKAGE)|" \
	-e "s|[@]shell_current@|$(SHELL_VERSION)|" \
	-e "s|[@]url@|$(extensionurl)|" \
	$< > $@

