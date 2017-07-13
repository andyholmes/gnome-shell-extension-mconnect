# meson.build for Gnome Shell Extensions
#
# This build file can automatically setup translations, GSettings schemas,
# GResource files, populate 'metadata.json' and build/install Zip files. It
# takes some inspiration from the CommonJS Package Format [1] and Giovanni
# Campagna's gtk-js-app template [2].
#
# [1] http://wiki.commonjs.org/wiki/Packages/1.0
# [2] https://github.com/gcampax/gtk-js-app
#
# It has become common practice to use 'org.gnome.shell.extensions' as a prefix
# for the GSchema ID and so the same is applied to GResource files. This
# template includes a GSettings schema with a single boolean option, 'debug',
# for use with the logging functions 'log', 'debug' and 'assert'. These
# functions are in the 'convenience.js' module which is also included.
#
# Translations
#
# The extension source tree should look like this:
#
#   gnome-shell-extensions-<extension-id>/
#       meson.build [YOU ARE HERE]
#       LICENSE
#       README.md
#       data/
#           meson.build
#           metadata.json.in
#           org.gnome.shell.extensions.<extension-id>.gschema.xml
#           org.gnome.shell.extensions.<extension-id>.gresource.xml
#       po/
#           meson.build
#           LINGUAS
#           POTFILES
#       src/
#           meson.build
#           extension.js
#           prefs.js
#           stylesheet.css


project(
  'gnome-shell-extension-mconnect',
  'c',
  version: '1',
  meson_version: '>= 0.40.1',
)

# User Definable Variables
#------------------------------------------------------------------------------

# The display name of the extension that users will see. It may contain spaces.
Name = 'MConnect'

# A description of the extension's functionality. No default.
Description = 'MConnect integration for Gnome Shell'

# By default the extension version is set to the the project version, and
# extension versions are typically whole numbers (eg. 51 vs 5.1).
Version = meson.project_version()

# By default the extension ID is set to the project name without the prefix
ExtensionId = meson.project_name().split('gnome-shell-extension-')[1]

# The UUID is a usually a combination of the extension ID and a domain in the
# form '<extension-id>@<domain>'
#
# The UUID must contain only alphanumerical characters, the period (.), the at
# symbol (@), the underscore (_), and the dash (-). Unicode characters are not
# allowed.
#
# Your extension must not end with gnome.org. Extensions are not affiliated
# with GNOME and must not appear to be.
#
# https://wiki.gnome.org/Projects/GnomeShell/Extensions/UUIDGuidelines
UUID = ExtensionId + '@' + 'andyholmes.github.io'

# A website or repository where more information or updates may be found
URL = 'https://github.com/andyholmes/gnome-shell-extension-mconnect'

# A list of gnome-shell versions that is known to be supported. By default this
# is the version installed on the build machine.
# Shell = [ run_command('gnome-shell', '--version').split(' ')[2] ]
Shell = [ '3.24', '3.24.1', '3.24.2' ]

# A list of src files to include. The directory tree will be flattened
ext_src = files(
  # standard files
  'src/extension.js',
  'src/convenience.js',
  'src/stylesheet.css',
  'src/prefs.js',
  # non-standard files
  'src/mconnect.js',
  'src/prefs.ui',
  'src/share.js'
)


# You shouldn't need to edit anything below.
#------------------------------------------------------------------------------

# ZIP targets
run_target('make-zip', command: ['meson/zip.sh', UUID])
run_target('install-zip', command: ['meson/zip.sh', UUID, 'install'])

extdatadir = join_paths(get_option('datadir'), 'gnome-shell/extensions', UUID)

# Extension Source
install_data(
  ext_src,
  install_dir: extdatadir,
  install_mode: 'rw-r--r--'
)

# metadata.json Configuration
ext_metadata = configuration_data()
ext_metadata.set('NAME', Name)
ext_metadata.set('DESCRIPTION', Description)
ext_metadata.set('EXTENSION_ID', ExtensionId)
ext_metadata.set('UUID', UUID)
ext_metadata.set('VERSION', Version)
ext_metadata.set('URL', URL)
ext_metadata.set('SHELL_VERSION', '[ "' + '", "'.join(Shell) + '" ]')
ext_metadata.set('GSCHEMA_ID', 'org.gnome.shell.extensions.' + ExtensionId)
ext_metadata.set('GETTEXT_DOMAIN', meson.project_name())

# metadata.json, GSettings, GResources
subdir('data')

# Gettext Translations
if run_command('[', '-e', 'po/meson.build', ']').returncode() == 0
    subdir('po')
endif

