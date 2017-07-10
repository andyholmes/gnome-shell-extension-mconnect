# meson.build for GSettings and GResources
gnome = import('gnome')

# metadata.json
metadata_json = configure_file(
  input: 'metadata.json.in',
  output: 'metadata.json',
  configuration: ext_metadata
)
install_data(
  metadata_json,
  install_dir: extdatadir,
  install_mode: 'rw-r--r--'
)

# GSettings
gschema_path = ext_metadata.get('GSETTINGS_SCHEMA') + '.gschema.xml'

if run_command('[', '-e', gschema_path, ']').returncode() == 0
    install_data(
        gschema_path,
        install_dir: join_paths(get_option('datadir'), 'glib-2.0', 'schemas')
    )
    meson.add_install_script('../meson/meson_post_install.py')
endif

# GResources
gresource_path = ext_metadata.get('GSETTINGS_SCHEMA') + '.gresource.xml'

if run_command('[', '-e', gresource_path, ']').returncode() == 0
ext_resource = gnome.compile_resources(
  ext_metadata.get('GSETTINGS_SCHEMA'),
  gresource_path,
  source_dir: '.',
  gresource_bundle: true,
  install: true,
  install_dir : join_paths(extdatadir, 'data')
)
endif

