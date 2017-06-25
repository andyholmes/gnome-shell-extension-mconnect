include $(top_srcdir)/include.mk

dist_extension_DATA = extension.js lib.js mconnect.js prefs.js prefs.ui \
						stylesheet.css Sw.js
nodist_extension_DATA = metadata.json

gsettings_SCHEMAS = $(gschema_name).gschema.xml

EXTRA_DIST = metadata.json.in $(gsettings_SCHEMAS)
CLEANFILES = metadata.json $(gsettings_SCHEMAS:.xml=.valid)

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed \
		-e "s|[@]extension_id@|$(extension_id)|" \
		-e "s|[@]uuid@|$(uuid)|" \
		-e "s|[@]gschema_name@|$(gschema_name)|" \
		-e "s|[@]gettext_domain@|$(GETTEXT_PACKAGE)|" \
		-e "s|[@]extension_version@|$(extension_version)|" \
		-e "s|[@]shell_version@|$(shell_version)|" \
		-e "s|[@]url@|$(extensionurl)|" \
		$< > $@

@GSETTINGS_RULES@

