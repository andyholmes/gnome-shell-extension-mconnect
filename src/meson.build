# Source Files
src = [
  # standard files
  'extension.js',
  'stylesheet.css',
  'prefs.js',
  # non-standard files
  'mconnect.js',
  'prefs.ui'
]

foreach file : src
  install_data(
    file,
    install_dir: extdatadir,
    install_mode: 'rw-r--r--'
  )
endforeach

# Gnome Shell Extension Library
if run_command('[', '-d', 'gsxl', ']').returncode() == 0
    subdir('gsxl')
endif

